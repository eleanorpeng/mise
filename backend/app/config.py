from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/mise"
    openai_api_key: str = ""
    edamam_app_id: str = ""
    edamam_app_key: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()
