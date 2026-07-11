from fastapi import APIRouter, File, Form, UploadFile
from starlette.concurrency import run_in_threadpool

from ..config import get_settings
from ..schemas import VisionFrameResult
from ..services.data_store import ApiError
from ..services.vision import get_adapter

router = APIRouter()
settings = get_settings()

ALLOWED_TYPES = {"image/jpeg", "image/png", "application/octet-stream"}


@router.post("/vision/frame", response_model=VisionFrameResult)
async def process_frame(
    frame: UploadFile = File(...),
    session_id: str | None = Form(default=None),
    timestamp_ms: int | None = Form(default=None),
    mode: str | None = Form(default=None),
):
    if frame.content_type and frame.content_type not in ALLOWED_TYPES:
        raise ApiError(400, "UNSUPPORTED_MEDIA", f"Unsupported frame type '{frame.content_type}'. Use JPEG or PNG.")
    data = await frame.read()
    if len(data) > settings.max_frame_size_mb * 1024 * 1024:
        raise ApiError(413, "FRAME_TOO_LARGE", f"Frame exceeds {settings.max_frame_size_mb} MB limit.")
    if not data:
        raise ApiError(400, "EMPTY_FRAME", "The uploaded frame is empty.")
    if mode and mode not in ("mock", "opencv"):
        raise ApiError(400, "UNKNOWN_VISION_MODE", f"Unknown vision mode '{mode}'.")
    return await run_in_threadpool(get_adapter(mode).process, data, session_id)


@router.get("/vision/modes")
def vision_modes():
    return {"default": settings.vision_mode, "available": ["mock", "opencv"]}
