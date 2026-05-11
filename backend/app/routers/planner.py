from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.database import supabase, maybe_single
from app.schemas import (
    GroceryItemCreate,
    GroceryItemUpdate,
    PlannedMealCreate,
    PlannedMealUpdate,
    row_to_camel,
)


def _verify_meal_owner(entry_id: str, user_id: str) -> str:
    meal = maybe_single(
        supabase.table("planned_meals")
        .select("plan_id")
        .eq("id", entry_id)
        .maybe_single()
        .execute()
    )
    if not meal:
        raise HTTPException(404, "Entry not found")
    plan_id = meal["plan_id"]
    plan = maybe_single(
        supabase.table("meal_plans")
        .select("user_id")
        .eq("id", plan_id)
        .maybe_single()
        .execute()
    )
    if not plan or plan["user_id"] != user_id:
        raise HTTPException(403, "Not authorized")
    return plan_id


def _verify_grocery_owner(item_id: str, user_id: str) -> None:
    item = maybe_single(
        supabase.table("grocery_items")
        .select("plan_id")
        .eq("id", item_id)
        .maybe_single()
        .execute()
    )
    if not item:
        raise HTTPException(404, "Item not found")
    plan = maybe_single(
        supabase.table("meal_plans")
        .select("user_id")
        .eq("id", item["plan_id"])
        .maybe_single()
        .execute()
    )
    if not plan or plan["user_id"] != user_id:
        raise HTTPException(403, "Not authorized")

router = APIRouter()


def _get_or_create_plan(user_id: str, week_start: str) -> str:
    """Return the meal_plan id for the given week, creating one if needed."""
    existing = maybe_single(
        supabase.table("meal_plans")
        .select("id")
        .eq("user_id", user_id)
        .eq("week_start", week_start)
        .maybe_single()
        .execute()
    )
    if existing:
        return existing["id"]

    create_res = (
        supabase.table("meal_plans")
        .insert({"user_id": user_id, "week_start": week_start})
        .execute()
    )
    return create_res.data[0]["id"]


@router.get("/")
async def get_week_plan(weekStart: str, user_id: str = Depends(get_current_user)):
    plan = maybe_single(
        supabase.table("meal_plans")
        .select("id")
        .eq("user_id", user_id)
        .eq("week_start", weekStart)
        .maybe_single()
        .execute()
    )

    if not plan:
        return {"weekStart": weekStart, "entries": []}

    plan_id = plan["id"]

    meals_res = (
        supabase.table("planned_meals")
        .select("*, recipes(id, title, cover_image_url, cuisine, duration_minutes, servings)")
        .eq("plan_id", plan_id)
        .order("planned_date")
        .execute()
    )

    entries = []
    for row in meals_res.data:
        recipe_data = row.pop("recipes", None)
        entry = row_to_camel(row)
        if recipe_data:
            entry["recipe"] = row_to_camel(recipe_data)
        entries.append(entry)

    return {"weekStart": weekStart, "entries": entries}


@router.post("/entries", status_code=201)
async def add_entry(data: PlannedMealCreate, user_id: str = Depends(get_current_user)):
    # Derive week_start (Monday) from the planned date
    from datetime import date, timedelta
    d = date.fromisoformat(data.plannedDate)
    monday = d - timedelta(days=d.weekday())
    week_start = monday.isoformat()

    plan_id = _get_or_create_plan(user_id, week_start)

    row = {
        "plan_id": plan_id,
        "recipe_id": data.recipeId,
        "planned_date": data.plannedDate,
        "meal_type": data.mealType,
        "servings": data.servings,
    }
    res = supabase.table("planned_meals").insert(row).execute()
    if not res.data:
        raise HTTPException(500, "Failed to create entry")
    return row_to_camel(res.data[0])


@router.patch("/entries/{entry_id}")
async def update_entry(
    entry_id: str,
    data: PlannedMealUpdate,
    user_id: str = Depends(get_current_user),
):
    current_plan_id = _verify_meal_owner(entry_id, user_id)

    update: dict = {}
    if data.plannedDate is not None:
        update["planned_date"] = data.plannedDate
    if data.mealType is not None:
        update["meal_type"] = data.mealType
    if data.servings is not None:
        update["servings"] = data.servings
    if data.cookedAt is not None:
        update["cooked_at"] = data.cookedAt or None

    # If the date moved to a different week, the entry's plan_id must change.
    if data.plannedDate is not None:
        from datetime import date, timedelta
        d = date.fromisoformat(data.plannedDate)
        monday = (d - timedelta(days=d.weekday())).isoformat()
        new_plan_id = _get_or_create_plan(user_id, monday)
        if new_plan_id != current_plan_id:
            update["plan_id"] = new_plan_id

    if not update:
        raise HTTPException(400, "No fields to update")

    res = (
        supabase.table("planned_meals")
        .update(update)
        .eq("id", entry_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(500, "Failed to update entry")
    return row_to_camel(res.data[0])


@router.delete("/entries/{entry_id}", status_code=204)
async def remove_entry(entry_id: str, user_id: str = Depends(get_current_user)):
    _verify_meal_owner(entry_id, user_id)
    supabase.table("planned_meals").delete().eq("id", entry_id).execute()


@router.get("/grocery-list")
async def get_grocery_list(weekStart: str, user_id: str = Depends(get_current_user)):
    plan = maybe_single(
        supabase.table("meal_plans")
        .select("id")
        .eq("user_id", user_id)
        .eq("week_start", weekStart)
        .maybe_single()
        .execute()
    )

    if not plan:
        return []

    plan_id = plan["id"]

    res = (
        supabase.table("grocery_items")
        .select("*")
        .eq("plan_id", plan_id)
        .order("category")
        .execute()
    )
    return [row_to_camel(r) for r in res.data]


@router.post("/grocery-list", status_code=201)
async def add_grocery_item(
    data: GroceryItemCreate,
    user_id: str = Depends(get_current_user),
):
    plan_id = _get_or_create_plan(user_id, data.weekStart)
    row = {
        "plan_id": plan_id,
        "ingredient_name": data.ingredientName,
        "total_quantity": data.totalQuantity,
        "unit": data.unit,
        "category": data.category,
        "checked": False,
    }
    res = supabase.table("grocery_items").insert(row).execute()
    if not res.data:
        raise HTTPException(500, "Failed to create item")
    return row_to_camel(res.data[0])


@router.patch("/grocery-list/{item_id}")
async def update_grocery_item(
    item_id: str,
    data: GroceryItemUpdate,
    user_id: str = Depends(get_current_user),
):
    _verify_grocery_owner(item_id, user_id)
    update: dict = {}
    if data.ingredientName is not None:
        update["ingredient_name"] = data.ingredientName
    if data.totalQuantity is not None:
        update["total_quantity"] = data.totalQuantity
    if data.unit is not None:
        update["unit"] = data.unit
    if data.category is not None:
        update["category"] = data.category
    if data.checked is not None:
        update["checked"] = data.checked

    if not update:
        raise HTTPException(400, "No fields to update")

    res = (
        supabase.table("grocery_items")
        .update(update)
        .eq("id", item_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(500, "Failed to update item")
    return row_to_camel(res.data[0])


@router.delete("/grocery-list/{item_id}", status_code=204)
async def delete_grocery_item(
    item_id: str,
    user_id: str = Depends(get_current_user),
):
    _verify_grocery_owner(item_id, user_id)
    supabase.table("grocery_items").delete().eq("id", item_id).execute()
