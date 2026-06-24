import json
import os
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from app import ai, db

# Load the project-root .env for local dev (no-op in Docker, where env is passed in).
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

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


# AI-facing board: cards as a list, not a map. OpenAI Structured Outputs (strict)
# does not support dynamic-key objects, so we use a list here and convert.
class AIBoard(BaseModel):
    columns: list[Column]
    cards: list[Card]


class AIChatResponse(BaseModel):
    reply: str
    board: AIBoard | None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


MAX_HISTORY = 10  # bound input cost: only the most recent turns are sent

AI_SYSTEM_PROMPT = (
    "You are a project management assistant for a Kanban board. "
    "You receive the user's current board as JSON and their messages. "
    "You can create, edit, move, and delete cards, and rename column titles.\n"
    "Rules:\n"
    "- Keep exactly the same columns with the same ids; you may only change their titles. "
    "Never add or remove columns.\n"
    "- Each card has a unique id, a title, and details. When creating a card, invent a new "
    "unique id that does not collide with any existing id.\n"
    "- In the board you return, every card in `cards` must be placed in exactly one column's "
    "`cardIds`, and every id in `cardIds` must have a matching card in `cards`.\n"
    "- The board uses `cards` as a list of card objects (not a map).\n"
    "- If the user only asks a question and no board change is needed, set board to null.\n"
    "- Always put a short, friendly user-facing message in reply."
)


def _board_to_ai_shape(board: dict) -> dict:
    # Present the stored board (cards map) to the model with cards as a list.
    return {"columns": board["columns"], "cards": list(board["cards"].values())}


def _ai_board_to_stored(board: AIBoard) -> dict:
    return {
        "columns": [column.model_dump() for column in board.columns],
        "cards": {card.id: card.model_dump() for card in board.cards},
    }


def _validate_ai_board(new_board: dict, current: dict) -> None:
    # Columns are fixed: same ids, same count (titles may differ).
    if sorted(c["id"] for c in new_board["columns"]) != sorted(c["id"] for c in current["columns"]):
        raise HTTPException(status_code=502, detail="AI returned an invalid board (columns changed)")

    placed = [card_id for column in new_board["columns"] for card_id in column["cardIds"]]
    # No card placed twice, and placements match the cards map exactly (no dangling/orphaned).
    if len(placed) != len(set(placed)) or set(placed) != set(new_board["cards"].keys()):
        raise HTTPException(status_code=502, detail="AI returned an inconsistent board")


def create_app(
    static_dir: Path = DEFAULT_STATIC_DIR,
    db_path: Path | None = None,
    ai_client: ai.AIClient | None = None,
) -> FastAPI:
    db_path = Path(db_path) if db_path else db.resolve_db_path()
    db.init_db(db_path)
    ai_client = ai_client or ai.OpenAIClient()

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

    @app.get("/api/ai/ping")
    def ai_ping(user: str = Depends(current_user)):
        # Connectivity proof-of-life: tiny on-demand call, output-token capped.
        try:
            answer = ai_client.ask("What is 2+2? Reply with just the number.")
        except ai.AIError:
            raise HTTPException(status_code=503, detail="AI service unavailable")
        return {"ok": True, "model": ai_client.model, "answer": answer}

    @app.post("/api/ai/chat")
    def ai_chat(req: ChatRequest, user: str = Depends(current_user)):
        if not req.messages or req.messages[-1].role != "user" or not req.messages[-1].content.strip():
            raise HTTPException(status_code=422, detail="A user message is required")

        board = db.get_board(db_path, user)
        history = req.messages[-MAX_HISTORY:]
        messages = [
            {"role": "system", "content": AI_SYSTEM_PROMPT},
            {"role": "system", "content": "Current board JSON:\n" + json.dumps(_board_to_ai_shape(board))},
            *({"role": m.role, "content": m.content} for m in history),
        ]

        try:
            result = ai_client.parse(messages, AIChatResponse)
        except ai.AIError:
            raise HTTPException(status_code=503, detail="AI service unavailable")

        if result.board is None:
            return {"reply": result.reply, "board": None}

        new_board = _ai_board_to_stored(result.board)
        _validate_ai_board(new_board, board)
        saved = db.save_board(db_path, user, new_board)
        return {"reply": result.reply, "board": saved}

    # Serve the exported Next.js frontend at /. Mounted last so /api/* wins.
    static_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

    return app


app = create_app()
