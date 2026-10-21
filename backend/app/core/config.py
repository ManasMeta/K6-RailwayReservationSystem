"""Core configuration settings for NRRMS FastAPI backend."""

import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/nrrms_test"
    )
    JWT_SECRET: str = os.getenv("JWT_SECRET", "ci-only-secret-for-nrrms-development")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    HOLD_EXPIRY_MINUTES: int = 10


settings = Settings()
