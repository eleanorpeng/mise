import base64
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from openai import OpenAIError
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.rate_limit import limiter
from app.routers.recipes import assemble_recipe
from app.services.voice_assistant import process_voice_turn, synthesize_speech

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/cook-along")
@limiter.limit("60/minute")
async def cook_along(
    request: Request,
    audio: UploadFile = File(...),
    recipe_id: str = Form(...),
    current_step: int = Form(...),
    voice: str | None = Form(None),
    provider: str | None = Form(None),
    user_id: str = Depends(get_current_user),
):
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio is required")

    recipe = assemble_recipe(recipe_id, user_id)

    try:
        result = await process_voice_turn(
            recipe,
            current_step,
            audio_bytes=audio_bytes,
            audio_filename=audio.filename or "audio.m4a",
            voice=voice,
            provider=provider,
        )
    except OpenAIError as exc:
        logger.warning("Voice turn failed: %s", exc)
        raise HTTPException(status_code=502, detail="Voice service temporarily unavailable")

    return result.model_dump()


class CookAlongTextRequest(BaseModel):
    recipe_id: str
    current_step: int
    transcript: str = Field(..., min_length=1, max_length=2000)
    voice: str | None = None
    provider: str | None = None


@router.post("/cook-along/text")
@limiter.limit("60/minute")
async def cook_along_text(
    request: Request,
    body: CookAlongTextRequest,
    user_id: str = Depends(get_current_user),
):
    recipe = assemble_recipe(body.recipe_id, user_id)
    try:
        result = await process_voice_turn(
            recipe,
            body.current_step,
            transcript=body.transcript,
            voice=body.voice,
            provider=body.provider,
        )
    except OpenAIError as exc:
        logger.warning("Voice turn failed: %s", exc)
        raise HTTPException(status_code=502, detail="Voice service temporarily unavailable")

    return result.model_dump()


class TtsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    voice: str | None = None
    provider: str | None = None


@router.post("/tts")
@limiter.limit("120/minute")
async def tts(
    request: Request,
    body: TtsRequest,
    user_id: str = Depends(get_current_user),
):
    try:
        audio_bytes = await synthesize_speech(body.text, body.voice, body.provider)
    except OpenAIError as exc:
        logger.warning("TTS failed: %s", exc)
        raise HTTPException(status_code=502, detail="TTS service temporarily unavailable")
    return {
        "audio_b64": base64.b64encode(audio_bytes).decode("ascii"),
        "mime": "audio/mpeg",
    }
