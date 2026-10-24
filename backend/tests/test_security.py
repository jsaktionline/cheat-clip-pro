"""Unit tests for :mod:`backend.utils.security`."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from backend.utils.security import (
    is_allowed_remote_url,
    is_local_media_reference,
    is_path_within,
    resolve_local_media,
    resolve_spa_file,
    resolve_within,
)


@pytest.fixture()
def media_root(tmp_path: Path) -> Path:
    root = tmp_path / "uploads"
    root.mkdir()
    (root / "clip.mp4").write_bytes(b"video")
    (root / "nested").mkdir()
    (root / "nested" / "inner.mp4").write_bytes(b"inner")
    return root


class TestResolveWithin:
    def test_returns_path_inside_root(self, tmp_path: Path):
        root = tmp_path / "dist"
        root.mkdir()
        asset = root / "assets" / "index.js"
        asset.parent.mkdir()
        asset.write_text("console.log(1)")
        assert resolve_within(root, "assets/index.js") == asset.resolve()

    @pytest.mark.parametrize(
        "payload",
        [
            "../etc/passwd",
            "../../../../etc/passwd",
            "assets/../../outside.txt",
            "/etc/passwd",
            "",
            "./",
            "bad\x00name",
        ],
    )
    def test_rejects_escapes_and_empty_values(self, tmp_path: Path, payload: str):
        root = tmp_path / "dist"
        root.mkdir()
        assert resolve_within(root, payload) is None

    def test_rejects_symlink_escape(self, tmp_path: Path):
        if not hasattr(os, "symlink"):
            pytest.skip("symlinks unsupported")
        root = tmp_path / "dist"
        root.mkdir()
        target = tmp_path / "secret.txt"
        target.write_text("secret")
        try:
            (root / "link.txt").symlink_to(target)
        except (OSError, NotImplementedError):
            pytest.skip("symlink creation not permitted")
        assert resolve_within(root, "link.txt") is None


class TestIsPathWithin:
    def test_accepts_nested_file(self, media_root: Path):
        assert is_path_within(media_root / "nested" / "inner.mp4", [media_root]) is True

    def test_rejects_sibling_directory(self, tmp_path: Path, media_root: Path):
        sibling = tmp_path / "uploads-evil" / "clip.mp4"
        sibling.parent.mkdir()
        sibling.write_bytes(b"x")
        assert is_path_within(sibling, [media_root]) is False

    def test_rejects_unresolvable_path(self, media_root: Path):
        assert is_path_within(media_root / "missing.mp4", []) is False


class TestAllowedRemoteUrl:
    @pytest.mark.parametrize(
        "url",
        [
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://youtu.be/dQw4w9WgXcQ",
            "https://m.youtube.com/shorts/abc123",
            "https://music.youtube.com/watch?v=abc",
            "https://de.youtube.com/watch?v=abc",
            "https://drive.google.com/file/d/abc123/view",
            "https://docs.google.com/document/d/abc123",
        ],
    )
    def test_accepts_known_media_hosts(self, url: str):
        assert is_allowed_remote_url(url) is True

    @pytest.mark.parametrize(
        "url",
        [
            "http://169.254.169.254/latest/meta-data/",
            "http://127.0.0.1:8000/api/health",
            "http://localhost/admin",
            "https://youtube.com.evil.example/watch",
            "https://evil.example/youtube.com",
            "https://user:pass@youtube.com/watch?v=abc",
            "https://youtube.com:8443/watch?v=abc",
            "ftp://youtube.com/watch?v=abc",
            "javascript:alert(1)",
            "file:///etc/passwd",
            "https://www.youtube.com/watch?v=a b",
            "",
        ],
    )
    def test_rejects_ssrf_and_malformed_inputs(self, url: str):
        assert is_allowed_remote_url(url) is False


class TestLocalReferences:
    def test_recognises_app_owned_references(self):
        assert is_local_media_reference("/api/video/upload_abc_clip.mp4") is True
        assert is_local_media_reference("upload_abc_clip.mp4") is True
        assert is_local_media_reference("gdrive_abc123") is True

    def test_rejects_external_or_absolute_paths(self):
        assert is_local_media_reference("https://youtube.com/watch?v=x") is False
        assert is_local_media_reference("/etc/passwd") is False


class TestResolveLocalMedia:
    def test_resolves_existing_file(self, media_root: Path):
        assert resolve_local_media("clip.mp4", [media_root]) == (media_root / "clip.mp4").resolve()

    def test_strips_api_prefix_and_query(self, media_root: Path):
        assert resolve_local_media("/api/video/clip.mp4?title=x", [media_root]) == (
            media_root / "clip.mp4"
        ).resolve()

    @pytest.mark.parametrize(
        "payload",
        ["../secret.txt", "/etc/passwd", "..%2fsecret.txt", "%2e%2e%2fsecret.txt", "", "missing.mp4"],
    )
    def test_never_escapes_search_dirs(self, media_root: Path, payload: str):
        assert resolve_local_media(payload, [media_root]) is None


class TestResolveSpaFile:
    def test_serves_file_inside_dist(self, tmp_path: Path):
        dist = tmp_path / "dist"
        dist.mkdir()
        (dist / "index.html").write_text("<html></html>")
        assert resolve_spa_file(dist, "index.html") == (dist / "index.html").resolve()

    def test_blocks_traversal(self, tmp_path: Path):
        dist = tmp_path / "dist"
        dist.mkdir()
        (tmp_path / "secret.txt").write_text("secret")
        assert resolve_spa_file(dist, "../secret.txt") is None
        assert resolve_spa_file(dist, "..%2fsecret.txt") is None

    def test_missing_file_returns_none(self, tmp_path: Path):
        assert resolve_spa_file(tmp_path, "nope.html") is None
