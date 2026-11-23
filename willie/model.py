"""Run the classification and segmentation heads from the official MINI checkpoint."""

from base64 import b64encode
from io import BytesIO
import os
from pathlib import Path
from threading import Lock

import numpy as np
from PIL import Image, ImageFilter, ImageOps
import torch
from torch import nn

from third_party.mini_architecture import (
    ClassificationDecoder,
    DINOv2MultiScale,
    FeaturePyramidNeck,
    ModelConfig,
    SegmentationDecoder,
    WA_CSA_Stack,
)

# Index order from the published MINI training notebook.
CLASSES = ("diabetic", "no_wound", "pressure", "surgical", "venous")
MEAN = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
STD = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)


class WillieMini(nn.Module):
    def __init__(self, cfg: ModelConfig, backbone: nn.Module):
        super().__init__()
        self.encoder = DINOv2MultiScale(cfg, backbone)
        self.fpn = FeaturePyramidNeck(cfg)
        self.wa_csa = WA_CSA_Stack(cfg)
        self.cls_decoder = ClassificationDecoder(cfg)
        self.seg_decoder = SegmentationDecoder(cfg)

    def forward(self, image):
        features = self.wa_csa(self.fpn(self.encoder(image)))
        logits, embedding = self.cls_decoder(features)
        mask = self.seg_decoder(features, embedding, image.shape[-2:])
        return logits, mask


def encode_mask(binary_mask):
    if not binary_mask.any():
        return None
    mask = Image.fromarray(binary_mask.astype(np.uint8) * 255)
    fill = mask.point(lambda pixel: 64 if pixel else 0)
    interior = mask.filter(ImageFilter.MinFilter(5))
    alpha = Image.composite(fill, mask, interior)
    overlay = Image.new('RGBA', mask.size, (24, 213, 166, 0))
    overlay.putalpha(alpha)
    buffer = BytesIO()
    overlay.save(buffer, format='PNG')
    return b64encode(buffer.getvalue()).decode('ascii')


class WillieModel:
    def __init__(self, checkpoint: Path, backbone_dir: Path):
        torch.set_num_threads(int(os.environ.get("WILLIE_THREADS", 4)))
        self.device = torch.device(os.environ.get("WILLIE_DEVICE", "cpu"))
        safe_types = [
            np._core.multiarray.scalar, np.dtype,
            *(type(np.dtype(name)) for name in ("float64", "float32", "int64")),
        ]
        with torch.serialization.safe_globals(safe_types):
            payload = torch.load(checkpoint, map_location="cpu", weights_only=True, mmap=True)

        cfg = ModelConfig(**payload["config"])
        if cfg.name != "MINI" or cfg.num_classes != len(CLASSES):
            raise ValueError("O checkpoint precisa ser da arquitetura WILLIE MINI de cinco classes.")
        backbone = torch.hub.load(str(backbone_dir), cfg.backbone_name, source="local", pretrained=False)
        model = WillieMini(cfg, backbone)
        allowed_keys = set(model.state_dict())
        weights = {k: v for k, v in payload["model_state_dict"].items() if k in allowed_keys}
        model.load_state_dict(weights, strict=True)
        self.model = model.to(self.device).eval()
        self.input_size = (cfg.img_size, cfg.img_size)
        # The upstream encoder keeps intermediate features in hooks on the model instance.
        self.lock = Lock()

    def predict(self, image: Image.Image) -> dict:
        rgb = ImageOps.exif_transpose(image).convert("RGB").resize(self.input_size, Image.Resampling.BILINEAR)
        array = np.array(rgb, dtype=np.float32) / 255.0
        normalized = (torch.from_numpy(array).permute(2, 0, 1) - MEAN) / STD
        with self.lock, torch.inference_mode():
            scores, mask = self.model(normalized.unsqueeze(0).to(self.device))
            predicted = CLASSES[scores.argmax(dim=1).item()]
            binary_mask = (mask[0, 0] > 0).cpu().numpy()
        return {"class": predicted, "mask": encode_mask(binary_mask) if predicted != "no_wound" else None}
