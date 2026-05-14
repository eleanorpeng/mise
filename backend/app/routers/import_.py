import logging
import shutil

from fastapi import APIRouter, Depends, HTTPException, Request
from openai import OpenAIError
from pydantic import BaseModel

from app.auth import get_current_user
from app.database import supabase
from app.rate_limit import limiter
from app.schemas import ExtractedTechnique, RecipeExtraction, row_to_camel
from app.services.downloader import DownloadError
from app.services.media import MediaError
from app.services.video_pipeline import process_video_url

logger = logging.getLogger(__name__)

router = APIRouter()


class UrlImportRequest(BaseModel):
    url: str
    fast: bool = False


class PhotoImportRequest(BaseModel):
    image: str  # base64


def _update_job_status(job_id: str, status: str, **extra) -> None:
    supabase.table("import_jobs").update({"status": status, **extra}).eq("id", job_id).execute()


def _upload_thumbnail(filepath, recipe_id: str) -> str | None:
    try:
        storage_path = f"{recipe_id}.jpg"
        with open(filepath, "rb") as f:
            supabase.storage.from_("thumbnails").upload(
                storage_path, f, file_options={"content-type": "image/jpeg"},
            )
        return supabase.storage.from_("thumbnails").get_public_url(storage_path)
    except Exception:
        logger.warning("Thumbnail upload failed for %s", recipe_id, exc_info=True)
        return None


def _persist_recipe(
    user_id: str,
    extraction: RecipeExtraction,
    source_url: str,
    cover_url: str | None,
) -> dict:
    """Insert recipe + ingredients + steps + techniques + macros, then return
    a fully-assembled camelCase recipe dict.

    Persistence is batched — at most 5 round trips to Supabase regardless of
    how many ingredients/steps/techniques the recipe has.
    """

    # 1. Insert the recipe row.
    recipe_row = {
        "user_id": user_id,
        "title": extraction.title,
        "description": extraction.description,
        "source_url": source_url,
        "source_type": "video",
        "cover_image_url": cover_url,
        "cuisine": extraction.cuisine,
        "difficulty": extraction.difficulty,
        "servings": extraction.servings,
        "duration_minutes": extraction.duration_minutes,
        "status": "ready",
        "imported_at": "now()",
    }
    res = supabase.table("recipes").insert(recipe_row).execute()
    recipe = res.data[0]
    recipe_id = recipe["id"]

    # 2. Batch-upsert all unique techniques in one round trip.
    #    Multiple steps may share a technique name; dedupe before sending.
    unique_techniques: dict[str, ExtractedTechnique] = {}
    for step in extraction.steps:
        if step.technique:
            unique_techniques[step.technique.name] = step.technique

    technique_id_by_name: dict[str, str] = {}
    technique_rows: list[dict] = []
    if unique_techniques:
        tech_payload = [
            {
                "name": t.name,
                "explanation": t.explanation,
                "category": t.category,
            }
            for t in unique_techniques.values()
        ]
        tech_res = (
            supabase.table("techniques")
            .upsert(tech_payload, on_conflict="name")
            .execute()
        )
        technique_rows = tech_res.data or []
        technique_id_by_name = {t["name"]: t["id"] for t in technique_rows}

    # 3. Batch-insert ingredients (single round trip).
    ingredient_rows: list[dict] = []
    if extraction.ingredients:
        ing_payload = [
            {
                "recipe_id": recipe_id,
                "name": ing.name,
                "quantity": ing.quantity,
                "unit": ing.unit,
                "notes": ing.notes,
                "order_index": i,
            }
            for i, ing in enumerate(extraction.ingredients)
        ]
        ing_res = supabase.table("ingredients").insert(ing_payload).execute()
        ingredient_rows = ing_res.data or []

    # 4. Batch-insert all steps (single round trip), with technique_id resolved.
    step_payload = [
        {
            "recipe_id": recipe_id,
            "order_index": i,
            "instruction": step.instruction,
            "duration_seconds": step.duration_seconds,
            "technique_id": (
                technique_id_by_name.get(step.technique.name)
                if step.technique
                else None
            ),
        }
        for i, step in enumerate(extraction.steps)
    ]
    step_rows: list[dict] = []
    if step_payload:
        step_res = supabase.table("steps").insert(step_payload).execute()
        step_rows = step_res.data or []

    # 5. Macros (single round trip, optional).
    macros_row: dict | None = None
    if extraction.macros:
        macro_payload = {
            "recipe_id": recipe_id,
            "servings": extraction.servings,
            "calories": extraction.macros.calories,
            "protein_g": extraction.macros.protein_g,
            "carbs_g": extraction.macros.carbs_g,
            "fat_g": extraction.macros.fat_g,
            "fiber_g": extraction.macros.fiber_g,
        }
        macros_res = supabase.table("macros").insert(macro_payload).execute()
        macros_row = (macros_res.data or [None])[0]

    # Build the camelCase response in-memory rather than re-querying.
    return _assemble_in_memory(
        recipe_row=recipe,
        ingredient_rows=ingredient_rows,
        step_rows=step_rows,
        technique_rows=technique_rows,
        macros_row=macros_row,
    )


def _assemble_in_memory(
    recipe_row: dict,
    ingredient_rows: list[dict],
    step_rows: list[dict],
    technique_rows: list[dict],
    macros_row: dict | None,
) -> dict:
    """Construct the same camelCase response shape as ``assemble_recipe`` from
    the rows we already have, without making any extra DB calls."""
    recipe = row_to_camel(recipe_row)

    # Sort by order_index defensively — Supabase preserves insert order, but
    # we don't want to depend on it for correctness.
    ingredient_rows = sorted(ingredient_rows, key=lambda r: r.get("order_index", 0))
    recipe["ingredients"] = [row_to_camel(r) for r in ingredient_rows]

    techniques_by_id = {t["id"]: t for t in technique_rows}
    step_rows = sorted(step_rows, key=lambda r: r.get("order_index", 0))
    steps: list[dict] = []
    for row in step_rows:
        tech_id = row.get("technique_id")
        step = row_to_camel({k: v for k, v in row.items() if k != "technique_id"})
        step.pop("recipeId", None)
        if tech_id and tech_id in techniques_by_id:
            step["technique"] = row_to_camel(techniques_by_id[tech_id])
        else:
            step["technique"] = None
        steps.append(step)
    recipe["steps"] = steps

    recipe["macros"] = row_to_camel(macros_row) if macros_row else None
    return recipe


@router.post("/url", status_code=201)
@limiter.limit("10/minute")
async def import_from_url(
    request: Request,
    body: UrlImportRequest,
    user_id: str = Depends(get_current_user),
):
    url = body.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    # Create import job (frontend can subscribe via Realtime)
    job_res = supabase.table("import_jobs").insert({
        "user_id": user_id,
        "source_url": url,
        "source_type": "video",
        "status": "queued",
    }).execute()
    job_id = job_res.data[0]["id"]

    work_dir = None
    try:
        _update_job_status(job_id, "downloading")
        result = await process_video_url(url, fast=body.fast)
        work_dir = result.work_dir

        _update_job_status(job_id, "synthesising")

        # Upload thumbnail
        cover_url = None
        if result.thumbnail_path and result.thumbnail_path.exists():
            cover_url = _upload_thumbnail(result.thumbnail_path, job_id)

        # Persist to normalized tables and assemble the response in-memory.
        full_recipe = _persist_recipe(user_id, result.extraction, url, cover_url)

        _update_job_status(job_id, "done", recipe_id=full_recipe["id"])
        return full_recipe

    except DownloadError as exc:
        _update_job_status(job_id, "failed", error_message=str(exc))
        raise HTTPException(status_code=422, detail=f"Could not download video: {exc}")
    except MediaError as exc:
        _update_job_status(job_id, "failed", error_message=str(exc))
        raise HTTPException(status_code=422, detail=f"Could not process video: {exc}")
    except OpenAIError as exc:
        _update_job_status(job_id, "failed", error_message=str(exc))
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable")
    except HTTPException:
        raise
    except Exception as exc:
        _update_job_status(job_id, "failed", error_message=str(exc))
        logger.exception("Unexpected error processing %s", url)
        raise HTTPException(status_code=500, detail="An unexpected error occurred")
    finally:
        if work_dir and work_dir.exists():
            shutil.rmtree(work_dir, ignore_errors=True)


@router.post("/photo", status_code=201)
@limiter.limit("10/minute")
async def import_from_photo(
    request: Request,
    body: PhotoImportRequest,
    user_id: str = Depends(get_current_user),
):
    # TODO: call services/photo_pipeline.py
    return {}
