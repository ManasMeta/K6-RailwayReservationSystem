"""SQL statements for the Reservation Engine module.

All queries use parameterized %s placeholders for safe psycopg 3 execution.
"""

# Concurrency & Advisory Lock: keyed on train_no, run_date, and class_code
SQL_ACQUIRE_BOOKING_ADVISORY_LOCK = """
SELECT pg_advisory_xact_lock(hashtext(%s || ':' || %s || ':' || %s));
"""

SQL_GET_STATION_STOP_SEQS = """
SELECT
    (SELECT ts.seq FROM train_stops ts
       JOIN trains t ON t.train_id = ts.train_id
       JOIN stations s ON s.station_id = ts.station_id
      WHERE t.train_no = %s AND s.station_code = %s) AS from_seq,
    (SELECT ts.seq FROM train_stops ts
       JOIN trains t ON t.train_id = ts.train_id
       JOIN stations s ON s.station_id = ts.station_id
      WHERE t.train_no = %s AND s.station_code = %s) AS to_seq;
"""

SQL_INSERT_RESERVATION = """
INSERT INTO reservations (
    user_id,
    train_no,
    run_date,
    from_station_code,
    to_station_code,
    from_seq,
    to_seq,
    class_code,
    quota_code,
    status,
    total_fare,
    hold_expires_at
) VALUES (
    %s, %s, %s, %s, %s, %s, %s, %s, %s, 'PENDING_PAYMENT', 0.00, now() + INTERVAL '10 minutes'
)
RETURNING
    reservation_id,
    pnr,
    user_id,
    train_no,
    run_date,
    from_station_code,
    to_station_code,
    from_seq,
    to_seq,
    class_code,
    quota_code,
    status,
    total_fare,
    hold_expires_at,
    created_at,
    updated_at;
"""

SQL_INSERT_PASSENGER = """
INSERT INTO reservation_passengers (
    reservation_id,
    passenger_name,
    age,
    gender,
    berth_preference,
    senior_citizen,
    booking_status,
    current_status,
    fare
) VALUES (
    %s, %s, %s, %s, %s, %s, 'WL', 'WL', 0.00
)
RETURNING
    passenger_id,
    reservation_id,
    passenger_name,
    age,
    gender,
    berth_preference,
    senior_citizen,
    booking_status,
    current_status,
    coach_code,
    berth_number,
    berth_type,
    rac_number,
    wl_number,
    fare,
    created_at,
    updated_at;
"""

SQL_CALL_BOOK_TICKETS = """
CALL book_tickets(%s);
"""

SQL_GET_RESERVATION_BY_PNR = """
SELECT
    reservation_id,
    pnr,
    user_id,
    train_no,
    run_date,
    from_station_code,
    to_station_code,
    from_seq,
    to_seq,
    class_code,
    quota_code,
    status,
    total_fare,
    hold_expires_at,
    created_at,
    updated_at
FROM reservations
WHERE pnr = %s;
"""

SQL_GET_PASSENGERS_BY_RES_ID = """
SELECT
    passenger_id,
    reservation_id,
    passenger_name,
    age,
    gender,
    berth_preference,
    senior_citizen,
    booking_status,
    current_status,
    coach_code,
    berth_number,
    berth_type,
    rac_number,
    wl_number,
    fare,
    created_at,
    updated_at
FROM reservation_passengers
WHERE reservation_id = %s
ORDER BY passenger_id ASC;
"""

SQL_LIST_USER_RESERVATIONS = """
SELECT
    reservation_id,
    pnr,
    user_id,
    train_no,
    run_date,
    from_station_code,
    to_station_code,
    from_seq,
    to_seq,
    class_code,
    quota_code,
    status,
    total_fare,
    hold_expires_at,
    created_at,
    updated_at
FROM reservations
WHERE (%s::bigint IS NULL OR user_id = %s::bigint)
  AND (%s::text IS NULL OR status = %s::text)
ORDER BY created_at DESC
LIMIT %s OFFSET %s;
"""

SQL_COUNT_USER_RESERVATIONS = """
SELECT COUNT(*)
FROM reservations
WHERE (%s::bigint IS NULL OR user_id = %s::bigint)
  AND (%s::text IS NULL OR status = %s::text);
"""

SQL_CANCEL_PASSENGER = """
SELECT cancel_passenger(%s, %s) AS refund_amount;
"""

SQL_GET_LATEST_CANCELLATION = """
SELECT
    cancellation_id,
    reservation_id,
    passenger_id,
    refund_amount,
    cancellation_charge,
    cancelled_at,
    reason
FROM cancellations
WHERE passenger_id = %s
ORDER BY cancellation_id DESC
LIMIT 1;
"""

SQL_CONFIRM_RESERVATION = """
SELECT confirm_reservation(%s);
"""

SQL_RELEASE_EXPIRED_HOLDS = """
SELECT release_expired_holds() AS released_count;
"""
