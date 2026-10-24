"""In-memory job registries and TTL-based pruning.

The renderer/downloader keep their progress in module level dictionaries.  A
long-running server would otherwise grow forever because finished jobs were
never removed.  This module provides a dependency-free pruning helper plus a
``prune_all_jobs`` facade wired into the background cleanup worker.
"""

from __future__ import annotations

import os
import time
from typing import Any, Dict, Iterable, Optional

DONE_STATUSES = frozenset({"ready", "completed", "error", "failed", "cancelled"})
RENDER_DONE_STATUSES = frozenset({"completed", "error"})
DEFAULT_JOB_TTL_SECONDS = 6 * 60 * 60  # 6 hours
DEFAULT_MAX_JOBS = 200


def job_ttl_seconds() -> int:
    try:
        return max(60, int(os.environ.get("JOB_TTL_SECONDS", DEFAULT_JOB_TTL_SECONDS)))
    except (TypeError, ValueError):
        return DEFAULT_JOB_TTL_SECONDS


def prune_registry(
    registry: Dict[str, Any],
    *,
    status_key: str = "status",
    done_statuses: Iterable[str] = DONE_STATUSES,
    max_age_seconds: float = DEFAULT_JOB_TTL_SECONDS,
    max_entries: Optional[int] = DEFAULT_MAX_JOBS,
    now: Optional[float] = None,
) -> int:
    """Drop finished jobs older than ``max_age_seconds`` (and cap history).

    Running jobs are never touched.  Returns the number of removed entries.
    """
    if not registry:
        return 0

    current = time.time() if now is None else now
    done = set(done_statuses)
    removed = 0

    for key, job in list(registry.items()):
        if not isinstance(job, dict) or job.get(status_key) not in done:
            continue
        created_at = job.get("created_at") or job.get("_created_at")
        try:
            created = float(created_at) if created_at is not None else current
        except (TypeError, ValueError):
            created = current
        if current - created > max_age_seconds:
            registry.pop(key, None)
            removed += 1

    if max_entries is not None and max_entries >= 0 and len(registry) > max_entries:
        finished = []
        for key, job in registry.items():
            if isinstance(job, dict) and job.get(status_key) in done:
                try:
                    created = float(job.get("created_at", 0))
                except (TypeError, ValueError):
                    created = 0.0
                finished.append((created, key))
        finished.sort()
        for _, key in finished[: max(0, len(registry) - max_entries)]:
            registry.pop(key, None)
            removed += 1

    return removed


def prune_all_jobs(
    *,
    max_age_seconds: Optional[float] = None,
    max_entries: int = DEFAULT_MAX_JOBS,
) -> Dict[str, int]:
    """Prune every job registry and return per-registry removal counts."""
    # Imported lazily to avoid a circular import with backend.config.
    from backend.services.download_service import (
        raw_clip_download_jobs,
        raw_download_jobs,
    )
    from backend.services.render_service import BATCH_REQUESTS, RENDER_BATCHES

    ttl = job_ttl_seconds() if max_age_seconds is None else max_age_seconds
    results = {
        "raw_downloads": prune_registry(
            raw_download_jobs, max_age_seconds=ttl, max_entries=max_entries
        ),
        "raw_clips": prune_registry(
            raw_clip_download_jobs, max_age_seconds=ttl, max_entries=max_entries
        ),
        "render_batches": prune_registry(
            RENDER_BATCHES,
            status_key="overall_status",
            done_statuses=RENDER_DONE_STATUSES,
            max_age_seconds=ttl,
            max_entries=max_entries,
        ),
    }
    # Drop cached request payloads whose batch metadata has already been pruned.
    for batch_id in list(BATCH_REQUESTS):
        if batch_id not in RENDER_BATCHES:
            BATCH_REQUESTS.pop(batch_id, None)
            results["batch_requests"] = results.get("batch_requests", 0) + 1
    return results
