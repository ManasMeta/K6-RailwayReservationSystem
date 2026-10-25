"""Operations logic (G6). Every function takes an open connection and commits its own writes."""

from app.modules.operations import sql
from app.modules.operations.errors import OperationsError


def list_runs(conn, run_date=None, page=1, page_size=50):
    """Return one page of train runs (page 1 is the first), optionally only those on one date."""
    params = {"d": run_date, "limit": page_size, "offset": (page - 1) * page_size}
    return conn.execute(sql.LIST_RUNS, params).fetchall()


def get_run(conn, run_id):
    run = conn.execute(sql.GET_RUN, {"run_id": run_id}).fetchone()
    if run is None:
        raise OperationsError(404, "Run not found", "RUN_NOT_FOUND")
    return run


def _lock_active_run(conn, run_id):
    """Lock a run for changing. Refuses runs that are missing, cancelled or already departed."""
    run = conn.execute(sql.LOCK_RUN, {"run_id": run_id}).fetchone()
    if run is None:
        conn.rollback()
        raise OperationsError(404, "Run not found", "RUN_NOT_FOUND")
    if run["status"] == "CANCELLED":
        conn.rollback()
        raise OperationsError(409, "This run is already cancelled", "RUN_ALREADY_CANCELLED")
    if run["status"] == "DEPARTED":
        conn.rollback()
        raise OperationsError(409, "This run has already departed", "RUN_NOT_ACTIVE")
    return run


def add_delay(conn, run_id, delay_minutes, station_code=None, notes=None):
    """Set the total delay of a run, log it as an event, and return the updated run."""
    _lock_active_run(conn, run_id)

    station_id = None
    if station_code:
        station = conn.execute(sql.FIND_STATION, {"code": station_code}).fetchone()
        if station is None:
            conn.rollback()
            raise OperationsError(404, "Station not found", "STATION_NOT_FOUND")
        station_id = station["station_id"]

    status = "DELAYED" if delay_minutes > 0 else "SCHEDULED"
    try:
        conn.execute(sql.SET_DELAY, {"run_id": run_id, "delay": delay_minutes, "status": status})
        conn.execute(
            sql.ADD_EVENT,
            {"run_id": run_id, "event_type": "DELAY", "station_id": station_id,
             "delay": delay_minutes, "notes": notes},
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return get_run(conn, run_id)


def cancel_run(conn, run_id, reason=None):
    """Cancel a run. The database trigger cancels every passenger and starts the refunds."""
    run = _lock_active_run(conn, run_id)
    key = {"train_id": run["train_id"], "run_date": run["run_date"]}
    try:
        live = conn.execute(sql.COUNT_LIVE_PASSENGERS, key).fetchone()["n"]
        conn.execute(sql.CANCEL_RUN, {"run_id": run_id})
        if reason:
            conn.execute(sql.ADD_REASON_TO_CANCEL_EVENT, {"run_id": run_id, "reason": reason})
        refunded = conn.execute(sql.REFUNDS_JUST_MADE, key).fetchone()["total"]
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {
        "run_id": run_id,
        "status": "CANCELLED",
        "passengers_cancelled": live,
        "total_refunded": refunded,
    }
