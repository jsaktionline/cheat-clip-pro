# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| `chat-clip-prov2` (v2.x) | ✅ |
| `master` (v1.x) | ⚠️ best effort |

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Report them
privately via GitHub's *Security → Report a vulnerability* flow, or contact the
maintainer directly. Include:

- the affected endpoint or file,
- reproduction steps (curl command or payload),
- impact assessment.

We aim to acknowledge reports within 72 hours.

## Deployment hardening checklist

Cheat Clip PRO is designed to run as a **local desktop tool**. If you expose it
to the internet, apply the following:

1. **Set an API key** — `ADMIN_API_KEY` (or `CHEAT_CLIP_API_KEY`). Once set,
   every `POST`/`PUT`/`PATCH`/`DELETE` request to `/api/*` requires
   `X-API-Key: <key>` (or `Authorization: Bearer <key>`). The built-in web UI
   injects the key from its *Server Access Key* field.
2. **Put it behind a reverse proxy** with TLS, authentication and rate limits
   (Caddy, Nginx, Traefik, Dokploy…). Do not publish port 8000 directly.
3. **Bind to localhost** when testing: `docker compose` supports
   `PUBLISH_PORT=127.0.0.1:8000` via `${PUBLISH_PORT}`.
4. **Run as an unprivileged user** and keep the `/data` volume private.
5. **Rotate keys** and never commit `.env` files. `.gitignore` already excludes
   them, along with `cookies.txt`.
6. **Keep dependencies updated** (`yt-dlp`, `ffmpeg`, `fastapi`, `google-genai`).

## Built-in protections (v2)

- All user supplied filesystem paths are confined with `Path.resolve()` +
  `relative_to()` checks (`backend/utils/security.py`).
- The SPA catch-all route cannot escape `dist/` (directory traversal fix).
- Remote media URLs are restricted to YouTube/Google Drive hosts; private IPs,
  credentials and non-standard ports are rejected (SSRF mitigation).
- CSP-friendly headers are emitted (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`).
- Uploads are streamed to disk in chunks with hard size limits; filenames are
  sanitised and prefixed with a UUID.
- Finished job metadata is pruned automatically to bound memory usage.
- The server never persists YouTube cookies; they stay in the browser.
