import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "J.A.R.V.I.S."
    API_V1_STR: str = "/api/v1"
    
    # Security
    JWT_SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 # 8 days
    
    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:4000",
        "http://localhost:3000",
        "http://127.0.0.1:4000",
        "http://127.0.0.1:3000",
    ]

    # Postgres
    DATABASE_URL: str
    
    # Qdrant
    QDRANT_HOST: str = os.getenv("QDRANT_HOST", "localhost")
    QDRANT_PORT: int = int(os.getenv("QDRANT_PORT", "6333"))
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # LLM APIs
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY", "")

    class Config:
        case_sensitive = True

settings = Settings()
