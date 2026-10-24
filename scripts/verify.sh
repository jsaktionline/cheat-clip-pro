#!/usr/bin/env bash
# Unified local verification — mirrors the GitHub Actions pipeline.
#
# Usage:
#   ./scripts/verify.sh            # frontend + backend (requires venv deps)
#   ./scripts/verify.sh frontend   # lint + build only
#   ./scripts/verify.sh backend    # ruff + pytest only
set -euo pipefail

cd "$(dirname "$0")/.."

run_frontend() {
  echo "▶ Frontend: npm ci + lint + build"
  npm ci --no-audit --no-fund
  npm run lint
  npm run build
}

run_backend() {
  echo "▶ Backend: ruff + pytest"
  if [[ -x "venv/bin/ruff" ]]; then
    RUFF="venv/bin/ruff"
    PYTEST="venv/bin/python -m pytest"
  elif [[ -x ".venv/bin/ruff" ]]; then
    RUFF=".venv/bin/ruff"
    PYTEST=".venv/bin/python -m pytest"
  else
    RUFF="ruff"
    PYTEST="python -m pytest"
  fi
  "$RUFF" check backend
  $PYTEST backend/tests -q
}

target="${1:-all}"
case "$target" in
  frontend) run_frontend ;;
  backend) run_backend ;;
  all)
    run_frontend
    run_backend
    ;;
  *)
    echo "Unknown target: $target (expected: frontend | backend | all)" >&2
    exit 2
    ;;
esac

echo "✅ All checks passed."
