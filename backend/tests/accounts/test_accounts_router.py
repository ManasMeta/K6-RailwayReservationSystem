from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import bcrypt
import jwt
import pytest
from fastapi.testclient import TestClient
from psycopg.errors import UniqueViolation

from app.core.auth import (
    UserPayload,
    create_access_token,
    decode_access_token,
    get_current_user_id,
    require_role,
)
from app.core.config import get_settings
from app.core.database import get_db_connection
from app.main import app

SECRET = "test-secret-with-more-than-32-bytes-in-it"


@pytest.fixture(autouse=True)
def jwt_secret(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    get_settings.cache_clear()
    yield
    app.dependency_overrides.clear()
    get_settings.cache_clear()


@pytest.fixture
def client():
    return TestClient(app)


def _fake_connection(*results):
    """A connection whose execute() hands back the given fetchone/fetchall results in order."""
    connection = MagicMock()
    cursors = []
    for result in results:
        cursor = MagicMock()
        cursor.fetchone.return_value = result
        cursor.fetchall.return_value = result
        cursors.append(cursor)
    connection.execute.side_effect = cursors
    app.dependency_overrides[get_db_connection] = lambda: connection
    return connection


def _auth(user_id=7, role="passenger"):
    token = create_access_token(user_id, "asha@example.com", role)
    return {"Authorization": f"Bearer {token}"}


def _user_row(password: str | None = None, role="passenger"):
    return {
        "user_id": 7,
        "email": "asha@example.com",
        "full_name": "Asha Rao",
        "phone": None,
        "role": role,
        "password_hash": bcrypt.hashpw((password or "x").encode(), bcrypt.gensalt(rounds=4)).decode(),
    }


SIGNUP = {"email": "asha@example.com", "password": "correct horse", "full_name": "Asha Rao"}


def test_signup_returns_token_and_stores_only_a_hash(client):
    connection = _fake_connection({"user_id": 7}, None, _user_row())

    res = client.post("/api/v1/auth/signup", json=SIGNUP)

    assert res.status_code == 201
    body = res.json()
    assert body["token_type"] == "bearer"
    assert body["user"] == {
        "user_id": 7, "email": "asha@example.com", "full_name": "Asha Rao", "phone": None, "role": "passenger",
    }
    assert "password_hash" not in body["user"]
    assert decode_access_token(body["access_token"]).user_id == 7
    stored_hash = connection.execute.call_args_list[0].args[1][1]
    assert stored_hash != SIGNUP["password"]
    assert bcrypt.checkpw(SIGNUP["password"].encode(), stored_hash.encode())
    connection.commit.assert_called_once()


def test_signup_duplicate_email_is_a_conflict(client):
    connection = MagicMock()
    connection.execute.side_effect = UniqueViolation()
    app.dependency_overrides[get_db_connection] = lambda: connection

    res = client.post("/api/v1/auth/signup", json=SIGNUP)

    assert res.status_code == 409
    assert res.json() == {"detail": "An account with this email already exists", "code": "EMAIL_TAKEN"}
    connection.rollback.assert_called_once()


@pytest.mark.parametrize(
    "change",
    [
        {"password": "short"},
        {"password": "x" * 73},
        {"email": "not-an-email"},
        {"full_name": "   "},
        {"phone": "12345"},
    ],
)
def test_signup_rejects_invalid_input(client, change):
    connection = _fake_connection()
    res = client.post("/api/v1/auth/signup", json={**SIGNUP, **change})
    assert res.status_code == 422
    connection.execute.assert_not_called()


def test_login_with_correct_password(client):
    _fake_connection(_user_row("correct horse", role="staff"))

    res = client.post("/api/v1/auth/login", json={"email": "asha@example.com", "password": "correct horse"})

    assert res.status_code == 200
    assert decode_access_token(res.json()["access_token"]).role == "staff"


def test_wrong_password_and_unknown_email_look_the_same(client):
    _fake_connection(_user_row("correct horse"))
    wrong = client.post("/api/v1/auth/login", json={"email": "asha@example.com", "password": "nope-nope"})
    _fake_connection(None)
    unknown = client.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "nope-nope"})

    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"detail": "Incorrect email or password", "code": "AUTH_INVALID"}


def test_me_requires_a_token(client):
    res = client.get("/api/v1/me")
    assert res.status_code == 401
    assert res.json()["code"] == "AUTH_REQUIRED"
    assert res.headers["www-authenticate"] == "Bearer"


def test_me_returns_the_signed_in_user(client):
    _fake_connection(_user_row())
    res = client.get("/api/v1/me", headers=_auth())
    assert res.status_code == 200
    assert res.json()["email"] == "asha@example.com"
    assert "password_hash" not in res.json()


def test_profile_update_changes_name_and_phone(client):
    updated = {**_user_row(), "full_name": "Asha R", "phone": "9876543210"}
    connection = _fake_connection(None, updated)

    res = client.patch("/api/v1/me", headers=_auth(user_id=7), json={"full_name": " Asha R ", "phone": "9876543210"})

    assert res.status_code == 200
    assert res.json()["full_name"] == "Asha R"
    assert connection.execute.call_args_list[0].args[1] == ("Asha R", "9876543210", 7)
    connection.commit.assert_called_once()


def test_profile_update_rejects_a_bad_phone(client):
    _fake_connection()
    res = client.patch("/api/v1/me", headers=_auth(), json={"full_name": "Asha", "phone": "123"})
    assert res.status_code == 422


def test_refresh_picks_up_a_role_change(client):
    _fake_connection(_user_row(role="staff"))
    res = client.post("/api/v1/auth/refresh", headers=_auth(role="passenger"))
    assert res.status_code == 200
    assert decode_access_token(res.json()["access_token"]).role == "staff"


def test_expired_token_is_rejected(client):
    past = datetime.now(timezone.utc) - timedelta(minutes=5)
    token = jwt.encode({"sub": "7", "exp": past}, SECRET, algorithm="HS256")
    res = client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
    assert res.json()["code"] == "AUTH_EXPIRED"


@pytest.mark.parametrize("token", ["garbage", jwt.encode({"sub": "7"}, "another-secret-of-32-bytes-or-more!!", algorithm="HS256")])
def test_forged_or_malformed_token_is_rejected(client, token):
    res = client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
    assert res.json()["code"] == "AUTH_INVALID"


def test_require_role_allows_listed_roles_and_admin_only():
    check = require_role(["staff"])
    assert check(UserPayload(user_id=1, email="a@b.co", role="staff")).role == "staff"
    assert check(UserPayload(user_id=1, email="a@b.co", role="admin")).role == "admin"
    with pytest.raises(Exception) as exc:
        check(UserPayload(user_id=1, email="a@b.co", role="passenger"))
    assert exc.value.status_code == 403


def test_wallet_user_id_comes_from_the_bearer_token(client):
    request = MagicMock()
    request.state = MagicMock(spec=[])
    request.headers = {"authorization": _auth(user_id=42)["Authorization"]}
    assert get_current_user_id(request) == 42

    res = client.get("/api/v1/wallet")
    assert res.status_code == 401


def test_saved_passenger_cap(client):
    connection = _fake_connection(None, {"n": 10})
    res = client.post(
        "/api/v1/me/passengers",
        headers=_auth(),
        json={"full_name": "Ravi Rao", "age": 40, "gender": "Male"},
    )
    assert res.status_code == 409
    assert res.json()["code"] == "PASSENGER_LIMIT"
    connection.rollback.assert_called_once()


def test_saved_passenger_is_scoped_to_the_signed_in_user(client):
    row = {
        "passenger_id": 3, "user_id": 7, "full_name": "Ravi Rao", "age": 40, "gender": "Male",
        "berth_preference": None, "senior_citizen": False,
    }
    connection = _fake_connection(None, {"n": 2}, row)
    res = client.post(
        "/api/v1/me/passengers",
        headers=_auth(user_id=7),
        json={"full_name": "Ravi Rao", "age": 40, "gender": "Male"},
    )
    assert res.status_code == 201
    insert_params = connection.execute.call_args_list[2].args[1]
    assert insert_params[0] == 7


def test_deleting_someone_elses_passenger_is_not_found(client):
    _fake_connection(None)
    res = client.delete("/api/v1/me/passengers/99", headers=_auth())
    assert res.status_code == 404
    assert res.json()["code"] == "PASSENGER_NOT_FOUND"
