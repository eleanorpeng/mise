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

    model_config = {"env_file": str(_ENV_FILE)}


settings = Settings()
