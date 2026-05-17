from __future__ import annotations

import base64
import json
import logging

from openai import AsyncOpenAI

from app.config import settings
from app.schemas import RecipeExtraction

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a culinary AI that looks at a single photo of a finished dish and reconstructs \
a plausible home-cooking recipe to make it. The dish may be a restaurant plate, a \
home-cooked meal, a takeout photo, or a magazine shot. Respond with a single JSON object \
matching this schema exactly:

{
  "title": "string — short, evocative name for the dish",
  "description": "string or null — one-sentence hook describing the dish",
  "cuisine": "string or null — e.g. Italian, Thai, Mexican",
  "difficulty": "\"easy\" | \"medium\" | \"hard\" or null",
  "servings": "integer — best estimate, default 2",
  "duration_minutes": "integer or null — total cook time in minutes",
  "ingredients": [
    {
      "name": "string",
      "quantity": "number or null",
      "unit": "string or null — g, ml, tbsp, etc.",
      "notes": "string or null — e.g. 'finely diced', 'room temperature'"
    }
  ],
  "steps": [
    {
      "instruction": "string — clear, actionable instruction for this step",
      "duration_seconds": "integer or null",
      "technique": {
        "name": "string — name of the cooking technique",
        "explanation": "string — why/how this technique works (the science or principle)",
        "category": "\"heat\" | \"knife\" | \"sauce\" | \"baking\" | \"timing\" | \"general\""
      } or null
    }
  ],
  "macros": {
    "calories": "number",
    "protein_g": "number",
    "carbs_g": "number",
    "fat_g": "number",
    "fiber_g": "number or null"
  } or null
}

Rules:
- Identify the dish from visual cues — colors, textures, plating, garnishes, sauces.
- Reconstruct a complete, cookable home recipe. Make reasonable assumptions about \
hidden ingredients (oils, aromatics, seasonings) that are typical for the cuisine.
- Quantities should be plausible for the estimated servings, even if not visible.
- Each step may have at most ONE technique annotation. Only include a technique when \
there is a genuine, non-obvious insight to share (Maillard reaction, emulsification, \
blooming spices, etc.).
- Use the correct category: heat (searing, caramelizing), knife (brunoise, chiffonade), \
sauce (emulsion, reduction), baking (proofing, laminating), timing (resting, carryover), \
general (everything else).
- If the photo is not food at all, return a recipe titled "Unknown dish" with an empty \
ingredients and steps list.
- Macros are optional — include a rough per-serving estimate if you can identify the dish.
- Output ONLY the JSON object, no markdown fences or commentary.\
"""


async def extract_recipe_from_photo(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    caption: str | None = None,
) -> RecipeExtraction:
    """Call GPT-4o vision with a single dish photo and return a structured recipe.

    An optional ``caption`` grounds the model — e.g. "pad see ew from a Thai
    restaurant" — and substantially improves dish identification when given.
    """
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    b64 = base64.b64encode(image_bytes).decode()
    data_url = f"data:{mime_type};base64,{b64}"

    user_text = "Identify this dish and write a recipe to recreate it at home."
    caption = (caption or "").strip()
    if caption:
        user_text += f'\n\nThe user added this hint about the dish: "{caption}". Trust this hint when identifying the dish.'

    response = await client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_text},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
    )

    raw = response.choices[0].message.content or "{}"
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        logger.exception("Photo extraction returned non-JSON: %s", raw[:200])
        raise

    return RecipeExtraction.model_validate(payload)
