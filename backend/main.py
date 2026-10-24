import asyncio
from contextlib import asynccontextmanager
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

# Initialize environment and configuration
from backend.config import logger
from backend.routers import (
    analyze_router,
    cookies_router,
    downloads_router,
    media_router,
    render_router,
    system_router,
)
# Re-exports for backwards compatibility
from backend.services.system_service import auto_cleanup_expired_files
from backend.services.job_registry import prune_all_jobs
from backend.utils.auth import api_key_middleware
from backend.utils.security import resolve_spa_file


async def background_storage_cleanup_worker():
    """
    Background worker that runs every 30 minutes (configurable via CLEANUP_INTERVAL_SECONDS):
    1. Option 1: TTL cleanup (files older than 1 hour / TEMP_MAX_AGE_SECONDS).
    2. Option 2: 5GB Max Quota ceiling (FIFO purge oldest files down to 80% if quota exceeded).
    """
    # Initial pause on startup
    await asyncio.sleep(15)
    while True:
        try:
            ttl_seconds = int(os.environ.get("TEMP_MAX_AGE_SECONDS", "3600"))
            max_quota_gb = float(os.environ.get("TEMP_STORAGE_QUOTA_GB", "5.0"))
            max_quota_bytes = int(max_quota_gb * 1024 * 1024 * 1024)
            auto_cleanup_expired_files(max_age_seconds=ttl_seconds, max_storage_bytes=max_quota_bytes)

            pruned = prune_all_jobs()
            if any(pruned.values()):
                logger.info(f"[Auto-Cleanup] Pruned stale job entries: {pruned}")
        except Exception as e:
            logger.warning(f"[Auto-Cleanup] Background worker encountered an error: {e}")

        interval_seconds = int(os.environ.get("CLEANUP_INTERVAL_SECONDS", "1800"))
        await asyncio.sleep(interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: spawn auto-cleanup background task
    cleanup_task = asyncio.create_task(background_storage_cleanup_worker())
    logger.info(
        "[Auto-Cleanup] Storage daemon active (Interval: %ss, Temp TTL: %ss, Quota: %sGB, Job TTL: %ss).",
        os.environ.get("CLEANUP_INTERVAL_SECONDS", "1800"),
        os.environ.get("TEMP_MAX_AGE_SECONDS", "3600"),
        os.environ.get("TEMP_STORAGE_QUOTA_GB", "5.0"),
        os.environ.get("JOB_TTL_SECONDS", "21600"),
    )
    yield
    # Shutdown: cancel task cleanly
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


# Initialize FastAPI Application
app = FastAPI(
    title="CHEAT CLIP PRO API",
    description="High-performance backend API for Cheat Clip Pro auto-clipper and video studio",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration supporting configurable ALLOWED_ORIGINS and local development
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "").strip()
if allowed_origins_env:
    allow_origins = [orig.strip() for orig in allowed_origins_env.split(",") if orig.strip()]
else:
    allow_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=r"^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Adds standard security headers to all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


# Optional API-key enforcement for state-changing requests (no-op unless
# ADMIN_API_KEY / CHEAT_CLIP_API_KEY is configured).
app.middleware("http")(api_key_middleware)


# Include Modular Routers
app.include_router(analyze_router)
app.include_router(render_router)
app.include_router(media_router)
app.include_router(cookies_router)
app.include_router(downloads_router)
app.include_router(system_router)

# Mount built frontend in production container if dist/ exists
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

dist_dir = Path(__file__).resolve().parent.parent / "dist"


def mount_spa(application: FastAPI, dist_path: Path) -> bool:
    """Serve the built Vite bundle, safely confined to ``dist_path``.

    Returns ``False`` when no production build is present (development mode).
    """
    if not (dist_path / "index.html").exists():
        return False

    assets_dir = dist_path / "assets"
    if assets_dir.exists():
        application.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @application.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        candidate = resolve_spa_file(dist_path, full_path) if full_path else None
        if candidate is not None:
            return FileResponse(candidate)
        return FileResponse(dist_path / "index.html")

    return True


if mount_spa(app, dist_dir):
    logger.info("Cheat Clip PRO production frontend mounted from dist/.")
else:
    logger.info("Cheat Clip PRO backend routers mounted successfully.")

if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("backend.main:app", host=host, port=port, reload=True)
