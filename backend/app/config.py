from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

DISCLAIMER = (
    "Surgify AI is an educational prototype for simulated skills training. "
    "It is not intended for real-patient use, diagnosis, clinical decision-making, "
    "treatment planning, medication guidance, or certification of surgical competence."
)


class Settings(BaseSettings):
    app_name: str = "Surgify AI Backend"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    api_prefix: str = "/api/v1"
    version: str = "0.1.0"

    database_url: str = "sqlite:///./surgify.db"

    frontend_origins: str = ("http://localhost:3000,http://127.0.0.1:3000,"
                             "http://localhost:3001,http://127.0.0.1:3001")

    vision_mode: str = "opencv"  # mock | opencv — hand tracking runs on-device in the frontend
    enable_opencv: bool = True
    upload_dir: str = "./uploads"
    max_frame_size_mb: int = 5

    aruco_dictionary: str = "DICT_4X4_50"
    tool_marker_h_min: int = 80
    tool_marker_h_max: int = 110

    enable_external_llm: bool = False
    anthropic_api_key: str = ""

    demo_mode: bool = True
    vitals_interval_seconds: float = 4.0
    max_trajectory_points: int = 5000

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
