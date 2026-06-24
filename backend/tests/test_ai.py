import os

import pytest
from fastapi.testclient import TestClient

from app import ai
from app.main import create_app


class FakeAI:
    """In-memory AI client: never touches the network."""

    model = "fake-model"

    def __init__(self, answer="4", error=False):
        self.answer = answer
        self.error = error

    def ask(self, prompt):
        if self.error:
            raise ai.AIError("OpenAI request failed")
        return self.answer


def make_client(tmp_path, ai_client):
    return TestClient(create_app(db_path=tmp_path / "test.db", ai_client=ai_client))


def login(client):
    client.post("/api/login", json={"username": "user", "password": "password"})


def test_ai_ping_returns_answer(tmp_path):
    client = make_client(tmp_path, FakeAI(answer="4"))
    login(client)

    response = client.get("/api/ai/ping")
    assert response.status_code == 200
    assert response.json() == {"ok": True, "model": "fake-model", "answer": "4"}


def test_ai_ping_requires_auth(tmp_path):
    client = make_client(tmp_path, FakeAI())
    assert client.get("/api/ai/ping").status_code == 401


def test_ai_ping_handles_failure(tmp_path):
    client = make_client(tmp_path, FakeAI(error=True))
    login(client)

    response = client.get("/api/ai/ping")
    assert response.status_code == 503
    # No secret/key material leaks in the error body.
    assert "sk-" not in response.text


@pytest.mark.skipif(
    os.environ.get("RUN_LIVE_AI") != "1",
    reason="opt-in live OpenAI call; set RUN_LIVE_AI=1 to run",
)
def test_ai_ping_live(tmp_path):
    # Real call to OpenAI using the configured key/model. Costs a fraction of a cent.
    client = make_client(tmp_path, ai.OpenAIClient())
    login(client)

    response = client.get("/api/ai/ping")
    assert response.status_code == 200
    assert "4" in response.json()["answer"]
