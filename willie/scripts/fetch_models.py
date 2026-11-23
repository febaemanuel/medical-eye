"""Download pinned public model artifacts and validate their integrity."""

import hashlib
import os
from pathlib import Path
import shutil
import tarfile
import tempfile
from urllib.request import urlopen

CHECKPOINT_REVISION = "2065b069cf9d407cbd1471b0b27cfc2bfc314d64"
CHECKPOINT = "willie_mini_fold0_best.pt"
CHECKPOINT_SHA256 = "db573a2db55910381bfc4a3f9998696a50b24e6efbf568b1d4a975154b9577d0"
BACKBONE_REVISION = "7764ea0f912e53c92e82eb78a2a1631e92725fc8"


def digest(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def download(url, destination):
    with urlopen(url, timeout=90) as source, destination.open("wb") as target:
        shutil.copyfileobj(source, target)


def main():
    model_dir = Path(os.environ.get("WILLIE_MODEL_DIR", ".cache/willie"))
    model_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=model_dir) as directory:
        temp = Path(directory)
        checkpoint = model_dir / CHECKPOINT
        if not checkpoint.exists() or digest(checkpoint) != CHECKPOINT_SHA256:
            print("Baixando os pesos oficiais do WILLIE MINI…", flush=True)
            download(f"https://huggingface.co/QianGroup/willie-weights/resolve/{CHECKPOINT_REVISION}/mini/{CHECKPOINT}", temp / CHECKPOINT)
            if digest(temp / CHECKPOINT) != CHECKPOINT_SHA256:
                raise RuntimeError("O SHA-256 do checkpoint não corresponde ao publicado no projeto.")
            (temp / CHECKPOINT).replace(checkpoint)
        backbone = model_dir / "dinov2"
        if not (backbone / "hubconf.py").exists():
            print("Baixando o código fixado do DINOv2…", flush=True)
            archive = temp / "dinov2.tar.gz"
            download(f"https://codeload.github.com/facebookresearch/dinov2/tar.gz/{BACKBONE_REVISION}", archive)
            with tarfile.open(archive, "r:gz") as source:
                source.extractall(temp, filter="data")
            (temp / f"dinov2-{BACKBONE_REVISION}").replace(backbone)


if __name__ == "__main__":
    main()
