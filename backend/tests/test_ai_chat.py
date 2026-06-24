import os

import pytest
from fastapi.testclient import TestClient

from app import ai
from app.main import AIBoard, AIChatResponse, Card, Column, create_app
from app.seed import default_board


class FakeChatAI:
    """Injectable AI client that records the messages and returns a canned parse."""

    model = "fake-model"

    def __init__(self, response=None, error=False):
        self.response = response
        self.error = error
        self.captured = None

    def parse(self, messages, response_format):
        self.captured = messages
        if self.error:
            raise ai.AIError("OpenAI request failed")
        return self.response


def make_client(tmp_path, ai_client):
    return TestClient(create_app(db_path=tmp_path / "test.db", ai_client=ai_client))


def login(client):
    client.post("/api/login", json={"username": "user", "password": "password"})


def ai_board_from(stored):
    columns = [Column(**c) for c in stored["columns"]]
    cards = [Card(**c) for c in stored["cards"].values()]
    return columns, cards


def chat(client, content="add a card"):
    return client.post("/api/ai/chat", json={"messages": [{"role": "user", "content": content}]})


def test_chat_persists_board_update(tmp_path):
    columns, cards = ai_board_from(default_board())
    columns[0].cardIds = columns[0].cardIds + ["card-new"]
    cards.append(Card(id="card-new", title="Write docs", details=""))
    response = AIChatResponse(reply="Added it.", board=AIBoard(columns=columns, cards=cards))

    client = make_client(tmp_path, FakeChatAI(response=response))
    login(client)

    result = chat(client)
    assert result.status_code == 200
    body = result.json()
    assert body["reply"] == "Added it."
    assert "card-new" in body["board"]["cards"]
    # Persisted server-side: a follow-up read reflects the change.
    assert "card-new" in client.get("/api/board").json()["cards"]


def test_chat_question_only_leaves_board_unchanged(tmp_path):
    client = make_client(tmp_path, FakeChatAI(response=AIChatResponse(reply="Going well.", board=None)))
    login(client)
    before = client.get("/api/board").json()

    result = chat(client, "how is it going?")
    assert result.status_code == 200
    assert result.json() == {"reply": "Going well.", "board": None}
    assert client.get("/api/board").json() == before


def test_chat_requires_auth(tmp_path):
    client = make_client(tmp_path, FakeChatAI())
    assert chat(client).status_code == 401


def test_chat_empty_message_returns_422(tmp_path):
    client = make_client(tmp_path, FakeChatAI())
    login(client)
    assert client.post("/api/ai/chat", json={"messages": []}).status_code == 422
    assert chat(client, "   ").status_code == 422


def test_chat_ai_failure_returns_503(tmp_path):
    client = make_client(tmp_path, FakeChatAI(error=True))
    login(client)
    result = chat(client)
    assert result.status_code == 503
    assert "sk-" not in result.text


def test_chat_rejects_changed_columns(tmp_path):
    columns, cards = ai_board_from(default_board())
    columns = columns[:4]  # drop a column
    response = AIChatResponse(reply="oops", board=AIBoard(columns=columns, cards=cards))

    client = make_client(tmp_path, FakeChatAI(response=response))
    login(client)
    assert chat(client).status_code == 502
    # Unchanged: still 5 columns.
    assert len(client.get("/api/board").json()["columns"]) == 5


def test_chat_rejects_dangling_card_id(tmp_path):
    columns, cards = ai_board_from(default_board())
    columns[0].cardIds = columns[0].cardIds + ["ghost"]  # placed but no matching card
    response = AIChatResponse(reply="oops", board=AIBoard(columns=columns, cards=cards))

    client = make_client(tmp_path, FakeChatAI(response=response))
    login(client)
    assert chat(client).status_code == 502
    assert "ghost" not in client.get("/api/board").json()["cards"]


def test_chat_sends_board_and_history(tmp_path):
    fake = FakeChatAI(response=AIChatResponse(reply="ok", board=None))
    client = make_client(tmp_path, fake)
    login(client)

    chat(client, "rename Backlog")
    contents = [m["content"] for m in fake.captured]
    # The current board (a known seeded card title) and the user's message are both sent.
    assert any("Current board JSON" in c and "Align roadmap themes" in c for c in contents)
    assert any(c == "rename Backlog" for c in contents)


@pytest.mark.skipif(
    os.environ.get("RUN_LIVE_AI") != "1",
    reason="opt-in live OpenAI call; set RUN_LIVE_AI=1 to run",
)
def test_chat_live_adds_card(tmp_path):
    client = make_client(tmp_path, ai.OpenAIClient())
    login(client)

    result = chat(client, "Add a card titled 'Write docs' to the Backlog column.")
    assert result.status_code == 200
    body = result.json()
    assert body["reply"]
    titles = [c["title"] for c in body["board"]["cards"].values()]
    assert any("Write docs" in t for t in titles)
