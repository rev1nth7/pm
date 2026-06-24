from fastapi.testclient import TestClient

from app.main import create_app


def make_client():
    return TestClient(create_app())


def test_me_is_logged_out_by_default():
    client = make_client()
    response = client.get("/api/me")
    assert response.status_code == 200
    assert response.json() == {"authenticated": False, "username": None}


def test_login_success_sets_session():
    client = make_client()
    response = client.post(
        "/api/login", json={"username": "user", "password": "password"}
    )
    assert response.status_code == 200
    assert response.json() == {"authenticated": True, "username": "user"}
    assert "session" in response.cookies

    me = client.get("/api/me")
    assert me.json() == {"authenticated": True, "username": "user"}


def test_login_failure_returns_401():
    client = make_client()
    response = client.post(
        "/api/login", json={"username": "user", "password": "wrong"}
    )
    assert response.status_code == 401
    assert client.get("/api/me").json()["authenticated"] is False


def test_logout_clears_session():
    client = make_client()
    client.post("/api/login", json={"username": "user", "password": "password"})
    assert client.get("/api/me").json()["authenticated"] is True

    logout = client.post("/api/logout")
    assert logout.status_code == 200
    assert client.get("/api/me").json()["authenticated"] is False


def test_health_is_public():
    client = make_client()
    assert client.get("/api/health").json() == {"status": "ok"}
