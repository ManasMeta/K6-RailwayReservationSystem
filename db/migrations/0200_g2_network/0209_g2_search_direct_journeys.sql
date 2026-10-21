-- Author: G2 database (Shambhavi, Sanskar)
-- Direct trains between two stations on a travel date (date of boarding).
-- The origin run date is travel date minus the days already elapsed when the
-- train leaves the boarding stop; the train must run on that weekday.
CREATE OR REPLACE FUNCTION search_direct_journeys(
    p_from TEXT,
    p_to TEXT,
    p_date DATE
)
RETURNS TABLE (
    train_id BIGINT,
    train_no TEXT,
    train_name TEXT,
    run_date DATE,
    from_seq INTEGER,
    to_seq INTEGER,
    depart_at TIMESTAMP,
    arrive_at TIMESTAMP,
    duration_minutes INTEGER,
    distance_km INTEGER
)
LANGUAGE sql
STABLE
AS $$
    SELECT t.train_id,
           t.train_no,
           t.name,
           p_date - (s1.departure_minute / 1440),
           s1.seq,
           s2.seq,
           p_date::TIMESTAMP + (s1.departure_minute % 1440) * INTERVAL '1 minute',
           p_date::TIMESTAMP + (s1.departure_minute % 1440) * INTERVAL '1 minute'
               + (s2.arrival_minute - s1.departure_minute) * INTERVAL '1 minute',
           s2.arrival_minute - s1.departure_minute,
           s2.distance_km - s1.distance_km
    FROM stations f
    JOIN train_stops s1 ON s1.station_id = f.station_id
    JOIN train_stops s2 ON s2.train_id = s1.train_id AND s2.seq > s1.seq
    JOIN stations d ON d.station_id = s2.station_id
    JOIN trains t ON t.train_id = s1.train_id
    WHERE f.station_code = upper(btrim(p_from))
      AND d.station_code = upper(btrim(p_to))
      AND f.station_id <> d.station_id
      AND s1.departure_minute IS NOT NULL
      AND s2.arrival_minute IS NOT NULL
      AND s2.arrival_minute >= s1.departure_minute
      AND EXISTS (
          SELECT 1
          FROM train_running_days r
          WHERE r.train_id = t.train_id
            AND r.weekday = EXTRACT(ISODOW FROM p_date - (s1.departure_minute / 1440))
      )
    ORDER BY 7, 9, 2;
$$;
