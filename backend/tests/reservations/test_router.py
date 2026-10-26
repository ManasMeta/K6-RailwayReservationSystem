"""Integration tests for Reservation Engine FastAPI endpoints."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.auth import UserPayload, get_current_user
from app.main import app
from app.modules.reservations.schemas import (
    CancellationResponse,
    CancelledPassengerDetail,
    PassengerResponse,
    ReservationListResponse,
    ReservationResponse,
)
from app.modules.reservations.service import ReservationService

client = TestClient(app)


def _sign_in(role: str = "passenger") -> None:
    app.dependency_overrides[get_current_user] = lambda: UserPayload(
        user_id=1, email="passenger@example.com", role=role
    )


@pytest.fixture(autouse=True)
def signed_in_passenger():
    _sign_in("passenger")
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def sample_reservation_response():
    now = datetime.now()
    return ReservationResponse(
        reservation_id=42,
        pnr="1000000042",
        user_id=1,
        train_no="12424",
        run_date=date.today() + timedelta(days=5),
        from_station_code="NDLS",
        to_station_code="DDU",
        from_seq=1,
        to_seq=4,
        class_code="3A",
        quota_code="GN",
        status="PENDING_PAYMENT",
        total_fare=Decimal("1250.00"),
        hold_expires_at=now + timedelta(minutes=10),
        passengers=[
            PassengerResponse(
                passenger_id=1,
                reservation_id=42,
                passenger_name="Aarav Sharma",
                age=30,
                gender="Male",
                berth_preference="LB",
                senior_citizen=False,
                booking_status="CNF",
                current_status="CNF",
                coach_code="B1",
                berth_number=12,
                berth_type="LB",
                rac_number=None,
                wl_number=None,
                fare=Decimal("1250.00"),
                created_at=now,
                updated_at=now,
            )
        ],
        created_at=now,
        updated_at=now,
    )


def test_create_reservation_endpoint(sample_reservation_response):
    with patch.object(ReservationService, "create_reservation", return_value=sample_reservation_response):
        payload = {
            "train_no": "12424",
            "run_date": str(date.today() + timedelta(days=5)),
            "from_station_code": "NDLS",
            "to_station_code": "DDU",
            "class_code": "3A",
            "quota_code": "GN",
            "passengers": [
                {
                    "passenger_name": "Aarav Sharma",
                    "age": 30,
                    "gender": "Male",
                    "berth_preference": "LB",
                }
            ],
        }
        res = client.post("/api/v1/reservations", json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["pnr"] == "1000000042"
        assert data["status"] == "PENDING_PAYMENT"
        assert len(data["passengers"]) == 1
        assert data["passengers"][0]["current_status"] == "CNF"


def test_get_reservation_by_pnr(sample_reservation_response):
    with patch.object(ReservationService, "get_reservation_by_pnr", return_value=sample_reservation_response):
        res = client.get("/api/v1/reservations/1000000042")
        assert res.status_code == 200
        data = res.json()
        assert data["pnr"] == "1000000042"
        assert data["train_no"] == "12424"


def test_list_reservations(sample_reservation_response):
    list_res = ReservationListResponse(
        items=[sample_reservation_response],
        total=1,
        page=1,
        page_size=10,
    )
    with patch.object(ReservationService, "list_reservations", return_value=list_res):
        res = client.get("/api/v1/reservations?page=1&page_size=10")
        assert res.status_code == 200
        data = res.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1


def test_cancel_passengers_endpoint():
    now = datetime.now()
    canc_res = CancellationResponse(
        pnr="1000000042",
        reservation_status="CANCELLED",
        total_refund=Decimal("1050.00"),
        cancelled_passengers=[
            CancelledPassengerDetail(
                passenger_id=1,
                passenger_name="Aarav Sharma",
                refund_amount=Decimal("1050.00"),
                cancellation_charge=Decimal("200.00"),
                status="CANCELLED",
            )
        ],
        cancelled_at=now,
    )
    with patch.object(ReservationService, "cancel_passengers", return_value=canc_res):
        payload = {"passenger_ids": [1], "reason": "Change of plans"}
        res = client.post("/api/v1/reservations/1000000042/cancel", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["pnr"] == "1000000042"
        assert data["reservation_status"] == "CANCELLED"
        assert data["total_refund"] == "1050.00"


def test_confirm_reservation_endpoint_allows_staff():
    _sign_in("staff")
    with patch.object(ReservationService, "confirm_reservation", return_value=True):
        res = client.post("/api/v1/reservations/1000000042/confirm")
        assert res.status_code == 200
        data = res.json()
        assert data["confirmed"] is True
        assert data["status"] == "CONFIRMED"


def test_confirm_reservation_endpoint_rejects_passenger():
    # Passengers must pay through the wallet; they cannot confirm their own hold.
    with patch.object(ReservationService, "confirm_reservation", return_value=True) as confirm:
        res = client.post("/api/v1/reservations/1000000042/confirm")
    assert res.status_code == 403
    assert res.json()["code"] == "PERMISSION_DENIED"
    confirm.assert_not_called()


def test_reservations_require_authentication():
    app.dependency_overrides.clear()
    res = client.get("/api/v1/reservations")
    assert res.status_code == 401
    assert res.json()["code"] == "AUTH_REQUIRED"
