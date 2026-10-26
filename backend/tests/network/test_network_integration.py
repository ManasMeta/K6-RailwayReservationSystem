"""Runs the network endpoints against a real PostgreSQL 16.

Needs migrations 0201-0210 applied and `python db/import/load_sample.py` run;
skipped when the database or the fixture data is not there.
"""
import os

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app


@pytest.fixture(scope="module")
def client():
    url = os.getenv("DATABASE_URL", get_settings().database_url)
    try:
        with psycopg.connect(url, connect_timeout=3) as connection:
            ready = connection.execute(
                "SELECT to_regclass('stations') IS NOT NULL AND EXISTS "
                "(SELECT 1 FROM stations WHERE station_code = 'HWH')"
            ).fetchone()[0]
    except psycopg.Error:
        ready = False
    if not ready:
        pytest.skip("G2 migrations and sample import are not present")
    app.dependency_overrides.clear()
    with TestClient(app) as test_client:
        yield test_client


def test_station_autocomplete_finds_by_name_fragment(client):
    body = client.get("/api/v1/stations", params={"q": "kanp"}).json()

    assert [s["station_code"] for s in body["items"]] == ["CNB"]


def test_station_exact_code_ranks_first(client):
    body = client.get("/api/v1/stations", params={"q": "lko"}).json()

    assert body["items"][0]["station_code"] == "LKO"


def test_direct_journey_across_midnight(client):
    body = client.get(
        "/api/v1/journeys", params={"from": "HWH", "to": "NDLS", "date": "2026-11-02"}
    ).json()

    assert [leg["train_no"] for leg in body["direct"]] == ["12301"]
    assert body["direct"][0]["arrive_at"] == "2026-11-03T10:05:00"


def test_connecting_journey_respects_wait_window(client):
    body = client.get(
        "/api/v1/journeys", params={"from": "HWH", "to": "LKO", "date": "2026-11-02"}
    ).json()

    assert body["direct"] == []
    # The generated timetable adds other connections; the fixture's 12301 + CNB trains
    # keep their meaning: only the 70 minute wait is inside the 30 min - 6 h window.
    fixture = [
        j for j in body["connecting"]
        if j["leg1"]["train_no"] == "12301"
        and j["leg2"]["train_no"] in {"12420", "12090", "11111", "22222"}
    ]
    assert len(fixture) == 1
    journey = fixture[0]
    assert journey["rank"] == 1
    assert journey["interchange"]["station_code"] == "CNB"
    assert journey["wait_minutes"] == 70
    assert journey["leg2"]["train_no"] == "12420"


def test_timetable_lists_stops_in_order(client):
    body = client.get("/api/v1/trains/22222/timetable").json()

    assert [s["station_code"] for s in body["stops"]] == ["NDLS", "CNB", "LKO"]
    assert [s["day_offset"] for s in body["stops"]] == [0, 0, 1]
    assert body["running_days"] == [1, 2, 3, 4, 5, 6, 7]
