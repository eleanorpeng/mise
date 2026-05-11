from __future__ import annotations

import logging
from pathlib import Path

import yt_dlp

logger = logging.getLogger(__name__)

MAX_DURATION_SEC = 600  # 10 minutes


class DownloadError(Exception):
    """Raised when the video cannot be downloaded."""


def download_video(url: str, output_dir: Path) -> Path:
    """Download a video from *url* into *output_dir* and return the path to the .mp4 file.

    Supports TikTok, Instagram Reels, and YouTube Shorts.
    Raises ``DownloadError`` on failure.
    """
    output_template = str(output_dir / "video.%(ext)s")

    ydl_opts: dict = {
        "format": "mp4/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "outtmpl": output_template,
        "merge_output_format": "mp4",
        "quiet": True,
        "no_warnings": True,
        "match_filter": yt_dlp.utils.match_filter_func(f"duration <= {MAX_DURATION_SEC}"),
        "socket_timeout": 30,
        "retries": 3,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if info is None:
                raise DownloadError("yt-dlp returned no info for this URL")
    except yt_dlp.utils.DownloadError as exc:
        raise DownloadError(str(exc)) from exc

    video_path = output_dir / f"video.mp4"
    if not video_path.exists():
        candidates = list(output_dir.glob("video.*"))
        if not candidates:
            raise DownloadError("Download succeeded but no video file was written")
        video_path = candidates[0]

    logger.info("Downloaded video to %s (%.1f MB)", video_path, video_path.stat().st_size / 1e6)
    return video_path
