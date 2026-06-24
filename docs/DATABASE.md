# Database design

How the Project Management MVP persists data. This document is the design proposed in Part 5; the tables and routes are implemented in Part 6.

## Decision

- Engine: SQLite. A single file database, created on first run if it does not exist.
- Storage model: each user's Kanban board is stored as one JSON document in a text column. The JSON mirrors the frontend `BoardData` type exactly (see `frontend/src/lib/kanban.ts`), so the same structure flows UI <-> API <-> DB with no translation.
- Two tables: `users` (multi-user ready) and `boards` (one row per user).

### Why a JSON blob instead of normalized column/card tables

The board is always read and written as a whole: the UI loads the entire board, and in Parts 9-10 the AI returns a complete updated board. There is no requirement to query or join individual cards in SQL. Storing the board as one JSON document keeps the schema tiny, makes reads/writes atomic per user, and means the API can hand the frontend exactly what it already expects. The trade-off - no SQL-level filtering or aggregation across cards - does not matter for this single-board MVP. If that need appears later, the `boards.data` document can be migrated into normalized tables without changing the API contract.

## Tables

```sql
CREATE TABLE users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT,                              -- nullable for the MVP (auth is hardcoded today)
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE boards (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id),  -- UNIQUE => one board per user (MVP)
    data       TEXT    NOT NULL,                               -- JSON document, shape below
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

Notes:
- `users.password_hash` is nullable because MVP auth is the hardcoded `user` / `password` (Part 4). The column exists now so real users can be added later without a migration.
- `boards.user_id` is `UNIQUE`, which enforces the one-board-per-user rule for the MVP. Relaxing this to many boards per user later is additive (drop the uniqueness, add a board name/id).
- Timestamps are stored as ISO text via SQLite's `datetime('now')`. `updated_at` is set by the application on every write.

## Board JSON shape

`boards.data` holds a JSON document matching `BoardData` in `frontend/src/lib/kanban.ts`:

- `columns`: ordered array of `{ id, title, cardIds }`, where `cardIds` is the ordered list of card ids in that column.
- `cards`: a lookup object keyed by card id, each `{ id, title, details }`.

Example:

```json
{
  "columns": [
    { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"] },
    { "id": "col-progress", "title": "In Progress", "cardIds": ["card-4"] },
    { "id": "col-done", "title": "Done", "cardIds": [] }
  ],
  "cards": {
    "card-1": { "id": "card-1", "title": "Align roadmap themes", "details": "Draft quarterly themes." },
    "card-2": { "id": "card-2", "title": "Gather customer signals", "details": "Review support tags." },
    "card-4": { "id": "card-4", "title": "Refine status language", "details": "Standardize labels." }
  }
}
```

Field-for-field this is the same `Card`, `Column`, and `BoardData` the frontend already uses, so the API stores and returns it unchanged.

## Creation and seeding

- On first run, if the SQLite file does not exist, the app creates it and the two tables.
- The MVP user is ensured to exist (a `users` row for `user`).
- When a user has no `boards` row yet, the application seeds one from the current default board (`initialData` in `frontend/src/lib/kanban.ts`: 5 columns with the sample cards). The seed data lives on the backend so it does not depend on the frontend bundle.
- After seeding, all reads and writes go through the stored document.

## File location and Docker persistence

- Default location: a `backend/data/app.db` file, with the path overridable by a `DATABASE_PATH` environment variable.
- The `data/` directory is gitignored (the database is runtime state, not source).
- Docker: the database lives inside the container's filesystem, so it is lost when the container is removed (the start script runs with `--rm`). To persist across restarts, mount a volume at the data directory (for example `-v pm-data:/app/data`) and point `DATABASE_PATH` there. This is flagged here and handled when Part 6 wires up the database and updates the Dockerfile/scripts.

## Mapping to later parts

- Part 6 implements these tables, the create-on-first-run + seed logic, and the read/update API routes for a user's board, with pytest coverage.
- Part 7 wires the frontend to those routes for real persistence.
- Parts 9-10 let the AI return a full updated board, which replaces the `boards.data` document for that user.
