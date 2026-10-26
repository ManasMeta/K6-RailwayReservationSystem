"""All SQL text for the operations module. Values always go in as named placeholders."""

RUN_COLUMNS = """
    r.run_id, t.train_no, t.name AS train_name, r.run_date,
    r.status, r.delay_minutes, r.chart_prepared
"""

LIST_RUNS = f"""
    SELECT {RUN_COLUMNS}
    FROM train_runs r
    JOIN trains t USING (train_id)
    WHERE (%(d)s::date IS NULL OR r.run_date = %(d)s)
    ORDER BY r.run_date, t.train_no, r.run_id
    LIMIT %(limit)s OFFSET %(offset)s
"""

GET_RUN = f"""
    SELECT {RUN_COLUMNS}
    FROM train_runs r
    JOIN trains t USING (train_id)
    WHERE r.run_id = %(run_id)s
"""

# FOR UPDATE locks the row so two staff members cannot change the same run at once.
LOCK_RUN = """
    SELECT run_id, train_id, run_date, status
    FROM train_runs
    WHERE run_id = %(run_id)s
    FOR UPDATE
"""

FIND_STATION = "SELECT station_id FROM stations WHERE station_code = upper(%(code)s)"

SET_DELAY = """
    UPDATE train_runs
    SET delay_minutes = %(delay)s, status = %(status)s
    WHERE run_id = %(run_id)s
"""

ADD_EVENT = """
    INSERT INTO run_events (run_id, event_type, station_id, delay_minutes, notes)
    VALUES (%(run_id)s, %(event_type)s, %(station_id)s, %(delay)s, %(notes)s)
"""

COUNT_LIVE_PASSENGERS = """
    SELECT count(*) AS n
    FROM reservation_passengers rp
    JOIN reservations r ON r.reservation_id = rp.reservation_id
    JOIN trains t ON t.train_no = r.train_no
    WHERE t.train_id = %(train_id)s AND r.run_date = %(run_date)s
      AND rp.current_status NOT IN ('CANCELLED', 'EXPIRED')
"""

# The database trigger on train_runs cancels every passenger and starts the refunds.
CANCEL_RUN = "UPDATE train_runs SET status = 'CANCELLED' WHERE run_id = %(run_id)s"

ADD_REASON_TO_CANCEL_EVENT = """
    UPDATE run_events
    SET notes = notes || ' Reason: ' || %(reason)s
    WHERE run_id = %(run_id)s AND event_type = 'CANCEL'
"""

# Refunds created in this transaction (created_at defaults to the transaction start time).
REFUNDS_JUST_MADE = """
    SELECT COALESCE(SUM(f.amount), 0) AS total
    FROM refunds f
    WHERE f.created_at >= now()
      AND f.pnr IN (SELECT r.pnr FROM reservations r JOIN trains t ON t.train_no = r.train_no
                    WHERE t.train_id = %(train_id)s AND r.run_date = %(run_date)s)
"""
