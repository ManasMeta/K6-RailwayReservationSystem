from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db_connection
from app.main import app
from app.modules.operations import router as ops_router
from app.modules.operations.errors import OperationsError

RUN = {
    "run_id": 7,
    "train_no": "12301",
    "train_name": "Howrah Rajdhani",
    "run_date": "2026-10-26",
    "status": "DELAYED",
    "delay_minutes": 30,
    "chart_prepared": False,
}


@pytest.fixture
def client():
    app.dependency_overrides[get_db_connection] = lambda: MagicMock()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_add_delay_returns_the_updated_run(client, monkeypatch):
    seen = {}

    def fake(conn, run_id, delay_minutes, station_code, notes):
        seen.update(run_id=run_id, delay=delay_minutes, station=station_code, notes=notes)
        return RUN

    monkeypatch.setattr(ops_router.service, "add_delay", fake)
    response = client.post(
        "/api/v1/ops/runs/7/delay",
        json={"delay_minutes": 30, "station_code": "CNB", "notes": "fog"},
    )
    assert response.status_code == 200
    assert response.json()["delay_minutes"] == 30
    assert seen == {"run_id": 7, "delay": 30, "station": "CNB", "notes": "fog"}


def test_add_delay_rejects_a_negative_delay(client):
    response = client.post("/api/v1/ops/runs/7/delay", json={"delay_minutes": -5})
    assert response.status_code == 422


def test_unknown_run_gives_404_with_a_code(client, monkeypatch):
    def fake(conn, run_id):
        raise OperationsError(404, "Run not found", "RUN_NOT_FOUND")

    monkeypatch.setattr(ops_router.service, "get_run", fake)
    response = client.get("/api/v1/ops/runs/999")
    assert response.status_code == 404
    assert response.json() == {"detail": "Run not found", "code": "RUN_NOT_FOUND"}


def test_cancel_run_returns_counts_and_refund_total(client, monkeypatch):
    monkeypatch.setattr(
        ops_router.service,
        "cancel_run",
        lambda conn, run_id, reason: {
            "run_id": run_id,
            "status": "CANCELLED",
            "passengers_cancelled": 5,
            "total_refunded": 650.0,
        },
    )
    response = client.post("/api/v1/ops/runs/7/cancel", json={"reason": "Flood"})
    assert response.status_code == 200
    assert response.json() == {
        "run_id": 7,
        "status": "CANCELLED",
        "passengers_cancelled": 5,
        "total_refunded": 650.0,
    }


def test_cancelling_twice_gives_409(client, monkeypatch):
    def fake(conn, run_id, reason):
        raise OperationsError(409, "This run is already cancelled", "RUN_ALREADY_CANCELLED")

    monkeypatch.setattr(ops_router.service, "cancel_run", fake)
    response = client.post("/api/v1/ops/runs/7/cancel")
    assert response.status_code == 409
    assert response.json()["code"] == "RUN_ALREADY_CANCELLED"
