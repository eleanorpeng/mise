from __future__ import annotations

import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

MAX_KEYFRAMES = 8


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


def extract_keyframes(video_path: Path, output_dir: Path) -> list[Path]:
    """Sample up to MAX_KEYFRAMES evenly-spaced JPEG frames from the video.

    These are intentionally low-res (512px) — they're fed to GPT-4o for
    vision analysis where small images keep token usage manageable. Use
    :func:`extract_thumbnail` for the recipe cover image instead.
    """
    frames_dir = output_dir / "frames"
    frames_dir.mkdir(exist_ok=True)

    duration = _get_duration(video_path)
    interval = max(duration / MAX_KEYFRAMES, 1.0)

    _run_ffmpeg([
        "-i", str(video_path),
        "-vf", f"fps=1/{interval:.2f},scale=512:-2",
        "-q:v", "3",
        str(frames_dir / "frame_%03d.jpg"),
        "-y",
    ])

    frames = sorted(frames_dir.glob("frame_*.jpg"))[:MAX_KEYFRAMES]
    logger.info("Extracted %d keyframes from %.1fs video", len(frames), duration)
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
