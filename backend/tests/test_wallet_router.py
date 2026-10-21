from decimal import Decimal
from unittest.mock import MagicMock

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user_id
from app.core.database import get_db_connection
from app.main import app
from app.modules.wallet.service import IdempotencyConflict
import app.modules.wallet.router as wallet_router


@pytest.fixture
def client():
    app.dependency_overrides.clear()
    app.dependency_overrides[get_current_user_id] = lambda: 42
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_wallet_requires_authentication():
    app.dependency_overrides.clear()
    with TestClient(app) as unauthenticated_client:
        response = unauthenticated_client.get("/api/v1/wallet")
    assert response.status_code == 401


def test_wallet_returns_authenticated_users_wallet(client):
    connection = MagicMock()
    connection.execute.return_value.fetchone.return_value = {
        "wallet_id": 7,
        "balance": Decimal("250.00"),
        "currency": "INR",
        "created_at": None,
        "updated_at": None,
    }
    app.dependency_overrides[get_db_connection] = lambda: connection

    response = client.get("/api/v1/wallet")

    assert response.status_code == 200
    assert response.json()["wallet_id"] == 7
    assert response.json()["balance"] == "250.00"
    assert response.json()["currency"] == "INR"
    connection.commit.assert_called_once()


def test_wallet_database_error_returns_503(client):
    connection = MagicMock()
    connection.execute.side_effect = psycopg.OperationalError(
        "database unavailable"
    )
    app.dependency_overrides[get_db_connection] = lambda: connection

    response = client.get("/api/v1/wallet")

    assert response.status_code == 503
    connection.rollback.assert_called_once()


def test_topup_endpoint_returns_simulated_topup(client, monkeypatch):
    connection = MagicMock()
    app.dependency_overrides[get_db_connection] = lambda: connection

    expected = {
        "topup_id": 10,
        "wallet_id": 7,
        "amount": Decimal("500.00"),
        "status": "COMPLETED",
        "provider_reference": "MOCK-UPI-test-key-123",
        "balance": Decimal("500.00"),
        "currency": "INR",
        "simulated": True,
        "replayed": False,
    }
    service_mock = MagicMock(return_value=expected)
    monkeypatch.setattr(wallet_router, "create_mock_topup", service_mock)

    response = client.post(
        "/api/v1/wallet/topups",
        json={"amount": "500.00", "idempotency_key": "test-key-123"},
    )

    assert response.status_code == 201
    assert response.json()["simulated"] is True
    assert response.json()["balance"] == "500.00"
    assert response.json()["replayed"] is False
    service_mock.assert_called_once_with(
        connection, 42, Decimal("500.00"), "test-key-123"
    )
    connection.commit.assert_called_once()


def test_topup_reused_key_conflict_returns_409(client, monkeypatch):
    connection = MagicMock()
    app.dependency_overrides[get_db_connection] = lambda: connection
    monkeypatch.setattr(
        wallet_router,
        "create_mock_topup",
        MagicMock(
            side_effect=IdempotencyConflict(
                "Idempotency key was already used with different request details"
            )
        ),
    )

    response = client.post(
        "/api/v1/wallet/topups",
        json={"amount": "200.00", "idempotency_key": "test-key-123"},
    )

    assert response.status_code == 409
    connection.rollback.assert_called_once()
    connection.commit.assert_not_called()


def test_topup_invalid_amount_is_rejected(client):
    response = client.post(
        "/api/v1/wallet/topups",
        json={"amount": "-10.00", "idempotency_key": "test-key-123"},
    )
    assert response.status_code == 422


def test_topup_requires_authentication():
    app.dependency_overrides.clear()
    with TestClient(app) as unauthenticated_client:
        response = unauthenticated_client.post(
            "/api/v1/wallet/topups",
            json={"amount": "100.00", "idempotency_key": "test-key-123"},
        )
    assert response.status_code == 401


def test_transactions_returns_paginated_history(client, monkeypatch):
    connection = MagicMock()
    app.dependency_overrides[get_db_connection] = lambda: connection

    expected = {
        "items": [
            {
                "ledger_txn_id": 15,
                "type": "TOPUP",
                "reference_type": "TOPUP",
                "reference_id": "10",
                "status": "POSTED",
                "description": "Mock wallet top-up",
                "amount": Decimal("500.00"),
                "direction": "CREDIT",
                "created_at": "2026-10-21T10:00:00+00:00",
            }
        ],
        "limit": 10,
        "offset": 5,
        "total": 21,
    }
    service_mock = MagicMock(return_value=expected)
    monkeypatch.setattr(
        wallet_router, "get_wallet_transactions", service_mock
    )

    response = client.get(
        "/api/v1/wallet/transactions?limit=10&offset=5"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 21
    assert body["limit"] == 10
    assert body["offset"] == 5
    assert body["items"][0]["type"] == "TOPUP"
    assert body["items"][0]["direction"] == "CREDIT"
    service_mock.assert_called_once_with(
        connection, 42, limit=10, offset=5
    )


def test_transactions_default_pagination(client, monkeypatch):
    connection = MagicMock()
    app.dependency_overrides[get_db_connection] = lambda: connection
    service_mock = MagicMock(
        return_value={
            "items": [],
            "limit": 20,
            "offset": 0,
            "total": 0,
        }
    )
    monkeypatch.setattr(
        wallet_router, "get_wallet_transactions", service_mock
    )

    response = client.get("/api/v1/wallet/transactions")

    assert response.status_code == 200
    assert response.json()["items"] == []
    service_mock.assert_called_once_with(
        connection, 42, limit=20, offset=0
    )


@pytest.mark.parametrize(
    "query",
    [
        "?limit=0",
        "?limit=101",
        "?offset=-1",
    ],
)
def test_transactions_rejects_invalid_pagination(client, query):
    response = client.get(f"/api/v1/wallet/transactions{query}")
    assert response.status_code == 422


def test_transactions_requires_authentication():
    app.dependency_overrides.clear()
    with TestClient(app) as unauthenticated_client:
        response = unauthenticated_client.get(
            "/api/v1/wallet/transactions"
        )
    assert response.status_code == 401