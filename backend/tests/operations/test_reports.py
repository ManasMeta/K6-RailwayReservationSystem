from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db_connection
from app.main import app
from app.modules.operations import reports_service


def _conn(rows=None, one=None):
    conn = MagicMock()
    conn.execute.return_value.fetchall.return_value = rows or []
    conn.execute.return_value.fetchone.return_value = one
    return conn


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def use(conn):
    app.dependency_overrides[get_db_connection] = lambda: conn
    return conn


def test_revenue_by_day_asks_for_grouping_level_1(client):
    conn = use(_conn(rows=[{"day": date(2026, 10, 20), "class_code": None, "bookings": 2,
                            "gross": 4200.0, "refunded": 0.0, "net": 4200.0}]))
    response = client.get("/api/v1/reports/revenue?from=2026-10-20&to=2026-10-26")
    assert response.status_code == 200
    assert response.json()[0]["net"] == 4200.0
    params = conn.execute.call_args[0][1]
    assert params["level"] == 1 and params["date_from"] == date(2026, 10, 20)


@pytest.mark.parametrize("by,level", [("day_class", 0), ("day", 1), ("class", 2), ("total", 3)])
def test_revenue_levels(client, by, level):
    conn = use(_conn())
    assert client.get(f"/api/v1/reports/revenue?by={by}").status_code == 200
    assert conn.execute.call_args[0][1]["level"] == level


def test_revenue_rejects_unknown_grouping(client):
    use(_conn())
    assert client.get("/api/v1/reports/revenue?by=month").status_code == 422


def test_from_after_to_is_400(client):
    use(_conn())
    response = client.get("/api/v1/reports/revenue?from=2026-10-26&to=2026-10-20")
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_DATE_RANGE"


def test_occupancy_by_class(client):
    use(_conn(rows=[{"class_code": "3A", "total_berths": 24, "booked_berths": 12, "occupancy_pct": 50.0}]))
    response = client.get("/api/v1/reports/occupancy")
    assert response.status_code == 200
    assert response.json() == [{"class_code": "3A", "total_berths": 24,
                                "booked_berths": 12, "occupancy_pct": 50.0}]


def test_occupancy_by_run_uses_the_per_run_query(client):
    conn = use(_conn(rows=[{"run_id": 4, "train_no": "12301", "train_name": "Howrah Rajdhani",
                            "run_date": date(2026, 10, 26), "class_code": "SL",
                            "total_berths": 8, "booked_berths": 2, "occupancy_pct": 25.0}]))
    response = client.get("/api/v1/reports/occupancy?by=run")
    assert response.status_code == 200
    assert response.json()[0]["train_no"] == "12301"
    assert "mv_occupancy m" in conn.execute.call_args[0][0] and "train_no" in conn.execute.call_args[0][0]


def test_wl_conversion_rate(client):
    use(_conn(one={"waiting": 8, "promoted": 6}))
    assert client.get("/api/v1/reports/wl-conversion").json() == {
        "waiting": 8, "promoted": 6, "conversion_pct": 75.0}


def test_wl_conversion_with_nobody_waiting_has_no_rate(client):
    use(_conn(one={"waiting": 0, "promoted": 0}))
    assert client.get("/api/v1/reports/wl-conversion").json()["conversion_pct"] is None


def test_busiest_segments_passes_the_limit(client):
    conn = use(_conn(rows=[{"train_no": "12301", "train_name": "Howrah Rajdhani",
                            "from_station_code": "CNB", "from_station_name": "Kanpur",
                            "to_station_code": "LKO", "to_station_name": "Lucknow", "passengers": 9}]))
    response = client.get("/api/v1/reports/busiest-segments?limit=3")
    assert response.status_code == 200
    assert conn.execute.call_args[0][1]["limit"] == 3
    assert client.get("/api/v1/reports/busiest-segments?limit=0").status_code == 422


def test_refresh_runs_both_views_and_commits():
    conn = MagicMock()
    result = reports_service.refresh_views(conn)
    assert result == {"refreshed": ["mv_occupancy", "mv_revenue"]}
    assert conn.execute.call_count == 2
    conn.commit.assert_called_once()
