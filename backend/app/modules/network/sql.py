"""Parameterised SQL for the G2 network module (psycopg named placeholders only)."""

STATION_BY_CODE = """
SELECT station_code, name FROM stations WHERE station_code = %(code)s
"""

SEARCH_STATIONS = """
SELECT station_code, name
FROM stations
WHERE %(q)s = '' OR name ILIKE %(pattern)s OR station_code ILIKE %(pattern)s
ORDER BY (station_code ILIKE %(q)s) DESC,
         (name ILIKE %(prefix)s) DESC,
         similarity(name, %(q)s) DESC,
         name
LIMIT %(limit)s OFFSET %(offset)s
"""

COUNT_STATIONS = """
SELECT count(*) AS total
FROM stations
WHERE %(q)s = '' OR name ILIKE %(pattern)s OR station_code ILIKE %(pattern)s
"""

DIRECT_JOURNEYS = """
SELECT * FROM search_direct_journeys(%(from_code)s, %(to_code)s, %(travel_date)s)
"""

CONNECTING_JOURNEYS = """
SELECT * FROM search_connecting_journeys(
    %(from_code)s, %(to_code)s, %(travel_date)s, %(limit)s
)
"""

TRAIN_BY_NUMBER = """
SELECT t.train_id, t.train_no, t.name,
       so.station_code AS source_code, so.name AS source_name,
       de.station_code AS destination_code, de.name AS destination_name
FROM trains t
LEFT JOIN stations so ON so.station_id = t.source_station_id
LEFT JOIN stations de ON de.station_id = t.destination_station_id
WHERE t.train_no = %(train_no)s
"""

TRAIN_STOPS = """
SELECT s.seq, st.station_code, st.name AS station_name,
       s.arrival, s.departure, s.day_offset, s.distance_km
FROM train_stops s
JOIN stations st ON st.station_id = s.station_id
WHERE s.train_id = %(train_id)s
ORDER BY s.seq
"""

TRAIN_RUNNING_DAYS = """
SELECT weekday FROM train_running_days WHERE train_id = %(train_id)s ORDER BY weekday
"""
