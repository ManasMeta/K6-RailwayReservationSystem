"""Parameterised SQL for G3 inventory and fares."""

GET_CLASSES = """
SELECT class_code, name, base_multiplier, has_ac
FROM travel_classes
ORDER BY class_code;
"""

GET_QUOTAS = """
SELECT quota_code, name
FROM quotas
ORDER BY quota_code;
"""

RESOLVE_TRAIN_AND_STOPS = """
SELECT
    t.train_id,
    s_from.seq AS from_seq,
    s_to.seq AS to_seq
FROM trains t
JOIN stations st_from ON st_from.station_code = %(from_code)s
JOIN train_stops s_from ON s_from.train_id = t.train_id AND s_from.station_id = st_from.station_id
JOIN stations st_to ON st_to.station_code = %(to_code)s
JOIN train_stops s_to ON s_to.train_id = t.train_id AND s_to.station_id = st_to.station_id
WHERE t.train_no = %(train_no)s;
"""

# Coaches and berths are created the first time a train is looked at, so a full
# timetable import does not need inventory for all ~11k trains up front.
ENSURE_TRAIN_INVENTORY = """
SELECT generate_train_consist_coaches(t.train_id) AS coaches_created
FROM trains t
WHERE t.train_no = %(train_no)s
  AND NOT EXISTS (SELECT 1 FROM coaches c WHERE c.train_id = t.train_id);
"""

AVAILABILITY_GRID = """
SELECT
    travel_date,
    class_code,
    class_name,
    status,
    available_count,
    rac_count,
    wl_count,
    fare
FROM availability_grid(
    %(train_no)s,
    %(from_code)s,
    %(to_code)s,
    %(start_date)s,
    %(days)s,
    %(quota)s
);
"""

CALCULATE_FARE = """
SELECT
    distance_km,
    base,
    reservation_fee,
    superfast,
    tatkal,
    concession,
    gst,
    total
FROM calculate_fare(
    %(train_id)s,
    %(from_seq)s,
    %(to_seq)s,
    %(class_code)s,
    %(quota_code)s,
    %(concession_code)s
);
"""

GET_TRAIN_COACHES = """
SELECT coach_id, coach_code, class_code, total_berths
FROM coaches
WHERE train_id = %(train_id)s
ORDER BY coach_code;
"""

GET_COACH_BY_ID = """
SELECT coach_id, train_id, coach_code, class_code, total_berths
FROM coaches
WHERE coach_id = %(coach_id)s;
"""

GET_COACH_BERTHS_WITH_STATUS = """
SELECT
    b.berth_id,
    b.berth_number,
    b.berth_type,
    NOT EXISTS (
        SELECT 1
        FROM berth_allocations ba
        WHERE ba.berth_id = b.berth_id
          AND ba.run_date = %(run_date)s
          AND ba.stops && int4range(%(from_seq)s, %(to_seq)s, '[)')
    ) AS is_available
FROM berths b
WHERE b.coach_id = %(coach_id)s
ORDER BY b.berth_number;
"""
