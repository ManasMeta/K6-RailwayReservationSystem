from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import get_current_user_id


client = TestClient(app)


def test_wallet_requires_authentication():
    response = client.get("/api/v1/wallet")

    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required"


def test_wallet_scaffold_reached_after_authentication():
    app.dependency_overrides[get_current_user_id] = lambda: 42
    try:
        response = client.get("/api/v1/wallet")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 501
    assert response.json()["detail"] == (
        "Wallet persistence is not connected yet"
    )
