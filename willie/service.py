"""Internal HTTP interface for WILLIE classification and segmentation."""

from contextlib import asynccontextmanager
from io import BytesIO
import logging
import os
from pathlib import Path
from secrets import compare_digest

from fastapi import FastAPI, HTTPException, Request
from PIL import Image, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from model import WillieModel
from scripts.fetch_models import checkpoints_for

MAX_BYTES = 4 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 16_000_000


@asynccontextmanager
async def lifespan(app: FastAPI):
    directory = Path(os.environ.get("WILLIE_MODEL_DIR", ".cache/willie"))
    checkpoints = [path for path, _ in checkpoints_for(directory)]
    backbone = Path(os.environ.get("WILLIE_BACKBONE_DIR", directory / "dinov2"))
    app.state.model = WillieModel(checkpoints, backbone)
    logging.getLogger("uvicorn.error").info("WILLIE MINI pronto com %d checkpoint(s).", len(checkpoints))
    yield


app = FastAPI(title="WILLIE MINI", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/health")
def health():
    return {"ready": True}


@app.post("/classify")
async def classify(request: Request):
    token = os.environ.get("WILLIE_TOKEN")
    if token and not compare_digest(request.headers.get("authorization", ""), "Bearer " + token):
        raise HTTPException(401, "Credencial inválida")
    if request.headers.get("content-type") != "image/jpeg":
        raise HTTPException(415, "Use image/jpeg")
    image = bytearray()
    async for chunk in request.stream():
        if len(image) + len(chunk) > MAX_BYTES:
            raise HTTPException(413, "Imagem excede 4 MB")
        image.extend(chunk)
    try:
        with Image.open(BytesIO(image), formats=["JPEG"]) as photo:
            if min(photo.size) < 64 or max(photo.size) > 4096:
                raise HTTPException(400, "Resolução de imagem inválida")
            predicted = await run_in_threadpool(request.app.state.model.predict, photo)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise HTTPException(400, "Imagem inválida") from error
    return predicted
