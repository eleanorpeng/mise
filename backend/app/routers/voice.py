from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.auth import get_current_user
from app.rate_limit import limiter

router = APIRouter()


class VoiceAskRequest(BaseModel):
    recipeId: str
    currentStep: int
    question: str


@router.post("/ask")
@limiter.limit("20/minute")
async def ask_voice(
    request: Request,
    body: VoiceAskRequest,
    user_id: str = Depends(get_current_user),
):
    # TODO: call services/voice_assistant.py
    return {"answer": "", "nextStep": None}
