from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth import get_current_user
from app.database import maybe_single, supabase
from app.schemas import row_to_camel

router = APIRouter()


class ProfileUpdate(BaseModel):
    displayName: str | None = None
    avatarUrl: str | None = None
    intent: str | None = None
    cuisinePreferences: list[str] | None = None
    dietaryRestrictions: list[str] | None = None
    skillLevel: str | None = None
    markOnboarded: bool | None = None


def _empty_profile(user_id: str) -> dict:
    return {
        "userId": user_id,
        "displayName": None,
        "avatarUrl": None,
        "intent": None,
        "cuisinePreferences": [],
        "dietaryRestrictions": [],
        "skillLevel": None,
        "onboardedAt": None,
    }


@router.get("/")
async def get_profile(user_id: str = Depends(get_current_user)):
    row = maybe_single(
        supabase.table("user_profiles")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not row:
        return _empty_profile(user_id)
    return row_to_camel(row)


@router.patch("/")
async def update_profile(
    data: ProfileUpdate, user_id: str = Depends(get_current_user)
):
    payload: dict = {"user_id": user_id, "updated_at": datetime.now(timezone.utc).isoformat()}
    if data.displayName is not None:
        payload["display_name"] = data.displayName
    if data.avatarUrl is not None:
        payload["avatar_url"] = data.avatarUrl
    if data.intent is not None:
        payload["intent"] = data.intent
    if data.cuisinePreferences is not None:
        payload["cuisine_preferences"] = data.cuisinePreferences
    if data.dietaryRestrictions is not None:
        payload["dietary_restrictions"] = data.dietaryRestrictions
    if data.skillLevel is not None:
        payload["skill_level"] = data.skillLevel
    if data.markOnboarded:
        payload["onboarded_at"] = datetime.now(timezone.utc).isoformat()

    res = (
        supabase.table("user_profiles")
        .upsert(payload, on_conflict="user_id")
        .execute()
    )
    return row_to_camel(res.data[0]) if res.data else _empty_profile(user_id)


@router.get("/stats")
async def get_stats(user_id: str = Depends(get_current_user)):
    """Lightweight stats for the profile tab hero."""
    recipes = (
        supabase.table("recipes")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    total_recipes = recipes.count or 0

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1).date().isoformat()
    cooked = (
        supabase.table("cook_logs")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gte("cooked_date", month_start)
        .execute()
    )
    cooked_this_month = cooked.count or 0

    return {
        "totalRecipes": total_recipes,
        "cookedThisMonth": cooked_this_month,
    }


@router.get("/insights")
async def get_insights(user_id: str = Depends(get_current_user)):
    """Detailed cooking metrics for the stats detail screen.

    Returns:
      - totalRecipes, totalCooked
      - cookedThisMonth, cookedThisYear
      - currentStreakDays (consecutive days ending today/yesterday with at least one cook)
      - techniquesLearned (distinct technique count across the user's saved recipes)
      - topCuisines: [{cuisine, count}] from saved recipes
      - monthlyActivity: [{month, count}] for last 6 months including current
    """
    from collections import Counter

    recipes_res = (
        supabase.table("recipes")
        .select("id, cuisine")
        .eq("user_id", user_id)
        .execute()
    )
    recipe_rows = recipes_res.data or []
    total_recipes = len(recipe_rows)
    recipe_ids = [r["id"] for r in recipe_rows]

    cuisine_counts = Counter(
        (r.get("cuisine") or "").strip() for r in recipe_rows if (r.get("cuisine") or "").strip()
    )
    top_cuisines = [
        {"cuisine": c, "count": n}
        for c, n in cuisine_counts.most_common(5)
    ]

    techniques_learned = 0
    if recipe_ids:
        steps_res = (
            supabase.table("steps")
            .select("technique_id")
            .in_("recipe_id", recipe_ids)
            .not_.is_("technique_id", "null")
            .execute()
        )
        techniques_learned = len({r["technique_id"] for r in (steps_res.data or [])})

    cooks_res = (
        supabase.table("cook_logs")
        .select("cooked_date")
        .eq("user_id", user_id)
        .execute()
    )
    cook_dates = [r["cooked_date"] for r in (cooks_res.data or [])]
    total_cooked = len(cook_dates)

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1).date()
    year_start = now.replace(month=1, day=1).date()
    cooked_this_month = sum(1 for d in cook_dates if d >= month_start.isoformat())
    cooked_this_year = sum(1 for d in cook_dates if d >= year_start.isoformat())

    # Monthly activity: last 6 months including the current one.
    monthly_buckets: list[dict] = []
    for i in range(5, -1, -1):
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        key = f"{year:04d}-{month:02d}"
        count = sum(1 for d in cook_dates if d.startswith(key))
        monthly_buckets.append({"month": key, "count": count})

    # Streak: consecutive days ending today (or yesterday) with ≥1 cook.
    cook_set = set(cook_dates)
    streak = 0
    cursor = now.date()
    if cursor.isoformat() not in cook_set:
        # Allow streak to start from yesterday so today not yet cooked doesn't reset it.
        from datetime import timedelta
        cursor = cursor - timedelta(days=1)
    while cursor.isoformat() in cook_set:
        streak += 1
        from datetime import timedelta
        cursor = cursor - timedelta(days=1)

    return {
        "totalRecipes": total_recipes,
        "totalCooked": total_cooked,
        "cookedThisMonth": cooked_this_month,
        "cookedThisYear": cooked_this_year,
        "currentStreakDays": streak,
        "techniquesLearned": techniques_learned,
        "topCuisines": top_cuisines,
        "monthlyActivity": monthly_buckets,
    }
