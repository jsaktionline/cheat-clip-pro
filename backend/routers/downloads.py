import re
import time
import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException

from backend.config import EXPORTS_DIR
from backend.schemas.downloads import RawClipDownloadRequest, RawVideoDownloadRequest
from backend.services.download_service import (
    raw_clip_download_jobs,
    raw_download_jobs,
    run_raw_clip_download_job,
    run_raw_download_job,
)
from backend.utils.security import is_allowed_remote_url

router = APIRouter(tags=["Downloads"])


def _normalise_media_url(raw_url: str, video_id: str) -> str:
    """Normalise a download request into a vetted YouTube/Drive/local URL.

    Local references are restricted to the app's own ``/api/video/`` route so a
    caller can never ask the backend to read an arbitrary filesystem path.
    """
    v_url = (raw_url or "").strip()
    if video_id and (video_id.startswith("gdrive_") or video_id.startswith("upload_")):
        if not v_url.startswith("/api/video/"):
            v_url = f"/api/video/{video_id}"
    elif not v_url:
        if video_id:
            v_url = f"https://www.youtube.com/watch?v={video_id}"
    elif not v_url.startswith(("http://", "https://", "/api/video/")):
        # Accept a bare YouTube video id only; reject paths, schemes and spaces.
        if not re.fullmatch(r"[A-Za-z0-9_-]{6,64}", v_url):
            raise HTTPException(status_code=400, detail="Unsupported video source.")
        v_url = f"https://www.youtube.com/watch?v={v_url}"

    if v_url.startswith(("http://", "https://")):
        if not is_allowed_remote_url(v_url):
            raise HTTPException(
                status_code=400,
                detail="Unsupported video source. Only YouTube and Google Drive links are allowed.",
            )
    elif not v_url.startswith("/api/video/"):
        raise HTTPException(status_code=400, detail="Unsupported video source.")
    return v_url


@router.post("/api/download-raw-video")
async def handle_download_raw_video(req: RawVideoDownloadRequest, background_tasks: BackgroundTasks):
    v_url = _normalise_media_url(req.video_url, req.video_id)

    job_id = str(uuid.uuid4())[:8]
    safe_id = re.sub(r'[^a-zA-Z0-9_-]', '_', req.video_id or "youtube_video")
    filename = f"{safe_id}_raw_{int(time.time())}.mp4"
    out_path = str(EXPORTS_DIR / filename)

    clean_title = re.sub(r'[\\/*?:"<>|]', "", (req.title or "").strip())
    download_title = f"{clean_title} (Full Video)" if clean_title else f"{safe_id} (Full Video)"

    raw_download_jobs[job_id] = {
        "job_id": job_id,
        "status": "starting",
        "progress_percent": 0.0,
        "downloaded": "",
        "total": "",
        "speed": "",
        "eta": "",
        "download_url": None,
        "filename": f"{download_title}.mp4",
        "error": None,
        "created_at": time.time(),
    }

    background_tasks.add_task(run_raw_download_job, job_id, v_url, out_path, filename, download_title, req.cookies)
    return {"job_id": job_id, "status": "starting"}


@router.get("/api/download-raw-status/{job_id}")
async def get_raw_download_status(job_id: str):
    job = raw_download_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Download job not found")
    return job


@router.post("/api/download-raw-clip")
async def handle_download_raw_clip(req: RawClipDownloadRequest, background_tasks: BackgroundTasks):
    v_url = _normalise_media_url(req.video_url, req.video_id)

    job_id = str(uuid.uuid4())[:8]
    clean_title = re.sub(r'[\\/*?:"<>|]', "", (req.title or "clip").strip()) or "clip"
    download_title = f"{clean_title} (raw)"

    raw_clip_download_jobs[job_id] = {
        "job_id": job_id,
        "status": "starting",
        "progress_percent": 0.0,
        "title": download_title,
        "download_url": None,
        "filename": f"{download_title}.mp4",
        "error": None,
        "created_at": time.time(),
    }

    background_tasks.add_task(
        run_raw_clip_download_job,
        job_id,
        v_url,
        req.video_id,
        req.start_time,
        req.end_time,
        req.title,
        req.cookies
    )
    return {"job_id": job_id, "status": "starting"}


@router.get("/api/download-raw-clip-status/{job_id}")
async def get_raw_clip_download_status(job_id: str):
    job = raw_clip_download_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Clip download job not found")
    return job
