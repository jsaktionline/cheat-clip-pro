"""Security helpers for path confinement and media-source validation.

This module deliberately depends on the Python standard library only so it can
be unit-tested without importing the heavy video/ML stack (FFmpeg, Whisper,
OpenCV, ...).  Every helper is pure and side-effect free.
"""

from __future__ import annotations

import ipaddress
import os
from pathlib import Path
from typing import Iterable, Optional
from urllib.parse import urlparse

# Hosts users are allowed to submit as a remote video source.  Anything else is
# rejected before it reaches yt-dlp / requests, which prevents the backend from
# being used as an SSRF proxy (cloud metadata endpoints, internal services...).
YOUTUBE_HOSTS = frozenset(
    {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
        "youtu.be",
    }
)
GOOGLE_DRIVE_HOSTS = frozenset(
    {
        "drive.google.com",
        "docs.google.com",
        "drive.usercontent.google.com",
    }
)
ALLOWED_MEDIA_HOSTS = YOUTUBE_HOSTS | GOOGLE_DRIVE_HOSTS
_ALLOWED_SCHEMES = frozenset({"http", "https"})
_ALLOWED_PORTS = frozenset({None, 80, 443})

LOCAL_MEDIA_PREFIX = "/api/video/"
LOCAL_ID_PREFIXES = ("upload_", "gdrive_")


class UnsafePathError(ValueError):
    """Raised when a user supplied path escapes its permitted root."""


def _resolve(path: os.PathLike[str] | str) -> Optional[Path]:
    try:
        return Path(path).expanduser().resolve(strict=False)
    except (OSError, RuntimeError, ValueError):
        return None


def resolve_within(root: os.PathLike[str] | str, relative: str) -> Optional[Path]:
    """Join ``relative`` onto ``root`` and return it only if it stays inside.

    Returns ``None`` for empty input, NUL bytes, absolute paths and any
    traversal attempt (``..``) that would escape ``root``.
    """
    if not relative or not isinstance(relative, str) or "\x00" in relative:
        return None
    if relative.strip() in {".", "./"}:
        return None

    root_path = _resolve(root)
    if root_path is None:
        return None

    # Reject absolute paths outright; callers must pass a relative reference.
    candidate_input = Path(relative)
    if candidate_input.is_absolute() or candidate_input.drive:
        return None

    try:
        candidate = (root_path / candidate_input).resolve(strict=False)
    except (OSError, RuntimeError, ValueError):
        return None

    try:
        candidate.relative_to(root_path)
    except ValueError:
        return None
    return candidate


def is_path_within(path: os.PathLike[str] | str, roots: Iterable[os.PathLike[str] | str]) -> bool:
    """Return ``True`` only when ``path`` resolves inside one of ``roots``."""
    target = _resolve(path)
    if target is None:
        return False
    for root in roots:
        root_path = _resolve(root)
        if root_path is None:
            continue
        try:
            target.relative_to(root_path)
            return True
        except ValueError:
            continue
    return False


def resolve_spa_file(dist_dir: os.PathLike[str] | str, full_path: str) -> Optional[Path]:
    """Resolve a requested SPA asset, or ``None`` when it escapes ``dist_dir``."""
    candidate = resolve_within(dist_dir, full_path)
    if candidate is None or not candidate.is_file():
        return None
    return candidate


def _is_ip_host(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return False


def is_allowed_remote_url(url: str) -> bool:
    """Validate a user supplied remote media URL.

    Only http(s) URLs pointing at a known YouTube / Google Drive host are
    accepted.  Credentials, non-standard ports and private IP literals are
    rejected to keep the backend from being weaponised as an SSRF proxy.
    """
    if not url or not isinstance(url, str):
        return False
    value = url.strip()
    if not value or "\x00" in value or any(ch.isspace() for ch in value):
        return False

    try:
        parsed = urlparse(value)
    except ValueError:
        return False

    if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        return False
    if parsed.username or parsed.password:
        return False
    if parsed.port not in _ALLOWED_PORTS:
        return False

    host = (parsed.hostname or "").lower().rstrip(".")
    if not host or _is_ip_host(host):
        return False
    if host in ALLOWED_MEDIA_HOSTS:
        return True
    # Allow regional YouTube subdomains such as de.youtube.com.
    return host.endswith(".youtube.com")


def is_local_media_reference(value: str) -> bool:
    """Return ``True`` for references to files already stored by this app."""
    if not value or not isinstance(value, str):
        return False
    clean = value.strip()
    return clean.startswith(LOCAL_MEDIA_PREFIX) or clean.startswith(LOCAL_ID_PREFIXES)


def resolve_local_media(
    reference: str,
    search_dirs: Iterable[os.PathLike[str] | str],
) -> Optional[Path]:
    """Best-effort lookup of an uploaded/local media file inside ``search_dirs``.

    The lookup never leaves the provided directories, even when the caller
    passes an absolute path or a ``../`` sequence.
    """
    if not reference or not isinstance(reference, str):
        return None

    clean = reference.strip()
    if clean.startswith(LOCAL_MEDIA_PREFIX):
        clean = clean[len(LOCAL_MEDIA_PREFIX) :]
    clean = clean.split("?", 1)[0].split("#", 1)[0]

    import urllib.parse

    clean = urllib.parse.unquote(clean).strip()
    if not clean:
        return None
    clean = os.path.basename(clean)
    if not clean or clean in {".", ".."}:
        return None

    for directory in search_dirs:
        candidate = resolve_within(directory, clean)
        if candidate is not None and candidate.is_file():
            return candidate
    return None
