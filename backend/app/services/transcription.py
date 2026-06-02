from __future__ import annotations

import base64
import io
import logging
import re
import subprocess
import tempfile
from pathlib import Path

from app.llm import transcribe_client, transcribe_model, transcribe_via_openrouter

logger = logging.getLogger(__name__)

# OpenRouter's audio chat input accepts mp3/wav; other containers (m4a/mp4) are
# rejected with "Failed to load audio file", so we transcode those to mp3 first.
_OPENROUTER_AUDIO_FORMATS = {"mp3", "wav"}

# Chat models occasionally wrap the transcript in a preamble or quotes despite
# instructions; strip the common shapes so the recipe builder gets clean text.
_PREAMBLE_RE = re.compile(r"^\s*(here(?:'s| is)[^:]*:|transcription:|transcript:)\s*", re.IGNORECASE)

_TRANSCRIBE_INSTRUCTION = (
    "Transcribe this audio. Respond with ONLY the verbatim transcript text — "
    "no preamble, no quotes, no commentary."
)


def _ffmpeg_to_wav(audio_bytes: bytes, src_ext: str) -> bytes:
    """Transcode arbitrary audio bytes to mono 16 kHz 16-bit WAV via ffmpeg.

    WAV/PCM is chosen over mp3 because PCM encoding is built into every ffmpeg
    build (no libmp3lame dependency — some server builds lack it, which fails
    the mp3 muxer). Uses temp files rather than stdin pipes because m4a/mp4 (mov
    containers) aren't reliably readable from a non-seekable pipe.
    """
    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / f"in.{src_ext or 'bin'}"
        dst = Path(td) / "out.wav"
        src.write_bytes(audio_bytes)
        proc = subprocess.run(
            [
                "ffmpeg", "-i", str(src),
                "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
                str(dst), "-y",
            ],
            capture_output=True,
            timeout=120,
        )
        if proc.returncode != 0 or not dst.exists():
            raise RuntimeError(
                f"ffmpeg audio conversion failed (rc={proc.returncode}): "
                f"{proc.stderr.decode(errors='replace')[-400:]}"
            )
        return dst.read_bytes()


def clean_transcript(text: str) -> str:
    """Strip a leading preamble and wrapping quotes from a model transcript."""
    t = (text or "").strip()
    t = _PREAMBLE_RE.sub("", t).strip()
    if len(t) >= 2 and t[0] in "\"'" and t[-1] == t[0]:
        t = t[1:-1].strip()
    return t


async def transcribe_bytes(audio_bytes: bytes, fmt: str = "mp3") -> str:
    """Transcribe raw audio bytes. Routes to OpenRouter (audio sent inline via
    chat completions) when configured, else OpenAI Whisper (multipart upload).

    *fmt* is the source container/extension (e.g. "mp3", "m4a"). For OpenRouter,
    anything other than mp3/wav is transcoded to mp3 first.
    """
    client = transcribe_client()
    model = transcribe_model()
    fmt = (fmt or "mp3").lower().lstrip(".")

    if transcribe_via_openrouter():
        if fmt not in _OPENROUTER_AUDIO_FORMATS:
            audio_bytes = _ffmpeg_to_wav(audio_bytes, fmt)
            fmt = "wav"
        b64 = base64.b64encode(audio_bytes).decode()
        response = await client.chat.completions.create(
            model=model,
            temperature=0,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": _TRANSCRIBE_INSTRUCTION},
                        {"type": "input_audio", "input_audio": {"data": b64, "format": fmt}},
                    ],
                }
            ],
        )
        transcript = clean_transcript(response.choices[0].message.content or "")
    else:
        # OpenAI Whisper — multipart file upload.
        buf = io.BytesIO(audio_bytes)
        buf.name = f"audio.{fmt}"
        result = await client.audio.transcriptions.create(
            model=model, file=buf, response_format="text",
        )
        transcript = (result if isinstance(result, str) else result.text).strip()

    logger.info("Transcribed %d characters via %s", len(transcript), model)
    return transcript


async def transcribe_audio(audio_path: Path) -> str:
    """Transcribe an audio file (video import — produces mono 16 kHz mp3)."""
    return await transcribe_bytes(audio_path.read_bytes(), audio_path.suffix.lstrip("."))
