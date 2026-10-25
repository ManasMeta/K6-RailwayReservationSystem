from unittest.mock import MagicMock

from app.jobs import operations_jobs
from app.modules.operations.errors import OperationsError


def _conn(run_ids):
    conn = MagicMock()
    conn.execute.return_value.fetchall.return_value = [{"run_id": i} for i in run_ids]
    return conn


def test_prepares_every_due_run(monkeypatch):
    seen = []
    monkeypatch.setattr(operations_jobs.chart_service, "prepare_chart",
                        lambda conn, run_id: seen.append(run_id))
    result = operations_jobs.prepare_due_charts(_conn([3, 5, 8]))
    assert seen == [3, 5, 8]
    assert result == {"prepared": [3, 5, 8], "failed": {}}


def test_nothing_due_prepares_nothing(monkeypatch):
    monkeypatch.setattr(operations_jobs.chart_service, "prepare_chart",
                        lambda conn, run_id: (_ for _ in ()).throw(AssertionError("must not run")))
    assert operations_jobs.prepare_due_charts(_conn([])) == {"prepared": [], "failed": {}}


def test_one_failure_does_not_stop_the_others(monkeypatch):
    def fake(conn, run_id):
        if run_id == 5:
            raise OperationsError(409, "This run is already cancelled", "RUN_ALREADY_CANCELLED")
        if run_id == 8:
            raise RuntimeError("database hiccup")

    monkeypatch.setattr(operations_jobs.chart_service, "prepare_chart", fake)
    conn = _conn([3, 5, 8, 9])
    result = operations_jobs.prepare_due_charts(conn)
    assert result["prepared"] == [3, 9]
    assert result["failed"] == {5: "This run is already cancelled", 8: "database hiccup"}
    conn.rollback.assert_called()  # the unexpected error rolled back


def test_cutoff_hours_is_passed_to_the_query():
    conn = _conn([])
    operations_jobs.prepare_due_charts(conn, cutoff_hours=6)
    assert conn.execute.call_args[0][1] == {"cutoff_hours": 6}


def test_refresh_uses_the_report_service():
    conn = MagicMock()
    assert operations_jobs.refresh_report_views(conn) == {"refreshed": ["mv_occupancy", "mv_revenue"]}
