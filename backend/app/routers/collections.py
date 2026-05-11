from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user
from app.database import supabase, maybe_single
from app.schemas import row_to_camel

router = APIRouter()


class CollectionCreate(BaseModel):
    name: str
    coverColor: str | None = None
    spineColor: str | None = None
    inkColor: str | None = None


class CollectionUpdate(BaseModel):
    name: str | None = None
    coverColor: str | None = None
    spineColor: str | None = None
    inkColor: str | None = None


def _collection_to_camel(row: dict, recipe_ids: list[str] | None = None) -> dict:
    out = row_to_camel(row)
    out["recipeIds"] = recipe_ids or []
    return out


def _ensure_owned(collection_id: str, user_id: str) -> dict:
    row = maybe_single(
        supabase.table("collections")
        .select("*")
        .eq("id", collection_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not row:
        raise HTTPException(404, "Collection not found")
    return row


@router.get("/")
async def list_collections(user_id: str = Depends(get_current_user)):
    res = (
        supabase.table("collections")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    if not res.data:
        return []

    collection_ids = [c["id"] for c in res.data]
    links_res = (
        supabase.table("recipe_collections")
        .select("recipe_id, collection_id")
        .in_("collection_id", collection_ids)
        .execute()
    )

    by_collection: dict[str, list[str]] = {cid: [] for cid in collection_ids}
    for link in links_res.data or []:
        by_collection.setdefault(link["collection_id"], []).append(link["recipe_id"])

    return [_collection_to_camel(c, by_collection.get(c["id"], [])) for c in res.data]


@router.post("/", status_code=201)
async def create_collection(
    payload: CollectionCreate, user_id: str = Depends(get_current_user)
):
    row = {
        "user_id": user_id,
        "name": payload.name.strip(),
        "cover_color": payload.coverColor or "#F5D0BC",
        "spine_color": payload.spineColor or "#E8A87C",
        "ink_color": payload.inkColor or "#6C250A",
    }
    res = supabase.table("collections").insert(row).execute()
    return _collection_to_camel(res.data[0], [])


@router.patch("/{collection_id}")
async def update_collection(
    collection_id: str,
    payload: CollectionUpdate,
    user_id: str = Depends(get_current_user),
):
    _ensure_owned(collection_id, user_id)

    updates: dict = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.coverColor is not None:
        updates["cover_color"] = payload.coverColor
    if payload.spineColor is not None:
        updates["spine_color"] = payload.spineColor
    if payload.inkColor is not None:
        updates["ink_color"] = payload.inkColor

    if not updates:
        raise HTTPException(400, "No fields to update")

    res = (
        supabase.table("collections")
        .update(updates)
        .eq("id", collection_id)
        .execute()
    )
    return _collection_to_camel(res.data[0])


@router.delete("/{collection_id}", status_code=204)
async def delete_collection(
    collection_id: str, user_id: str = Depends(get_current_user)
):
    _ensure_owned(collection_id, user_id)
    supabase.table("collections").delete().eq("id", collection_id).execute()


@router.post("/{collection_id}/recipes/{recipe_id}", status_code=201)
async def add_recipe_to_collection(
    collection_id: str,
    recipe_id: str,
    user_id: str = Depends(get_current_user),
):
    _ensure_owned(collection_id, user_id)

    # Verify recipe ownership too.
    recipe_res = (
        supabase.table("recipes")
        .select("id")
        .eq("id", recipe_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not recipe_res.data:
        raise HTTPException(404, "Recipe not found")

    supabase.table("recipe_collections").upsert(
        {"recipe_id": recipe_id, "collection_id": collection_id},
        on_conflict="recipe_id,collection_id",
    ).execute()
    return {"recipeId": recipe_id, "collectionId": collection_id}


@router.delete("/{collection_id}/recipes/{recipe_id}", status_code=204)
async def remove_recipe_from_collection(
    collection_id: str,
    recipe_id: str,
    user_id: str = Depends(get_current_user),
):
    _ensure_owned(collection_id, user_id)

    (
        supabase.table("recipe_collections")
        .delete()
        .eq("recipe_id", recipe_id)
        .eq("collection_id", collection_id)
        .execute()
    )
