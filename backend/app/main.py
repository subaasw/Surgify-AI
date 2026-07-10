import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import websocket
from .api.router import api_router
from .config import DISCLAIMER, get_settings
from .database import init_db

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description=f"AI-assisted surgical simulation training backend. {DISCLAIMER}",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _error_response(status: int, code: str, message: str, details: dict) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {
        "code": code, "message": message, "details": details,
        "request_id": f"req_{uuid.uuid4().hex[:10]}",
    }})


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "code" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    return _error_response(exc.status_code, "HTTP_ERROR", str(exc.detail), {})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return _error_response(422, "VALIDATION_ERROR", "Request validation failed.",
                           {"errors": exc.errors()})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return _error_response(500, "INTERNAL_ERROR", "An unexpected server error occurred.", {})


app.include_router(api_router, prefix=settings.api_prefix)
app.include_router(websocket.router)


@app.get("/")
def root():
    return {"service": "surgify-ai-backend", "docs": "/docs", "api": settings.api_prefix,
            "disclaimer": DISCLAIMER}
