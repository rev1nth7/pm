# Project Management MVP

A single-board Kanban app with an AI assistant that can edit the board. The
Next.js frontend is exported as static files and served by the FastAPI backend,
which also exposes the JSON API. Everything runs as one Docker container.

## Features

- Sign in (hardcoded `user` / `password`; session in an HTTP-only cookie)
- Kanban board with five columns: drag-and-drop cards, rename columns, add/edit/delete cards
- Board persisted per user in SQLite
- AI chat sidebar that creates, edits, moves, and deletes cards via OpenAI Structured Outputs; the board updates in place

## Stack

- Frontend: Next.js (static export), Tailwind CSS, dnd-kit
- Backend: FastAPI, Uvicorn, SQLite (stdlib `sqlite3`), managed with `uv`
- AI: OpenAI (`gpt-4.1-nano`) with Structured Outputs
- Packaging: single Docker container

## Quick start (Docker)

Requires Docker and an OpenAI API key.

1. Put your key in a project-root `.env`:
   ```
   OPENAI_API_KEY=sk-...
   ```
2. Start it:
   - Windows: `scripts\start.bat`
   - macOS/Linux: `scripts/start.sh`
3. Open http://localhost:8000 and sign in with `user` / `password`.
4. Stop it: `scripts/stop.*`

The board is stored in a Docker volume (`pm-data`) so it survives restarts.

## Local development

Backend (from `backend/`):

```
uv sync
uv run uvicorn app.main:app --reload   # API on http://localhost:8000
uv run pytest                          # backend tests
```

Frontend (from `frontend/`):

```
npm install
npm run dev          # dev server on http://localhost:3000
npm run build        # static export to out/
npm run test:unit    # Vitest
npm run test:e2e     # Playwright
```

To serve the real board from the backend locally, run `npm run build` and copy
`frontend/out/` into `backend/app/static/` before starting Uvicorn.

## Configuration

Environment variables (read from the root `.env` in local dev, passed through in Docker):

- `OPENAI_API_KEY` - required for the AI features
- `OPENAI_MODEL` - optional, defaults to `gpt-4.1-nano`
- `DATABASE_PATH` - optional, defaults to `backend/data/app.db`
- `SECRET_KEY` - optional, signs the session cookie

Set a monthly usage hard limit in the OpenAI dashboard as a budget safety net.

## API

- `GET /api/health`, `GET /api/hello` - public
- `POST /api/login`, `POST /api/logout`, `GET /api/me` - auth
- `GET /api/board`, `PUT /api/board` - read/replace the signed-in user's board
- `GET /api/ai/ping` - AI connectivity check
- `POST /api/ai/chat` - send messages plus the current board; returns a reply and an optional updated board

## Project layout

- `frontend/` - Next.js app (components, board/auth/chat API helpers, tests)
- `backend/` - FastAPI app (`app/main.py`, `app/db.py`, `app/ai.py`, `app/seed.py`, `tests/`)
- `scripts/` - start/stop scripts for Windows, macOS, and Linux
- `docs/` - `PLAN.md` (build plan) and `DATABASE.md` (schema)

## Limitations

This is an MVP: a single hardcoded user and one board per user. The database
schema already supports multiple users for a future iteration.
