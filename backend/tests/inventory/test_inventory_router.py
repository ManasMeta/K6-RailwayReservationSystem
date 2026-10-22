from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db_connection
from app.main import app


@pytest.fixture
def client():
    app.dependency_overrides.clear()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def mock_connection_with_cursor(cursor_mock):
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cursor_mock
    return conn


def test_list_travel_classes(client):
    cursor = MagicMock()
    cursor.fetchall.return_value = [
        {"class_code": "SL", "name": "Sleeper", "base_multiplier": Decimal("1.00"), "has_ac": False},
        {"class_code": "3A", "name": "AC 3 Tier", "base_multiplier": Decimal("1.60"), "has_ac": True},
    ]
    conn = mock_connection_with_cursor(cursor)
    app.dependency_overrides[get_db_connection] = lambda: conn

    response = client.get("/api/v1/travel-classes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["class_code"] == "SL"
    assert data[1]["has_ac"] is True


def test_list_quotas(client):
    cursor = MagicMock()
    cursor.fetchall.return_value = [
        {"quota_code": "GN", "name": "General Quota"},
        {"quota_code": "TQ", "name": "Tatkal Quota"},
    ]
    conn = mock_connection_with_cursor(cursor)
    app.dependency_overrides[get_db_connection] = lambda: conn

    response = client.get("/api/v1/quotas")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["quota_code"] == "GN"


def test_availability_grid_success(client):
    cursor = MagicMock()
    cursor.fetchall.return_value = [
        {
            "travel_date": date(2026, 11, 2),
            "class_code": "3A",
            "class_name": "AC 3 Tier",
            "status": "AVAILABLE",
            "available_count": 42,
            "rac_count": 0,
            "wl_count": 0,
            "fare": Decimal("1296.75"),
        }
    ]
    conn = mock_connection_with_cursor(cursor)
    app.dependency_overrides[get_db_connection] = lambda: conn

    response = client.get("/api/v1/trains/12301/availability?from=HWH&to=CNB&date=2026-11-02")
    assert response.status_code == 200
    data = response.json()
    assert data["train_no"] == "12301"
    assert data["from_station"] == "HWH"
    assert data["items"][0]["status"] == "AVAILABLE"
    assert data["items"][0]["available_count"] == 42


def test_availability_same_station_error(client):
    conn = MagicMock()
    app.dependency_overrides[get_db_connection] = lambda: conn

    response = client.get("/api/v1/trains/12301/availability?from=HWH&to=HWH&date=2026-11-02")
    assert response.status_code == 400
    data = response.json()
    assert data["code"] == "SAME_STATION"


def test_calculate_fare_success(client):
    cursor = MagicMock()
    cursor.fetchone.side_effect = [
        {"train_id": 1, "from_seq": 1, "to_seq": 4},  # Route resolution
        {
            "distance_km": 1017,
            "base": Decimal("1150.00"),
            "reservation_fee": Decimal("40.00"),
            "superfast": Decimal("45.00"),
            "tatkal": Decimal("0.00"),
            "concession": Decimal("0.00"),
            "gst": Decimal("61.75"),
            "total": Decimal("1296.75"),
        },  # Fare calculation result
    ]
    conn = mock_connection_with_cursor(cursor)
    app.dependency_overrides[get_db_connection] = lambda: conn

    response = client.get("/api/v1/fare?train_no=12301&from=HWH&to=CNB&class_code=3A")
    assert response.status_code == 200
    data = response.json()
    assert data["distance_km"] == 1017
    assert float(data["total_fare"]) == 1296.75
    assert float(data["gst"]) == 61.75


def test_coach_layout_success(client):
    cursor = MagicMock()
    cursor.fetchone.return_value = {
        "coach_id": 10,
        "coach_code": "B1",
        "class_code": "3A",
        "total_berths": 64,
    }
    cursor.fetchall.return_value = [
        {"berth_id": 101, "berth_number": 1, "berth_type": "LB", "is_available": True},
        {"berth_id": 102, "berth_number": 2, "berth_type": "MB", "is_available": False},
    ]
    conn = mock_connection_with_cursor(cursor)
    app.dependency_overrides[get_db_connection] = lambda: conn

    response = client.get("/api/v1/coaches/10/layout?run_date=2026-11-02&from_seq=1&to_seq=4")
    assert response.status_code == 200
    data = response.json()
    assert data["coach_code"] == "B1"
    assert len(data["berths"]) == 2
    assert data["berths"][0]["is_available"] is True
    assert data["berths"][1]["is_available"] is False
