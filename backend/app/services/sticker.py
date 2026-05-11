from __future__ import annotations

import io
import logging
from functools import lru_cache
from typing import TYPE_CHECKING

from PIL import Image

if TYPE_CHECKING:
    from rembg.session_base import BaseSession

logger = logging.getLogger(__name__)

_MAX_DIMENSION = 1600
_STICKER_MAX_DIMENSION = 1024


class StickerError(RuntimeError):
    """Raised when sticker generation fails."""


@lru_cache(maxsize=1)
def _session() -> "BaseSession":
    """Lazily build a single rembg session backed by the lightweight u2netp model.

    u2netp is ~5 MB (vs ~170 MB for u2net) and is fast enough on CPU for the
    1-image-at-a-time workload we have here. Cached so the model only loads once.
    """
    from rembg import new_session  # local import: heavy + downloads model

    logger.info("Initialising rembg session (u2netp)")
    return new_session(model_name="u2netp")


def normalize_original(image_bytes: bytes) -> bytes:
    """Return JPEG bytes scaled to <= _MAX_DIMENSION on the long edge.

    We strip alpha channels here so the original is small enough to store cheaply
    while still looking sharp. EXIF rotations are baked in.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img = _apply_exif_rotation(img)
    except Exception as exc:  # noqa: BLE001
        raise StickerError(f"Could not read image: {exc}") from exc

    if img.mode in ("RGBA", "LA", "P"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[-1] if img.mode != "P" else None)
        img = background
    elif img.mode != "RGB":
        img = img.convert("RGB")

    img = _resize_within(img, _MAX_DIMENSION)

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=88, optimize=True)
    return out.getvalue()


def cut_out(image_bytes: bytes) -> bytes:
    """Run background removal on the input image and return PNG bytes (with alpha).

    The output is cropped to the visible sticker region and resized so its long
    edge is at most ``_STICKER_MAX_DIMENSION``. Raises ``StickerError`` on failure.
    """
    from rembg import remove  # local import: heavy

    try:
        cut_bytes = remove(image_bytes, session=_session())
    except Exception as exc:  # noqa: BLE001
        raise StickerError(f"Background removal failed: {exc}") from exc

    try:
        img = Image.open(io.BytesIO(cut_bytes))
        if img.mode != "RGBA":
            img = img.convert("RGBA")

        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)

        img = _resize_within(img, _STICKER_MAX_DIMENSION)

        out = io.BytesIO()
        img.save(out, format="PNG", optimize=True)
        return out.getvalue()
    except Exception as exc:  # noqa: BLE001
        raise StickerError(f"Could not finalize sticker: {exc}") from exc


def _resize_within(img: Image.Image, max_dimension: int) -> Image.Image:
    width, height = img.size
    longest = max(width, height)
    if longest <= max_dimension:
        return img
    scale = max_dimension / longest
    new_size = (int(width * scale), int(height * scale))
    return img.resize(new_size, Image.LANCZOS)


def _apply_exif_rotation(img: Image.Image) -> Image.Image:
    try:
        from PIL import ImageOps

        return ImageOps.exif_transpose(img)
    except Exception:  # noqa: BLE001
        return img
