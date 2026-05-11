from __future__ import annotations

import logging
from pathlib import Path

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)


async def transcribe_audio(audio_path: Path) -> str:
    """Send *audio_path* to the Whisper API and return the transcript text."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    with open(audio_path, "rb") as f:
        response = await client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            response_format="text",
        )

    transcript = response.strip() if isinstance(response, str) else response.text.strip()
    logger.info("Transcribed %d characters from %s", len(transcript), audio_path.name)
    return transcript
