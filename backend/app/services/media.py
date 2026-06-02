from __future__ import annotations

import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

MAX_KEYFRAMES = 8
# Scene-change pruning: keep frames whose visual difference from the previous
# frame exceeds this (0..1). Higher = only big cuts. 0.3 captures meaningful
# step transitions without firing on minor motion.
SCENE_THRESHOLD = 0.3
# If scene detection yields fewer than this, the clip is low-motion (e.g. a
# static overhead cooking shot) and we fall back to even time-sampling.
MIN_SCENE_FRAMES = 3


def _evenly_subsample(items: list, k: int) -> list:
    """Pick at most *k* items spread evenly across the list (endpoints included)."""
    n = len(items)
    if n <= k:
        return items
    # Evenly spaced indices from 0..n-1 inclusive.
    return [items[round(i * (n - 1) / (k - 1))] for i in range(k)]


class MediaError(Exception):
    """Raised when an ffmpeg operation fails."""


def _run_ffmpeg(args: list[str]) -> None:
    result = subprocess.run(
        ["ffmpeg", *args],
        capture_output=True,
        timeout=120,
    )
    if result.returncode != 0:
        stderr = result.stderr.decode(errors="replace")
        raise MediaError(f"ffmpeg failed (rc={result.returncode}): {stderr[:500]}")


def extract_audio(video_path: Path, output_dir: Path) -> Path:
    """Extract audio from *video_path* as mono 16 kHz mp3 (optimal for Whisper)."""
    audio_path = output_dir / "audio.mp3"
    _run_ffmpeg([
        "-i", str(video_path),
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-q:a", "4",
        str(audio_path),
        "-y",
    ])
    logger.info("Extracted audio to %s (%.1f KB)", audio_path, audio_path.stat().st_size / 1e3)
    return audio_path


def _get_duration(video_path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(video_path),
        ],
        capture_output=True,
        timeout=30,
    )
    try:
        return float(result.stdout.decode().strip())
    except ValueError:
        return 60.0  # fallback assumption


def _extract_even_keyframes(video_path: Path, frames_dir: Path, duration: float) -> list[Path]:
    """Sample up to MAX_KEYFRAMES evenly-spaced frames (time-based)."""
    interval = max(duration / MAX_KEYFRAMES, 1.0)
    _run_ffmpeg([
        "-i", str(video_path),
        "-vf", f"fps=1/{interval:.2f},scale=512:-2",
        "-q:v", "3",
        str(frames_dir / "frame_%03d.jpg"),
        "-y",
    ])
    return sorted(frames_dir.glob("frame_*.jpg"))[:MAX_KEYFRAMES]


def extract_keyframes(video_path: Path, output_dir: Path) -> list[Path]:
    """Select up to MAX_KEYFRAMES representative JPEG frames from the video.

    Prefers *scene-change* frames so near-identical frames don't waste vision
    tokens (a 512px frame at detail:low is cheap, but redundant frames add no
    signal). Low-motion clips that yield too few scene cuts fall back to even
    time-sampling. Frames are low-res (512px) for the structure vision pass; use
    :func:`extract_thumbnail` for the recipe cover image instead.
    """
    frames_dir = output_dir / "frames"
    frames_dir.mkdir(exist_ok=True)

    duration = _get_duration(video_path)

    # First pass: scene-change detection. `-vsync vfr` keeps only the selected
    # frames (no CFR duplication); cap the work, then subsample evenly.
    try:
        _run_ffmpeg([
            "-i", str(video_path),
            "-vf", f"select='gt(scene,{SCENE_THRESHOLD})',scale=512:-2",
            "-vsync", "vfr",
            "-frames:v", str(MAX_KEYFRAMES * 5),
            "-q:v", "3",
            str(frames_dir / "scene_%03d.jpg"),
            "-y",
        ])
        scene_frames = sorted(frames_dir.glob("scene_*.jpg"))
    except MediaError:
        logger.warning("Scene-change extraction failed; falling back to even sampling", exc_info=True)
        scene_frames = []

    if len(scene_frames) >= MIN_SCENE_FRAMES:
        selected = _evenly_subsample(scene_frames, MAX_KEYFRAMES)
        logger.info(
            "Selected %d scene-change keyframes (from %d detected) over %.1fs",
            len(selected), len(scene_frames), duration,
        )
        return selected

    # Fallback: low-motion clip — even time-sampling.
    frames = _extract_even_keyframes(video_path, frames_dir, duration)
    logger.info("Extracted %d evenly-spaced keyframes from %.1fs video", len(frames), duration)
    return frames


def extract_thumbnail(video_path: Path, output_dir: Path) -> Path:
    """Extract a single high-quality cover image from the video.

    Strategy:
    - Skip the first 15 % of the video (intro / logos / blank frames)
    - Within the next ~70 % of the timeline, ask ffmpeg's ``thumbnail``
      filter to score frames in 100-frame batches and pick the one most
      representative (greatest histogram distance from the running mean —
      this avoids motion blur, fades, and dim transitions).
    - Output at 1080 px wide, JPEG quality 2 (mjpeg scale: 1=best, 31=worst).
    """
    thumb_path = output_dir / "thumbnail.jpg"
    duration = _get_duration(video_path)

    # Sample from the middle 70% of the video.
    start = max(duration * 0.15, 0.5)
    sample_window = max(duration * 0.70, 1.0)

    _run_ffmpeg([
        "-ss", f"{start:.2f}",
        "-t", f"{sample_window:.2f}",
        "-i", str(video_path),
        "-vf", "thumbnail=n=100,scale=1080:-2",
        "-frames:v", "1",
        "-q:v", "2",
        str(thumb_path),
        "-y",
    ])

    if not thumb_path.exists():
        # Fallback: just grab a frame at 30% in.
        _run_ffmpeg([
            "-ss", f"{duration * 0.30:.2f}",
            "-i", str(video_path),
            "-vf", "scale=1080:-2",
            "-frames:v", "1",
            "-q:v", "2",
            str(thumb_path),
            "-y",
        ])

    logger.info(
        "Extracted thumbnail to %s (%.1f KB)",
        thumb_path,
        thumb_path.stat().st_size / 1e3,
    )
    return thumb_path
