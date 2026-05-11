from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.database import supabase, maybe_single
from app.schemas import row_to_camel

router = APIRouter()


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
