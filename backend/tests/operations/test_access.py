import pytest
from fastapi.testclient import TestClient

from app.core.auth import UserPayload, get_current_user
from app.main import app

client = TestClient(app)

STAFF_ROUTES = [
    ("get", "/api/v1/ops/runs"),
    ("post", "/api/v1/ops/runs/1/cancel"),
    ("post", "/api/v1/ops/runs/1/chart"),
]
ADMIN_ROUTES = [
    ("get", "/api/v1/reports/revenue"),
    ("post", "/api/v1/reports/refresh"),
]


def _as(role):
    app.dependency_overrides[get_current_user] = lambda: UserPayload(user_id=5, email="u@example.com", role=role)


@pytest.mark.parametrize("method,path", STAFF_ROUTES + ADMIN_ROUTES)
def test_anonymous_callers_get_401(method, path):
    app.dependency_overrides.pop(get_current_user, None)
    res = getattr(client, method)(path)
    assert res.status_code == 401
    assert res.json()["code"] == "AUTH_REQUIRED"


@pytest.mark.parametrize("method,path", STAFF_ROUTES + ADMIN_ROUTES)
def test_passengers_get_403(method, path):
    _as("passenger")
    res = getattr(client, method)(path)
    assert res.status_code == 403
    assert res.json()["code"] == "PERMISSION_DENIED"


@pytest.mark.parametrize("method,path", ADMIN_ROUTES)
def test_staff_cannot_use_admin_reports(method, path):
    _as("staff")
    res = getattr(client, method)(path)
    assert res.status_code == 403


def test_public_pnr_status_needs_no_login():
    app.dependency_overrides.pop(get_current_user, None)
    # reaches the route (and the database dependency), instead of being stopped by auth
    assert client.get("/api/v1/pnr/1000000000").status_code != 401
