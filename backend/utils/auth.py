"""Optional API-key protection for mutating endpoints.

The desktop build keeps working without any configuration.  When an operator
sets ``ADMIN_API_KEY`` (or ``CHEAT_CLIP_API_KEY``) — which is strongly
recommended for any internet-facing deployment — every state-changing
``/api/*`` request must present the matching key through the ``X-API-Key``
header or an ``Authorization: Bearer <key>`` header.
"""

from __future__ import annotations

import hmac
import os
from typing import Iterable, Optional

from fastapi import Header, HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from backend.config import logger

#: HTTP methods that can mutate server state and therefore require the key.
PROTECTED_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

#: Read-only endpoints that must stay reachable for health checks.
AUTH_EXEMPT_PATHS = frozenset({"/api/health"})

#: Optional reverse-proxy prefixes, e.g. ``/cheat-clip``.
AUTH_EXEMPT_SUFFIXES = frozenset({"/api/health"})


def get_configured_api_key() -> str:
    """Return the operator configured key, or ``""`` when auth is disabled."""
    return (
        os.environ.get("ADMIN_API_KEY")
        or os.environ.get("CHEAT_CLIP_API_KEY")
        or ""
    ).strip()


def _presented_key(headers: Iterable[tuple[bytes, bytes]]) -> str:
    header_map = {key.decode("latin-1").lower(): value.decode("latin-1").strip() for key, value in headers}
    api_key = header_map.get("x-api-key", "")
    if api_key:
        return api_key
    authorization = header_map.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return ""


def is_authorized(presented: str, configured: str) -> bool:
    """Constant-time comparison helper (kept separate for unit testing)."""
    if not configured:
        return True
    if not presented:
        return False
    return hmac.compare_digest(presented, configured)


def verify_admin_access(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None),
) -> bool:
    """FastAPI dependency used by administrative endpoints."""
    configured = get_configured_api_key()
    presented = (x_api_key or "").strip()
    if not presented and authorization and authorization.lower().startswith("bearer "):
        presented = authorization[7:].strip()
    if not is_authorized(presented, configured):
        raise HTTPException(status_code=401, detail="Unauthorized: invalid or missing API key")
    return True


def _is_protected_request(request: Request) -> bool:
    path = request.url.path.rstrip("/") or "/"
    if request.method.upper() not in PROTECTED_METHODS:
        return False
    if not path.startswith("/api/"):
        return False
    return not any(path.endswith(suffix) for suffix in AUTH_EXEMPT_SUFFIXES)


async def api_key_middleware(request: Request, call_next) -> Response:
    """Reject unauthenticated state-changing API calls when a key is set."""
    if _is_protected_request(request):
        configured = get_configured_api_key()
        if configured:
            presented = _presented_key(request.headers.raw)
            if not is_authorized(presented, configured):
                logger.warning("Rejected unauthenticated %s %s", request.method, request.url.path)
                return JSONResponse(
                    status_code=401,
                    content={
                        "detail": (
                            "Unauthorized: this server requires an API key. "
                            "Send it through the X-API-Key header."
                        )
                    },
                )
    return await call_next(request)
