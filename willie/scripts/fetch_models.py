"""Download pinned public model artifacts and validate their integrity."""

import hashlib
import os
from pathlib import Path
import shutil
import tarfile
import tempfile
from urllib.request import urlopen

CHECKPOINT_REVISION = "2065b069cf9d407cbd1471b0b27cfc2bfc314d64"
CHECKPOINT_HASHES = (
    "db573a2db55910381bfc4a3f9998696a50b24e6efbf568b1d4a975154b9577d0",
    "001d3731b92284b3d90496d0c0311553a6901e7bbceb3739f8bfb40f1bd418cc",
    "7a0426fed9faa859dd2d723238db447cc6a64c8bbd6ee951c43ec2c89107984e",
    "a8c33753a22a7c9bbfa90f565eeefadc09e18f4833170da8b7ad5c64c16da823",
    "1f5b2f6bac6636d57b8f12a221da714c5715b4ac14e60a5664d941dbd6e6fe7a",
)
BACKBONE_REVISION = "7764ea0f912e53c92e82eb78a2a1631e92725fc8"


def checkpoints_for(model_dir):
    custom = os.environ.get("WILLIE_CHECKPOINT")
    if custom:
        return [(Path(custom), None)]
    setting = os.environ.get("WILLIE_FOLDS", "5")
    if setting not in {"1", "3", "5"}:
        raise ValueError("WILLIE_FOLDS precisa ser 1, 3 ou 5.")
    return [
        (model_dir / f"willie_mini_fold{fold}_best.pt", expected)
        for fold, expected in enumerate(CHECKPOINT_HASHES[:int(setting)])
    ]


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
        for checkpoint, expected in checkpoints_for(model_dir):
            if expected is None:
                if not checkpoint.is_file():
                    raise FileNotFoundError("O arquivo indicado por WILLIE_CHECKPOINT não foi encontrado.")
                continue
            if checkpoint.is_file() and digest(checkpoint) == expected:
                continue
            print(f"Baixando pesos oficiais do WILLIE MINI: {checkpoint.name}", flush=True)
            url = f"https://huggingface.co/QianGroup/willie-weights/resolve/{CHECKPOINT_REVISION}/mini/{checkpoint.name}"
            downloaded = temp / checkpoint.name
            download(url, downloaded)
            if digest(downloaded) != expected:
                raise RuntimeError(f"O SHA-256 do checkpoint {checkpoint.name} não corresponde ao publicado.")
            downloaded.replace(checkpoint)
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
