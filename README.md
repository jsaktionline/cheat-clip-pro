# 🎬 Cheat Clip PRO

> **AI Powered Auto Clipper — Turn long YouTube, Google Drive, and uploaded videos into viral TikToks, Shorts, and Reels with animated subtitles, face centering, and music in minutes.**

---

## 🆕 v2: hardened & tested (`chat-clip-prov2`)

This branch is a security and quality-focused iteration of `master`:

* 🔒 Path traversal in the SPA route fixed; every filesystem path is confined.
* 🛡️ SSRF protection — only YouTube/Google Drive URLs are accepted; arbitrary
  local paths are rejected.
* 🔑 Optional `X-API-Key` protection for all state-changing API calls.
* 🧹 TTL-based pruning of in-memory render/download jobs (no more memory leak).
* 🐳 Docker volumes and healthcheck fixed (renders/uploads now persist).
* ✅ 81 backend tests + 17 frontend tests, `ruff` clean, ESLint 0 errors,
  CI template included.
* 📄 `LICENSE`, `SECURITY.md`, `CHANGELOG.md` added.

Jump to: [Architecture](#-architecture) · [Testing](#-testing--ci) ·
[Docker deployment](#-docker-deployment) · [Security](#-security).

> ⚠️ **Deploying to a server?** Set `ADMIN_API_KEY` (see [SECURITY.md](SECURITY.md)).
> The desktop app keeps working with no configuration.

---

## ⚡ Quick Start & Setup

Follow these steps to set up and run Cheat Clip PRO locally on **Windows**, **macOS**, or **Linux**.

### Step 1: Prerequisites

Make sure you have the following installed:

1. **[Git](https://git-scm.com/)**
   * **Windows:** `winget install Git.Git` or download from [git-scm.com](https://git-scm.com/)
   * **macOS:** `brew install git`
   * **Linux:** `sudo apt install git`
2. **[Node.js](https://nodejs.org/)** (v22 recommended; v20.19+ minimum)
   * Download from [nodejs.org](https://nodejs.org/) or install via your package manager.
3. **[Python](https://www.python.org/)** (v3.10 or newer)
   * **Windows:** Install from [python.org](https://www.python.org/downloads/) (make sure to check *"Add Python to PATH"* during setup) or from Microsoft Store.
   * **macOS:** `brew install python`
   * **Linux:** `sudo apt install python3 python3-pip python3-venv`
4. **FFmpeg & yt-dlp** (Required to download, slice, and render clips)
   * **Windows (PowerShell):**
     ```powershell
     winget install Gyan.FFmpeg
     winget install yt-dlp.yt-dlp
     ```
     *(Close and reopen your terminal after installing so Windows recognizes them)*
   * **macOS (Terminal):**
     ```bash
     brew install ffmpeg-full yt-dlp
     ```
      `ffmpeg-full` is required for the libass subtitle filter used by rendered captions.
   * **Linux:**
     ```bash
     sudo apt update && sudo apt install ffmpeg
     pip install yt-dlp
     ```

---

### Step 2: Clone the Repository

Open your terminal and clone the repository:

```bash
git clone https://github.com/jsaktionline/cheat-clip-pro.git
cd cheat-clip-pro
git checkout chat-clip-prov2   # v2: hardened, tested branch
```

---

### Step 3: Install Dependencies

#### 1. Frontend Dependencies
```bash
npm install
```

#### 2. Backend Dependencies
We recommend setting up a Python virtual environment:

* **Windows:**
  ```powershell
  python -m venv venv
  venv\Scripts\activate
  pip install -r backend/requirements.txt
  ```

* **macOS / Linux:**
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  pip install -r backend/requirements.txt
  ```

---

### Step 4: Run the App

Launch both the frontend and backend servers concurrently:

```bash
npm run dev
```

* **Web App:** [`http://localhost:5173`](http://localhost:5173)
* **Backend API:** [`http://localhost:8000`](http://localhost:8000)
* **API Documentation:** [`http://localhost:8000/docs`](http://localhost:8000/docs)

---

## 🔄 Updating to the Latest Version

To update Cheat Clip PRO to the latest release:

```bash
git pull
npm install
pip install -r backend/requirements.txt
```
*(Make sure your virtual environment is activated if you created one)*

---

## 🔑 Free Google Gemini API Key (Takes 1 Minute)

Cheat Clip PRO uses Google's AI to find the best viral moments for free:
1. Go to **[Google AI Studio](https://aistudio.google.com/)** and sign in with any Google account.
2. Click **"Get API key"** (or **"Create API key"**).
3. Copy your key (starts with `AIzaSy...`).
4. Paste it into the **Gemini API Key** field in the app.

> 💡 **Tip:** You can also type `mock` in the API Key box to test out the app with sample data without an API key!

---

## 🎯 How to Use

1. **Paste a YouTube URL** — Enter any podcast, stream, or video link.
2. **Choose Duration** — Pick `~15s` (fast hooks), `~30s` (standard shorts), or `~60s` (story clips).
3. **Click "Analyze Video"** — The AI finds the most exciting moments using YouTube audience retention data.
4. **Customize in Clip Studio** — Adjust your video style:
   * **Frame & Crop**: Fullscreen 9:16 vertical, square, or split-screen facecam.
   * **Face Tracking**: Automatically keeps the speaker in the center of the frame.
   * **Subtitles**: Choose viral animated karaoke caption styles and fonts.
   * **Branding & Audio**: Add your watermark logo, background music, and hook sound effects.
   * **Hardware Acceleration**: Choose your graphics card (NVIDIA, AMD, Intel) or CPU.
5. **Batch Render & Download** — Click **Batch Render**, then download all your finished videos together in one **.ZIP** file!

---

## ❓ Common Problems & Easy Fixes

### 1. "Failed to render video" or `The system cannot find the file specified`
* **Cause:** `ffmpeg` or `yt-dlp` is missing on your computer.
* **Fix:**
  * **Windows (PowerShell):**
    ```powershell
    winget install Gyan.FFmpeg
    winget install yt-dlp.yt-dlp
    ```
    *(Then close and reopen your terminal)*
  * **Mac (Terminal):**
    ```bash
    brew install ffmpeg-full yt-dlp
    ```
  * Or install directly via Python: `pip install yt-dlp`

### 2. `No such filter: 'subtitles'`
* **Cause:** FFmpeg was installed without the libass subtitle filter.
* **Fix (macOS):**
  ```bash
  brew install ffmpeg-full
  ```
  Restart the backend after installation. The app automatically prefers Homebrew's subtitle-capable `ffmpeg-full` binary.

### 3. "Sign in to confirm you're not a bot"
* **Cause:** YouTube blocks video downloads if too many requests are sent without logging in.
* **Fix:** Click the 🍪 **Cookies** button in the top navigation bar, export your YouTube cookies using a free browser extension (like *Get cookies.txt locally*), and paste them into the app.

### 4. Does this work on AMD graphics cards and Mac?
* **Yes!** Cheat Clip PRO automatically supports:
  * **NVIDIA** (`h264_nvenc`)
  * **AMD** (`h264_amf` on Radeon GPUs & Ryzen CPUs)
  * **Intel** (`h264_qsv` on Arc & UHD Graphics)
  * **Apple Mac & CPU Software** (`libx264` universal high-speed fallback)
* You can switch your preferred hardware acceleration encoder anytime in the Render Settings or History card.

---

## 📄 License

Distributed under the **MIT License**. Free for personal and commercial use!
See [LICENSE](LICENSE).

---

## 🧱 Architecture

```
src/                      React 19 + Vite 8 + TypeScript (UI)
  components/             Feature components + co-located CSS modules
  hooks/                  Reusable hooks (AI model catalogue)
  services/               Client-side renderers (FFmpeg WASM, WebCodecs)
  utils/                  API client, cookies, face detection, server key
backend/
  main.py                 FastAPI app, security middleware, SPA mounting
  routers/                HTTP endpoints (analyze, render, media, downloads…)
  services/               Business logic (download, render, AI, job registry)
  schemas/                Pydantic request/response models
  utils/                  Pure helpers: security, cookies, text, sse, proxy
  tests/                  pytest suite (security, auth, cookies, jobs)
```

Key helpers added in v2:

| Module | Purpose |
| --- | --- |
| `backend/utils/security.py` | Path confinement, SPA resolver, SSRF-safe URL allowlist |
| `backend/utils/auth.py` | Optional API-key middleware + admin dependency |
| `backend/utils/cookies.py` | Cookie format normalisation (Netscape/JSON/header) |
| `backend/services/job_registry.py` | TTL + history cap for in-memory jobs |

---

## ✅ Testing & CI

```bash
# Backend (fast, no torch/whisper needed)
python3 -m venv venv
source venv/bin/activate           # Windows: venv\Scripts\activate
pip install -r backend/requirements-test.txt
ruff check backend
pytest backend/tests -q

# Frontend
npm ci
npm run lint
npm test            # Vitest (jsdom)
npm run build
```

CI pipeline: the workflow lives at [`docs/ci/ci.yml`](docs/ci/ci.yml) (GitHub
App tokens without the `workflows` permission cannot push to
`.github/workflows/`). Copy it to `.github/workflows/ci.yml` to enable it, or
run the exact same checks locally:

```bash
./scripts/verify.sh          # frontend + backend
./scripts/verify.sh backend  # ruff + pytest only
```

---

## 🐳 Docker Deployment

```bash
# Optional but strongly recommended for public servers
export ADMIN_API_KEY="$(openssl rand -hex 24)"
docker compose up -d --build
```

* Web UI/API: `http://localhost:8000`
* Persistent data (downloads, uploads, renders): volume `media_data` → `/data`
* Health endpoint: `/api/health` (used by the container healthcheck)
* Bind to localhost only: `PUBLISH_PORT=127.0.0.1:8000 docker compose up -d`

Environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `ADMIN_API_KEY` | *(empty)* | Enables `X-API-Key` protection for mutating routes |
| `CHEAT_CLIP_DATA_DIR` | `backend/` | Root for `temp_clips/`, `exports/`, uploads |
| `JOB_TTL_SECONDS` | `21600` | How long finished job metadata is kept |
| `TEMP_MAX_AGE_SECONDS` | `3600` | Temp file TTL for the cleanup worker |
| `TEMP_STORAGE_QUOTA_GB` | `5.0` | Max temp storage before FIFO purge |
| `ALLOWED_ORIGINS` | localhost | Comma-separated CORS origins |

---

## 🔐 Security

See [SECURITY.md](SECURITY.md) for the full policy and deployment checklist.
Highlights:

* All user paths are resolved and confined with `relative_to()`.
* Remote sources are allowlisted (YouTube/Drive) — private IPs and credentials
  are rejected, preventing SSRF.
* `ADMIN_API_KEY` enables constant-time API-key checks for all state-changing
  requests; the UI sends it via the *Server Access Key* field.
* Uploads are streamed with hard size limits and sanitised filenames.
