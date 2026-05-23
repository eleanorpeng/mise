from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import get_current_user
from app.database import supabase

router = APIRouter()

Scope = Literal["year", "month", "week", "all"]

_BUCKET = "cook-logs"


def _public_url(path: str | None) -> str | None:
    if not path:
        return None
    return supabase.storage.from_(_BUCKET).get_public_url(path)


def _parse_iso(d: str) -> date:
    return date.fromisoformat(d)


def _month_key(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _week_key(d: date) -> str:
    iso = d.isocalendar()
    return f"{iso.year:04d}-W{iso.week:02d}"


def _year_key(d: date) -> str:
    return f"{d.year:04d}"


MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def _period_label(scope: Scope, key: str) -> str:
    if scope == "year":
        return key
    if scope == "month":
        y, m = key.split("-")
        return f"{MONTH_NAMES[int(m) - 1]} {y}"
    if scope == "week":
        y, w = key.split("-W")
        return f"Week {int(w)}, {y}"
    return "All time"


def _range_for(scope: Scope, key: str) -> tuple[date, date]:
    """Return [start, end) date range for a given scope/key."""
    if scope == "year":
        y = int(key)
        return date(y, 1, 1), date(y + 1, 1, 1)
    if scope == "month":
        y, m = (int(x) for x in key.split("-"))
        nxt = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
        return date(y, m, 1), nxt
    if scope == "week":
        y_str, w_str = key.split("-W")
        y, w = int(y_str), int(w_str)
        # ISO week: Monday is day 1
        monday = date.fromisocalendar(y, w, 1)
        return monday, monday + timedelta(days=7)
    if scope == "all":
        return date(1970, 1, 1), date(9999, 12, 31)
    raise HTTPException(400, "Invalid scope")


def _fetch_user_logs(user_id: str) -> list[dict]:
    res = (
        supabase.table("cook_logs")
        .select("id,recipe_id,cooked_date,original_path,sticker_path,caption,created_at")
        .eq("user_id", user_id)
        .order("cooked_date", desc=True)
        .execute()
    )
    return res.data or []


@router.get("/periods")
async def list_periods(
    scope: Scope = Query("month"),
    user_id: str = Depends(get_current_user),
):
    """List recap periods for the user, with a cover image and count for each."""
    logs = _fetch_user_logs(user_id)
    if not logs:
        return []

    if scope == "all":
        # Single virtual period — cover uses the sticker so the hero feels editorial.
        cover_log = min(logs, key=lambda l: l["cooked_date"])
        sticker_urls = [
            _public_url(l["sticker_path"]) for l in logs if l.get("sticker_path")
        ]
        return [{
            "scope": "all",
            "key": "all",
            "label": "All time",
            "year": None,
            "coverImageUrl": _public_url(cover_log.get("sticker_path") or cover_log.get("original_path")),
            "stickerUrls": sticker_urls,
            "count": len(logs),
        }]

    grouper = {"year": _year_key, "month": _month_key, "week": _week_key}[scope]

    groups: dict[str, list[dict]] = {}
    for log in logs:
        try:
            d = _parse_iso(log["cooked_date"])
        except (KeyError, ValueError):
            continue
        groups.setdefault(grouper(d), []).append(log)

    periods: list[dict] = []
    for key, items in groups.items():
        # Earliest log in the period drives the cover.
        cover = min(items, key=lambda l: l["cooked_date"])
        cover_path = cover.get("sticker_path") or cover.get("original_path")
        first_date = min(l["cooked_date"] for l in items)
        year = int(first_date.split("-")[0])
        sticker_urls = [
            _public_url(l["sticker_path"]) for l in items if l.get("sticker_path")
        ]
        periods.append({
            "scope": scope,
            "key": key,
            "label": _period_label(scope, key),
            "year": year,
            "coverImageUrl": _public_url(cover_path),
            "stickerUrls": sticker_urls,
            "count": len(items),
        })

    # Most recent period first.
    periods.sort(key=lambda p: p["key"], reverse=True)
    return periods


@router.get("/detail")
async def recap_detail(
    scope: Scope = Query(...),
    key: str = Query(...),
    user_id: str = Depends(get_current_user),
):
    """Aggregate stats + photo grid for a single recap period."""
    start, end = _range_for(scope, key)

    logs_res = (
        supabase.table("cook_logs")
        .select("id,recipe_id,cooked_date,original_path,sticker_path,caption")
        .eq("user_id", user_id)
        .gte("cooked_date", start.isoformat())
        .lt("cooked_date", end.isoformat())
        .order("cooked_date", desc=True)
        .execute()
    )
    logs = logs_res.data or []

    # Photos under the "Cooks" grid use the original photo (richer detail),
    # while the hero cover above uses the sticker (cleaner, editorial).
    photos = [
        {
            "id": l["id"],
            "cookedDate": l["cooked_date"],
            "imageUrl": _public_url(l.get("original_path") or l.get("sticker_path")),
            "stickerUrl": _public_url(l.get("sticker_path")),
            "originalUrl": _public_url(l.get("original_path")),
            "caption": l.get("caption"),
        }
        for l in logs
    ]

    recipe_ids = sorted({l["recipe_id"] for l in logs if l.get("recipe_id")})

    cuisines: set[str] = set()
    technique_names: set[str] = set()

    if recipe_ids:
        recipes_res = (
            supabase.table("recipes")
            .select("id,cuisine")
            .in_("id", recipe_ids)
            .execute()
        )
        for r in recipes_res.data or []:
            if r.get("cuisine"):
                cuisines.add(r["cuisine"])

        steps_res = (
            supabase.table("steps")
            .select("technique_id")
            .in_("recipe_id", recipe_ids)
            .not_.is_("technique_id", "null")
            .execute()
        )
        tech_ids = sorted({s["technique_id"] for s in (steps_res.data or []) if s.get("technique_id")})
        if tech_ids:
            tech_res = (
                supabase.table("techniques")
                .select("id,name")
                .in_("id", tech_ids)
                .execute()
            )
            for t in tech_res.data or []:
                if t.get("name"):
                    technique_names.add(t["name"])

    # Hero cover uses the sticker of the earliest log in the period.
    cover = photos[-1] if photos else None
    cover_image_url = None
    if cover:
        cover_image_url = cover.get("stickerUrl") or cover.get("originalUrl")
    return {
        "scope": scope,
        "key": key,
        "label": _period_label(scope, key),
        "coverImageUrl": cover_image_url,
        "stats": {
            "recipesCooked": len(logs),
            "uniqueRecipes": len(recipe_ids),
            "cuisines": sorted(cuisines),
            "techniques": sorted(technique_names),
        },
        "photos": photos,
    }
