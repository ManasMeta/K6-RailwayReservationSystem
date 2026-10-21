from datetime import date, datetime, time
from unittest.mock import MagicMock

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.core.database import get_db_connection
from app.main import app

STATION = {"station_code": "HWH", "name": "HOWRAH JN"}


@pytest.fixture
def client():
    app.dependency_overrides.clear()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def use_connection(connection):
    app.dependency_overrides[get_db_connection] = lambda: connection


def results(*row_sets):
    """Connection whose successive execute().fetch*() calls return row_sets."""
    connection = MagicMock()
    cursors = []
    for rows in row_sets:
        cursor = MagicMock()
        cursor.fetchall.return_value = rows
        cursor.fetchone.return_value = rows[0] if rows else None
        cursors.append(cursor)
    connection.execute.side_effect = cursors
    return connection


def direct_row():
    return {
        "train_id": 1,
        "train_no": "12301",
        "train_name": "HOWRAH RAJDHANI",
        "run_date": date(2026, 11, 2),
        "from_seq": 1,
        "to_seq": 4,
        "depart_at": datetime(2026, 11, 2, 16, 55),
        "arrive_at": datetime(2026, 11, 3, 10, 5),
        "duration_minutes": 1030,
        "distance_km": 1447,
    }


def connecting_row():
    leg1 = {f"leg1_{k}": v for k, v in direct_row().items()}
    leg2 = {
        "leg2_train_id": 2,
        "leg2_train_no": "12420",
        "leg2_train_name": "LUCKNOW MAIL",
        "leg2_run_date": date(2026, 11, 3),
        "leg2_from_seq": 1,
        "leg2_to_seq": 2,
        "leg2_depart_at": datetime(2026, 11, 3, 5, 30),
        "leg2_arrive_at": datetime(2026, 11, 3, 7, 0),
        "leg2_distance_km": 74,
    }
    return {
        "rank": 1,
        "interchange_code": "CNB",
        "interchange_name": "KANPUR CENTRAL",
        "wait_minutes": 70,
        "total_minutes": 845,
        **leg1,
        **leg2,
    }


def test_stations_returns_page(client):
    use_connection(
        results([{"total": 1}], [{"station_code": "CNB", "name": "KANPUR CENTRAL"}])
    )

    response = client.get("/api/v1/stations", params={"q": "kanp", "page_size": 5})

    assert response.status_code == 200
    body = response.json()
    assert body["items"] == [{"station_code": "CNB", "name": "KANPUR CENTRAL"}]
    assert body["total"] == 1 and body["page"] == 1 and body["page_size"] == 5


def test_stations_escapes_like_wildcards(client):
    connection = results([{"total": 0}], [])
    use_connection(connection)

    client.get("/api/v1/stations", params={"q": "100%_x"})

    params = connection.execute.call_args_list[0].args[1]
    assert params["pattern"] == "%100\\%\\_x%"


@pytest.mark.parametrize("params", [{"page": 0}, {"page_size": 101}, {"q": "x" * 61}])
def test_stations_rejects_bad_paging(client, params):
    use_connection(MagicMock())
    assert client.get("/api/v1/stations", params=params).status_code == 422


def test_journeys_returns_direct_and_connecting(client):
    use_connection(
        results(
            [STATION],
            [{"station_code": "LKO", "name": "LUCKNOW NR"}],
            [direct_row()],
            [connecting_row()],
        )
    )

    response = client.get(
        "/api/v1/journeys", params={"from": "hwh", "to": "lko", "date": "2026-11-02"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["from_station"]["station_code"] == "HWH"
    assert body["direct"][0]["train_no"] == "12301"
    assert body["direct"][0]["depart_at"] == "2026-11-02T16:55:00"
    connection = body["connecting"][0]
    assert connection["interchange"]["station_code"] == "CNB"
    assert connection["wait_minutes"] == 70
    assert connection["leg1"]["to_code"] == "CNB"
    assert connection["leg2"]["from_code"] == "CNB"
    assert connection["leg2"]["to_code"] == "LKO"
    assert connection["leg2"]["duration_minutes"] == 90


def test_journeys_same_station_is_rejected(client):
    use_connection(MagicMock())

    response = client.get(
        "/api/v1/journeys", params={"from": "hwh", "to": "HWH", "date": "2026-11-02"}
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Origin and destination must be different stations",
        "code": "SAME_STATION",
    }


def test_journeys_unknown_station_is_404(client):
    use_connection(results([]))

    response = client.get(
        "/api/v1/journeys", params={"from": "ZZZ", "to": "HWH", "date": "2026-11-02"}
    )

    assert response.status_code == 404
    assert response.json()["code"] == "STATION_NOT_FOUND"


@pytest.mark.parametrize(
    "params",
    [
        {"to": "HWH", "date": "2026-11-02"},
        {"from": "HWH", "to": "NDLS", "date": "not-a-date"},
        {"from": "HW H;", "to": "NDLS", "date": "2026-11-02"},
    ],
)
def test_journeys_validate_input(client, params):
    use_connection(MagicMock())
    assert client.get("/api/v1/journeys", params=params).status_code == 422


def test_timetable_returns_stops(client):
    train = {
        "train_id": 1,
        "train_no": "12301",
        "name": "HOWRAH RAJDHANI",
        "source_code": "HWH",
        "source_name": "HOWRAH JN",
        "destination_code": "NDLS",
        "destination_name": "NEW DELHI",
    }
    stop = {
        "seq": 1,
        "station_code": "HWH",
        "station_name": "HOWRAH JN",
        "arrival": None,
        "departure": time(16, 55),
        "day_offset": 0,
        "distance_km": 0,
    }
    use_connection(results([train], [stop], [{"weekday": d} for d in range(1, 8)]))

    response = client.get("/api/v1/trains/12301/timetable")

    assert response.status_code == 200
    body = response.json()
    assert body["running_days"] == [1, 2, 3, 4, 5, 6, 7]
    assert body["source"]["station_code"] == "HWH"
    assert body["stops"][0]["departure"] == "16:55:00"
    assert body["stops"][0]["arrival"] is None


def test_timetable_unknown_train_is_404(client):
    use_connection(results([]))

    response = client.get("/api/v1/trains/99999/timetable")

    assert response.status_code == 404
    assert response.json()["code"] == "TRAIN_NOT_FOUND"


def test_database_error_returns_503_with_code(client):
    connection = MagicMock()
    connection.execute.side_effect = psycopg.OperationalError("down")
    use_connection(connection)

    response = client.get("/api/v1/stations")

    assert response.status_code == 503
    assert response.json()["code"] == "DB_UNAVAILABLE"
