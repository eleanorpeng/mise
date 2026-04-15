from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class VoiceAskRequest(BaseModel):
    recipeId: str
    currentStep: int
    question: str


@router.post("/ask")
async def ask_voice(request: VoiceAskRequest):
    # TODO: call services/voice_assistant.py
    return {"answer": "", "nextStep": None}
