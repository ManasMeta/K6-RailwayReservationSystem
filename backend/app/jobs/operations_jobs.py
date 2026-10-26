"""Scheduled jobs of G6 (operations). Plain functions, so cron, Task Scheduler or a test can call them.

  prepare_due_charts()  - prepares the chart of every run whose chart cut-off has passed
  refresh_report_views() - refreshes mv_occupancy and mv_revenue for the admin reports

Run them with:  python -m app.jobs.run_operations --help
"""

import logging

from app.core.database import system_connection
from app.modules.operations import chart_service, reports_service
from app.modules.operations.errors import OperationsError

log = logging.getLogger("jobs.operations")

# A chart is final CHART_CUTOFF_HOURS before the train really leaves (scheduled start + delay).
CHART_CUTOFF_HOURS = 4

# Runs that are still open, have no chart yet, and whose cut-off time has passed.
# The first stop's departure time is on train_stops (seq = 1); times are Indian Standard Time.
DUE_RUNS = """
    SELECT tr.run_id
    FROM train_runs tr
    JOIN train_stops ts ON ts.train_id = tr.train_id AND ts.seq = 1
    WHERE tr.status IN ('SCHEDULED', 'DELAYED')
      AND NOT tr.chart_prepared
      AND ts.departure IS NOT NULL
      AND (tr.run_date + ts.departure) AT TIME ZONE 'Asia/Kolkata'
          + make_interval(mins => tr.delay_minutes)
          - make_interval(hours => %(cutoff_hours)s)
          <= now()
    ORDER BY tr.run_date, ts.departure, tr.run_id
"""


def prepare_due_charts(conn, cutoff_hours=CHART_CUTOFF_HOURS):
    """Prepare every chart that is due. One failing run never stops the others.

    Returns {"prepared": [run ids], "failed": {run id: message}}.
    """
    run_ids = [r["run_id"] for r in conn.execute(DUE_RUNS, {"cutoff_hours": cutoff_hours}).fetchall()]
    conn.rollback()  # end the read-only transaction; prepare_chart starts its own
    result = {"prepared": [], "failed": {}}
    for run_id in run_ids:
        try:
            chart_service.prepare_chart(conn, run_id)
            result["prepared"].append(run_id)
            log.info("chart prepared for run %s", run_id)
        except OperationsError as exc:  # run was cancelled or departed meanwhile
            result["failed"][run_id] = exc.detail
            log.warning("run %s skipped: %s", run_id, exc.detail)
        except Exception as exc:  # unexpected: record it, keep going
            conn.rollback()
            result["failed"][run_id] = str(exc)
            log.exception("run %s failed", run_id)
    return result


def refresh_report_views(conn):
    """Refresh the report summaries (same code as POST /reports/refresh)."""
    result = reports_service.refresh_views(conn)
    log.info("refreshed %s", ", ".join(result["refreshed"]))
    return result


def run_once(cutoff_hours=CHART_CUTOFF_HOURS):
    """One pass of every job on a fresh connection: charts first, then the views."""
    with system_connection() as conn:
        charts = prepare_due_charts(conn, cutoff_hours)
        views = refresh_report_views(conn)
        return {"charts": charts, "views": views}
