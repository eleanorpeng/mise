from __future__ import annotations

import re
from typing import Any, Literal

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# snake_case <-> camelCase helpers
# ---------------------------------------------------------------------------

_CAMEL_RE = re.compile(r"([A-Z])")


def _to_snake(name: str) -> str:
    return _CAMEL_RE.sub(r"_\1", name).lower()


def _to_camel(name: str) -> str:
    parts = name.split("_")
    return parts[0] + "".join(w.capitalize() for w in parts[1:])


def row_to_camel(row: dict[str, Any]) -> dict[str, Any]:
    """Convert a Supabase DB row (snake_case keys) to camelCase for the frontend."""
    return {_to_camel(k): v for k, v in row.items()}


# ---------------------------------------------------------------------------
# DB enum types
# ---------------------------------------------------------------------------

SourceType = Literal["video", "photo", "manual"]
RecipeStatus = Literal["processing", "ready", "failed"]
Difficulty = Literal["easy", "medium", "hard"]
MealType = Literal["breakfast", "lunch", "dinner", "snack"]
ImportStatus = Literal["queued", "downloading", "transcribing", "synthesising", "done", "failed"]
TechniqueCategory = Literal["heat", "knife", "sauce", "baking", "timing", "general"]


# ---------------------------------------------------------------------------
# Technique
# ---------------------------------------------------------------------------

class Technique(BaseModel):
    id: str
    name: str
    explanation: str
    category: TechniqueCategory = "general"
    difficulty: Difficulty | None = None


# ---------------------------------------------------------------------------
# Ingredient (API response shape)
# ---------------------------------------------------------------------------

class Ingredient(BaseModel):
    id: str | None = None
    name: str
    quantity: float | None = None
    unit: str | None = None
    notes: str | None = None
    orderIndex: int = 0


# ---------------------------------------------------------------------------
# Step (API response — technique joined inline)
# ---------------------------------------------------------------------------

class RecipeStep(BaseModel):
    id: str | None = None
    orderIndex: int
    instruction: str
    durationSeconds: int | None = None
    technique: Technique | None = None


# ---------------------------------------------------------------------------
# Macros
# ---------------------------------------------------------------------------

class Macros(BaseModel):
    calories: float
    proteinG: float
    carbsG: float
    fatG: float
    fiberG: float | None = None


# ---------------------------------------------------------------------------
# Recipe (full API response — assembled from joined tables)
# ---------------------------------------------------------------------------

class Recipe(BaseModel):
    id: str
    title: str
    description: str | None = None
    coverImageUrl: str | None = None
    sourceUrl: str | None = None
    sourceType: SourceType
    cuisine: str | None = None
    difficulty: Difficulty | None = None
    servings: int
    durationMinutes: int | None = None
    status: RecipeStatus = "ready"
    isPublic: bool = False
    ingredients: list[Ingredient] = []
    steps: list[RecipeStep] = []
    macros: Macros | None = None
    importedAt: str | None = None
    createdAt: str


# ---------------------------------------------------------------------------
# Pipeline extraction models (what GPT-4o outputs)
# ---------------------------------------------------------------------------

class ExtractedIngredient(BaseModel):
    name: str
    quantity: float | None = None
    unit: str | None = None
    notes: str | None = None


class ExtractedTechnique(BaseModel):
    name: str
    explanation: str
    category: TechniqueCategory = "general"


class ExtractedStep(BaseModel):
    instruction: str
    duration_seconds: int | None = None
    technique: ExtractedTechnique | None = None


class ExtractedMacros(BaseModel):
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float | None = None


class RecipeExtraction(BaseModel):
    """Schema for GPT-4o structured output."""

    title: str
    description: str | None = None
    cuisine: str | None = None
    difficulty: Difficulty | None = None
    servings: int = 2
    duration_minutes: int | None = None
    ingredients: list[ExtractedIngredient]
    steps: list[ExtractedStep]
    macros: ExtractedMacros | None = None


# ---------------------------------------------------------------------------
# Meal plan (API shapes)
# ---------------------------------------------------------------------------

class PlannedMeal(BaseModel):
    id: str
    recipeId: str
    plannedDate: str
    mealType: MealType
    servings: int
    cookedAt: str | None = None


class PlannedMealCreate(BaseModel):
    recipeId: str
    plannedDate: str
    mealType: MealType
    servings: int = 2


class PlannedMealUpdate(BaseModel):
    plannedDate: str | None = None
    mealType: MealType | None = None
    servings: int | None = None
    cookedAt: str | None = None  # ISO timestamp; pass empty-string to clear


class GroceryItem(BaseModel):
    id: str
    ingredientName: str
    totalQuantity: float | None = None
    unit: str | None = None
    category: str = "other"
    checked: bool = False


class GroceryItemCreate(BaseModel):
    weekStart: str
    ingredientName: str
    totalQuantity: float | None = None
    unit: str | None = None
    category: str = "other"


class GroceryItemUpdate(BaseModel):
    ingredientName: str | None = None
    totalQuantity: float | None = None
    unit: str | None = None
    category: str | None = None
    checked: bool | None = None


# ---------------------------------------------------------------------------
# Cook log (sticker entries on the calendar)
# ---------------------------------------------------------------------------

class CookLog(BaseModel):
    id: str
    recipeId: str | None = None
    cookedDate: str
    caption: str | None = None
    originalUrl: str
    stickerUrl: str
    dominantColor: str | None = None
    createdAt: str
