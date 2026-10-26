"""Tests for the configurable booking window (/reservations/booking-rules)."""

from datetime import datetime, time
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.auth import UserPayload, get_current_user
from app.main import app
from app.modules.reservations.schemas import BookingRulesResponse
from app.modules.reservations.service import ReservationService

client = TestClient(app)

RULES = BookingRulesResponse(
    advance_days=60,
    tatkal_ac_opens_at=time(10, 0),
    tatkal_non_ac_opens_at=time(11, 0),
    updated_at=datetime(2026, 10, 26, 12, 0),
)


def _sign_in(role: str) -> None:
    app.dependency_overrides[get_current_user] = lambda: UserPayload(
        user_id=7, email=f"{role}@example.com", role=role
    )


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


def test_booking_rules_are_public():
    with patch.object(ReservationService, "get_booking_rules", return_value=RULES):
        response = client.get("/api/v1/reservations/booking-rules")

    assert response.status_code == 200
    body = response.json()
    assert body["advance_days"] == 60
    assert body["tatkal_ac_opens_at"] == "10:00:00"
    assert body["tatkal_non_ac_opens_at"] == "11:00:00"


def test_admin_can_change_booking_rules():
    _sign_in("admin")
    changed = RULES.model_copy(update={"tatkal_ac_opens_at": time(9, 30)})
    with patch.object(ReservationService, "update_booking_rules", return_value=changed) as update:
        response = client.put(
            "/api/v1/reservations/booking-rules", json={"tatkal_ac_opens_at": "09:30"}
        )

    assert response.status_code == 200
    assert response.json()["tatkal_ac_opens_at"] == "09:30:00"
    payload = update.call_args.args[0]
    assert payload.tatkal_ac_opens_at == time(9, 30)
    assert payload.advance_days is None  # left out, so it keeps its value


@pytest.mark.parametrize("role", ["passenger", "staff"])
def test_only_admins_change_booking_rules(role):
    _sign_in(role)
    with patch.object(ReservationService, "update_booking_rules") as update:
        response = client.put("/api/v1/reservations/booking-rules", json={"advance_days": 30})

    assert response.status_code == 403
    assert response.json()["code"] == "PERMISSION_DENIED"
    update.assert_not_called()


def test_booking_rules_reject_an_out_of_range_window():
    _sign_in("admin")
    response = client.put("/api/v1/reservations/booking-rules", json={"advance_days": 0})

    assert response.status_code == 422
