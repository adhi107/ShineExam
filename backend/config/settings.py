import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017/shine")
    DB_NAME: str = os.getenv("DB_NAME", "shine")
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    PORT: int = int(os.getenv("PORT", "5000"))

    # Security settings
    # TTL for security session tokens stored in MongoDB (used for watermark session IDs)
    SESSION_TTL_HOURS: int = int(os.getenv("SESSION_TTL_HOURS", "8"))
    # Default rate-limit: max calls per window for the login endpoint
    RATE_LIMIT_LOGIN_MAX: int = int(os.getenv("RATE_LIMIT_LOGIN_MAX", "10"))
    RATE_LIMIT_LOGIN_PERIOD: int = int(os.getenv("RATE_LIMIT_LOGIN_PERIOD", "60"))

settings = Settings()
