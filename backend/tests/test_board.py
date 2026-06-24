import sqlite3

from fastapi.testclient import TestClient

from app import db
from app.main import create_app


def make_client(tmp_path):
    return TestClient(create_app(db_path=tmp_path / "test.db"))


def login(client):
    client.post("/api/login", json={"username": "user", "password": "password"})


def test_init_db_creates_file_and_tables(tmp_path):
    path = tmp_path / "fresh.db"
    db.init_db(path)
    assert path.exists()
    conn = sqlite3.connect(path)
    tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    conn.close()
    assert {"users", "boards"} <= tables


def test_get_board_requires_auth(tmp_path):
    client = make_client(tmp_path)
    assert client.get("/api/board").status_code == 401


def test_get_board_seeds_default(tmp_path):
    client = make_client(tmp_path)
    login(client)

    response = client.get("/api/board")
    assert response.status_code == 200
    board = response.json()
    assert len(board["columns"]) == 5
    assert board["columns"][0]["title"] == "Backlog"
    assert "card-1" in board["cards"]

    # A second read returns the same persisted board.
    assert client.get("/api/board").json() == board


def test_put_board_persists(tmp_path):
    client = make_client(tmp_path)
    login(client)

    board = client.get("/api/board").json()
    board["columns"][0]["title"] = "Renamed"
    put = client.put("/api/board", json=board)
    assert put.status_code == 200

    assert client.get("/api/board").json()["columns"][0]["title"] == "Renamed"


def test_put_board_requires_auth(tmp_path):
    client = make_client(tmp_path)
    # Valid shape, but no session -> 401 (not a validation error).
    assert client.put("/api/board", json={"columns": [], "cards": {}}).status_code == 401


def test_put_invalid_payload_returns_422(tmp_path):
    client = make_client(tmp_path)
    login(client)
    assert client.put("/api/board", json={"columns": "nope"}).status_code == 422


def test_save_board_advances_updated_at(tmp_path):
    path = tmp_path / "ts.db"
    db.init_db(path)

    def read_updated_at():
        conn = sqlite3.connect(path)
        value = conn.execute("SELECT updated_at FROM boards").fetchone()[0]
        conn.close()
        return value

    db.save_board(path, "user", {"columns": [], "cards": {}})
    first = read_updated_at()
    db.save_board(path, "user", {"columns": [{"id": "c", "title": "t", "cardIds": []}], "cards": {}})
    second = read_updated_at()
    assert second != first
