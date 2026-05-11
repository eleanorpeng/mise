from __future__ import annotations

import logging
import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.auth import get_current_user
from app.database import supabase, maybe_single
from app.schemas import row_to_camel
from app.services.sticker import StickerError, cut_out, normalize_original

logger = logging.getLogger(__name__)

router = APIRouter()

_BUCKET = "cook-logs"
_MAX_UPLOAD_BYTES = 15 * 1024 * 1024  # 15 MB hard cap


def _public_url(path: str) -> str:
    return supabase.storage.from_(_BUCKET).get_public_url(path)


def _row_to_log(row: dict) -> dict:
    out = row_to_camel(row)
    original_path = row.get("original_path")
    sticker_path = row.get("sticker_path")
    out["originalUrl"] = _public_url(original_path) if original_path else None
    out["stickerUrl"] = _public_url(sticker_path) if sticker_path else None
    out.pop("originalPath", None)
    out.pop("stickerPath", None)
    out.pop("userId", None)
    return out


def _parse_month(month: str) -> tuple[date, date]:
    """``YYYY-MM`` -> (first_of_month, first_of_next_month). Raises 400 on bad input."""
    try:
        first = datetime.strptime(month, "%Y-%m").date()
    except ValueError as exc:
        raise HTTPException(400, "month must be in YYYY-MM format") from exc

    if first.month == 12:
        next_first = first.replace(year=first.year + 1, month=1)
    else:
        next_first = first.replace(month=first.month + 1)
    return first, next_first


def _parse_date(value: str | None) -> str:
    if not value:
        return date.today().isoformat()
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as exc:
        raise HTTPException(400, "cookedDate must be ISO-8601 (YYYY-MM-DD)") from exc


@router.get("/")
async def list_cook_logs(
    month: str | None = None,
    user_id: str = Depends(get_current_user),
):
    query = (
        supabase.table("cook_logs")
        .select("*")
        .eq("user_id", user_id)
        .order("cooked_date", desc=True)
    )

    if month:
        first, next_first = _parse_month(month)
        query = query.gte("cooked_date", first.isoformat()).lt(
            "cooked_date", next_first.isoformat()
        )

    res = query.execute()
    return [_row_to_log(r) for r in (res.data or [])]


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_cook_log(
    image: UploadFile = File(...),
    cookedDate: Optional[str] = Form(None),
    recipeId: Optional[str] = Form(None),
    caption: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user),
):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(400, "Uploaded file must be an image")

    raw = await image.read()
    if not raw:
        raise HTTPException(400, "Empty upload")
    if len(raw) > _MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Image too large")

    cooked_iso = _parse_date(cookedDate)

    if recipeId:
        owns = maybe_single(
            supabase.table("recipes")
            .select("id")
            .eq("id", recipeId)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if not owns:
            raise HTTPException(404, "Recipe not found")

    try:
        original_jpeg = normalize_original(raw)
        sticker_png = cut_out(original_jpeg)
    except StickerError as exc:
        logger.warning("Sticker pipeline failed for user %s: %s", user_id, exc)
        raise HTTPException(422, str(exc)) from exc

    asset_id = uuid.uuid4().hex
    original_path = f"{user_id}/{asset_id}.jpg"
    sticker_path = f"{user_id}/{asset_id}.png"

    try:
        supabase.storage.from_(_BUCKET).upload(
            original_path,
            original_jpeg,
            file_options={"content-type": "image/jpeg", "upsert": "true"},
        )
        supabase.storage.from_(_BUCKET).upload(
            sticker_path,
            sticker_png,
            file_options={"content-type": "image/png", "upsert": "true"},
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Storage upload failed")
        raise HTTPException(502, "Could not store images") from exc

    row = {
        "user_id": user_id,
        "recipe_id": recipeId,
        "cooked_date": cooked_iso,
        "caption": (caption or "").strip() or None,
        "original_path": original_path,
        "sticker_path": sticker_path,
    }

    try:
        res = supabase.table("cook_logs").insert(row).execute()
    except Exception as exc:  # noqa: BLE001
        # Best-effort cleanup of just-uploaded files so we don't leak orphans.
        for path in (original_path, sticker_path):
            try:
                supabase.storage.from_(_BUCKET).remove([path])
            except Exception:  # noqa: BLE001
                pass
        logger.exception("Insert cook_log row failed")
        raise HTTPException(500, "Could not save cook log") from exc

    if not res.data:
        raise HTTPException(500, "Could not save cook log")

    return _row_to_log(res.data[0])


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cook_log(
    log_id: str,
    user_id: str = Depends(get_current_user),
):
    row = maybe_single(
        supabase.table("cook_logs")
        .select("*")
        .eq("id", log_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not row:
        raise HTTPException(404, "Cook log not found")

    paths = [p for p in (row.get("original_path"), row.get("sticker_path")) if p]
    if paths:
        try:
            supabase.storage.from_(_BUCKET).remove(paths)
        except Exception:  # noqa: BLE001
            logger.warning("Failed to remove storage files for cook_log %s", log_id, exc_info=True)

    supabase.table("cook_logs").delete().eq("id", log_id).execute()
