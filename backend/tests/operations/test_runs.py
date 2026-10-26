from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db_connection
from app.main import app


@pytest.fixture
def client():
    fake_conn = MagicMock()
    fake_conn.execute.return_value.fetchall.return_value = [
        {
            "run_id": 1,
            "train_no": "12301",
            "train_name": "Howrah Rajdhani",
            "run_date": date(2026, 10, 24),
            "status": "RUNNING",
            "delay_minutes": 45,
            "chart_prepared": False,
        }
    ]
    app.dependency_overrides[get_db_connection] = lambda: fake_conn
    with TestClient(app) as test_client:
        test_client.fake_conn = fake_conn
        yield test_client
    app.dependency_overrides.clear()


def test_list_runs_returns_rows(client):
    response = client.get("/api/v1/ops/runs")
    assert response.status_code == 200
    body = response.json()
    assert body[0]["train_no"] == "12301"
    assert body[0]["delay_minutes"] == 45


def test_list_runs_passes_the_date_filter_to_sql(client):
    client.get("/api/v1/ops/runs?run_date=2026-10-24")
    params = client.fake_conn.execute.call_args.args[1]
    assert params["d"] == date(2026, 10, 24)


def test_list_runs_defaults_to_the_first_page_of_50(client):
    client.get("/api/v1/ops/runs")
    params = client.fake_conn.execute.call_args.args[1]
    assert params == {"d": None, "limit": 50, "offset": 0}


def test_list_runs_second_page_skips_the_first_page(client):
    client.get("/api/v1/ops/runs?page=2&page_size=20")
    params = client.fake_conn.execute.call_args.args[1]
    assert params["limit"] == 20 and params["offset"] == 20


@pytest.mark.parametrize("query", ["page=0", "page_size=0", "page_size=101", "page=abc"])
def test_list_runs_rejects_bad_paging(client, query):
    assert client.get(f"/api/v1/ops/runs?{query}").status_code == 422


def test_list_runs_rejects_a_bad_date(client):
    assert client.get("/api/v1/ops/runs?run_date=not-a-date").status_code == 422
