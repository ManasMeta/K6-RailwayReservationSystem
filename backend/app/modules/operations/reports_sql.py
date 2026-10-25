"""SQL for the admin reports. Money comes from mv_revenue, occupancy from mv_occupancy."""

# grouping_level: 0 = day and class, 1 = day, 2 = class, 3 = grand total (see 0621_g6_mv_revenue.sql)
REVENUE = """
SELECT day, class_code, bookings, gross::float8 AS gross,
       refunded::float8 AS refunded, net::float8 AS net
FROM mv_revenue
WHERE grouping_level = %(level)s
  AND (%(date_from)s::date IS NULL OR day IS NULL OR day >= %(date_from)s::date)
  AND (%(date_to)s::date   IS NULL OR day IS NULL OR day <= %(date_to)s::date)
ORDER BY day NULLS LAST, class_code NULLS LAST
"""

OCCUPANCY_BY_CLASS = """
SELECT m.class_code,
       SUM(m.total_berths)::int  AS total_berths,
       SUM(m.booked_berths)::int AS booked_berths,
       ROUND(100.0 * SUM(m.booked_berths) / NULLIF(SUM(m.total_berths), 0), 2)::float8 AS occupancy_pct
FROM mv_occupancy m
JOIN train_runs tr ON tr.run_id = m.run_id
WHERE tr.status <> 'CANCELLED'
  AND (%(date_from)s::date IS NULL OR tr.run_date >= %(date_from)s::date)
  AND (%(date_to)s::date   IS NULL OR tr.run_date <= %(date_to)s::date)
GROUP BY m.class_code
ORDER BY m.class_code
"""

OCCUPANCY_BY_RUN = """
SELECT tr.run_id, t.train_no, t.name AS train_name, tr.run_date, m.class_code,
       m.total_berths, m.booked_berths, m.occupancy_pct::float8 AS occupancy_pct
FROM mv_occupancy m
JOIN train_runs tr ON tr.run_id = m.run_id
JOIN trains t ON t.train_id = tr.train_id
WHERE tr.status <> 'CANCELLED'
  AND (%(date_from)s::date IS NULL OR tr.run_date >= %(date_from)s::date)
  AND (%(date_to)s::date   IS NULL OR tr.run_date <= %(date_to)s::date)
ORDER BY tr.run_date, t.train_no, m.class_code
"""

WL_CONVERSION = """
SELECT COALESCE(SUM(c.waiting_before), 0)::int AS waiting,
       COALESCE(SUM(c.promoted), 0)::int       AS promoted
FROM charts c
JOIN train_runs tr ON tr.run_id = c.run_id
WHERE (%(date_from)s::date IS NULL OR tr.run_date >= %(date_from)s::date)
  AND (%(date_to)s::date   IS NULL OR tr.run_date <= %(date_to)s::date)
"""

# Each stretch between two neighbouring stops of a train, and how many passengers held a berth on it.
BUSIEST_SEGMENTS = """
SELECT t.train_no, t.name AS train_name,
       s1.station_code AS from_station_code, s1.name AS from_station_name,
       s2.station_code AS to_station_code,   s2.name AS to_station_name,
       COUNT(ba.allocation_id)::int AS passengers
FROM train_stops a
JOIN train_stops b  ON b.train_id = a.train_id AND b.seq = a.seq + 1
JOIN trains t       ON t.train_id = a.train_id
JOIN stations s1    ON s1.station_id = a.station_id
JOIN stations s2    ON s2.station_id = b.station_id
JOIN coaches co     ON co.train_id = a.train_id
JOIN berths bt      ON bt.coach_id = co.coach_id
JOIN berth_allocations ba ON ba.berth_id = bt.berth_id
                         AND ba.passenger_id IS NOT NULL
                         AND ba.stops && int4range(a.seq, b.seq, '[)')
WHERE (%(date_from)s::date IS NULL OR ba.run_date >= %(date_from)s::date)
  AND (%(date_to)s::date   IS NULL OR ba.run_date <= %(date_to)s::date)
GROUP BY t.train_no, t.name, a.seq, s1.station_code, s1.name, s2.station_code, s2.name
ORDER BY passengers DESC, t.train_no, a.seq
LIMIT %(limit)s
"""

REFRESH_OCCUPANCY = "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_occupancy"
REFRESH_REVENUE = "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue"
