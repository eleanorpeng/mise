from __future__ import annotations

import logging
from pathlib import Path

from app.llm import transcribe_client, transcribe_model

logger = logging.getLogger(__name__)


async def transcribe_audio(audio_path: Path) -> str:
    """Transcribe *audio_path* and return the transcript text."""
    client = transcribe_client()

    with open(audio_path, "rb") as f:
        response = await client.audio.transcriptions.create(
            model=transcribe_model(),
            file=f,
            response_format="text",
        )

    transcript = response.strip() if isinstance(response, str) else response.text.strip()
    logger.info("Transcribed %d characters from %s", len(transcript), audio_path.name)
    return transcript
