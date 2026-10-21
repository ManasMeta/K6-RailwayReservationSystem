-- Author: G2 database (Shambhavi, Sanskar)
-- Moves staging_train_stops into stations, trains, train_stops and
-- train_running_days, then truncates staging. Reruns are safe: every INSERT
-- uses ON CONFLICT DO NOTHING. Returns the number of rows read from staging.
CREATE OR REPLACE FUNCTION import_train_details()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    staged INTEGER;
BEGIN
    SELECT count(*) INTO staged FROM staging_train_stops;

    DROP TABLE IF EXISTS _g2_clean;
    CREATE TEMP TABLE _g2_clean ON COMMIT DROP AS
    SELECT DISTINCT ON (train_no, seq)
           train_no, train_name, seq, station_code, station_name,
           arr, dep, distance_km
    FROM (
        SELECT upper(btrim(replace(s.train_no, '''', ''))) AS train_no,
               btrim(s.train_name) AS train_name,
               btrim(s.seq)::INTEGER AS seq,
               upper(btrim(s.station_code)) AS station_code,
               btrim(s.station_name) AS station_name,
               CASE WHEN btrim(s.arrival) ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
                    THEN btrim(s.arrival)::TIME END AS arr,
               CASE WHEN btrim(s.departure) ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
                    THEN btrim(s.departure)::TIME END AS dep,
               CASE WHEN btrim(s.distance) ~ '^[0-9]+(\.[0-9]+)?$'
                    THEN round(btrim(s.distance)::NUMERIC)::INTEGER
                    ELSE 0 END AS distance_km
        FROM staging_train_stops s
        WHERE btrim(s.seq) ~ '^[0-9]+$'
    ) c
    WHERE train_no ~ '^[0-9A-Z]+$' AND train_name <> ''
      AND station_code <> '' AND station_name <> '' AND seq >= 1
    ORDER BY train_no, seq;

    -- The CSV stores 00:00:00 for the origin arrival and the final departure.
    -- Treat them as "no event" so those stops keep one real time only.
    UPDATE _g2_clean c SET arr = NULL
    WHERE c.seq = (SELECT min(x.seq) FROM _g2_clean x WHERE x.train_no = c.train_no)
      AND c.arr = TIME '00:00' AND c.dep IS NOT NULL;
    UPDATE _g2_clean c SET dep = NULL
    WHERE c.seq = (SELECT max(x.seq) FROM _g2_clean x WHERE x.train_no = c.train_no)
      AND c.dep = TIME '00:00' AND c.arr IS NOT NULL;
    DELETE FROM _g2_clean WHERE arr IS NULL AND dep IS NULL;

    -- One row per station; the most common spelling of the name wins.
    INSERT INTO stations (station_code, name)
    SELECT DISTINCT ON (station_code) station_code, station_name
    FROM (
        SELECT station_code, station_name, count(*) AS n
        FROM _g2_clean
        GROUP BY station_code, station_name
    ) v
    ORDER BY station_code, n DESC, station_name
    ON CONFLICT (station_code) DO NOTHING;

    -- Source / destination come from the first and last stop of each train.
    INSERT INTO trains (train_no, name, source_station_id, destination_station_id)
    SELECT t.train_no, t.train_name, so.station_id, de.station_id
    FROM (
        SELECT DISTINCT ON (train_no) train_no, train_name,
               first_value(station_code) OVER w AS source_code,
               last_value(station_code) OVER w AS destination_code
        FROM _g2_clean
        WINDOW w AS (PARTITION BY train_no ORDER BY seq
                     ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)
        ORDER BY train_no, seq
    ) t
    JOIN stations so ON so.station_code = t.source_code
    JOIN stations de ON de.station_code = t.destination_code
    ON CONFLICT (train_no) DO NOTHING;

    -- Every train is assumed daily until staff edit train_running_days.
    INSERT INTO train_running_days (train_id, weekday)
    SELECT tr.train_id, d
    FROM trains tr
    CROSS JOIN generate_series(1, 7) AS d
    WHERE NOT EXISTS (
        SELECT 1 FROM train_running_days r WHERE r.train_id = tr.train_id
    )
    ON CONFLICT DO NOTHING;

    -- day_offset by window function. A new day starts when a stop's first
    -- event is earlier than the previous stop's departure; a halt that crosses
    -- midnight (dep < arr) is counted from the stop AFTER it.
    INSERT INTO train_stops
        (train_id, seq, station_id, arrival, departure, day_offset, distance_km)
    SELECT tr.train_id, w.seq, st.station_id, w.arr, w.dep,
           (w.cum_wraps - w.halt_wrap)::SMALLINT, w.distance_km
    FROM (
        SELECT f.*,
               SUM(f.arrive_wrap + f.halt_wrap) OVER (
                   PARTITION BY f.train_no ORDER BY f.seq
                   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
               ) AS cum_wraps
        FROM (
            SELECT c.*,
                   CASE WHEN COALESCE(c.arr, c.dep)
                             < LAG(COALESCE(c.dep, c.arr))
                                   OVER (PARTITION BY c.train_no ORDER BY c.seq)
                        THEN 1 ELSE 0 END AS arrive_wrap,
                   CASE WHEN c.arr IS NOT NULL AND c.dep IS NOT NULL AND c.dep < c.arr
                        THEN 1 ELSE 0 END AS halt_wrap
            FROM _g2_clean c
        ) f
    ) w
    JOIN trains tr ON tr.train_no = w.train_no
    JOIN stations st ON st.station_code = w.station_code
    ON CONFLICT (train_id, seq) DO NOTHING;

    TRUNCATE staging_train_stops;
    RETURN staged;
END;
$$;
