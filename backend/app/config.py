from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    google_maps_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    frontend_url: str = "http://localhost:3000"

    model_config = {"env_file": ".env"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
