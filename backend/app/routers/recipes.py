import logging
import secrets

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.auth import get_current_user
from app.database import supabase, maybe_single
from app.schemas import row_to_camel

logger = logging.getLogger(__name__)

router = APIRouter()


_COVER_BUCKET = "thumbnails"
_COVER_EXT_BY_MIME = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
}
_MAX_COVER_BYTES = 8 * 1024 * 1024  # 8 MB


def assemble_recipe(recipe_id: str, user_id: str) -> dict:
    """Fetch a recipe and its related rows, returning a unified camelCase dict."""

    row = maybe_single(
        supabase.table("recipes")
        .select("*")
        .eq("id", recipe_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not row:
        raise HTTPException(404, "Recipe not found")
    recipe = row_to_camel(row)

    # Ingredients
    ing_res = (
        supabase.table("ingredients")
        .select("*")
        .eq("recipe_id", recipe_id)
        .order("order_index")
        .execute()
    )
    recipe["ingredients"] = [row_to_camel(r) for r in ing_res.data]

    # Steps (with technique joined)
    steps_res = (
        supabase.table("steps")
        .select("*, techniques(*)")
        .eq("recipe_id", recipe_id)
        .order("order_index")
        .execute()
    )
    steps = []
    for row in steps_res.data:
        tech_data = row.pop("techniques", None)
        step = row_to_camel(row)
        step.pop("techniqueId", None)
        step.pop("recipeId", None)
        if tech_data:
            step["technique"] = row_to_camel(tech_data)
        else:
            step["technique"] = None
        steps.append(step)
    recipe["steps"] = steps

    # Macros (take latest for current servings)
    macros_res = (
        supabase.table("macros")
        .select("*")
        .eq("recipe_id", recipe_id)
        .order("computed_at", desc=True)
        .limit(1)
        .execute()
    )
    if macros_res.data:
        m = row_to_camel(macros_res.data[0])
        recipe["macros"] = m
    else:
        recipe["macros"] = None

    return recipe


def _recipe_summary(row: dict) -> dict:
    """Convert a recipe DB row to a summary (no ingredients/steps)."""
    r = row_to_camel(row)
    r["ingredients"] = []
    r["steps"] = []
    r["macros"] = None
    return r


@router.get("/")
async def list_recipes(user_id: str = Depends(get_current_user)):
    res = (
        supabase.table("recipes")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [_recipe_summary(r) for r in res.data]


@router.get("/{recipe_id}")
async def get_recipe(recipe_id: str, user_id: str = Depends(get_current_user)):
    return assemble_recipe(recipe_id, user_id)


@router.post("/", status_code=201)
async def create_recipe(data: dict, user_id: str = Depends(get_current_user)):
    row = {
        "user_id": user_id,
        "title": data.get("title", "Untitled"),
        "description": data.get("description"),
        "source_type": data.get("sourceType", "manual"),
        "cuisine": data.get("cuisine"),
        "servings": data.get("servings", 2),
        "duration_minutes": data.get("durationMinutes"),
        "status": "ready",
    }
    res = supabase.table("recipes").insert(row).execute()
    recipe_id = res.data[0]["id"]

    ingredients = data.get("ingredients", [])
    if ingredients:
        ing_rows = [
            {
                "recipe_id": recipe_id,
                "name": ing["name"],
                "quantity": ing.get("quantity"),
                "unit": ing.get("unit"),
                "notes": ing.get("notes"),
                "order_index": i,
            }
            for i, ing in enumerate(ingredients)
        ]
        supabase.table("ingredients").insert(ing_rows).execute()

    return assemble_recipe(recipe_id, user_id)


@router.delete("/{recipe_id}", status_code=204)
async def delete_recipe(recipe_id: str, user_id: str = Depends(get_current_user)):
    supabase.table("recipes").delete().eq("id", recipe_id).eq("user_id", user_id).execute()


def _check_recipe_ownership(recipe_id: str, user_id: str) -> dict:
    row = maybe_single(
        supabase.table("recipes")
        .select("id, cover_image_url")
        .eq("id", recipe_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not row:
        raise HTTPException(404, "Recipe not found")
    return row


def _cover_path_from_url(url: str | None) -> str | None:
    """Pull the storage path back out of a public Supabase URL, if it lives in
    our cover bucket. Returns None for foreign URLs (e.g. legacy yt thumbnails)
    so we don't try to delete what we don't own."""
    if not url:
        return None
    marker = f"/storage/v1/object/public/{_COVER_BUCKET}/"
    idx = url.find(marker)
    if idx < 0:
        return None
    return url[idx + len(marker):].split("?", 1)[0]


@router.post("/{recipe_id}/cover")
async def upload_cover(
    recipe_id: str,
    image: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    existing = _check_recipe_ownership(recipe_id, user_id)

    mime = (image.content_type or "image/jpeg").lower()
    ext = _COVER_EXT_BY_MIME.get(mime)
    if not ext:
        raise HTTPException(400, "Unsupported image type")

    body = await image.read()
    if not body:
        raise HTTPException(400, "Empty upload")
    if len(body) > _MAX_COVER_BYTES:
        raise HTTPException(413, "Image is too large (max 8 MB)")

    # Random suffix forces a fresh public URL so the client doesn't show a
    # stale cached image after a re-upload.
    storage_path = f"{recipe_id}-{secrets.token_hex(4)}.{ext}"
    try:
        supabase.storage.from_(_COVER_BUCKET).upload(
            storage_path, body, file_options={"content-type": mime},
        )
    except Exception:
        logger.exception("Cover upload failed for %s", recipe_id)
        raise HTTPException(502, "Could not save the cover image")

    public_url = supabase.storage.from_(_COVER_BUCKET).get_public_url(storage_path)
    supabase.table("recipes").update({"cover_image_url": public_url}).eq("id", recipe_id).execute()

    # Best-effort delete of the previous cover if it was one of ours.
    prev_path = _cover_path_from_url(existing.get("cover_image_url"))
    if prev_path and prev_path != storage_path:
        try:
            supabase.storage.from_(_COVER_BUCKET).remove([prev_path])
        except Exception:
            logger.warning("Could not remove old cover %s", prev_path, exc_info=True)

    return assemble_recipe(recipe_id, user_id)


@router.delete("/{recipe_id}/cover")
async def remove_cover(recipe_id: str, user_id: str = Depends(get_current_user)):
    existing = _check_recipe_ownership(recipe_id, user_id)
    supabase.table("recipes").update({"cover_image_url": None}).eq("id", recipe_id).execute()
    prev_path = _cover_path_from_url(existing.get("cover_image_url"))
    if prev_path:
        try:
            supabase.storage.from_(_COVER_BUCKET).remove([prev_path])
        except Exception:
            logger.warning("Could not remove cover %s", prev_path, exc_info=True)
    return assemble_recipe(recipe_id, user_id)
