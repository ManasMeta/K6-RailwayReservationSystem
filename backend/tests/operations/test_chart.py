from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db_connection
from app.main import app
from app.modules.operations import chart_router
from app.modules.operations.errors import OperationsError

SUMMARY = {
    "run_id": 7, "chart_id": 3, "promoted": 2, "remaining_rac": 0,
    "remaining_wl": 1, "final_vacant_berths": 8, "already_prepared": False,
}
CHART = {
    "chart_id": 3, "run_id": 7, "prepared_at": "2026-10-25T10:00:00+00:00",
    "final_vacant_berths": 8,
    "entries": [{"passenger_id": 1, "pnr": "1000000000", "name": "Pavitra Sharma",
                 "status": "CNF", "coach_code": "B1", "berth_no": 4,
                 "berth_type": "LB", "quota_code": "GN"}],
}


@pytest.fixture
def client():
    app.dependency_overrides[get_db_connection] = lambda: MagicMock()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_prepare_chart_returns_summary(client, monkeypatch):
    monkeypatch.setattr(chart_router.chart_service, "prepare_chart", lambda conn, run_id, user_id=None: SUMMARY)
    response = client.post("/api/v1/ops/runs/7/chart")
    assert response.status_code == 200
    assert response.json()["promoted"] == 2
    assert response.json()["already_prepared"] is False


def test_prepare_chart_on_cancelled_run_is_409(client, monkeypatch):
    def fail(conn, run_id, user_id=None):
        raise OperationsError(409, "This run is already cancelled", "RUN_ALREADY_CANCELLED")

    monkeypatch.setattr(chart_router.chart_service, "prepare_chart", fail)
    response = client.post("/api/v1/ops/runs/7/chart")
    assert response.status_code == 409
    assert response.json()["code"] == "RUN_ALREADY_CANCELLED"


def test_get_chart_returns_entries(client, monkeypatch):
    monkeypatch.setattr(chart_router.chart_service, "get_chart", lambda conn, run_id: CHART)
    response = client.get("/api/v1/ops/runs/7/chart")
    assert response.status_code == 200
    assert response.json()["entries"][0]["coach_code"] == "B1"


def test_get_chart_before_it_is_prepared_is_404(client, monkeypatch):
    def fail(conn, run_id, user_id=None):
        raise OperationsError(404, "The chart is not prepared yet", "CHART_NOT_PREPARED")

    monkeypatch.setattr(chart_router.chart_service, "get_chart", fail)
    response = client.get("/api/v1/ops/runs/7/chart")
    assert response.status_code == 404
    assert response.json()["code"] == "CHART_NOT_PREPARED"
