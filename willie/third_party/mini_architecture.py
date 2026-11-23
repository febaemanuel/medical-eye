"""WILLIE MINI classification and segmentation layers adapted from the authors' MIT-licensed notebook.

Source: Qian-Group-HRI/Willie, 06_WILLIE_MINI.ipynb,
revision 221f2e7ef470810422436c12730834c82e9bdc8f.
See LICENSE.willie.txt.
"""
from dataclasses import dataclass, field
from typing import List

import torch
import torch.nn as nn
import torch.nn.functional as F


@dataclass
class ModelConfig:
    name: str = "MINI"
    backbone_name: str = "dinov2_vits14"
    backbone_dim: int = 384
    backbone_layers: List[int] = field(default_factory=lambda: [2, 5, 8, 11])
    img_size: int = 518           # DINOv2 native: 518 = 37×14
    patch_size: int = 14
    fpn_dim: int = 256
    fpn_levels: int = 4
    wa_csa_layers: int = 1
    wa_csa_heads: int = 8
    wa_csa_dropout: float = 0.1
    num_classes: int = 5
    num_experts: int = 2
    top_k_experts: int = 2
    cls_embed_dim: int = 128      # WTCS bridge dim
    seg_out_channels: int = 1
    pscse_reduction: int = 16
    det_max_objects: int = 20
    freeze_backbone_epochs: int = 3

    @property
    def grid_size(self) -> int:
        return self.img_size // self.patch_size


class DINOv2MultiScale(nn.Module):
    """Shared DINOv2 backbone with hooks at layers [2,5,8,11]."""

    def __init__(self, cfg: ModelConfig, backbone: nn.Module):
        super().__init__()
        self.cfg = cfg
        self.features = {}
        self.backbone = backbone
        self._hook_handles = []
        for idx in cfg.backbone_layers:
            h = self.backbone.blocks[idx].register_forward_hook(self._make_hook(idx))
            self._hook_handles.append(h)
        self.set_frozen(True)

    def _make_hook(self, idx):
        def hook(mod, inp, out):
            tokens = out[:, 1:, :]
            grid = self.cfg.grid_size
            self.features[idx] = tokens.transpose(1, 2).unflatten(-1, (grid, grid))
        return hook

    def set_frozen(self, frozen):
        for p in self.backbone.parameters():
            p.requires_grad = not frozen

    def forward(self, x):
        self.features.clear()
        if x.shape[-1] != self.cfg.img_size:
            x = F.interpolate(x, size=self.cfg.img_size, mode="bilinear", align_corners=False)
        self.backbone(x)
        return [self.features[idx] for idx in self.cfg.backbone_layers]


# ──────────────────────────────────────────────────────────────────────────────
# 4. FEATURE PYRAMID NECK
# ──────────────────────────────────────────────────────────────────────────────
class FeaturePyramidNeck(nn.Module):
    def __init__(self, cfg: ModelConfig):
        super().__init__()
        D, F = cfg.backbone_dim, cfg.fpn_dim
        self.laterals = nn.ModuleList([
            nn.Sequential(nn.Conv2d(D, F, 1, bias=False), nn.GroupNorm(32, F), nn.GELU())
            for _ in range(cfg.fpn_levels)
        ])
        self.smooth = nn.ModuleList([
            nn.Sequential(nn.Conv2d(F, F, 3, padding=1, bias=False), nn.GroupNorm(32, F), nn.GELU())
            for _ in range(cfg.fpn_levels)
        ])

    def forward(self, features):
        lats = [self.laterals[i](features[i]) for i in range(len(features))]
        pyr = [None] * len(features)
        pyr[-1] = lats[-1]
        for i in range(len(features) - 2, -1, -1):
            up = F.interpolate(pyr[i+1], size=lats[i].shape[-2:], mode="bilinear", align_corners=False)
            pyr[i] = lats[i] + up
        return [self.smooth[i](pyr[i]) for i in range(len(features))]


# ──────────────────────────────────────────────────────────────────────────────
# 5. WOUND-AWARE CROSS-SCALE ATTENTION (WA-CSA)
# ──────────────────────────────────────────────────────────────────────────────
class WoundAwareCrossScaleAttention(nn.Module):
    """Bidirectional cross-attention + wound gate + tanh alpha residual."""

    def __init__(self, cfg: ModelConfig, level_idx: int = 0):
        super().__init__()
        dim = cfg.fpn_dim
        self.heads = cfg.wa_csa_heads
        self.head_dim = dim // self.heads
        self.scale = self.head_dim ** -0.5
        self.use_sdpa = (level_idx > 0)
        self.dropout_p = cfg.wa_csa_dropout

        self.q_f = nn.Linear(dim, dim, bias=False)
        self.k_c = nn.Linear(dim, dim, bias=False)
        self.v_c = nn.Linear(dim, dim, bias=False)
        self.q_c = nn.Linear(dim, dim, bias=False)
        self.k_f = nn.Linear(dim, dim, bias=False)
        self.v_f = nn.Linear(dim, dim, bias=False)
        self.out_f = nn.Linear(dim, dim, bias=False)
        self.out_c = nn.Linear(dim, dim, bias=False)

        self.gate_f = nn.Sequential(nn.Conv2d(dim, dim//4, 1), nn.GELU(), nn.Conv2d(dim//4, 1, 1), nn.Sigmoid())
        self.gate_c = nn.Sequential(nn.Conv2d(dim, dim//4, 1), nn.GELU(), nn.Conv2d(dim//4, 1, 1), nn.Sigmoid())

        self.alpha_f = nn.Parameter(torch.zeros(1))
        self.alpha_c = nn.Parameter(torch.zeros(1))
        self.norm_f = nn.LayerNorm(dim)
        self.norm_c = nn.LayerNorm(dim)
        self.drop = nn.Dropout(cfg.wa_csa_dropout)

    def _attn(self, q, k, v):
        q = q.unflatten(-1, (self.heads, -1)).transpose(1, 2)
        k = k.unflatten(-1, (self.heads, -1)).transpose(1, 2)
        v = v.unflatten(-1, (self.heads, -1)).transpose(1, 2)
        if self.use_sdpa and hasattr(F, 'scaled_dot_product_attention'):
            out = F.scaled_dot_product_attention(q, k, v, dropout_p=self.dropout_p if self.training else 0.0)
        else:
            a = (q @ k.transpose(-2, -1)) * self.scale
            out = self.drop(a.softmax(-1)) @ v
        return out.transpose(1, 2).flatten(2)

    def forward(self, fine, coarse):
        f_seq = self.norm_f(fine.flatten(2).transpose(1, 2))
        c_seq = self.norm_c(coarse.flatten(2).transpose(1, 2))

        fine_attended = self._attn(self.q_f(f_seq), self.k_c(c_seq), self.v_c(c_seq))
        coarse_attended = self._attn(self.q_c(c_seq), self.k_f(f_seq), self.v_f(f_seq))
        f_up = self.out_f(fine_attended).transpose(1, 2).reshape_as(fine)
        c_up = self.out_c(coarse_attended).transpose(1, 2).reshape_as(coarse)

        return (fine + torch.tanh(self.alpha_f) * f_up * self.gate_f(fine),
                coarse + torch.tanh(self.alpha_c) * c_up * self.gate_c(coarse))


class WA_CSA_Stack(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        pairs = cfg.fpn_levels - 1
        self.layers = nn.ModuleList([
            nn.ModuleList([WoundAwareCrossScaleAttention(cfg, p) for p in range(pairs)])
            for _ in range(cfg.wa_csa_layers)
        ])

    def forward(self, pyr):
        for layer in self.layers:
            p = list(pyr)
            for i, wa in enumerate(layer):
                p[i], p[i+1] = wa(p[i], p[i+1])
            pyr = p
        return pyr


# ──────────────────────────────────────────────────────────────────────────────
# 6. CLASSIFICATION DECODER (MoE)
# ──────────────────────────────────────────────────────────────────────────────
class Expert(nn.Module):
    def __init__(self, d_in, d_hid, d_out):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d_in, d_hid), nn.GELU(), nn.Dropout(0.1), nn.Linear(d_hid, d_out))
    def forward(self, x): return self.net(x)

class TopKRouter(nn.Module):
    def __init__(self, d_in, n_exp, top_k=2):
        super().__init__()
        self.n_exp, self.top_k = n_exp, top_k
        self.gate = nn.Linear(d_in, n_exp, bias=False)
        self.aux_loss = 0.0
    def forward(self, x):
        probs = F.softmax(self.gate(x), -1)
        w, idx = torch.topk(probs, self.top_k, -1)
        w = w / w.sum(-1, keepdim=True)
        self.aux_loss = F.mse_loss(probs.mean(0), torch.ones(self.n_exp, device=x.device) / self.n_exp)
        return w, idx

class ClassificationDecoder(nn.Module):
    """Multi-scale pool → MoE → logits + wound_embed (WTCS bridge)."""
    def __init__(self, cfg):
        super().__init__()
        F = cfg.fpn_dim
        self.cfg = cfg
        self.pools = nn.ModuleList([nn.Sequential(nn.AdaptiveAvgPool2d(1), nn.Flatten(1)) for _ in range(cfg.fpn_levels)])
        self.scale_attn = nn.Sequential(nn.Linear(cfg.fpn_levels, cfg.fpn_levels), nn.Softmax(-1))
        self.pre = nn.Sequential(nn.Linear(F, F), nn.LayerNorm(F), nn.GELU())
        self.experts = nn.ModuleList([Expert(F, F*2, cfg.num_classes) for _ in range(cfg.num_experts)])
        self.router = TopKRouter(F, cfg.num_experts, cfg.top_k_experts)
        self.embed_head = nn.Sequential(nn.Linear(F, cfg.cls_embed_dim), nn.LayerNorm(cfg.cls_embed_dim), nn.GELU())

    def forward(self, pyr):
        B = pyr[0].shape[0]
        pooled = torch.stack([self.pools[i](pyr[i]) for i in range(self.cfg.fpn_levels)], 1)
        sw = self.scale_attn(torch.ones(B, self.cfg.fpn_levels, device=pooled.device))
        fused = self.pre((pooled * sw.unsqueeze(-1)).sum(1))
        w, idx = self.router(fused)
        logits = torch.zeros(B, self.cfg.num_classes, device=fused.device)
        for k in range(self.cfg.top_k_experts):
            for e in range(self.cfg.num_experts):
                mask = (idx[:, k] == e)
                if mask.any():
                    logits[mask] += w[mask, k:k+1] * self.experts[e](fused[mask])
        return logits, self.embed_head(fused)


class ChannelSE(nn.Module):
    def __init__(self, ch, r=16):
        super().__init__()
        mid = max(ch // r, 4)
        self.fc = nn.Sequential(nn.AdaptiveAvgPool2d(1), nn.Flatten(1),
                                nn.Linear(ch, mid, bias=False), nn.ReLU(True),
                                nn.Linear(mid, ch, bias=False), nn.Sigmoid())
    def forward(self, x):
        return x * self.fc(x).view(x.shape[0], -1, 1, 1)

class SpatialSE(nn.Module):
    def __init__(self, ch):
        super().__init__()
        self.conv = nn.Conv2d(ch, 1, 1, bias=False)
    def forward(self, x):
        return x * torch.sigmoid(self.conv(x))

class ParallelScSE(nn.Module):
    """Full: additive(cSE+sSE) + maxout(cSE,sSE). Shortened: additive only."""
    def __init__(self, ch, r=16, shortened=False):
        super().__init__()
        self.shortened = shortened
        self.cse_a, self.sse_a = ChannelSE(ch, r), SpatialSE(ch)
        if not shortened:
            self.cse_m, self.sse_m = ChannelSE(ch, r), SpatialSE(ch)
    def forward(self, x):
        add = self.cse_a(x) + self.sse_a(x)
        if self.shortened:
            return add
        return add + torch.max(self.cse_m(x), self.sse_m(x))


# 8. FiLM CONDITIONER (WTCS bridge)
class FiLMConditioner(nn.Module):
    def __init__(self, embed_dim, feat_dim):
        super().__init__()
        self.gamma = nn.Sequential(nn.Linear(embed_dim, feat_dim), nn.Sigmoid())
        self.beta = nn.Linear(embed_dim, feat_dim)
    def forward(self, feat, embed):
        g = self.gamma(embed).unsqueeze(-1).unsqueeze(-1) + 1.0
        b = self.beta(embed).unsqueeze(-1).unsqueeze(-1)
        return g * feat + b


# 9. SEGMENTATION DECODER (P-scSE + FiLM/WTCS)
#    FUSegNet arrangement: Conv-BN-ReLU → P-scSE (middle) → Conv-BN-ReLU
class PscSEDecoderStage(nn.Module):
    """Conv → P-scSE (middle) → Conv. Top stage uses shortened P-scSE."""
    def __init__(self, in_ch, out_ch, r=16, shortened=False):
        super().__init__()
        self.conv1 = nn.Sequential(nn.Conv2d(in_ch, out_ch, 3, padding=1, bias=False), nn.BatchNorm2d(out_ch), nn.ReLU(True))
        self.pscse = ParallelScSE(out_ch, r, shortened)
        self.conv2 = nn.Sequential(nn.Conv2d(out_ch, out_ch, 3, padding=1, bias=False), nn.BatchNorm2d(out_ch), nn.ReLU(True))
    def forward(self, x):
        return self.conv2(self.pscse(self.conv1(x)))

class SegmentationDecoder(nn.Module):
    """Progressive decode P4→P1 with FiLM + P-scSE at each stage."""
    def __init__(self, cfg):
        super().__init__()
        self.cfg = cfg
        F = cfg.fpn_dim
        self.films = nn.ModuleList([FiLMConditioner(cfg.cls_embed_dim, F) for _ in range(cfg.fpn_levels)])
        self.stages = nn.ModuleList([
            PscSEDecoderStage(F*2, F, cfg.pscse_reduction, shortened=(i == cfg.fpn_levels - 2))
            for i in range(cfg.fpn_levels - 1)
        ])
        self.head = nn.Sequential(
            nn.Conv2d(F, F//2, 3, padding=1, bias=False), nn.BatchNorm2d(F//2), nn.ReLU(True),
            nn.Conv2d(F//2, F//4, 3, padding=1, bias=False), nn.BatchNorm2d(F//4), nn.ReLU(True),
            nn.Conv2d(F//4, cfg.seg_out_channels, 1),
        )

    def forward(self, pyr, wound_embed, target_size=None):
        if target_size is None: target_size = self.cfg.img_size
        cond = [self.films[i](pyr[i], wound_embed) for i in range(self.cfg.fpn_levels)]
        x = cond[-1]
        for s in range(self.cfg.fpn_levels - 1):
            skip = cond[self.cfg.fpn_levels - 2 - s]
            x = F.interpolate(x, size=skip.shape[-2:], mode="bilinear", align_corners=False)
            x = self.stages[s](torch.cat([x, skip], 1))
        x = F.interpolate(x, size=target_size, mode="bilinear", align_corners=False)
        return self.head(x)
