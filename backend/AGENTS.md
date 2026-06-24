# Backend

FastAPI backend for the Project Management MVP. It serves the JSON API under `/api/*` and the static frontend at `/`. Managed with `uv`.

## Stack

- Python 3.12+
- FastAPI + Uvicorn
- `uv` for dependency management
- pytest + httpx for tests

## Structure

- `pyproject.toml` - project metadata, dependencies, and pytest config (`uv` manages the env)
- `app/main.py` - FastAPI app (built by `create_app(static_dir)`)
  - `GET /api/health` -> `{"status": "ok"}`
  - `GET /api/hello` -> `{"message": "hello world"}`
  - `POST /api/login` -> validates hardcoded `user`/`password`; sets a session (HTTP-only signed cookie via `SessionMiddleware`); `401` on failure
  - `POST /api/logout` -> clears the session
  - `GET /api/me` -> `{"authenticated": bool, "username": str | null}`
  - mounts `app/static/` at `/` (serves `index.html`); `/api/*` routes take priority
- `app/static/index.html` - placeholder page (Part 3 replaces this with the exported Next.js build)
- `tests/test_main.py` - endpoint tests via FastAPI `TestClient`

## Commands

Run from `backend/`:

- `uv sync` - create/refresh the virtual environment
- `uv run uvicorn app.main:app --reload` - run the dev server on port 8000
- `uv run pytest` - run the tests

The whole app is also built and run via the root `Dockerfile` and the `scripts/` start/stop scripts.
