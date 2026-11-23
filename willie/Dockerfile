FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 WILLIE_MODEL_DIR=/models HF_HUB_DISABLE_TELEMETRY=1
WORKDIR /service
COPY requirements.txt ./
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu "torch==2.7.1+cpu" \
    && pip install --no-cache-dir -r requirements.txt \
    && groupadd --gid 10001 classifier \
    && useradd --uid 10001 --gid classifier --no-create-home classifier \
    && mkdir -p /models \
    && chown classifier:classifier /models
COPY --chown=classifier:classifier . .
USER classifier
EXPOSE 8765
CMD ["sh", "-c", "python scripts/fetch_models.py && exec uvicorn service:app --host 0.0.0.0 --port 8765 --no-access-log"]
