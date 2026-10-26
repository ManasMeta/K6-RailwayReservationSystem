-- G2 network assertions. Run after migrations and
-- `python db/import/load_sample.py` (uses db/seeds/g2_train_details_sample.csv):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/g2_network.sql
-- Everything runs in a transaction that is rolled back.
BEGIN;

-- 1. Import normalised the fixture: padding removed, one row per station.
DO $$
BEGIN
    IF (SELECT count(*) FROM stations) <> 86 THEN
        RAISE EXCEPTION 'expected 86 stations, got %', (SELECT count(*) FROM stations);
    END IF;
    IF (SELECT count(*) FROM trains) <> 475 THEN
        RAISE EXCEPTION 'expected 475 trains, got %', (SELECT count(*) FROM trains);
    END IF;
    IF EXISTS (SELECT 1 FROM stations WHERE name <> btrim(name) OR station_code <> btrim(station_code)) THEN
        RAISE EXCEPTION 'station values still carry padding';
    END IF;
    IF (SELECT name FROM stations WHERE station_code = 'CNB') <> 'KANPUR CENTRAL' THEN
        RAISE EXCEPTION 'CNB name not trimmed';
    END IF;
    IF EXISTS (SELECT 1 FROM trains WHERE train_no LIKE '%''%') THEN
        RAISE EXCEPTION 'train_no kept CSV quote characters';
    END IF;
    IF (SELECT count(*) FROM train_stops) <> 1898 THEN
        RAISE EXCEPTION 'malformed fixture row was not skipped, got % stops',
            (SELECT count(*) FROM train_stops);
    END IF;
    IF (SELECT count(*) FROM staging_train_stops) <> 0 THEN
        RAISE EXCEPTION 'staging was not truncated';
    END IF;
END $$;

-- 2. Origin arrival and final departure placeholders (00:00:00) become NULL.
DO $$
BEGIN
    IF (SELECT arrival FROM train_stops s JOIN trains t USING (train_id)
        WHERE t.train_no = '12301' AND s.seq = 1) IS NOT NULL THEN
        RAISE EXCEPTION 'origin arrival should be NULL';
    END IF;
    IF (SELECT departure FROM train_stops s JOIN trains t USING (train_id)
        WHERE t.train_no = '12301' AND s.seq = 4) IS NOT NULL THEN
        RAISE EXCEPTION 'final departure should be NULL';
    END IF;
END $$;

-- 3. day_offset and the generated minute columns, including a halt that
--    crosses midnight (22222 at CNB: arrives 23:50, leaves 00:10 next day).
DO $$
DECLARE
    r RECORD;
BEGIN
    SELECT s.day_offset, s.arrival_minute, s.departure_minute INTO r
    FROM train_stops s JOIN trains t USING (train_id)
    WHERE t.train_no = '12301' AND s.seq = 2;
    IF r.day_offset <> 1 OR r.arrival_minute <> 1460 OR r.departure_minute <> 1470 THEN
        RAISE EXCEPTION '12301 DDU wrong: %', r;
    END IF;

    SELECT s.day_offset, s.arrival_minute, s.departure_minute INTO r
    FROM train_stops s JOIN trains t USING (train_id)
    WHERE t.train_no = '22222' AND s.seq = 2;
    IF r.day_offset <> 0 OR r.arrival_minute <> 1430 OR r.departure_minute <> 1450 THEN
        RAISE EXCEPTION '22222 CNB halt wrong: %', r;
    END IF;

    SELECT s.day_offset INTO r
    FROM train_stops s JOIN trains t USING (train_id)
    WHERE t.train_no = '22222' AND s.seq = 3;
    IF r.day_offset <> 1 THEN
        RAISE EXCEPTION '22222 LKO should be on day 1, got %', r.day_offset;
    END IF;
END $$;

-- 4. Every imported train runs daily; trains get source/destination.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM trains t
        WHERE (SELECT count(*) FROM train_running_days r WHERE r.train_id = t.train_id) <> 7
    ) THEN
        RAISE EXCEPTION 'a train is not running daily';
    END IF;
    IF (SELECT s.station_code FROM trains t JOIN stations s ON s.station_id = t.destination_station_id
        WHERE t.train_no = '12301') <> 'NDLS' THEN
        RAISE EXCEPTION '12301 destination wrong';
    END IF;
END $$;

-- 5. Direct search: boarding date drives the origin run date.
DO $$
DECLARE
    r RECORD;
BEGIN
    SELECT * INTO r FROM search_direct_journeys('hwh', 'NDLS', DATE '2026-11-02')
    WHERE train_no = '12301';
    IF r.train_no <> '12301' OR r.duration_minutes <> 1030 OR r.distance_km <> 1447
       OR r.arrive_at <> TIMESTAMP '2026-11-03 10:05' THEN
        RAISE EXCEPTION 'direct HWH->NDLS wrong: %', r;
    END IF;

    -- 22222 leaves CNB at 00:10 on 3 Nov, so it started on 2 Nov.
    SELECT * INTO r FROM search_direct_journeys('CNB', 'LKO', DATE '2026-11-03')
    WHERE train_no = '22222';
    IF r.run_date <> DATE '2026-11-02' THEN
        RAISE EXCEPTION '22222 run_date wrong: %', r;
    END IF;

    -- Wrong direction and unknown station return nothing: the four fixture trains
    -- only run CNB -> LKO (the generated trains do run the other way).
    IF EXISTS (SELECT 1 FROM search_direct_journeys('LKO', 'CNB', DATE '2026-11-03')
               WHERE train_no IN ('12420', '12090', '11111', '22222')) THEN
        RAISE EXCEPTION 'reverse direction should have no trains';
    END IF;
    IF EXISTS (SELECT 1 FROM search_direct_journeys('ZZZ', 'CNB', DATE '2026-11-03')) THEN
        RAISE EXCEPTION 'unknown station should return nothing';
    END IF;
END $$;

-- 6. Staff removing a weekday hides the train on that run date only.
DO $$
BEGIN
    -- 2026-11-02 is a Monday (ISO 1).
    DELETE FROM train_running_days
    WHERE weekday = 1 AND train_id = (SELECT train_id FROM trains WHERE train_no = '12301');
    IF EXISTS (SELECT 1 FROM search_direct_journeys('HWH', 'NDLS', DATE '2026-11-02')
               WHERE train_no = '12301') THEN
        RAISE EXCEPTION '12301 should not run on Monday';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM search_direct_journeys('HWH', 'NDLS', DATE '2026-11-03')
                   WHERE train_no = '12301') THEN
        RAISE EXCEPTION '12301 should still run on Tuesday';
    END IF;
END $$;
ROLLBACK;

BEGIN;
-- 7. Connecting search: 30 minute minimum and 6 hour maximum wait.
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Only the fixture trains are counted: 12301 then one of the four CNB -> LKO trains.
    IF (SELECT count(*) FROM search_connecting_journeys('HWH', 'LKO', DATE '2026-11-02')
        WHERE leg1_train_no = '12301'
          AND leg2_train_no IN ('12420', '12090', '11111', '22222')) <> 1 THEN
        RAISE EXCEPTION 'expected exactly one HWH->LKO connection (20 min and 6h40 waits excluded)';
    END IF;
    SELECT * INTO r FROM search_connecting_journeys('HWH', 'LKO', DATE '2026-11-02')
    WHERE leg1_train_no = '12301' AND leg2_train_no IN ('12420', '12090', '11111', '22222');
    IF r.rank <> 1 OR r.interchange_code <> 'CNB' OR r.wait_minutes <> 70
       OR r.total_minutes <> 845 OR r.leg1_train_no <> '12301' OR r.leg2_train_no <> '12420'
       OR r.leg2_run_date <> DATE '2026-11-03' THEN
        RAISE EXCEPTION 'connection wrong: %', r;
    END IF;
    -- Same station on both ends has no journey.
    IF EXISTS (SELECT 1 FROM search_connecting_journeys('HWH', 'HWH', DATE '2026-11-02')) THEN
        RAISE EXCEPTION 'same-station connection should be empty';
    END IF;
END $$;

-- 8. Bad data is rejected by constraints.
DO $$
BEGIN
    BEGIN
        INSERT INTO stations (station_code, name) VALUES ('lower', 'X');
        RAISE EXCEPTION 'lower-case station code accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO train_running_days (train_id, weekday)
        VALUES ((SELECT train_id FROM trains LIMIT 1), 8);
        RAISE EXCEPTION 'weekday 8 accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO train_stops (train_id, seq, station_id)
        VALUES ((SELECT train_id FROM trains LIMIT 1), 99, (SELECT station_id FROM stations LIMIT 1));
        RAISE EXCEPTION 'stop without any time accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END $$;
ROLLBACK;
