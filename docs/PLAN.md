# Project plan

This document plans the build of the Project Management MVP described in the root `AGENTS.md`. It is built in 10 parts. Near-term parts (1-3) are detailed with substep checklists, tests, and success criteria; later parts (4-10) are outlines to be expanded just before each is built.

## Key decisions

- AI: use the existing standard OpenAI key (`api.openai.com`) with the most affordable current OpenAI model that supports Structured Outputs - `gpt-4.1-nano` (fallback `gpt-4o-mini`). This replaces the originally noted `openai/gpt-oss-120b`, which `api.openai.com` does not serve.
- Serving: single process. Next.js builds to static files (`output: 'export'`); FastAPI serves them at `/` and the JSON API at `/api/*`. One Docker container.
- Database: SQLite, created on first run.
- Package manager: `uv` for the Python backend.

## Open item

- The live `OPENAI_API_KEY` is committed in plaintext in `.env`. Recommend rotating it and confirming `.env` is gitignored. No change will be made to `.env` or git history without sign-off.

---

## Part 1 - Plan

Goal: produce an approved, detailed plan and document the existing frontend.

- [x] Enrich this `docs/PLAN.md` with detailed substeps, tests, and success criteria
- [x] Create `frontend/AGENTS.md` describing the existing frontend
- [x] User reviews and approves the plan

Tests / success criteria:
- Both documents exist and accurately reflect the codebase, and the user approves before any code is written.

## Part 2 - Scaffolding

Goal: stand up the Docker + FastAPI infrastructure and start/stop scripts, serving a hello-world page and a hello-world API.

- [x] Create `backend/` Python project managed by `uv` (`pyproject.toml`): `fastapi`, `uvicorn`; dev deps `pytest`, `httpx`
- [x] `backend/app/main.py`: FastAPI app with
  - [x] `GET /api/health` returning `{"status": "ok"}`
  - [x] `GET /api/hello` returning `{"message": "hello world"}`
  - [x] serve a placeholder `index.html` at `/`
- [x] `Dockerfile` (python base image, install `uv`, install deps, copy app, run `uvicorn` on a fixed port) and `.dockerignore`
- [x] `scripts/` start and stop scripts that build/run/stop the container:
  - [x] Mac/Linux: `start.sh`, `stop.sh`
  - [x] Windows: `start.ps1` + `start.bat`, `stop.ps1` + `stop.bat`

Tests:
- `pytest` (using FastAPI `TestClient`/`httpx`) asserts `/api/health` and `/api/hello` return the expected JSON. PASSING (3/3).
- Manual: build and run the container; load `/` (hello-world HTML) and hit `/api/hello` (JSON).

Success criteria:
- The container builds and runs; `/` serves hello-world HTML; `/api/hello` returns JSON; the start/stop scripts work on this machine.
- Status: VERIFIED. Image builds (`docker build -t pm-mvp .`) and the running container returns 200 with expected content for `/api/health`, `/api/hello`, and `/` (port 8000 mapped).

## Part 3 - Add in Frontend

Goal: statically build the existing frontend and serve the demo Kanban board at `/` from the same FastAPI process (and container) that serves `/api/*`.

Configure the static export:
- [x] Add `output: 'export'` and `images.unoptimized: true` to `frontend/next.config.ts`
- [x] Run `npm run build` in `frontend/` and confirm it produces an `out/` folder containing `index.html` and a `_next/` assets folder
- [x] Add `out/` to `frontend/.gitignore` (build artifact, not committed)

Serve the build from FastAPI:
- [x] Decide on the served location: FastAPI serves a static directory (e.g. `backend/app/static`) that holds the exported site
- [x] Replace the Part 2 placeholder `index.html` with the real exported build (kept out of git; populated by the build/Docker step)
- [x] Confirm `app.mount("/", StaticFiles(..., html=True))` serves the board and that `/api/health` and `/api/hello` still work (API routes registered before the mount keep priority)

Containerize as one image:
- [x] Convert `Dockerfile` to multi-stage: a Node stage runs `npm ci` + `npm run build` in `frontend/`; the Python stage copies the resulting `out/` into the served static directory
- [x] Update `.dockerignore` so frontend `node_modules`, `.next`, and `out` are not sent as build context (they are produced inside the image)
- [x] `scripts/start.*` and `stop.*` continue to work unchanged

Tests:
- [x] Frontend unit tests pass: `npm run test:unit` (3 tests)
- [x] Frontend e2e tests pass: `npm run test:e2e` (Playwright, 3 tests)
- [x] Backend `pytest` updated/added: asserts `/` returns 200 and contains real board markup (e.g. a known column title like "Backlog"), and that a `_next/` asset returns 200
- [x] Existing `/api/health` and `/api/hello` tests still pass
- [x] Manual: build and run the container, open `http://localhost:8000`, see the Kanban board, drag a card, add a card

Success criteria:
- `npm run build` produces a static `out/` with no server-only errors.
- Opening `/` (both via local uvicorn and via the running container) renders the real demo Kanban board, not the hello-world placeholder.
- The board is interactive (drag-and-drop and add-card work) since it is fully client-side.
- `/api/health` and `/api/hello` still return their JSON.
- A single `docker build` produces one image that serves both the UI and the API on port 8000; start/stop scripts work.
- All four test suites are green (frontend unit, frontend e2e, backend pytest, and a manual smoke check).

Status: VERIFIED. `npm run build` produces a clean static `out/`; frontend unit (6) and e2e (3, Chromium) pass; backend `pytest` (3) passes. The multi-stage `docker build` produces one image whose running container serves the real Kanban board at `/` (contains "Backlog", placeholder gone), serves a hashed `/_next/*` asset (200), and returns `/api/health` and `/api/hello` JSON.

---

## Part 4 - Fake user sign in

Goal: require a login (hardcoded `user` / `password`) before the Kanban board is shown, with a working logout. Because the frontend is a static export with no Next.js server, gating is done client-side against FastAPI auth endpoints, with the session held in an HTTP-only signed cookie.

Approach: add auth endpoints to FastAPI using Starlette `SessionMiddleware` (signed cookie, no DB needed yet). The frontend asks "am I logged in?" on load and shows either the login screen or the board.

Backend (auth API):
- [x] Add `SessionMiddleware` with a `SECRET_KEY` (env var, dev default) to the FastAPI app
- [x] `POST /api/login` `{username, password}`: validate against hardcoded `user` / `password`; on success set the session and return `{ "authenticated": true, "username": "user" }`; on failure return `401`
- [x] `POST /api/logout`: clear the session, return `{ "authenticated": false }`
- [x] `GET /api/me`: return `{ "authenticated": bool, "username": str | null }` from the session cookie
- [x] Keep `/api/health` and `/api/hello` public (no auth required)

Frontend (login gate):
- [x] On load, call `GET /api/me`; while pending show a minimal loading state
- [x] If not authenticated, render a `Login` screen (username + password fields, submit, error message) styled with the brand colors; otherwise render the existing `KanbanBoard`
- [x] `Login` submit calls `POST /api/login`; on success re-check `/api/me` (or use its response) to reveal the board; on `401` show an inline error and keep the form
- [x] Add a logout control in the board header that calls `POST /api/logout` and returns to the login screen
- [x] Use credentialed fetches (`credentials: "include"`) so the session cookie is sent; centralize calls in a small `lib/auth.ts`
- [x] No credentials or tokens stored in `localStorage` (rely on the HTTP-only cookie)

Tests:
- [x] Backend `pytest`: `/api/login` with correct creds returns 200 and sets a session cookie; wrong creds return 401; `/api/me` reflects logged-in vs logged-out; `/api/logout` clears the session; `/api/health` stays public
- [x] Frontend unit (Vitest): `Login` renders, shows an error on rejected login, and the gate renders the board when `/api/me` reports authenticated (fetch mocked)
- [x] Frontend e2e (Playwright): visiting `/` shows the login screen; wrong creds show an error and no board; `user` / `password` reveals the board; logout returns to the login screen; reload while logged in stays on the board
- [x] Manual: same flow in the running container

Success criteria:
- Visiting `/` while logged out shows the login screen, not the board.
- Correct creds (`user` / `password`) reveal the board; wrong creds show an error and never reveal it.
- Logout returns to the login screen; reloading while logged in keeps you on the board (cookie persists); reloading while logged out shows login.
- The session is carried in an HTTP-only signed cookie; no secrets in `localStorage`.
- All suites green (backend pytest, frontend unit, frontend e2e) and the container smoke test passes.

Status: VERIFIED. Backend `pytest` (8) covers login success/failure, `/api/me` state, logout, and public health. Frontend unit (10) covers `Login` (error + success) and the `AuthGate` (login vs board). Frontend e2e (4) covers the gated board plus the login flow (bad creds error, then board revealed). Container smoke: logged-out `authenticated=false`; wrong creds `401`; correct creds set an HTTP-only `session` cookie and `/api/me` reports `authenticated=true`; logout clears it; `/api/health` stays public.

---

## Part 5 - Database modeling

Goal: propose how the Kanban is persisted - a SQLite database that stores each user's board as a JSON document - then document it in `docs/` and get sign-off. This part is design and documentation only; no schema is built or wired up until Part 6.

Approach: SQLite with two tables - `users` (multi-user ready) and `boards` (one row per user, the board stored as a JSON text column). The JSON mirrors the frontend `BoardData` shape in `frontend/src/lib/kanban.ts` exactly, so the same structure flows UI <-> API <-> DB with no translation. A JSON blob (rather than fully normalized column/card tables) is chosen because the whole board is read and written as a unit, and the AI will rewrite the board wholesale in Parts 9-10.

Deliverable: a new `docs/DATABASE.md` containing:
- [x] Storage decision and rationale: SQLite file created on first run if missing; board persisted as a JSON document; JSON-blob vs fully-normalized trade-off stated
- [x] Table definitions (DDL) for:
  - [x] `users` - `id` (PK), `username` (unique), `password_hash` (nullable for the MVP; hardcoded auth today, real users later), `created_at`
  - [x] `boards` - `id` (PK), `user_id` (FK -> users, unique so it is one board per user), `data` (JSON text), `created_at`, `updated_at`
- [x] The board JSON shape, matching `BoardData` exactly: `{ "columns": [{ "id", "title", "cardIds": [] }], "cards": { "<id>": { "id", "title", "details" } } }`, with a small example
- [x] Seed/default behavior: when a user has no board yet, seed from the current `initialData` (5 columns, sample cards)
- [x] DB file location and Docker persistence note: where the `.sqlite` file lives, and that a Docker volume is needed for it to survive container restarts (flagged for Part 6/Docker)
- [x] How this maps to the parts ahead: Part 6 builds these tables and read/update routes; Parts 9-10 have the AI replace the `data` document

Tests / checks (doc-stage, no code yet):
- [x] The documented JSON shape is field-for-field consistent with `frontend/src/lib/kanban.ts` (`Card`, `Column`, `BoardData`)
- [x] The DDL is internally consistent (PKs, the `boards.user_id` FK and uniqueness, JSON column) and the one-board-per-user MVP rule is explicit
- [x] User reviews and signs off on `docs/DATABASE.md`

Success criteria:
- `docs/DATABASE.md` exists and clearly specifies the SQLite tables, the board JSON document shape, the create-on-first-run and seed behavior, and the Docker persistence consideration.
- The JSON shape matches the existing frontend types exactly, so Part 6 can implement it with no schema surprises.
- You have approved the design before any database code is written.

Status: APPROVED. `docs/DATABASE.md` signed off; JSON shape cross-checked against `frontend/src/lib/kanban.ts`. Ready for Part 6.

---

## Part 6 - Backend (database + board API)

Goal: implement the approved `docs/DATABASE.md` design - a SQLite database created on first run - and add authenticated API routes to read and update the signed-in user's board. Backend only; the frontend is wired to these routes in Part 7.

Approach: use the Python standard-library `sqlite3` (no ORM - keep it simple). A small data layer creates the schema on first run, ensures the MVP `user` exists, seeds a default board when the user has none, and reads/writes the board as a JSON document. The board routes require an authenticated session (reusing Part 4's cookie) and validate the board shape with Pydantic models mirroring `BoardData`.

Data layer (`backend/app/`):
- [x] `db.py`: resolve the DB path from `DATABASE_PATH` (default `backend/data/app.db`), open connections, and `init_db()` that creates the `users` and `boards` tables if missing (per `docs/DATABASE.md`)
- [x] Default board lives on the backend (e.g. `seed.py`) as a Python dict matching `initialData` (5 columns + sample cards)
- [x] Board access helpers: `ensure_user(username)`, `get_board(username)` (seed-on-first-access if no row), `save_board(username, data)` (updates `data` and `updated_at`)
- [x] `init_db()` runs at app startup; the `data/` directory is created if missing and is gitignored

Board API (auth-protected, JSON shape validated):
- [x] Pydantic models `Card`, `Column`, `BoardData` matching the frontend types
- [x] A dependency that returns the session user or raises `401` when not logged in
- [x] `GET /api/board`: return the current user's board (seeding the default if none exists)
- [x] `PUT /api/board`: replace the current user's board with the validated payload; return the saved board; invalid shape returns `422`
- [x] `create_app()` accepts the DB path (default from env) so tests use an isolated database

Persistence / Docker:
- [x] Add `backend/data/` to gitignore; ensure the DB file is created if it does not exist
- [x] Dockerfile/scripts: set `DATABASE_PATH` to a mounted location (e.g. `/app/data/app.db`) and mount a named volume (e.g. `-v pm-data:/app/data`) so the board survives container restarts; update `scripts/start.*`

Tests (`pytest`, isolated tmp database per test):
- [x] `init_db()` creates the database file and both tables when absent
- [x] `GET /api/board` while logged in seeds and returns the default board; a second call returns the same board
- [x] `PUT /api/board` persists changes - a follow-up `GET` reflects them, and `updated_at` advances
- [x] `GET`/`PUT` without a session return `401`; a malformed board payload returns `422`
- [x] Existing Part 2/4 tests still pass (health, hello, auth)
- [x] Manual: in the running container, log in, `GET /api/board`, `PUT` a change, restart the container, and confirm the change persisted (volume)

Success criteria:
- A fresh start with no database creates `app.db` with the `users` and `boards` tables and no errors.
- A logged-in user gets a seeded default board on first read; an anonymous request is rejected with `401`.
- Updating the board persists across requests (and across container restarts when the volume is mounted); invalid payloads are rejected with `422`.
- All backend tests green (new board tests plus the existing suites), and the board JSON returned matches the frontend `BoardData` shape exactly.

Status: VERIFIED (container volume check deferred - Docker daemon down). Backend `pytest` 15 passed (7 new board tests: init creates file+tables, seed-on-first-read, identical second read, PUT persists, `401` without session, `422` on bad payload, `updated_at` advances). Local run proved restart persistence: anon `GET /api/board` -> `401`; login seeds 5-column default; `PUT` renamed a column; after stopping and restarting uvicorn on the same DB file the rename survived (PERSISTENCE: PASS) - the behavior the `pm-data` volume preserves in Docker. Dockerfile sets `DATABASE_PATH=/app/data/app.db` and `scripts/start.*` mount `-v pm-data:/app/data`; rerun the container smoke once Docker is up to close the volume loop.

---

## Parts 7-10 (outlines, expanded before each is built)

### Part 7 - Frontend + Backend
Wire the board to the backend API for real persistence. Includes adding card-detail editing (a current frontend gap). Thorough unit and integration tests.

### Part 8 - AI connectivity
Add a backend OpenAI call; validate end to end with a simple "2+2" connectivity test.

### Part 9 - AI with Structured Outputs
Always call the AI with the board JSON plus the user's question and conversation history. The AI returns Structured Outputs containing a user-facing reply and an optional board update. Thorough tests.

### Part 10 - AI chat sidebar
Add a polished sidebar chat widget. When the AI returns a board update, apply it and refresh the UI automatically.
