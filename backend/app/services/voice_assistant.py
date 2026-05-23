from __future__ import annotations

import base64
import json
import logging
import re
from io import BytesIO
from typing import Literal

import httpx
from openai import AsyncOpenAI
from pydantic import BaseModel

from app.config import settings
from app.llm import chat_client

logger = logging.getLogger(__name__)


Intent = Literal["next", "back", "repeat", "goto", "timer", "answer", "unknown"]


class VoiceResponse(BaseModel):
    intent: Intent
    step_delta: int | None = None
    target_step: int | None = None
    timer_seconds: int | None = None
    speech: str
    transcript: str
    speech_audio_b64: str | None = None
    speech_audio_mime: str | None = None


OPENAI_TTS_MODEL = "gpt-4o-mini-tts"
DEFAULT_TTS_VOICE = "nova"
DEFAULT_TTS_PROVIDER = "openai"

OPENAI_VOICES = frozenset(
    {
        "alloy", "ash", "ballad", "coral", "echo",
        "fable", "onyx", "nova", "sage", "shimmer", "verse",
    }
)

ELEVENLABS_MODEL = "eleven_turbo_v2_5"
ELEVENLABS_VOICES = {
    "custom": "DODLEQrClDo8wCz460ld",
    "custom2": "qSeXEcewz7tA0Q0qk9fH",
    "custom3": "kdmDKE6EkgrWrrykO9Qt",
    "custom4": "7li2FesTkwg1glJviKzT",
    "rachel": "21m00Tcm4TlvDq8ikWAM",
    "bella": "EXAVITQu4vr4xnSDxMaL",
    "elli": "MF3mGyEYCl7XYWbV9V6O",
    "domi": "AZnzlk1XvdvUeBnXmlld",
    "antoni": "ErXwobaYiN019PkySvjV",
    "josh": "TxGEqnHWrfWFTfGW9XjX",
    "adam": "pNInz6obpgDQGcFmaJgB",
    "sam": "yoZ06aMxZJJ28mfd3POQ",
}


def resolve_voice(provider: str | None, voice: str | None) -> tuple[str, str]:
    """Return (provider, voice) after validation, falling back to defaults."""
    if provider == "elevenlabs" and voice and voice in ELEVENLABS_VOICES:
        if not settings.elevenlabs_api_key:
            return DEFAULT_TTS_PROVIDER, DEFAULT_TTS_VOICE
        return "elevenlabs", voice
    if voice and voice in OPENAI_VOICES:
        return "openai", voice
    return DEFAULT_TTS_PROVIDER, DEFAULT_TTS_VOICE


async def _synthesize_openai(text: str, voice: str) -> bytes:
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    async with client.audio.speech.with_streaming_response.create(
        model=OPENAI_TTS_MODEL,
        voice=voice,
        input=text,
        response_format="mp3",
    ) as response:
        chunks = [chunk async for chunk in response.iter_bytes()]
    return b"".join(chunks)


_UNICODE_FRACTIONS = {
    "½": "one half",
    "⅓": "one third",
    "⅔": "two thirds",
    "¼": "one quarter",
    "¾": "three quarters",
    "⅕": "one fifth",
    "⅖": "two fifths",
    "⅗": "three fifths",
    "⅘": "four fifths",
    "⅙": "one sixth",
    "⅚": "five sixths",
    "⅛": "one eighth",
    "⅜": "three eighths",
    "⅝": "five eighths",
    "⅞": "seven eighths",
}

_FRACTION_WORDS = {
    (1, 2): "one half",
    (1, 3): "one third",
    (2, 3): "two thirds",
    (1, 4): "one quarter",
    (3, 4): "three quarters",
    (1, 8): "one eighth",
    (3, 8): "three eighths",
}

# Unit abbreviations -> (singular, plural). Word-boundary matched.
_UNIT_EXPANSIONS = [
    (r"tbsps?", "tablespoon", "tablespoons"),
    (r"tbs", "tablespoon", "tablespoons"),
    (r"tsps?", "teaspoon", "teaspoons"),
    (r"ozs?", "ounce", "ounces"),
    (r"lbs?", "pound", "pounds"),
    (r"kgs?", "kilogram", "kilograms"),
    (r"mls?", "milliliter", "milliliters"),
    (r"mins?", "minute", "minutes"),
    (r"hrs?", "hour", "hours"),
    (r"secs?", "second", "seconds"),
]


def _expand_unit(match: re.Match, singular: str, plural: str) -> str:
    qty_str = (match.group("qty") or "").strip()
    word = plural
    try:
        if qty_str and float(qty_str) == 1:
            word = singular
    except ValueError:
        pass
    return f"{qty_str} {word}".strip()


def normalize_for_tts(text: str) -> str:
    """Expand kitchen abbreviations, units, fractions, and degree symbols
    so TTS engines without internal normalization (e.g. ElevenLabs) read
    them naturally."""
    out = text

    # Unicode fractions
    for sym, words in _UNICODE_FRACTIONS.items():
        out = out.replace(sym, words)

    # Ascii fractions like "1/2", "3/4", optionally with a leading whole number
    def _frac_sub(m: re.Match) -> str:
        whole = m.group("whole")
        num = int(m.group("num"))
        den = int(m.group("den"))
        words = _FRACTION_WORDS.get((num, den), f"{num} over {den}")
        if whole:
            return f"{whole} and {words}"
        return words

    out = re.sub(
        r"(?:(?P<whole>\d+)\s+)?(?P<num>\d+)/(?P<den>\d+)",
        _frac_sub,
        out,
    )

    # Temperatures: "350°F", "200 °C", "180°"
    out = re.sub(r"(\d+)\s*°\s*F\b", r"\1 degrees Fahrenheit", out)
    out = re.sub(r"(\d+)\s*°\s*C\b", r"\1 degrees Celsius", out)
    out = re.sub(r"(\d+)\s*°", r"\1 degrees", out)

    # Units: "2 tbsp", "1 tsp", or a bare "tsp" after a spelled-out fraction.
    # Optional period after the unit is consumed *but* re-emitted only when
    # it's a real sentence terminator (followed by space/end), so "tsp." in
    # the middle of a sentence keeps the period.
    for pattern, singular, plural in _UNIT_EXPANSIONS:
        out = re.sub(
            rf"(?:(?P<qty>\d+(?:\.\d+)?)\s*)?\b{pattern}\b",
            lambda m, s=singular, p=plural: _expand_unit(m, s, p),
            out,
            flags=re.IGNORECASE,
        )

    # Collapse double spaces from substitutions
    out = re.sub(r"\s{2,}", " ", out).strip()
    return out


async def _synthesize_elevenlabs(text: str, voice_key: str) -> bytes:
    voice_id = ELEVENLABS_VOICES[voice_key]
    spoken = normalize_for_tts(text)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": settings.elevenlabs_api_key,
        "accept": "audio/mpeg",
        "content-type": "application/json",
    }
    payload = {
        "text": spoken,
        "model_id": ELEVENLABS_MODEL,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        return resp.content


async def synthesize_speech(
    text: str,
    voice: str | None = None,
    provider: str | None = None,
) -> bytes:
    resolved_provider, resolved_voice = resolve_voice(provider, voice)
    if resolved_provider == "elevenlabs":
        try:
            return await _synthesize_elevenlabs(text, resolved_voice)
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "ElevenLabs TTS failed (%s); falling back to OpenAI Nova",
                exc.response.status_code,
            )
            return await _synthesize_openai(text, DEFAULT_TTS_VOICE)
    return await _synthesize_openai(text, resolved_voice)


SYSTEM_PROMPT = """\
You are a hands-free cooking assistant guiding a user through a recipe \
while they cook. They have messy hands and want short, friendly responses.

You receive:
- The recipe (title + all steps)
- Their current step index (0-based)
- A transcribed utterance from the user

Decide what they want, then respond with a SINGLE JSON object matching:
{
  "intent": "next" | "back" | "repeat" | "goto" | "timer" | "answer" | "unknown",
  "step_delta": null or integer,
  "target_step": null or 0-based step index,
  "timer_seconds": null or integer,
  "speech": "1-3 short sentences, conversational, no markdown, no emoji"
}

Rules:
- "next" / "ok done" / "what's next" → intent="next", step_delta=1. \
  In speech, briefly confirm and read the new step.
- "back" / "previous" / "go back" → intent="back", step_delta=-1. Read the previous step.
- "repeat" / "say that again" → intent="repeat". Re-read the current step text exactly.
- "go to step 5" → intent="goto", target_step=4 (0-based). Read that step.
- "set a 5 minute timer" / "10 second timer" → intent="timer", timer_seconds=300. \
  Just confirm the timer ("Starting a 5 minute timer.") — do not read a step.
- Cooking questions ("why", "how", "what does X mean", "can I substitute Y") → \
  intent="answer". Give a 1-3 sentence answer grounded in the current step or recipe context.
- Anything unclear or unrelated → intent="unknown", \
  speech="Sorry, I didn't catch that. Try saying next, back, or ask a question."

If the user is already on the last step and asks for next, gently say so. \
Same for back from step 1. Never invent steps that aren't in the recipe.

The "speech" field is read aloud by a text-to-speech engine, so write it for the ear:
- Spell out units and quantities: "two tablespoons" not "2 tbsp", "one teaspoon" not "1 tsp", \
  "350 degrees Fahrenheit" not "350°F", "one half cup" not "1/2 cup".
- Spell out abbreviations: "ounce", "pound", "minute", "second" — no "oz", "lb", "min", "sec".
- No symbols, no markdown, no parentheses, no slashes. Just natural spoken sentences.
"""


_NEXT_PATTERNS = (
    "next", "next step", "next one", "go on", "continue", "keep going",
    "okay next", "ok next", "done", "im done", "i'm done", "im ready",
    "ready", "got it", "moving on",
)
_BACK_PATTERNS = (
    "back", "go back", "previous", "previous step", "last step", "before",
    "one back",
)
_REPEAT_PATTERNS = (
    "repeat", "say again", "say that again", "again", "what was that",
    "one more time", "repeat that", "what did you say",
)


def _normalize(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9' ]+", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def match_keyword_intent(
    transcript: str,
    recipe: dict,
    current_step: int,
) -> VoiceResponse | None:
    """Fast-path simple navigation commands; return None if the LLM is needed."""
    norm = _normalize(transcript)
    if not norm or len(norm.split()) > 4:
        return None

    steps = recipe.get("steps") or []
    total = len(steps)

    def step_text(i: int) -> str:
        if 0 <= i < total:
            return steps[i].get("instruction", "") or ""
        return ""

    if norm in _NEXT_PATTERNS:
        if current_step >= total - 1:
            return VoiceResponse(
                intent="next",
                step_delta=0,
                speech="That was the last step. You're done.",
                transcript=transcript,
            )
        target = current_step + 1
        return VoiceResponse(
            intent="next",
            step_delta=1,
            speech=f"Step {target + 1}. {step_text(target)}",
            transcript=transcript,
        )

    if norm in _BACK_PATTERNS:
        if current_step <= 0:
            return VoiceResponse(
                intent="back",
                step_delta=0,
                speech="You're on the first step.",
                transcript=transcript,
            )
        target = current_step - 1
        return VoiceResponse(
            intent="back",
            step_delta=-1,
            speech=f"Step {target + 1}. {step_text(target)}",
            transcript=transcript,
        )

    if norm in _REPEAT_PATTERNS:
        return VoiceResponse(
            intent="repeat",
            speech=f"Step {current_step + 1}. {step_text(current_step)}",
            transcript=transcript,
        )

    return None


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.m4a") -> str:
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    f = BytesIO(audio_bytes)
    f.name = filename
    result = await client.audio.transcriptions.create(model="whisper-1", file=f)
    return (result.text or "").strip()


async def process_voice_turn(
    recipe: dict,
    current_step: int,
    *,
    transcript: str | None = None,
    audio_bytes: bytes | None = None,
    audio_filename: str = "audio.m4a",
    voice: str | None = None,
    provider: str | None = None,
) -> VoiceResponse:
    """Resolve a voice turn. Prefer a client-supplied (on-device) transcript;
    fall back to Whisper transcription of audio_bytes when no transcript is
    given."""
    if transcript is None:
        if audio_bytes is None:
            raise ValueError("Either transcript or audio_bytes must be provided")
        transcript = await transcribe_audio(audio_bytes, audio_filename)
    transcript = (transcript or "").strip()

    if not transcript:
        return VoiceResponse(
            intent="unknown",
            speech="I didn't hear anything. Try again.",
            transcript="",
        )

    fast = match_keyword_intent(transcript, recipe, current_step)
    if fast is not None:
        if fast.speech:
            try:
                audio_bytes_out = await synthesize_speech(fast.speech, voice, provider)
                fast.speech_audio_b64 = base64.b64encode(audio_bytes_out).decode("ascii")
                fast.speech_audio_mime = "audio/mpeg"
            except Exception as exc:
                logger.warning("TTS synthesis failed (fast-path): %s", exc)
        return fast

    steps = recipe.get("steps") or []
    step_texts = [s.get("instruction", "") for s in steps]
    current_text = step_texts[current_step] if 0 <= current_step < len(step_texts) else ""

    context = {
        "recipe_title": recipe.get("title"),
        "total_steps": len(step_texts),
        "current_step_index": current_step,
        "current_step_text": current_text,
        "all_steps": step_texts,
        "user_said": transcript,
    }

    client = chat_client()
    response = await client.chat.completions.create(
        model=settings.chat_model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(context)},
        ],
    )

    raw = response.choices[0].message.content or "{}"
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Voice intent returned non-JSON: %s", raw[:200])
        return VoiceResponse(
            intent="unknown",
            speech="Sorry, something went wrong. Try again.",
            transcript=transcript,
        )

    payload["transcript"] = transcript
    result = VoiceResponse.model_validate(payload)

    if result.speech:
        try:
            audio_bytes = await synthesize_speech(result.speech, voice, provider)
            result.speech_audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
            result.speech_audio_mime = "audio/mpeg"
        except Exception as exc:
            logger.warning("TTS synthesis failed: %s", exc)

    return result
