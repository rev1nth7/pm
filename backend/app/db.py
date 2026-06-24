import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from app.seed import default_board

DEFAULT_DB_PATH = Path(__file__).parent.parent / "data" / "app.db"


def resolve_db_path() -> Path:
    return Path(os.environ.get("DATABASE_PATH", DEFAULT_DB_PATH))


@contextmanager
def _connect(db_path: Path):
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        with conn:  # commits on success, rolls back on exception
            yield conn
    finally:
        conn.close()


def init_db(db_path: Path) -> None:
    with _connect(db_path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT    NOT NULL UNIQUE,
                password_hash TEXT,
                created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS boards (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id),
                data       TEXT    NOT NULL,
                created_at TEXT    NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
            );
            """
        )


def ensure_user(db_path: Path, username: str) -> int:
    with _connect(db_path) as conn:
        conn.execute(
            "INSERT OR IGNORE INTO users (username) VALUES (?)", (username,)
        )
        row = conn.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        ).fetchone()
        return row["id"]


def get_board(db_path: Path, username: str) -> dict:
    user_id = ensure_user(db_path, username)
    with _connect(db_path) as conn:
        row = conn.execute(
            "SELECT data FROM boards WHERE user_id = ?", (user_id,)
        ).fetchone()
        if row is not None:
            return json.loads(row["data"])
        # Seed a default board on first access.
        data = default_board()
        conn.execute(
            "INSERT INTO boards (user_id, data) VALUES (?, ?)",
            (user_id, json.dumps(data)),
        )
        return data


def save_board(db_path: Path, username: str, data: dict) -> dict:
    user_id = ensure_user(db_path, username)
    now = datetime.now(timezone.utc).isoformat()
    payload = json.dumps(data)
    with _connect(db_path) as conn:
        updated = conn.execute(
            "UPDATE boards SET data = ?, updated_at = ? WHERE user_id = ?",
            (payload, now, user_id),
        ).rowcount
        if updated == 0:
            conn.execute(
                "INSERT INTO boards (user_id, data, updated_at) VALUES (?, ?, ?)",
                (user_id, payload, now),
            )
    return data
