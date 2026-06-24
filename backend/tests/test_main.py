from fastapi.testclient import TestClient

from app.main import app, create_app

client = TestClient(app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_hello():
    response = client.get("/api/hello")
    assert response.status_code == 200
    assert response.json() == {"message": "hello world"}


def test_serves_static_frontend(tmp_path):
    # A populated static dir is served at / (mirrors the exported frontend),
    # and a nested asset path resolves too.
    (tmp_path / "index.html").write_text(
        "<html><body><h2>Backlog</h2></body></html>", encoding="utf-8"
    )
    (tmp_path / "_next").mkdir()
    (tmp_path / "_next" / "app.js").write_text("console.log('ok')", encoding="utf-8")

    local = TestClient(create_app(tmp_path))

    root = local.get("/")
    assert root.status_code == 200
    assert "Backlog" in root.text

    asset = local.get("/_next/app.js")
    assert asset.status_code == 200

    # API routes still take priority over the static mount.
    assert local.get("/api/health").json() == {"status": "ok"}
