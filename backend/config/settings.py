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

settings = Settings()
