from __future__ import annotations

import asyncio
import logging
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path

from app.schemas import RecipeExtraction
from app.services.cache import TTLCache
from app.services.downloader import download_video
from app.services.media import extract_audio, extract_keyframes, extract_thumbnail
from app.services.transcription import transcribe_audio
from app.services.recipe_builder import build_structure

logger = logging.getLogger(__name__)

# Cache the fully-enriched extraction (structure + techniques) by URL. Re-importing
# the same video — the common case in demos and test runs — then skips
# download, transcription, and both synthesis passes entirely. Keyed on the URL,
# not per-user: the recipe is re-persisted fresh for whoever imports it (see
# _persist_recipe), so sharing the extraction across users is safe. 24h TTL.
_extraction_cache: TTLCache[RecipeExtraction] = TTLCache(ttl_seconds=24 * 3600)


def _cache_key(url: str) -> str:
    return url.strip()


def get_cached_extraction(url: str) -> RecipeExtraction | None:
    """Return a previously-enriched extraction for this URL, or None."""
    return _extraction_cache.get(_cache_key(url))


def cache_extraction(url: str, extraction: RecipeExtraction) -> None:
    """Store the fully-enriched extraction for this URL (called once techniques
    have been merged in, so cache hits serve complete recipes)."""
    _extraction_cache.set(_cache_key(url), extraction)


@dataclass
class PipelineResult:
    extraction: RecipeExtraction
    source_url: str
    thumbnail_path: Path | None
    work_dir: Path


async def process_structure(url: str) -> PipelineResult:
    """Stage A+B: download -> extract media -> transcribe -> build *structure*.

    Steps are pipelined for latency:
    - The audio→Whisper chain runs concurrently with keyframe+thumbnail extraction.
    - Structure synthesis runs once both branches finish (it needs both signals).

    Returns the structural recipe only — technique annotations are added
    separately (see recipe_builder.enrich_techniques) so the caller can return
    the structure to the client immediately and enrich in the background.
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

    # 3. Synthesize the structural recipe (fast vision model; no techniques yet).
    logger.info("Building recipe structure")
    extraction = await build_structure(transcript, keyframe_paths)
    t_synth = time.perf_counter()

    logger.info(
        "Structure complete: '%s' (%d steps) — download=%.1fs media+whisper=%.1fs structure=%.1fs total=%.1fs",
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
