import os
import json
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=True, extra="ignore", env_file=".env")

    PROJECT_NAME: str = "FLOWCARE — AI-Powered Hospital Patient Flow & Healthcare Management System"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "flowcare-super-secure-production-grade-jwt-secret-key-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database Configuration
    MYSQL_HOST: str = os.getenv("MYSQL_HOST", "localhost")
    MYSQL_PORT: int = int(os.getenv("MYSQL_PORT", 3306))
    MYSQL_USER: str = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD: str = os.getenv("MYSQL_PASSWORD", "")
    MYSQL_DB: str = os.getenv("MYSQL_DB", "flowcare_db")
    
    # Optional direct database URL override
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # Hybrid Encryption Secret Configuration
    ENCRYPTION_MASTER_KEY: str = os.getenv("ENCRYPTION_MASTER_KEY", "flowcare-medical-aes256-master-key-32b-2026-secure")

    # Cloud Synchronization Configuration
    CLOUD_SYNC_ENABLED: bool = os.getenv("CLOUD_SYNC_ENABLED", "false").lower() in ("true", "1", "yes")
    CLOUD_ENDPOINT_URL: str = os.getenv("CLOUD_ENDPOINT_URL", "https://cloud-sync.flowcare-hospital.demo/api/v1")
    CLOUD_API_KEY: str = os.getenv("CLOUD_API_KEY", "flowcare_cloud_sync_api_key_2026_demo")

    # WebRTC / TURN Configuration
    TURN_ENABLED: bool = os.getenv("TURN_ENABLED", "false").lower() in ("true", "1", "yes")
    TURN_URLS: str = os.getenv("TURN_URLS", "")
    TURN_SECRET: str = os.getenv("TURN_SECRET", "")
    TURN_CREDENTIAL_TTL: int = int(os.getenv("TURN_CREDENTIAL_TTL", "86400"))

    @property
    def parsed_turn_urls(self) -> List[str]:
        raw = self.TURN_URLS.strip()
        if not raw:
            return []
        if raw.startswith("[") and raw.endswith("]"):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            except Exception:
                pass
        if "," in raw:
            return [i.strip() for i in raw.split(",") if i.strip()]
        return [raw]

    # CORS Configuration
    @property
    def CORS_ORIGINS(self) -> List[str]:
        raw = os.getenv("CORS_ORIGINS", "*").strip()
        if not raw:
            return ["*"]
        if raw.startswith("[") and raw.endswith("]"):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [str(item) for item in parsed]
            except Exception:
                pass
        if "," in raw:
            return [i.strip() for i in raw.split(",") if i.strip()]
        return [raw]

    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+psycopg2://", 1)
            elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
                url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
            return url
        if self.MYSQL_PASSWORD:
            return f"mysql+pymysql://{self.MYSQL_USER}:{self.MYSQL_PASSWORD}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DB}?charset=utf8mb4"
        else:
            return f"mysql+pymysql://{self.MYSQL_USER}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/{self.MYSQL_DB}?charset=utf8mb4"

settings = Settings()


