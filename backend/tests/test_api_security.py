"""Integration tests for the HTTP security layer (auth, SPA, headers)."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from backend.main import app, mount_spa
from backend.routers.downloads import _normalise_media_url
from backend.services.gdrive_service import is_google_drive_url
from backend.utils.auth import _presented_key, is_authorized

VALID_COOKIES = (
    "# Netscape HTTP Cookie File\n"
    ".youtube.com\tTRUE\t/\tTRUE\t2147483647\tSID\tsecret-value\n"
)


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)


def test_health_is_public_and_sets_security_headers(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "SAMEORIGIN"
    assert response.headers["Referrer-Policy"] == "no-referrer"


def test_state_changing_requests_require_api_key(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ADMIN_API_KEY", "s3cret")
    monkeypatch.delenv("CHEAT_CLIP_API_KEY", raising=False)

    denied = client.post("/api/cookies", json={"cookies_content": VALID_COOKIES})
    assert denied.status_code == 401
    assert "API key" in denied.json()["detail"]

    allowed = client.post(
        "/api/cookies",
        json={"cookies_content": VALID_COOKIES},
        headers={"X-API-Key": "s3cret"},
    )
    assert allowed.status_code == 200

    bearer = client.post(
        "/api/cookies",
        json={"cookies_content": VALID_COOKIES},
        headers={"Authorization": "Bearer s3cret"},
    )
    assert bearer.status_code == 200


def test_read_only_requests_stay_public(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("ADMIN_API_KEY", "s3cret")
    monkeypatch.delenv("CHEAT_CLIP_API_KEY", raising=False)
    assert client.get("/api/cookies").status_code == 200


class TestSpaMounting:
    @pytest.fixture()
    def spa(self, tmp_path: Path):
        dist = tmp_path / "dist"
        dist.mkdir()
        (dist / "index.html").write_text("SPA_INDEX", encoding="utf-8")
        (dist / "assets").mkdir()
        (dist / "assets" / "app.js").write_text("console.log('ok')", encoding="utf-8")
        (tmp_path / "secret.txt").write_text("TOP_SECRET_VALUE", encoding="utf-8")

        application = FastAPI()
        assert mount_spa(application, dist) is True
        return TestClient(application), dist

    def test_serves_built_assets(self, spa):
        client, _ = spa
        response = client.get("/assets/app.js")
        assert response.status_code == 200
        assert "console.log" in response.text

    def test_unknown_route_falls_back_to_index(self, spa):
        client, _ = spa
        response = client.get("/some/deep/link")
        assert response.status_code == 200
        assert response.text == "SPA_INDEX"

    @pytest.mark.parametrize(
        "payload",
        [
            "/../secret.txt",
            "/..%2fsecret.txt",
            "/..%2f..%2fetc%2fpasswd",
            "/%2e%2e/%2e%2e/etc/passwd",
        ],
    )
    def test_never_serves_files_outside_dist(self, spa, payload: str):
        client, _ = spa
        response = client.get(payload)
        assert "TOP_SECRET_VALUE" not in response.text
        assert "root:" not in response.text
        assert response.text == "SPA_INDEX"

    def test_mount_is_skipped_without_build(self, tmp_path: Path):
        assert mount_spa(FastAPI(), tmp_path / "missing") is False


class TestAuthHelpers:
    def test_authorization_matrix(self):
        assert is_authorized("", "") is True
        assert is_authorized("anything", "") is True
        assert is_authorized("key", "key") is True
        assert is_authorized("", "key") is False
        assert is_authorized("wrong", "key") is False

    def test_extracts_header_or_bearer_token(self):
        assert _presented_key([(b"x-api-key", b"abc")]) == "abc"
        assert _presented_key([(b"authorization", b"Bearer xyz")]) == "xyz"
        assert _presented_key([(b"authorization", b"Basic xyz")]) == ""


class TestDownloadUrlValidation:
    def test_allows_youtube_and_local_references(self):
        assert _normalise_media_url("https://youtu.be/abc", "") == "https://youtu.be/abc"
        assert _normalise_media_url("/api/video/upload_x.mp4", "") == "/api/video/upload_x.mp4"
        assert _normalise_media_url("", "upload_abc") == "/api/video/upload_abc"

    @pytest.mark.parametrize(
        "url",
        [
            "http://169.254.169.254/latest/meta-data/",
            "http://localhost:8000/api/health",
            "file:///etc/passwd",
            "/etc/passwd",
            "https://youtube.com.evil.example/watch?v=1",
        ],
    )
    def test_rejects_ssrf_and_local_paths(self, url: str):
        with pytest.raises(HTTPException) as exc:
            _normalise_media_url(url, "")
        assert exc.value.status_code == 400

    def test_google_drive_detection_is_host_based(self):
        assert is_google_drive_url("https://drive.google.com/file/d/abc/view") is True
        assert is_google_drive_url("https://evil.example/?x=drive.google.com") is False
