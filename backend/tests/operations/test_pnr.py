from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db_connection
from app.main import app
from app.modules.operations import pnr_service


def _row(**over):
    row = {
        "pnr": "1000000000", "reservation_status": "CONFIRMED",
        "train_no": "11111", "train_name": "Test Express", "run_date": "2026-10-26",
        "from_station_code": "NDLS", "from_station_name": "New Delhi",
        "to_station_code": "HWH", "to_station_name": "Howrah",
        "class_code": "3A", "quota_code": "GN",
        "passenger_id": 1, "passenger_name": "Pavitra Sharma", "passenger_status": "CNF",
        "coach_code": "B1", "berth_no": 12, "berth_type": "LB",
        "rac_number": None, "wl_number": None,
        "run_status": "DELAYED", "delay_minutes": 30, "chart_prepared": False,
    }
    row.update(over)
    return row


def _conn(rows):
    conn = MagicMock()
    conn.execute.return_value.fetchall.return_value = rows
    return conn


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_mask_name_keeps_first_letter_of_each_word():
    assert pnr_service.mask_name("Pavitra Sharma") == "P****** S*****"
    assert pnr_service.mask_name("A") == "A"
    assert pnr_service.mask_name(None) == ""


def test_pnr_status_returns_masked_passengers(client):
    rows = [_row(), _row(passenger_id=2, passenger_name="Ravi Kumar",
                         passenger_status="WL", coach_code=None, berth_no=None,
                         berth_type=None, wl_number=3)]
    app.dependency_overrides[get_db_connection] = lambda: _conn(rows)
    response = client.get("/api/v1/pnr/1000000000")
    assert response.status_code == 200
    body = response.json()
    assert body["train_no"] == "11111"
    assert body["delay_minutes"] == 30
    assert [p["name"] for p in body["passengers"]] == ["P****** S*****", "R*** K****"]
    assert body["passengers"][1]["status"] == "WL"
    assert body["passengers"][1]["wl_number"] == 3
    assert "Pavitra" not in response.text


def test_unknown_pnr_is_404(client):
    app.dependency_overrides[get_db_connection] = lambda: _conn([])
    response = client.get("/api/v1/pnr/9999999999")
    assert response.status_code == 404
    assert response.json() == {"detail": "PNR not found", "code": "PNR_NOT_FOUND"}


@pytest.mark.parametrize("bad", ["123", "abcdefghij", "12345678901"])
def test_badly_formed_pnr_is_400(client, bad):
    app.dependency_overrides[get_db_connection] = lambda: _conn([])
    response = client.get(f"/api/v1/pnr/{bad}")
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_PNR"
