# Changelog

All notable changes to Cheat Clip PRO are documented here.
The project follows [Semantic Versioning](https://semver.org/).

## [2.0.0] — 2026-10-24 (`chat-clip-prov2`)

Hardening and quality release. No rendering pipeline changes; existing clips
render exactly as before.

### Security

- **Fixed a directory traversal** in the production SPA catch-all route
  (`/{full_path:path}`). Requests such as `/..%2f..%2fetc%2fpasswd` can no
  longer read files outside `dist/`.
- Added `backend/utils/security.py` with path confinement (`resolve_within`,
  `is_path_within`), a SPA file resolver and an SSRF-safe media URL allowlist.
- `/api/analyze` and `/api/download-raw-*` now reject arbitrary filesystem
  paths and non-YouTube/Drive URLs (previously any local file or internal URL
  could be processed).
- Added optional API-key protection (`X-API-Key` / `Bearer`) for all mutating
  `/api/*` routes when `ADMIN_API_KEY` is configured, plus a *Server Access
  Key* field in the UI and a fetch interceptor.
- Google Drive detection is now host-based (was a substring match that could be
  spoofed by `?x=drive.google.com`).
- Gemini/OpenRouter model listing keys moved from query strings to headers.
- Added `Referrer-Policy` and `Permissions-Policy`; removed the deprecated
  `X-XSS-Protection` header.

### Reliability

- In-memory job registries (`RENDER_BATCHES`, download jobs) are now pruned by
  TTL (`JOB_TTL_SECONDS`, default 6 h) and capped at 200 entries — fixes an
  unbounded memory leak.
- Media directories are configurable via `CHEAT_CLIP_DATA_DIR`,
  `CHEAT_CLIP_TEMP_DIR`, `CHEAT_CLIP_EXPORTS_DIR`, `CHEAT_CLIP_FONTS_DIR`,
  `CHEAT_CLIP_COOKIES_PATH`.
- Docker: the compose file previously mounted unused paths (`/app/temp`, …),
  so renders/uploads were lost on container recreation. It now uses a single
  persistent `/data` volume; the healthcheck points at the real `/api/health`
  endpoint; `init` and `no-new-privileges` are enabled.
- Removed the duplicated root `requirements.txt` (Docker now installs
  `backend/requirements.txt`).

### Quality

- **81 backend tests** added (security helpers, auth middleware, SPA mounting,
  SSRF validation, cookie normalisation, job pruning).
- Added `ruff` configuration and fixed all findings (unused imports/variables,
  ambiguous names, dead code).
- Frontend lint now passes with **0 errors** (83 advisory warnings for `any`
  and hook dependencies, tracked for incremental cleanup).
- Added a GitHub Actions pipeline template (`docs/ci/ci.yml` — lint, build,
  ruff, pytest, `docker compose config`) plus `scripts/verify.sh` for local runs.
- Added MIT `LICENSE`, `SECURITY.md` and `pyproject.toml`.
- Extracted cookie normalisation to `backend/utils/cookies.py` for testability.
- Removed dead code in `video_engine.py` (unused content-boundary computation
  and variables).

### Known limitations

- Job state remains in-process, so the backend still runs as a single worker.
  A shared store (Redis/SQLite) is planned for a future release.
- The client-side renderer loads `@ffmpeg/core` from unpkg/jsDelivr at runtime;
  self-hosting the WASM bundle is planned.
- `any` types and a few hook dependency warnings remain in the React codebase.
