from __future__ import annotations

import base64
import json
import logging
from pathlib import Path

from app.llm import structure_model, technique_model, vision_client
from app.schemas import (
    ExtractedStep,
    ExtractedTechnique,
    RecipeExtraction,
    TechniqueCategory,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Stage B — STRUCTURE (fast vision model)
# ---------------------------------------------------------------------------
# Produces the structural recipe (title, ingredients, steps, macros) from the
# transcript + keyframes. Deliberately does NOT produce technique annotations —
# those are a separate, smarter, text-only pass (see enrich_techniques).

STRUCTURE_SYSTEM_PROMPT = """\
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
      "duration_seconds": "integer or null — time for this step"
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
- Ingredient quantities must be numeric (float) or null. Put prep notes in the "notes" field.
- If the video is not a cooking recipe, still do your best to extract a recipe \
from whatever food content is shown.
- Macros are optional — include a rough per-serving estimate if you can infer the dish.
- Do NOT include technique explanations — only the actionable step instructions.
- Output ONLY the JSON object, no markdown fences or commentary.\
"""

# ---------------------------------------------------------------------------
# Stage C — TECHNIQUE (smart model, text-only)
# ---------------------------------------------------------------------------
# Given the finished step instructions, annotate the steps where a genuine,
# non-obvious cooking technique is worth surfacing. This is the app's key
# differentiator, so it runs on the higher-quality model — but text-only (no
# images), which keeps it fast and cheap.

TECHNIQUE_SYSTEM_PROMPT = """\
You are a culinary expert who annotates recipe steps with the underlying cooking \
technique — the science or principle a thoughtful cook would want to understand.

You will be given a recipe's ingredients and its numbered steps. Return a single JSON \
object of this exact shape:

{
  "techniques": [
    {
      "step_index": "integer — 0-based index of the step this annotates",
      "name": "string — name of the cooking technique (e.g. 'Maillard reaction')",
      "explanation": "string — why/how this technique works (the science or principle)",
      "category": "\"heat\" | \"knife\" | \"sauce\" | \"baking\" | \"timing\" | \"general\""
    }
  ]
}

Rules:
- Annotate a step ONLY when there is a genuine, non-obvious insight to share. Skip \
trivial steps ("add salt", "plate and serve"). It is good to annotate only some steps.
- At most ONE technique per step. Do not invent techniques that aren't present.
- Use the correct category: heat (searing, caramelizing), knife (brunoise, chiffonade), \
sauce (emulsion, reduction), baking (proofing, laminating), timing (resting, carryover \
cooking), general (everything else).
- step_index must refer to a real step in the list (0-based).
- Output ONLY the JSON object, no markdown fences or commentary.\
"""

_VALID_CATEGORIES: set[str] = {"heat", "knife", "sauce", "baking", "timing", "general"}


def loads_json_object(raw: str | None) -> dict:
    """Parse a JSON object from a model response, tolerating the two ways JSON
    mode occasionally goes off-spec: markdown code fences (```json … ```) and
    leading/trailing prose around the object.

    This is our provider-agnostic stand-in for strict structured outputs — it
    keeps a slightly-malformed response from failing the whole import. Raises
    ValueError if no object can be recovered.
    """
    if not raw or not raw.strip():
        raise ValueError("empty model response")
    text = raw.strip()

    # Strip a leading ``` or ```json fence and the matching trailing fence.
    if text.startswith("```"):
        text = text[3:]
        if text[:4].lower() == "json":
            text = text[4:]
        if "```" in text:
            text = text[: text.rindex("```")]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Salvage: take the outermost {...} span and try again.
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


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


async def build_structure(
    transcript: str,
    keyframe_paths: list[Path],
) -> RecipeExtraction:
    """Stage B: fast vision model → structural recipe (no technique annotations).

    Steps come back with ``technique=None``; call :func:`enrich_techniques` to
    add the annotations.
    """
    client = vision_client()
    model = structure_model()

    response = await client.chat.completions.create(
        model=model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": STRUCTURE_SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_content(transcript, keyframe_paths)},
        ],
        temperature=0.3,
        max_tokens=4096,
    )

    raw = response.choices[0].message.content
    logger.info("structure model %s returned %d chars of JSON", model, len(raw or ""))

    data = loads_json_object(raw)
    return RecipeExtraction.model_validate(data)


def _coerce_category(value: object) -> TechniqueCategory:
    if isinstance(value, str) and value in _VALID_CATEGORIES:
        return value  # type: ignore[return-value]
    return "general"


def merge_techniques(extraction: RecipeExtraction, payload: dict) -> RecipeExtraction:
    """Merge a technique-enrichment response onto an extraction's steps.

    Pure function (no network) so it can be unit-tested. Out-of-range or
    malformed entries are ignored; the last valid annotation for a given step
    wins. Returns a new extraction; the input is not mutated.
    """
    raw_items = payload.get("techniques") or []
    by_index: dict[int, ExtractedTechnique] = {}
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        idx = item.get("step_index")
        name = item.get("name")
        explanation = item.get("explanation")
        if not isinstance(idx, int) or not name or not explanation:
            continue
        if idx < 0 or idx >= len(extraction.steps):
            continue
        by_index[idx] = ExtractedTechnique(
            name=str(name),
            explanation=str(explanation),
            category=_coerce_category(item.get("category")),
        )

    new_steps = [
        ExtractedStep(
            instruction=step.instruction,
            duration_seconds=step.duration_seconds,
            technique=by_index.get(i, step.technique),
        )
        for i, step in enumerate(extraction.steps)
    ]
    return extraction.model_copy(update={"steps": new_steps})


def _build_technique_prompt(extraction: RecipeExtraction) -> str:
    ingredient_lines = "\n".join(
        f"- {ing.name}" + (f" ({ing.notes})" if ing.notes else "")
        for ing in extraction.ingredients
    ) or "(none listed)"
    step_lines = "\n".join(
        f"{i}. {step.instruction}" for i, step in enumerate(extraction.steps)
    ) or "(no steps)"
    return (
        f"Recipe: {extraction.title}\n\n"
        f"## Ingredients\n{ingredient_lines}\n\n"
        f"## Steps (0-based index)\n{step_lines}"
    )


async def enrich_techniques(extraction: RecipeExtraction) -> RecipeExtraction:
    """Stage C: smart, text-only model → technique annotations merged onto steps.

    Graceful: on any failure the extraction is returned unchanged (no
    annotations) rather than failing the whole import.
    """
    if not extraction.steps:
        return extraction

    client = vision_client()
    model = technique_model()

    try:
        response = await client.chat.completions.create(
            model=model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": TECHNIQUE_SYSTEM_PROMPT},
                {"role": "user", "content": _build_technique_prompt(extraction)},
            ],
            temperature=0.4,
            max_tokens=2048,
        )
        raw = response.choices[0].message.content
        logger.info("technique model %s returned %d chars of JSON", model, len(raw or ""))
        payload = loads_json_object(raw)
    except Exception:
        logger.warning("Technique enrichment failed; returning un-annotated recipe", exc_info=True)
        return extraction

    enriched = merge_techniques(extraction, payload)
    annotated = sum(1 for s in enriched.steps if s.technique)
    logger.info("Annotated %d/%d steps with techniques", annotated, len(enriched.steps))
    return enriched


async def build_recipe(
    transcript: str,
    keyframe_paths: list[Path],
) -> RecipeExtraction:
    """Full structured recipe: structure (fast) → technique enrichment (smart).

    Sequential convenience wrapper. The import router may instead call
    :func:`build_structure` and :func:`enrich_techniques` separately to return
    the structure early and enrich in the background (progressive render).
    """
    structure = await build_structure(transcript, keyframe_paths)
    return await enrich_techniques(structure)
