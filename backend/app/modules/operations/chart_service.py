"""Chart logic (G6). Staff prepare the final chart of a run, then read it."""

from app.modules.operations import chart_sql, service
from app.modules.operations.errors import OperationsError


def prepare_chart(conn, run_id, user_id=None):
    """Prepare the chart for a run (safe to call twice) and return a short summary."""
    service._lock_active_run(conn, run_id)  # 404 missing, 409 cancelled / departed
    try:
        summary = conn.execute(
            chart_sql.PREPARE_CHART, {"run_id": run_id, "user_id": user_id}
        ).fetchone()
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"run_id": run_id, **summary}


def get_chart(conn, run_id):
    """Return the prepared chart of a run with every passenger, or 404."""
    service.get_run(conn, run_id)  # 404 RUN_NOT_FOUND
    chart = conn.execute(chart_sql.GET_CHART, {"run_id": run_id}).fetchone()
    if chart is None:
        raise OperationsError(404, "The chart is not prepared yet", "CHART_NOT_PREPARED")
    entries = conn.execute(chart_sql.CHART_ENTRIES, {"chart_id": chart["chart_id"]}).fetchall()
    return {**chart, "entries": entries}
