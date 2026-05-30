import json
import logging
import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from openai import OpenAIError
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.config import settings
from app.llm import chat_client
from app.rate_limit import limiter
from app.routers.import_ import _persist_recipe
from app.schemas import RecipeExtraction

logger = logging.getLogger(__name__)

router = APIRouter()


SYSTEM_PROMPT = """\
You are Mise's friendly chef assistant. The user tells you what ingredients they \
have on hand, and you help them decide on a dish to cook, then write a full recipe.

Your job has two phases:

1. CLARIFY — When the user's request is vague or you could make a meaningfully \
better suggestion with more details, ask SHORT clarifying questions. \
Good things to clarify: dietary restrictions, cuisine preference, how much time \
they have, what equipment they have (oven? just a pan?), how many servings, \
whether they want to use only the listed ingredients or are open to a few common \
staples (salt, oil, garlic, etc.). \
Ask EXACTLY ONE question per turn — never bundle multiple questions into one \
message. After the user answers, ask the next single question if you still need \
more info, otherwise propose the recipe. Be warm and concise.

2. PROPOSE — Once you have enough to make a confident, cookable suggestion, write \
a complete recipe.

You MUST respond with a SINGLE JSON object matching this schema:

{
  "reply": "string — your conversational message to the user. In clarify phase, \
ask your questions here. In propose phase, a one or two sentence intro to the dish.",
  "needs_more_info": boolean,
  "suggestions": ["string", ...],
  "recipe": null OR {
    "title": "string",
    "description": "string or null — one-sentence hook",
    "cuisine": "string or null",
    "difficulty": "\"easy\" | \"medium\" | \"hard\" or null",
    "servings": "integer, default 2",
    "duration_minutes": "integer or null — total time",
    "ingredients": [
      {
        "name": "string",
        "quantity": "number or null",
        "unit": "string or null — g, ml, tbsp, etc.",
        "notes": "string or null — e.g. 'finely diced'"
      }
    ],
    "steps": [
      {
        "instruction": "string — clear, actionable step",
        "duration_seconds": "integer or null",
        "technique": {
          "name": "string",
          "explanation": "string — the principle behind it",
          "category": "\"heat\" | \"knife\" | \"sauce\" | \"baking\" | \"timing\" | \"general\""
        } or null
      }
    ],
    "macros": {
      "calories": "number", "protein_g": "number", "carbs_g": "number",
      "fat_g": "number", "fiber_g": "number or null"
    } or null
  }
}

You may also include a "learned" field when the user states a DURABLE preference \
worth remembering for future sessions (e.g. "I'm vegetarian", "I love Thai food", \
"no dairy"). Only include preferences that are stable across meals — never one-off \
choices like "tonight I want something quick". Shape:

  "learned": {
    "dietary_restrictions": ["string", ...],   // e.g. ["vegetarian", "no dairy"]
    "cuisine_preferences": ["string", ...]      // e.g. ["Thai", "Italian"]
  }

Omit "learned" entirely (or use null) when nothing durable was stated.

Because you ask exactly one question per turn, ALWAYS include a "suggestions" \
array of 2 to 5 short, tappable example answers for THAT single question — like \
quick-reply chips. Keep each under ~24 characters. Examples: for a dietary \
question ["No restrictions", "Vegetarian", "Gluten-free"]; for a servings question \
["2 servings", "4 servings", "Just me"]. The suggestions must all answer the one \
question you asked in this turn — never mix answers to different questions. When \
you are proposing a recipe (needs_more_info is false), use an empty suggestions array.

Rules:
- When needs_more_info is true, set recipe to null and put your questions in reply.
- When needs_more_info is false, recipe MUST be a complete object and reply is a \
short intro. Never set needs_more_info false without a recipe.
- Build the recipe primarily around the ingredients the user has. You may assume \
common pantry staples (salt, pepper, oil, water) unless they said otherwise.
- Use what you already know about the user (provided below) — never ask about \
dietary restrictions or cuisine preferences you already know.
- Each step may have at most ONE technique annotation, and only when there is a \
genuine, non-obvious insight to share.
- Ingredient quantities must be numeric (float) or null. Put prep notes in "notes".
- Macros are optional — include a rough per-serving estimate if you can.
- Output ONLY the JSON object, no markdown fences or commentary.
"""


def _profile_context(profile: "ProfileContext | None") -> str:
    if not profile:
        return "What you know about the user: nothing yet."
    bits: list[str] = []
    if profile.display_name:
        bits.append(f"Name: {profile.display_name}")
    if profile.dietary_restrictions:
        bits.append(f"Dietary restrictions: {', '.join(profile.dietary_restrictions)}")
    if profile.cuisine_preferences:
        bits.append(f"Favourite cuisines: {', '.join(profile.cuisine_preferences)}")
    if profile.skill_level:
        bits.append(f"Cooking skill: {profile.skill_level}")
    if not bits:
        return "What you know about the user: nothing yet."
    return "What you already know about the user:\n- " + "\n- ".join(bits)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ProfileContext(BaseModel):
    display_name: str | None = None
    dietary_restrictions: list[str] = []
    cuisine_preferences: list[str] = []
    skill_level: str | None = None


class LearnedPreferences(BaseModel):
    dietary_restrictions: list[str] = []
    cuisine_preferences: list[str] = []


class ChefChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=40)
    profile: ProfileContext | None = None


class ChefChatResponse(BaseModel):
    reply: str
    needs_more_info: bool
    suggestions: list[str] = []
    recipe: RecipeExtraction | None = None
    learned: LearnedPreferences | None = None


@router.post("/chat", response_model=ChefChatResponse)
@limiter.limit("30/minute")
async def chef_chat(
    request: Request,
    body: ChefChatRequest,
    user_id: str = Depends(get_current_user),
):
    client = chat_client()
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": _profile_context(body.profile)},
    ]
    messages.extend({"role": m.role, "content": m.content} for m in body.messages)

    try:
        response = await client.chat.completions.create(
            model=settings.chat_model,
            response_format={"type": "json_object"},
            messages=messages,
            temperature=0.5,
            max_tokens=2048,
        )
    except OpenAIError as exc:
        logger.warning("Chef chat failed: %s", exc)
        raise HTTPException(status_code=502, detail="Chef is unavailable right now")

    raw = response.choices[0].message.content or "{}"
    return _finalize_chef_payload(raw)


def _finalize_chef_payload(raw: str) -> ChefChatResponse:
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Chef returned non-JSON: %s", raw[:200])
        return ChefChatResponse(
            reply="Sorry, I got a bit muddled. Could you say that again?",
            needs_more_info=True,
        )

    reply = (payload.get("reply") or "").strip()
    needs_more_info = bool(payload.get("needs_more_info", True))
    recipe_data = payload.get("recipe")

    recipe: RecipeExtraction | None = None
    if recipe_data:
        try:
            recipe = RecipeExtraction.model_validate(recipe_data)
            needs_more_info = False
        except Exception as exc:
            logger.warning("Chef recipe validation failed: %s", exc)
            recipe = None
            needs_more_info = True
            if not reply:
                reply = "Let me rework that — what kind of dish are you in the mood for?"

    if not reply:
        reply = "Here's an idea." if recipe else "Tell me a bit more and I'll suggest something."

    learned: LearnedPreferences | None = None
    learned_data = payload.get("learned")
    if isinstance(learned_data, dict):
        try:
            candidate = LearnedPreferences.model_validate(learned_data)
            if candidate.dietary_restrictions or candidate.cuisine_preferences:
                learned = candidate
        except Exception:
            learned = None

    suggestions: list[str] = []
    if needs_more_info and isinstance(payload.get("suggestions"), list):
        suggestions = [
            str(s).strip()
            for s in payload["suggestions"]
            if isinstance(s, str) and s.strip()
        ][:5]

    return ChefChatResponse(
        reply=reply,
        needs_more_info=needs_more_info,
        suggestions=suggestions,
        recipe=recipe,
        learned=learned,
    )


# --- Streaming endpoint ------------------------------------------------------
#
# We stream the JSON tokens from the LLM and incrementally peel the "reply"
# field's contents off the front of the stream. The user sees the assistant's
# message land word-by-word; the structured recipe / suggestions / learned
# payload is delivered once at the end when the full JSON parses cleanly.

_REPLY_START = re.compile(r'"reply"\s*:\s*"')

_SIMPLE_ESCAPES = {
    '"': '"', "\\": "\\", "/": "/",
    "n": "\n", "t": "\t", "r": "\r", "b": "\b", "f": "\f",
}


def _decode_json_string(buf: str) -> tuple[int, str, bool]:
    """Consume *buf* up to the unescaped closing quote of a JSON string.

    Returns ``(chars_consumed, decoded_text, finished)``. When ``finished`` is
    False, the buffer was exhausted mid-string — re-call after appending more.
    """
    out: list[str] = []
    i = 0
    n = len(buf)
    while i < n:
        c = buf[i]
        if c == '"':
            return i + 1, "".join(out), True
        if c == "\\":
            if i + 1 >= n:
                return i, "".join(out), False
            nxt = buf[i + 1]
            if nxt in _SIMPLE_ESCAPES:
                out.append(_SIMPLE_ESCAPES[nxt])
                i += 2
            elif nxt == "u":
                if i + 6 > n:
                    return i, "".join(out), False
                code = buf[i + 2 : i + 6]
                try:
                    out.append(chr(int(code, 16)))
                except ValueError:
                    out.append("?")
                i += 6
            else:
                out.append(nxt)
                i += 2
        else:
            out.append(c)
            i += 1
    return i, "".join(out), False


class _ReplyStreamer:
    """Pull the unescaped contents of the JSON ``reply`` field out of a
    growing token stream, ignoring everything else."""

    def __init__(self) -> None:
        self._buffer = ""
        self._state: Literal["scan", "in_string", "done"] = "scan"

    def feed(self, chunk: str) -> str:
        if self._state == "done":
            return ""
        self._buffer += chunk
        out: list[str] = []
        while True:
            if self._state == "scan":
                m = _REPLY_START.search(self._buffer)
                if m is None:
                    return "".join(out)
                self._buffer = self._buffer[m.end():]
                self._state = "in_string"
            elif self._state == "in_string":
                consumed, decoded, finished = _decode_json_string(self._buffer)
                self._buffer = self._buffer[consumed:]
                if decoded:
                    out.append(decoded)
                if finished:
                    self._state = "done"
                return "".join(out)
            else:
                return "".join(out)


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/chat/stream")
@limiter.limit("30/minute")
async def chef_chat_stream(
    request: Request,
    body: ChefChatRequest,
    user_id: str = Depends(get_current_user),
):
    client = chat_client()
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": _profile_context(body.profile)},
    ]
    messages.extend({"role": m.role, "content": m.content} for m in body.messages)

    async def gen():
        collected: list[str] = []
        extractor = _ReplyStreamer()
        try:
            stream = await client.chat.completions.create(
                model=settings.chat_model,
                response_format={"type": "json_object"},
                messages=messages,
                temperature=0.5,
                max_tokens=2048,
                stream=True,
            )
            async for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                content = delta.content if delta else None
                if not content:
                    continue
                collected.append(content)
                new_text = extractor.feed(content)
                if new_text:
                    yield _sse("delta", {"text": new_text})
        except OpenAIError as exc:
            logger.warning("Chef stream failed: %s", exc)
            yield _sse("error", {"message": "Chef is unavailable right now"})
            return
        except Exception as exc:  # noqa: BLE001
            logger.exception("Chef stream crashed: %s", exc)
            yield _sse("error", {"message": "Chef ran into a problem"})
            return

        final = _finalize_chef_payload("".join(collected))
        yield _sse("done", json.loads(final.model_dump_json()))

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/save", status_code=201)
@limiter.limit("20/minute")
async def chef_save(
    request: Request,
    body: RecipeExtraction,
    user_id: str = Depends(get_current_user),
):
    try:
        full_recipe = _persist_recipe(
            user_id, body, source_url="", cover_url=None, source_type="manual",
        )
    except Exception:
        logger.exception("Failed to save chef recipe")
        raise HTTPException(status_code=500, detail="Could not save recipe")
    return full_recipe
