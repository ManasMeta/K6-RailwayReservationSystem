"""SQL for the operations module (G6). Every function takes an open connection."""


def list_runs(conn, run_date=None):
    """Return train runs, optionally only those on one date."""
    return conn.execute(
        """
        SELECT r.run_id, t.train_no, t.name AS train_name, r.run_date,
               r.status, r.delay_minutes, r.chart_prepared
        FROM train_runs r
        JOIN trains t USING (train_id)
        WHERE (%(d)s::date IS NULL OR r.run_date = %(d)s)
        ORDER BY r.run_date, t.train_no
        """,
        {"d": run_date},
    ).fetchall()