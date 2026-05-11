from __future__ import annotations

import asyncio
import logging
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

from app.schemas import RecipeExtraction
from app.services.downloader import download_video
from app.services.media import extract_audio, extract_keyframes, extract_thumbnail
from app.services.transcription import transcribe_audio
from app.services.recipe_builder import build_recipe

logger = logging.getLogger(__name__)


@dataclass
class PipelineResult:
    extraction: RecipeExtraction
    source_url: str
    thumbnail_path: Path | None
    work_dir: Path


async def process_video_url(url: str, fast: bool = False) -> PipelineResult:
    """Full pipeline: download -> extract media -> transcribe -> build recipe.

    Steps are pipelined for latency:
    - The audio→Whisper chain runs concurrently with keyframe+thumbnail extraction.
    - GPT-4o is only called once both branches finish (it needs both signals).

    If *fast* is True, recipe extraction uses gpt-4o-mini (~3× faster) at a
    small cost in ingredient/technique nuance.
    """
    work_dir = Path(tempfile.mkdtemp(prefix="mise_"))
    t_start = time.perf_counter()

    # 1. Download the video.
    logger.info("Downloading video from %s", url)
    video_path = await asyncio.to_thread(download_video, url, work_dir)
    t_dl = time.perf_counter()

    # 2. Run two concurrent branches:
    #    a. audio extract → Whisper transcription (chained, both are fast)
    #    b. keyframes + thumbnail (parallel, both ffmpeg passes on the same video)
    async def _audio_branch() -> str:
        audio_path = await asyncio.to_thread(extract_audio, video_path, work_dir)
        return await transcribe_audio(audio_path)

    async def _visual_branch() -> tuple[list[Path], Path]:
        keyframes, thumbnail = await asyncio.gather(
            asyncio.to_thread(extract_keyframes, video_path, work_dir),
            asyncio.to_thread(extract_thumbnail, video_path, work_dir),
        )
        return keyframes, thumbnail

    transcript, (keyframe_paths, thumbnail_path) = await asyncio.gather(
        _audio_branch(),
        _visual_branch(),
    )
    t_media = time.perf_counter()

    # 3. Synthesize the structured recipe.
    logger.info("Building recipe with GPT-4o (fast=%s)", fast)
    extraction = await build_recipe(transcript, keyframe_paths, fast=fast)
    t_synth = time.perf_counter()

    logger.info(
        "Pipeline complete: '%s' (%d steps) — download=%.1fs media+whisper=%.1fs synth=%.1fs total=%.1fs",
        extraction.title,
        len(extraction.steps),
        t_dl - t_start,
        t_media - t_dl,
        t_synth - t_media,
        t_synth - t_start,
    )

    return PipelineResult(
        extraction=extraction,
        source_url=url,
        thumbnail_path=thumbnail_path if thumbnail_path.exists() else None,
        work_dir=work_dir,
    )
