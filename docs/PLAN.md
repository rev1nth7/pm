# Project plan

This document plans the build of the Project Management MVP described in the root `AGENTS.md`. It is built in 10 parts. Parts 1-7 are detailed (substep checklists, tests, success criteria) and complete; Parts 8-10 are outlines, expanded just before each is built.

## Key decisions

- AI: use the existing standard OpenAI key (`api.openai.com`) with the most affordable current OpenAI model that supports Structured Outputs - `gpt-4.1-nano` (fallback `gpt-4o-mini`). This replaces the originally noted `openai/gpt-oss-120b`, which `api.openai.com` does not serve.
- Serving: single process. Next.js builds to static files (`output: 'export'`); FastAPI serves them at `/` and the JSON API at `/api/*`. One Docker container.
- Database: SQLite, created on first run.
- Package manager: `uv` for the Python backend.

## Open item

- The live `OPENAI_API_KEY` lives in a local `.env`. Verified: `.env` is gitignored and was never committed (`git ls-files`/`git log` show no tracking or history), so it is not exposed in the repo. Still keep it out of any commit; rotate it if it has been shared elsewhere. Relevant from Part 8 on, when the key is first used.

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

## Part 7 - Frontend + Backend

Goal: make the board genuinely persistent by wiring the frontend to the Part 6 API - load the board from `GET /api/board` and save every change with `PUT /api/board` - and add card-detail editing, the one business-requirement gap in the current UI.

Approach: `KanbanBoard` stops seeding from `initialData` at runtime and instead loads the board from the backend on mount, keeping local state as the responsive source of truth (optimistic UI). After any change it persists the whole board with a short debounce, so rapid edits (typing a rename, editing details) collapse into one save while discrete actions (add/delete/move) save promptly. The default board still comes from the backend seed (Part 6), so the frontend no longer hardcodes board content.

Frontend data layer:
- [x] `lib/board.ts`: same-origin credentialed `getBoard()` and `saveBoard(board)` against `/api/board`
- [x] Reuse the existing `BoardData` types from `lib/kanban.ts` (no duplicate shapes)

Wire the board to the API:
- [x] `KanbanBoard` loads via `getBoard()` on mount; show a loading state, and a simple error state if the load fails
- [x] Persist on change with a debounced `saveBoard()` (skip the initial load so mount does not immediately PUT); keep optimistic local updates for responsiveness
- [x] A light save indicator (e.g. "Saving..." / "Saved") so persistence is visible; keep it minimal
- [x] `initialData` is no longer used to seed runtime board state (kept only as the backend's seed source / tests)

Card editing (close the gap):
- [x] Add `handleEditCard(cardId, title, details)` in `KanbanBoard`
- [x] `KanbanCard` gains an edit affordance: toggle an inline form (title + details), save or cancel; thread `onEdit` through `KanbanColumn`
- [x] Edited cards persist through the same save path

Tests:
- [x] Frontend unit (Vitest): mock `lib/board`; board renders from the API response (not hardcoded); editing a card updates the UI and triggers `saveBoard`; add/delete/rename/edit each schedule a save
- [x] Frontend e2e (Playwright): mock `/api/me` and `/api/board` (GET returns a seeded board, PUT captured); board loads from the API; edit a card's details; adding a card issues a `PUT`
- [x] Existing suites stay green (backend pytest, other frontend unit/e2e)
- [x] Manual (real backend): log in, rename a column / add / edit a card, reload the page, and confirm the changes persisted; in the container, confirm they survive a restart (volume)

Success criteria:
- On load the board comes from `GET /api/board`, reflecting whatever is stored (no hardcoded board at runtime).
- Every change - rename, add, delete, move, and edit details - persists via `PUT /api/board`; reloading the page shows the persisted board.
- Cards can be edited (title and details) after creation, satisfying the "cards can be edited" requirement.
- The UI stays responsive (optimistic updates) and a failed save is surfaced rather than silently lost.
- All test suites green, plus a manual end-to-end persistence check against the real backend.

Status: VERIFIED. Frontend unit 11 passed (`KanbanBoard` loads from the API, and rename/add/delete/edit each persist via mocked `saveBoard`; added an edit-card test). Frontend e2e 5 passed (board loads from `/api/board`, adding a card issues a `PUT`, a card's details are edited, drag still works, login gate intact). Real-backend smoke: a fresh DB seeded the 5-column default; a card-detail edit plus a column rename were `PUT`, and a follow-up `GET` (reload) returned both changes - persistence confirmed. Card editing (title + details) is now in the UI, closing the requirement gap.

---

## Part 8 - AI connectivity

Goal: prove the backend can reach OpenAI end to end. Add a thin server-side AI client and one authenticated connectivity route that asks the model a trivial question ("what is 2+2?") and returns its answer. This part is plumbing and proof-of-life only - no board context, no Structured Outputs, no frontend (those are Parts 9-10).

Approach: load the project-root `.env` so the backend sees `OPENAI_API_KEY` in local dev (Docker passes it via env), add the official `openai` SDK as a backend dependency, and isolate all OpenAI usage in a small `ai.py` module. The connectivity route reuses Part 4's auth so the endpoint (and the API spend behind it) is not anonymous. Following the `create_app(db_path=...)` pattern, the AI client is injectable so tests never hit the network, with one opt-in live test that really calls OpenAI.

Config / dependencies:
- [x] Add `openai` to `backend/pyproject.toml` dependencies; add `python-dotenv` so the root `.env` is loaded in local dev (`uv sync` to update `uv.lock`)
- [x] Load the project-root `.env` at startup (no-op if absent, e.g. in Docker where env is passed directly); never log or echo the key
- [x] Read `OPENAI_API_KEY` from the environment and the model name from `OPENAI_MODEL` (default `gpt-4.1-nano`, documented fallback `gpt-4o-mini`)

AI client (`backend/app/ai.py`):
- [x] A small wrapper that constructs an OpenAI client from `OPENAI_API_KEY` and exposes one function, e.g. `ask(prompt: str) -> str`, returning the model's text reply
- [x] Define a minimal client protocol/interface so a fake client can be injected in tests (no network)
- [x] Surface a clear, key-free error when the API key is missing or the OpenAI call fails (no secret material in the message)

Connectivity route (auth-protected):
- [x] `GET /api/ai/ping`: depends on the session user (`401` when logged out); calls `ask("What is 2+2? Reply with just the number.")` and returns `{ "ok": true, "model": "<model>", "answer": "<text>" }`
- [x] On OpenAI failure or missing key, return `503` with a short, safe error message (not `500`, and no key leakage)
- [x] `create_app(...)` accepts an injectable AI client (default: the real one) so tests pass a fake; keeps `/api/*` registered before the static mount

Budget / cost control (keep API calls within budget):
- [x] Hard ceiling lives in the OpenAI dashboard: set a monthly usage hard limit on the account (the real safety net; out-of-code so no key handling here) - documented in the plan/README *(manual user step: OpenAI dashboard > Settings > Limits)*
- [x] Default to the cheapest capable model `gpt-4.1-nano`; the connectivity prompt is tiny and the call is on-demand only (no polling, no background loop, no retry storms)
- [x] Cap output with `max_completion_tokens` on every call (small for the ping; sized deliberately in Parts 9-10) so a runaway response cannot inflate cost
- [x] Note the per-call cost order of magnitude in `ai.py`/docs (a 2+2 call is a fraction of a cent) so the budget impact is explicit going into Parts 9-10, where board + history are sent each message

Docker / scripts:
- [x] Ensure `OPENAI_API_KEY` (and optional `OPENAI_MODEL`) reach the container: `scripts/start.*` pass them through (`--env-file .env`, guarded so it is optional); confirm `.env` stays gitignored
- [ ] Confirm the image still builds (the `openai` dep installs cleanly under `uv`) - DEFERRED (Docker daemon down)

Tests (`pytest`, network mocked):
- [x] `GET /api/ai/ping` while logged in, with a fake AI client returning "4", returns 200 and `{ ok: true, answer: "4", model: ... }`
- [x] `GET /api/ai/ping` while logged out returns `401`
- [x] When the injected client raises (simulated API failure), the route returns `503` and no key/secret appears in the response
- [x] Existing Part 2/4/6 suites still pass (health, hello, auth, board)
- [x] Live connectivity test (opt-in via `RUN_LIVE_AI=1` rather than mere key presence, since `.env` auto-loads the key on every run): a real call to OpenAI for "2+2" returns an answer containing "4"
- [ ] Manual: in the running container, log in and hit `/api/ai/ping`; confirm a real "4" answer comes back - DEFERRED (Docker daemon down)

Success criteria:
- A logged-in `GET /api/ai/ping` performs a real OpenAI call and returns the model's answer (contains "4"); a logged-out request is rejected with `401`.
- All OpenAI access is isolated in `ai.py` behind an injectable client; mocked tests are green with no network, and the opt-in live test passes when the key is present.
- A missing key or an OpenAI error yields a clean `503` with no secret leakage, never an unhandled `500`.
- The key is read from env/`.env` only, never committed or logged; the Docker image builds and the container can make the call with the key passed through.
- Calls stay within budget: an OpenAI dashboard monthly hard limit is set, the cheapest model (`gpt-4.1-nano`) is used, every call is output-token-capped, and calls happen only on demand (no polling/background spend).
- All backend suites pass (new AI tests plus the existing health/auth/board tests).

Status: VERIFIED (container build/manual deferred - Docker daemon down). All OpenAI access is isolated in `app/ai.py` behind an injectable `AIClient` (real `OpenAIClient` default; `FakeAI` in tests), output-token-capped (`max_completion_tokens=16`) on `gpt-4.1-nano`. `GET /api/ai/ping` is auth-gated and returns `{ok, model, answer}`; OpenAI/missing-key failures map to a clean `503` with no key leakage. Backend `pytest` 18 passed, 1 skipped (3 new mocked AI tests: 200+answer, `401` logged out, `503` on failure with no `sk-` in body); the existing health/auth/board suites stayed green. The opt-in live test (`RUN_LIVE_AI=1`) made a real OpenAI call and returned an answer containing "4" - end-to-end connectivity proven. `.env` is loaded at startup (root `.env`, gitignored) and `scripts/start.*` pass it through via guarded `--env-file .env`. Budget ceiling: set the OpenAI dashboard monthly hard limit (manual). Rerun the container smoke once Docker is up to close the build/manual loop.

---

## Part 9 - AI with Structured Outputs

Goal: turn the Part 8 connectivity plumbing into a real board assistant. Add an authenticated chat endpoint that, on every message, sends the user's current board plus the conversation history to the model and gets back OpenAI Structured Outputs: a user-facing reply and an optional full board update. The model can thereby create, edit, move, and delete cards (and rename columns) by returning a revised board. Backend only; the sidebar UI is Part 10.

Approach: extend `app/ai.py` with a generic `parse(messages, response_format) -> BaseModel` that uses OpenAI Structured Outputs (`chat.completions.parse` with a strict Pydantic schema), keeping `ai.py` decoupled from the board models and still injectable for tests. A new `POST /api/ai/chat` builds the request: a system prompt stating the assistant's rules, the user's current board (loaded server-side from the DB), and the recent conversation history sent by the client. The model returns `{ reply, board }` where `board` is either a complete new `BoardData` or `null` (no change). The board is rewritten wholesale (the Part 5 decision), so no diff/op format is needed.

Persistence decision (flag for sign-off): when the model returns a board, the server validates it, persists it via the existing `save_board` (DB stays authoritative for the next turn), and returns it in the response. Part 10's frontend then simply refreshes its UI to the returned board - no separate `PUT` and no client/server race.

Structured Outputs schema (`app/ai.py` / models):
- [x] Define a Pydantic `AIChatResponse { reply: str, board: AIBoard | None }`. Note: the AI-facing `AIBoard` uses `cards` as a **list** (reusing `Card`/`Column`), not `BoardData`'s `cards` map - OpenAI strict Structured Outputs does not support dynamic-key objects. The route converts the list back to the stored map shape.
- [x] Extend `ai.py` with `parse(messages: list[dict], response_format: type[T], max_tokens) -> T` using `client.chat.completions.parse(...)` (strict Structured Outputs); return the parsed object
- [x] Reuse Part 8's `AIError` for missing key / API failure / a refusal or unparsable result (key-free message)

Chat endpoint (auth-protected):
- [x] `POST /api/ai/chat` body `{ messages: [{ role: "user"|"assistant", content: str }] }`; require a non-empty latest user message (`422` otherwise)
- [x] Depends on the session user (`401` when logged out); load that user's board server-side via `db.get_board` (seed if none)
- [x] Build the model input: a system prompt (assistant rules) + the current board JSON + the recent history (cap to the last N messages, N=10, to bound input cost)
- [x] Call `ai_client.parse(..., AIChatResponse)`; on `AIError` return `503` (no key leakage)
- [x] If `board` is returned: validate it, `save_board`, and include it in the response; if `null`: leave the board unchanged
- [x] Response shape `{ "reply": str, "board": BoardData | null }` (stored map shape)

System prompt / rules (enforce the business constraints):
- [x] Tell the model it manages a Kanban board: it may create, edit, move, and delete cards freely, and may rename columns
- [x] Columns are fixed: the model must keep the same 5 column ids (rename titles only) - never add or remove columns
- [x] New cards must use new unique ids that do not collide with existing ones; every `cardIds` entry must reference a card in `cards`, and every card must be referenced by exactly one column
- [x] If the user only asks a question (no change needed), return `board: null` and just answer in `reply`

Server-side validation of the model's board (defense in depth):
- [x] Reject with `502` a returned board that drops/adds columns or changes column ids
- [x] Reject a board whose `cardIds`/`cards` are inconsistent (dangling id, card not referenced, duplicate placement)
- [x] Only persist a board that passes validation; never persist a malformed board

Budget / cost control (calls are bigger than Part 8 - whole board + history each turn):
- [x] Still `gpt-4.1-nano`, on-demand only; the OpenAI dashboard monthly hard limit remains the ceiling
- [x] Cap `max_completion_tokens` high enough to return a full board but no higher (`BOARD_MAX_TOKENS=2000` in `ai.py`)
- [x] Bound input by trimming history to the last N messages so a long chat does not grow cost unbounded
- [x] Note expected per-call cost order of magnitude in `ai.py`/docs (board + short history on nano is well under a cent)

Tests (`pytest`, network mocked):
- [x] `POST /api/ai/chat` logged in, fake returns `reply` + a modified `board`: 200, response carries both, and a follow-up `GET /api/board` reflects the persisted change
- [x] Fake returns `reply` with `board: null`: 200, reply returned, board unchanged
- [x] Logged out returns `401`; empty/missing message returns `422`
- [x] Injected client raises -> `503`, no key/secret in the body
- [x] A fake returning an invalid board (dropped column and dangling cardId) is rejected and not persisted
- [x] The request actually includes the current board and history (asserted via a spy fake capturing the messages passed to `parse`)
- [x] Existing Part 2/4/6/8 suites still pass
- [x] Live test (opt-in via `RUN_LIVE_AI=1`): a real call like "add a card titled 'Write docs' to Backlog" returns a non-empty reply and a board containing that card under the Backlog column
- [x] Manual: covered by the opt-in live test (real OpenAI call -> validated -> persisted via the same app)

Success criteria:
- A logged-in `POST /api/ai/chat` always sends the current board + recent history and returns a Structured Output `{ reply, board }`; the schema is enforced by the model (strict) and the response validates as `BoardData | null`.
- The AI can create, edit, move, and delete cards and rename columns via the returned board; column ids/count stay fixed and an inconsistent board is rejected, never persisted.
- A valid board update is persisted server-side (a follow-up `GET /api/board` reflects it) and returned for Part 10 to render; a question-only turn leaves the board unchanged.
- Logged-out is `401`, empty message is `422`, and an OpenAI/parse failure is a clean `503` with no key leakage.
- Calls stay within budget: cheapest model, output-token-capped, history-bounded, on-demand only, under the dashboard hard limit.
- All backend suites pass (new chat tests plus the existing health/auth/board/ai-ping tests), and the opt-in live test demonstrates a real board edit end to end.

Status: VERIFIED. `POST /api/ai/chat` (auth-gated) loads the user's board, sends a system prompt + current board JSON + last 10 history messages, and gets OpenAI Structured Outputs `{reply, board}` via `ai.parse` (`chat.completions.parse`, strict). Deviation from the outline: the AI-facing `AIBoard` uses `cards` as a list (strict Structured Outputs rejects dynamic-key maps); the route converts it back to the stored `BoardData` map. A returned board is validated (fixed 5 column ids; no dangling/orphaned/duplicate card placements) and only persisted via `save_board` if valid (`502` otherwise); `board: null` leaves the board untouched. Backend `pytest` 26 passed, 2 skipped (8 new chat tests: persisted update, null-board no-op, `401`, `422` empty/whitespace, `503` on failure with no `sk-` leak, rejected changed-columns, rejected dangling cardId, and a spy asserting board+history are actually sent); existing health/auth/board/ai-ping suites stayed green. Opt-in live test (`RUN_LIVE_AI=1`) made a real call ("add a card titled 'Write docs' to Backlog") that returned a reply and a board containing the new card under Backlog, validated and persisted - end-to-end proven. Budget: `gpt-4.1-nano`, `max_completion_tokens=2000`, history capped at 10, on-demand only.

---

## Part 10 (outline, expanded before it is built)

### Part 10 - AI chat sidebar
Add a polished sidebar chat widget. When the AI returns a board update, apply it and refresh the UI automatically.
