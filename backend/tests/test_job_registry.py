"""Unit tests for TTL pruning of the in-memory job registries."""

from __future__ import annotations

import time

import backend.services.download_service as download_service
import backend.services.render_service as render_service
from backend.services.job_registry import prune_all_jobs, prune_registry


class TestPruneRegistry:
    def test_removes_only_old_finished_jobs(self):
        now = 1_000_000.0
        registry = {
            "old_done": {"status": "ready", "created_at": now - 10_000},
            "fresh_done": {"status": "ready", "created_at": now - 10},
            "running": {"status": "downloading", "created_at": now - 10_000},
            "failed_old": {"status": "failed", "created_at": now - 10_000},
        }
        removed = prune_registry(registry, max_age_seconds=3_600, now=now)
        assert removed == 2
        assert set(registry) == {"fresh_done", "running"}

    def test_keeps_entries_without_timestamp(self):
        now = 1_000_000.0
        registry = {"legacy": {"status": "ready"}}
        assert prune_registry(registry, max_age_seconds=1, now=now) == 0
        assert "legacy" in registry

    def test_caps_history_size_oldest_first(self):
        registry = {
            f"done_{i}": {"status": "ready", "created_at": float(i)} for i in range(5)
        }
        registry["running"] = {"status": "rendering", "created_at": 0}
        prune_registry(registry, max_age_seconds=10**9, max_entries=2, now=10.0)
        assert len(registry) == 2
        assert "running" in registry
        assert "done_4" in registry

    def test_running_jobs_are_never_pruned_by_cap(self):
        registry = {
            "a": {"status": "rendering", "created_at": 0},
            "b": {"status": "transcribing", "created_at": 0},
            "c": {"status": "rendering", "created_at": 0},
        }
        prune_registry(registry, max_age_seconds=10**9, max_entries=1)
        assert len(registry) == 3

    def test_empty_registry(self):
        assert prune_registry({}) == 0


class TestPruneAllJobs:
    def test_prunes_every_registry_and_orphan_requests(self, monkeypatch):
        now = time.time()
        downloads = {
            "old": {"status": "ready", "created_at": now - 60_000},
            "new": {"status": "ready", "created_at": now},
        }
        clips = {"old": {"status": "failed", "created_at": now - 60_000}}
        batches = {
            "old_batch": {"overall_status": "completed", "created_at": now - 60_000},
            "new_batch": {"overall_status": "running", "created_at": now - 60_000},
        }
        requests = {"old_batch": object(), "new_batch": object()}

        monkeypatch.setattr(download_service, "raw_download_jobs", downloads)
        monkeypatch.setattr(download_service, "raw_clip_download_jobs", clips)
        monkeypatch.setattr(render_service, "RENDER_BATCHES", batches)
        monkeypatch.setattr(render_service, "BATCH_REQUESTS", requests)

        result = prune_all_jobs(max_age_seconds=3_600)

        assert result["raw_downloads"] == 1
        assert result["raw_clips"] == 1
        assert result["render_batches"] == 1
        assert set(downloads) == {"new"}
        assert clips == {}
        assert set(batches) == {"new_batch"}
        assert set(requests) == {"new_batch"}
