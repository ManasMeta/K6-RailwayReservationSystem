from datetime import date

from psycopg import Connection

from app.modules.network import sql
from app.modules.network.errors import NetworkError


def normalise_code(code: str) -> str:
    return code.strip().upper()


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def search_stations(connection: Connection, q: str, page: int, page_size: int) -> dict:
    q = q.strip()
    escaped = _escape_like(q)
    params = {
        "q": q,
        "pattern": f"%{escaped}%",
        "prefix": f"{escaped}%",
        "limit": page_size,
        "offset": (page - 1) * page_size,
    }
    total = connection.execute(sql.COUNT_STATIONS, params).fetchone()["total"]
    rows = connection.execute(sql.SEARCH_STATIONS, params).fetchall()
    return {"items": rows, "page": page, "page_size": page_size, "total": total}


def get_station(connection: Connection, code: str) -> dict:
    row = connection.execute(
        sql.STATION_BY_CODE, {"code": normalise_code(code)}
    ).fetchone()
    if row is None:
        raise NetworkError(404, f"Station {normalise_code(code)} was not found", "STATION_NOT_FOUND")
    return row


def _direct_leg(row: dict, from_code: str, to_code: str) -> dict:
    return {
        "train_no": row["train_no"],
        "train_name": row["train_name"],
        "run_date": row["run_date"],
        "from_code": from_code,
        "to_code": to_code,
        "from_seq": row["from_seq"],
        "to_seq": row["to_seq"],
        "depart_at": row["depart_at"],
        "arrive_at": row["arrive_at"],
        "duration_minutes": row["duration_minutes"],
        "distance_km": row["distance_km"],
    }


def _connecting(row: dict, from_code: str, to_code: str) -> dict:
    x_code = row["interchange_code"]
    leg1 = {k.removeprefix("leg1_"): v for k, v in row.items() if k.startswith("leg1_")}
    leg2 = {k.removeprefix("leg2_"): v for k, v in row.items() if k.startswith("leg2_")}
    for leg in (leg1, leg2):
        leg["duration_minutes"] = int(
            (leg["arrive_at"] - leg["depart_at"]).total_seconds() // 60
        )
    return {
        "rank": row["rank"],
        "interchange": {"station_code": x_code, "name": row["interchange_name"]},
        "wait_minutes": row["wait_minutes"],
        "total_minutes": row["total_minutes"],
        "leg1": _direct_leg(leg1, from_code, x_code),
        "leg2": _direct_leg(leg2, x_code, to_code),
    }


def search_journeys(
    connection: Connection, from_code: str, to_code: str, travel_date: date, limit: int
) -> dict:
    from_code, to_code = normalise_code(from_code), normalise_code(to_code)
    if from_code == to_code:
        raise NetworkError(
            400, "Origin and destination must be different stations", "SAME_STATION"
        )
    origin = get_station(connection, from_code)
    destination = get_station(connection, to_code)
    params = {"from_code": from_code, "to_code": to_code, "travel_date": travel_date}

    direct = connection.execute(sql.DIRECT_JOURNEYS, params).fetchall()
    connecting = connection.execute(
        sql.CONNECTING_JOURNEYS, {**params, "limit": limit}
    ).fetchall()
    return {
        "from_station": origin,
        "to_station": destination,
        "date": travel_date,
        "direct": [_direct_leg(r, from_code, to_code) for r in direct],
        "connecting": [_connecting(r, from_code, to_code) for r in connecting],
    }


def get_timetable(connection: Connection, train_no: str) -> dict:
    train_no = train_no.strip().upper()
    train = connection.execute(sql.TRAIN_BY_NUMBER, {"train_no": train_no}).fetchone()
    if train is None:
        raise NetworkError(404, f"Train {train_no} was not found", "TRAIN_NOT_FOUND")
    params = {"train_id": train["train_id"]}
    stops = connection.execute(sql.TRAIN_STOPS, params).fetchall()
    days = connection.execute(sql.TRAIN_RUNNING_DAYS, params).fetchall()

    def station(prefix: str):
        code = train[f"{prefix}_code"]
        return {"station_code": code, "name": train[f"{prefix}_name"]} if code else None

    return {
        "train_no": train["train_no"],
        "name": train["name"],
        "source": station("source"),
        "destination": station("destination"),
        "running_days": [d["weekday"] for d in days],
        "stops": stops,
    }
