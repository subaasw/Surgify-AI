from fastapi import APIRouter

from . import catalog, results, sessions, vision

api_router = APIRouter()
api_router.include_router(catalog.router, tags=["catalog"])
api_router.include_router(sessions.router, tags=["sessions"])
api_router.include_router(results.router, tags=["results"])
api_router.include_router(vision.router, tags=["vision"])
