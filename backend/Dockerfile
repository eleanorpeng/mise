FROM python:3.12-slim

# ffmpeg: required by yt-dlp (video import) and audio extraction for Whisper.
# libgl/libglib: required by rembg/onnxruntime + Pillow image ops.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# App Platform provides $PORT (defaults to 8080). Bind to it.
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
