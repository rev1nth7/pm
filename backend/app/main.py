import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from app import db

DEFAULT_STATIC_DIR = Path(__file__).parent / "static"

# Hardcoded MVP credentials. The database will support real users later.
USERNAME = "user"
PASSWORD = "password"


class Credentials(BaseModel):
    username: str
    password: str


class Card(BaseModel):
    id: str
    title: str
    details: str


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]


def create_app(static_dir: Path = DEFAULT_STATIC_DIR, db_path: Path | None = None) -> FastAPI:
    db_path = Path(db_path) if db_path else db.resolve_db_path()
    db.init_db(db_path)

    app = FastAPI(title="Project Management MVP")

    # Session is held in an HTTP-only signed cookie (Starlette sets httponly).
    app.add_middleware(
        SessionMiddleware,
        secret_key=os.environ.get("SECRET_KEY", "dev-secret-change-me"),
        same_site="lax",
    )

    def current_user(request: Request) -> str:
        user = request.session.get("user")
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        return user

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/hello")
    def hello():
        return {"message": "hello world"}

    @app.post("/api/login")
    def login(credentials: Credentials, request: Request):
        if credentials.username != USERNAME or credentials.password != PASSWORD:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        request.session["user"] = credentials.username
        return {"authenticated": True, "username": credentials.username}

    @app.post("/api/logout")
    def logout(request: Request):
        request.session.clear()
        return {"authenticated": False, "username": None}

    @app.get("/api/me")
    def me(request: Request):
        user = request.session.get("user")
        return {"authenticated": user is not None, "username": user}

    @app.get("/api/board")
    def read_board(user: str = Depends(current_user)):
        return db.get_board(db_path, user)

    @app.put("/api/board")
    def update_board(board: BoardData, user: str = Depends(current_user)):
        return db.save_board(db_path, user, board.model_dump())

    # Serve the exported Next.js frontend at /. Mounted last so /api/* wins.
    static_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

    return app


app = create_app()
