from __future__ import annotations

import base64
import json
import logging
from pathlib import Path

from openai import AsyncOpenAI

from app.config import settings
from app.schemas import RecipeExtraction

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a culinary AI that converts cooking video transcripts and keyframe images \
into structured recipes. Respond with a single JSON object matching this schema exactly:

{
  "title": "string",
  "description": "string or null — one-sentence hook",
  "cuisine": "string or null — e.g. Italian, Thai, Mexican",
  "difficulty": "\"easy\" | \"medium\" | \"hard\" or null",
  "servings": "integer — best estimate, default 2",
  "duration_minutes": "integer or null — total cook time in minutes",
  "ingredients": [
    {
      "name": "string",
      "quantity": "number or null — numeric amount, null if 'to taste' / unmeasured",
      "unit": "string or null — g, ml, tbsp, etc.",
      "notes": "string or null — e.g. 'finely diced', 'room temperature'"
    }
  ],
  "steps": [
    {
      "instruction": "string — clear, actionable instruction for this step",
      "duration_seconds": "integer or null — time for this step",
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
- Infer quantities, times, and servings from the transcript and visual cues in the frames.
- Each step may have at most ONE technique annotation. A technique annotation explains \
the underlying cooking principle (e.g. "Maillard reaction", "emulsification", "blooming spices"). \
Only include a technique when there is a genuine, non-obvious insight to share.
- Use the correct category for each technique: heat (searing, caramelizing), \
knife (brunoise, chiffonade), sauce (emulsion, reduction), baking (proofing, laminating), \
timing (resting, carryover cooking), general (everything else).
- Ingredient quantities must be numeric (float) or null. Put prep notes in the "notes" field.
- If the video is not a cooking recipe, still do your best to extract a recipe \
from whatever food content is shown.
- Macros are optional — include a rough per-serving estimate if you can infer the dish.
- Output ONLY the JSON object, no markdown fences or commentary.\
"""


def _encode_frame(frame_path: Path) -> str:
    data = frame_path.read_bytes()
    return base64.b64encode(data).decode()


def _build_user_content(transcript: str, keyframe_paths: list[Path]) -> list[dict]:
    parts: list[dict] = [
        {
            "type": "text",
            "text": f"## Transcript\n\n{transcript}",
        },
    ]

    if keyframe_paths:
        parts.append({"type": "text", "text": "## Keyframes from the video"})
        for frame in keyframe_paths:
            b64 = _encode_frame(frame)
            parts.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{b64}",
                    "detail": "low",
                },
            })

    return parts


async def build_recipe(
    transcript: str,
    keyframe_paths: list[Path],
    fast: bool = False,
) -> RecipeExtraction:
    """Call GPT-4o with the transcript and keyframes to produce a structured recipe.

    When *fast* is True, uses gpt-4o-mini — roughly 3× faster end-to-end with
    slightly less precise quantities and shorter technique explanations.
    """
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    model = "gpt-4o-mini" if fast else "gpt-4o"

    response = await client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_content(transcript, keyframe_paths)},
        ],
        temperature=0.3,
        max_tokens=4096,
    )

    raw = response.choices[0].message.content
    logger.info("%s returned %d chars of JSON", model, len(raw or ""))

    data = json.loads(raw)
    extraction = RecipeExtraction.model_validate(data)
    return extraction
