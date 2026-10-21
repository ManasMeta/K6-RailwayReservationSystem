from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

import app.modules.wallet.router as wallet_router
from app.core.auth import get_current_user_id
from app.core.database import get_db_connection
from app.main import app
from app.modules.wallet.service import (
    InsufficientFunds,
    ReservationNotFound,
    ReservationNotPayable,
    TicketNotFound,
)

TICKET = {
    "pnr": "1000000001",
    "ticket_number": "NRRMS-1000000001",
    "qr_payload": "NRRMS|PNR=1000000001|TKT=NRRMS-1000000001|AMT=400.00",
    "issued_at": datetime(2026, 11, 2, 9, 30, tzinfo=UTC),
    "amount": Decimal("400.00"),
}


@pytest.fixture
def connection():
    return MagicMock()


@pytest.fixture
def client(connection):
    app.dependency_overrides.clear()
    app.dependency_overrides[get_current_user_id] = lambda: 42
    app.dependency_overrides[get_db_connection] = lambda: connection
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_pay_returns_payment_and_forwards_idempotency_key(client, connection, monkeypatch):
    calls = []

    def fake_pay(conn, user_id, pnr, key):
        calls.append((user_id, pnr, key))
        return {
            "payment_id": 5,
            "pnr": pnr,
            "amount": Decimal("400.00"),
            "balance": Decimal("600.00"),
            "ticket_number": "NRRMS-" + pnr,
            "replayed": False,
        }

    monkeypatch.setattr(wallet_router, "pay_reservation", fake_pay)

    response = client.post(
        "/api/v1/reservations/1000000001/pay", headers={"Idempotency-Key": "pay-key-123"}
    )

    assert response.status_code == 200
    assert response.json()["balance"] == "600.00"
    assert response.json()["ticket_number"] == "NRRMS-1000000001"
    assert calls == [(42, "1000000001", "pay-key-123")]
    connection.commit.assert_called_once()


@pytest.mark.parametrize(
    ("error", "status_code", "code"),
    [
        (InsufficientFunds("Insufficient wallet balance"), 402, "INSUFFICIENT_FUNDS"),
        (ReservationNotFound("Reservation X was not found"), 404, "RESERVATION_NOT_FOUND"),
        (ReservationNotPayable("Reservation X is CONFIRMED"), 409, "RESERVATION_NOT_PAYABLE"),
    ],
)
def test_pay_errors_use_detail_and_code(client, connection, monkeypatch, error, status_code, code):
    def fail(*args):
        raise error

    monkeypatch.setattr(wallet_router, "pay_reservation", fail)

    response = client.post("/api/v1/reservations/1000000001/pay")

    assert response.status_code == status_code
    assert response.json() == {"detail": str(error), "code": code}
    connection.rollback.assert_called_once()
    connection.commit.assert_not_called()


def test_pay_requires_authentication():
    app.dependency_overrides.clear()
    with TestClient(app) as anonymous:
        assert anonymous.post("/api/v1/reservations/1000000001/pay").status_code == 401


def test_pay_rejects_malformed_pnr(client):
    assert client.post("/api/v1/reservations/not-a-pnr!/pay").status_code == 422


def test_payment_quote(client, monkeypatch):
    monkeypatch.setattr(
        wallet_router,
        "get_payment_quote",
        lambda conn, user_id, pnr: {
            "pnr": pnr,
            "amount": Decimal("400.00"),
            "status": "PENDING_PAYMENT",
            "balance": Decimal("100.00"),
            "payable": True,
        },
    )

    body = client.get("/api/v1/reservations/1000000001/payment").json()

    assert body["amount"] == "400.00" and body["payable"] is True


def test_payment_quote_unknown_pnr_is_404(client, monkeypatch):
    def missing(*args):
        raise ReservationNotFound("Reservation 1 was not found")

    monkeypatch.setattr(wallet_router, "get_payment_quote", missing)

    response = client.get("/api/v1/reservations/1/payment")

    assert response.status_code == 404
    assert response.json()["code"] == "RESERVATION_NOT_FOUND"


def test_refunds_list(client, monkeypatch):
    page = {"items": [], "limit": 20, "offset": 0, "total": 0}
    monkeypatch.setattr(wallet_router, "get_refunds", lambda conn, user_id, limit, offset: page)

    assert client.get("/api/v1/refunds").json() == page


def test_ticket_json_pdf_and_qr(client, monkeypatch):
    monkeypatch.setattr(wallet_router, "get_ticket", lambda conn, user_id, pnr: TICKET)

    details = client.get("/api/v1/tickets/1000000001").json()
    pdf = client.get("/api/v1/tickets/1000000001.pdf")
    qr = client.get("/api/v1/tickets/1000000001/qr.png")

    assert details["ticket_number"] == "NRRMS-1000000001"
    assert "qr_payload" not in details
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert "ticket-1000000001.pdf" in pdf.headers["content-disposition"]
    assert pdf.content.startswith(b"%PDF")
    assert qr.headers["content-type"] == "image/png"
    assert qr.content.startswith(b"\x89PNG")


def test_ticket_of_another_user_is_404(client, monkeypatch):
    def missing(*args):
        raise TicketNotFound("No e-ticket found for PNR 1000000001")

    monkeypatch.setattr(wallet_router, "get_ticket", missing)

    for path in ("/tickets/1000000001", "/tickets/1000000001.pdf", "/tickets/1000000001/qr.png"):
        response = client.get(f"/api/v1{path}")
        assert response.status_code == 404
        assert response.json()["code"] == "TICKET_NOT_FOUND"


def test_topup_accepts_idempotency_key_header(client, monkeypatch):
    seen = []

    def fake_topup(conn, user_id, amount, key):
        seen.append(key)
        return {"topup_id": 1, "amount": amount, "balance": amount}

    monkeypatch.setattr(wallet_router, "create_mock_topup", fake_topup)

    response = client.post(
        "/api/v1/wallet/topups",
        json={"amount": "250.00"},
        headers={"Idempotency-Key": "header-key-1"},
    )

    assert response.status_code == 201
    assert seen == ["header-key-1"]


def test_topup_without_any_key_is_rejected(client):
    response = client.post("/api/v1/wallet/topups", json={"amount": "250.00"})

    assert response.status_code == 422
