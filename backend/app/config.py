from pathlib import Path

from pydantic_settings import BaseSettings

_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""
    openai_api_key: str = ""
    edamam_app_id: str = ""
    edamam_app_key: str = ""

    # DigitalOcean serverless inference (OpenAI-compatible). When the key is
    # set, text chat completions route here; vision/Whisper/TTS stay on OpenAI.
    do_inference_api_key: str = ""
    do_inference_base_url: str = "https://inference.do-ai.run/v1/"
    # DO model slug for text chat. OpenAI/Anthropic slugs require a higher DO
    # tier; llama3.3-70b-instruct is available and supports JSON mode.
    chat_model: str = "llama3.3-70b-instruct"

    # OpenRouter (OpenAI-compatible) for vision. When the key is set, the photo
    # and video recipe pipelines route here; otherwise they use OpenAI directly.
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    vision_model: str = "google/gemini-2.5-pro"
    vision_model_fast: str = "google/gemini-2.5-flash"

    # Text-to-speech for voice cook-along. Routes to Mistral Voxtral Mini TTS
    # via OpenRouter when OPENROUTER_API_KEY is set; otherwise OpenAI TTS.
    voxtral_tts_model: str = "mistralai/voxtral-mini-tts-2603"

    # Speech-to-text (video import + voice cook-along). When OpenRouter is set,
    # audio is sent to this audio-capable chat model via chat completions
    # (OpenRouter has no Whisper file endpoint); otherwise OpenAI Whisper.
    # gemini-2.5-flash returns clean transcripts and is already used for vision.
    transcribe_model: str = "google/gemini-2.5-flash"

    # extra="ignore" so unrelated keys in .env / the shell environment (e.g. a
    # stray ELEVENLABS_API_KEY) don't crash settings load — and thus startup.
    model_config = {"env_file": str(_ENV_FILE), "extra": "ignore"}


settings = Settings()
