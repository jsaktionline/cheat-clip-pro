# CI workflow template

GitHub blocks workflow files from being pushed by GitHub App tokens that do not
have the `workflows` permission, so the pipeline lives here as a template.

## Enable it

```bash
mkdir -p .github/workflows
cp docs/ci/ci.yml .github/workflows/ci.yml
git add .github/workflows/ci.yml
git commit -m "ci: enable GitHub Actions pipeline"
git push
```

The push must be performed by an account/token with the `workflows` permission
(or pasted through the GitHub web UI).

## What it runs

| Job | Command |
| --- | --- |
| Frontend | `npm ci && npm run lint && npm run build` |
| Backend | `pip install -r backend/requirements-test.txt`, `ruff check backend`, `pytest backend/tests -q` |
| Docker | `docker compose config --quiet` |

The same checks are available locally via `./scripts/verify.sh`.
