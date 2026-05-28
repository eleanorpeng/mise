"""Centralised OpenAI client construction.

`chat_client()` returns a client pointed at DigitalOcean serverless inference
when DO_INFERENCE_API_KEY is configured (OpenAI-compatible, spends the sponsored
credits), otherwise falls back to OpenAI directly. Use it for plain text chat
completions — including JSON-mode calls.

`openai_client()` always returns a direct OpenAI client. Use it for features DO
inference does not reliably support: vision (image inputs), Whisper
transcription, and TTS.
"""

from openai import AsyncOpenAI

from app.config import settings


def chat_client() -> AsyncOpenAI:
    if settings.do_inference_api_key:
        return AsyncOpenAI(
            api_key=settings.do_inference_api_key,
            base_url=settings.do_inference_base_url,
        )
    return AsyncOpenAI(api_key=settings.openai_api_key)


def openai_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.openai_api_key)


def vision_client() -> AsyncOpenAI:
    """Client for image-input (vision) calls. Routes to OpenRouter when
    configured, otherwise OpenAI directly."""
    if settings.openrouter_api_key:
        return AsyncOpenAI(
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
        )
    return AsyncOpenAI(api_key=settings.openai_api_key)


def vision_model(fast: bool = False) -> str:
    """Model slug for vision calls — provider-specific. OpenRouter namespaces
    slugs (openai/gpt-4o); OpenAI uses bare slugs (gpt-4o)."""
    if settings.openrouter_api_key:
        return settings.vision_model_fast if fast else settings.vision_model
    return "gpt-4o-mini" if fast else "gpt-4o"


def transcribe_client() -> AsyncOpenAI:
    """Client for speech-to-text. Routes to OpenRouter (Voxtral Mini
    Transcribe) when configured, otherwise OpenAI Whisper."""
    if settings.openrouter_api_key:
        return AsyncOpenAI(
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
        )
    return AsyncOpenAI(api_key=settings.openai_api_key)


def transcribe_model() -> str:
    """Model slug for transcription — provider-specific."""
    if settings.openrouter_api_key:
        return settings.transcribe_model
    return "whisper-1"
