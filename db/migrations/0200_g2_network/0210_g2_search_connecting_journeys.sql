-- Author: G2 database (Shambhavi, Sanskar)
-- One-change journeys A -> X -> B. Leg 1 and leg 2 meet at a common station X
-- on two different trains; leg 2 must leave between 30 minutes and 6 hours
-- after leg 1 arrives (so it may run on a later calendar day). Each
-- (train 1, train 2, interchange) keeps its earliest valid leg 2, and the
-- results are ranked by total time with ROW_NUMBER().
CREATE OR REPLACE FUNCTION search_connecting_journeys(
    p_from TEXT,
    p_to TEXT,
    p_date DATE,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    rank BIGINT,
    interchange_code TEXT,
    interchange_name TEXT,
    wait_minutes INTEGER,
    total_minutes INTEGER,
    leg1_train_id BIGINT,
    leg1_train_no TEXT,
    leg1_train_name TEXT,
    leg1_run_date DATE,
    leg1_from_seq INTEGER,
    leg1_to_seq INTEGER,
    leg1_depart_at TIMESTAMP,
    leg1_arrive_at TIMESTAMP,
    leg1_distance_km INTEGER,
    leg2_train_id BIGINT,
    leg2_train_no TEXT,
    leg2_train_name TEXT,
    leg2_run_date DATE,
    leg2_from_seq INTEGER,
    leg2_to_seq INTEGER,
    leg2_depart_at TIMESTAMP,
    leg2_arrive_at TIMESTAMP,
    leg2_distance_km INTEGER
)
LANGUAGE sql
STABLE
AS $$
    WITH leg1 AS (
        SELECT s1.train_id,
               s1.seq AS from_seq,
               s2.seq AS to_seq,
               s2.station_id AS x_id,
               p_date::TIMESTAMP + (s1.departure_minute % 1440) * INTERVAL '1 minute' AS depart_at,
               p_date::TIMESTAMP + (s1.departure_minute % 1440) * INTERVAL '1 minute'
                   + (s2.arrival_minute - s1.departure_minute) * INTERVAL '1 minute' AS arrive_at,
               p_date - (s1.departure_minute / 1440) AS run_date,
               s2.distance_km - s1.distance_km AS distance_km
        FROM stations a
        JOIN train_stops s1 ON s1.station_id = a.station_id
        JOIN train_stops s2 ON s2.train_id = s1.train_id AND s2.seq > s1.seq
        WHERE a.station_code = upper(btrim(p_from))
          AND upper(btrim(p_from)) <> upper(btrim(p_to))
          AND s2.station_id <> a.station_id
          AND s1.departure_minute IS NOT NULL
          AND s2.arrival_minute IS NOT NULL
          AND s2.arrival_minute >= s1.departure_minute
          AND EXISTS (
              SELECT 1 FROM train_running_days r
              WHERE r.train_id = s1.train_id
                AND r.weekday = EXTRACT(ISODOW FROM p_date - (s1.departure_minute / 1440))
          )
    ),
    leg2 AS (
        SELECT s3.train_id,
               s3.seq AS from_seq,
               s4.seq AS to_seq,
               s3.station_id AS x_id,
               s3.departure_minute AS dep_minute,
               s4.arrival_minute - s3.departure_minute AS duration_minutes,
               s4.distance_km - s3.distance_km AS distance_km
        FROM stations b
        JOIN train_stops s4 ON s4.station_id = b.station_id
        JOIN train_stops s3 ON s3.train_id = s4.train_id AND s3.seq < s4.seq
        WHERE b.station_code = upper(btrim(p_to))
          AND s3.station_id <> b.station_id
          AND s3.departure_minute IS NOT NULL
          AND s4.arrival_minute IS NOT NULL
          AND s4.arrival_minute >= s3.departure_minute
    ),
    candidates AS (
        SELECT l1.train_id AS t1, l1.from_seq AS f1, l1.to_seq AS e1,
               l1.x_id, l1.depart_at AS dep1, l1.arrive_at AS arr1,
               l1.run_date AS run1, l1.distance_km AS dist1,
               l2.train_id AS t2, l2.from_seq AS f2, l2.to_seq AS e2,
               l2.distance_km AS dist2,
               ((l1.arrive_at + INTERVAL '30 minutes')::DATE
                    - (l2.dep_minute / 1440) + g.n) AS run2,
               l2.dep_minute, l2.duration_minutes
        FROM leg1 l1
        JOIN leg2 l2 ON l2.x_id = l1.x_id AND l2.train_id <> l1.train_id
        CROSS JOIN LATERAL generate_series(
            0,
            (l1.arrive_at + INTERVAL '6 hours')::DATE
                - (l1.arrive_at + INTERVAL '30 minutes')::DATE
        ) AS g(n)
    ),
    timed AS (
        SELECT c.*,
               c.run2::TIMESTAMP + c.dep_minute * INTERVAL '1 minute' AS dep2
        FROM candidates c
    ),
    valid AS (
        SELECT t.*,
               ROW_NUMBER() OVER (
                   PARTITION BY t.t1, t.t2, t.x_id ORDER BY t.dep2
               ) AS pair_rank
        FROM timed t
        WHERE t.dep2 BETWEEN t.arr1 + INTERVAL '30 minutes'
                         AND t.arr1 + INTERVAL '6 hours'
          AND EXISTS (
              SELECT 1 FROM train_running_days r
              WHERE r.train_id = t.t2
                AND r.weekday = EXTRACT(ISODOW FROM t.run2)
          )
    ),
    ranked AS (
        SELECT v.*,
               EXTRACT(EPOCH FROM v.dep2 - v.arr1)::INTEGER / 60 AS wait_minutes,
               EXTRACT(EPOCH FROM v.dep2
                   + v.duration_minutes * INTERVAL '1 minute' - v.dep1)::INTEGER / 60
                   AS total_minutes
        FROM valid v
        WHERE v.pair_rank = 1
    ),
    ordered AS (
        SELECT r.*,
               ROW_NUMBER() OVER (
                   ORDER BY r.total_minutes, r.wait_minutes, r.dep1, r.t1, r.t2
               ) AS rn
        FROM ranked r
    )
    SELECT o.rn,
           x.station_code,
           x.name,
           o.wait_minutes,
           o.total_minutes,
           o.t1, tr1.train_no, tr1.name, o.run1, o.f1, o.e1,
           o.dep1, o.arr1, o.dist1,
           o.t2, tr2.train_no, tr2.name, o.run2, o.f2, o.e2,
           o.dep2,
           o.dep2 + o.duration_minutes * INTERVAL '1 minute',
           o.dist2
    FROM ordered o
    JOIN stations x ON x.station_id = o.x_id
    JOIN trains tr1 ON tr1.train_id = o.t1
    JOIN trains tr2 ON tr2.train_id = o.t2
    WHERE o.rn <= GREATEST(p_limit, 1)
    ORDER BY o.rn;
$$;
