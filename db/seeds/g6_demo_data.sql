-- G6 TEST DATA. Fake rows so delays, cancellations, charts and analytics have something to show.
--
-- Load order on a fresh database:
--   G2 migrations -> g6_contract_stubs.sql -> G5 migrations -> G6 migrations (0600-0699)
--   -> python db/import/load_sample.py   (the sample timetable: 5 stations, 6 trains)
--   -> this file
-- Run it ONCE. A second run stops with an error instead of adding duplicates.
--
-- Everything is generated relative to CURRENT_DATE, so "5 days ago" is always 5 days ago.
-- It only uses trains 12301, 12302, 12420 and stations HWH, DDU, CNB, NDLS, LKO from G2's
-- sample CSV, so it stays valid once the real timetable is loaded.
--
-- Part 1 fills tables owned by other groups (users, coaches, berths, bookings). Once G1/G3/G4
-- have real versions with their own seeds, drop Part 1 and keep Part 2.
-- Part 2 fills G6's own tables: train_runs, run_events, charts, chart_entries.
-- Column names follow the ER diagram. Run statuses follow migration 0601 (SCHEDULED, DELAYED, CANCELLED,
-- DEPARTED); event types are DELAY and CANCEL.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE email = 'staff@yatrio.test') THEN
        RAISE EXCEPTION 'g6_seed.sql was already loaded on this database';
    END IF;
END $$;

-- =====================================================================
-- PART 1: stand-in data for other groups' tables
-- =====================================================================

INSERT INTO users (email, full_name) VALUES
    ('staff@yatrio.test', 'Station Staff'),
    ('alice@yatrio.test', 'Alice Sharma'),
    ('bob@yatrio.test',   'Bob Verma'),
    ('carol@yatrio.test', 'Carol Singh');

-- One 3A coach and one Sleeper coach on 12301 and 12302, one 3A coach on 12420. 8 berths each.
INSERT INTO coaches (train_id, coach_code, class_code, total_berths)
SELECT t.train_id, c.coach_code, c.class_code, 8
FROM (VALUES ('12301','B1','3A'), ('12301','S1','SL'),
             ('12302','B1','3A'), ('12302','S1','SL'),
             ('12420','B1','3A')) AS c(train_no, coach_code, class_code)
JOIN trains t ON t.train_no = c.train_no
ON CONFLICT (train_id, coach_code) DO NOTHING;

INSERT INTO berths (coach_id, berth_number, berth_type)
SELECT c.coach_id, n.i,
       (ARRAY['LB','MB','UB','LB','MB','UB','SL','SU'])[n.i]
FROM coaches c CROSS JOIN generate_series(1, 8) AS n(i)
ON CONFLICT (coach_id, berth_number) DO NOTHING;

-- Bookings: pnr, user, train, days from today, from, to, class, quota, passengers, fare each, status
CREATE TEMP TABLE seed_res (
    pnr VARCHAR(10), email TEXT, train_no TEXT, day_off INT, from_code TEXT, to_code TEXT,
    class_code TEXT, quota_code TEXT, n_pass INT, fare NUMERIC(10,2), status TEXT
) ON COMMIT DROP;
INSERT INTO seed_res VALUES
 ('9000000001','alice@yatrio.test','12301',-5,'HWH','NDLS','3A','GN',2,1800,'CONFIRMED'),
 ('9000000002','bob@yatrio.test',  '12301',-5,'HWH','CNB', 'SL','TQ',1, 600,'CONFIRMED'),
 ('9000000003','carol@yatrio.test','12301',-4,'DDU','NDLS','3A','GN',3,1200,'CONFIRMED'),
 ('9000000004','alice@yatrio.test','12301',-3,'HWH','NDLS','SL','GN',2, 900,'CONFIRMED'),
 ('9000000005','bob@yatrio.test',  '12301',-3,'HWH','NDLS','3A','LD',1,1800,'CONFIRMED'),
 ('9000000006','carol@yatrio.test','12302',-4,'NDLS','HWH','3A','GN',2,1800,'CONFIRMED'),
 ('9000000007','alice@yatrio.test','12302',-2,'NDLS','CNB','SL','GN',3, 500,'CONFIRMED'),
 ('9000000008','bob@yatrio.test',  '12302',-2,'CNB','HWH', '3A','SS',1,1100,'CONFIRMED'),
 ('9000000009','carol@yatrio.test','12420',-3,'CNB','LKO','3A','GN',2, 400,'CONFIRMED'),
 ('9000000010','alice@yatrio.test','12420',-1,'CNB','LKO','3A','TQ',1, 520,'CONFIRMED'),
 ('9000000011','bob@yatrio.test',  '12301',-1,'HWH','NDLS','3A','GN',2,1800,'CONFIRMED'),
 ('9000000012','carol@yatrio.test','12301',-1,'HWH','CNB', 'SL','GN',1, 600,'CANCELLED'),
 ('9000000013','alice@yatrio.test','12301', 0,'HWH','NDLS','3A','GN',3,1800,'CONFIRMED'),
 ('9000000014','bob@yatrio.test',  '12302', 1,'NDLS','HWH','3A','GN',2,1800,'CONFIRMED'),
 ('9000000015','carol@yatrio.test','12301', 1,'HWH','NDLS','SL','GN',2, 900,'CONFIRMED'),
 ('9000000016','alice@yatrio.test','12420', 0,'CNB','LKO','3A','GN',2, 400,'PENDING_PAYMENT'),
 ('9000000017','carol@yatrio.test','12301',-1,'HWH','NDLS','3A','GN',1,1800,'CONFIRMED');

INSERT INTO reservations
    (pnr, user_id, train_id, run_date, from_station_id, to_station_id,
     class_code, quota_code, total_fare, status, departure_at)
SELECT s.pnr, u.user_id, t.train_id, CURRENT_DATE + s.day_off, fs.station_id, ts.station_id,
       s.class_code, s.quota_code, s.n_pass * s.fare, s.status,
       ((CURRENT_DATE + s.day_off)
          + COALESCE(fst.departure, fst.arrival, TIME '06:00')
          + fst.day_offset * INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata'
FROM seed_res s
JOIN users u     ON u.email = s.email
JOIN trains t    ON t.train_no = s.train_no
JOIN stations fs ON fs.station_code = s.from_code
JOIN stations ts ON ts.station_code = s.to_code
JOIN train_stops fst ON fst.train_id = t.train_id AND fst.station_id = fs.station_id;

-- Passengers. Confirmed bookings -> CNF, except the last booking on 12301 yesterday, whose
-- passenger is waitlisted (WL). The pending-payment booking and the cancelled one are handled below.
INSERT INTO reservation_passengers (pnr, full_name, age, gender, current_status, fare)
SELECT s.pnr, 'Passenger ' || right(s.pnr, 2) || '-' || i,
       18 + (i * 13 + right(s.pnr, 2)::int * 3) % 50,
       CASE WHEN i % 2 = 1 THEN 'F' ELSE 'M' END,
       CASE WHEN s.status = 'CONFIRMED' AND s.pnr <> '9000000017' THEN 'CNF'
            WHEN s.pnr = '9000000017' THEN 'WL'
            WHEN s.status = 'CANCELLED' THEN 'CNF'
            ELSE 'WL' END,
       s.fare
FROM seed_res s CROSS JOIN LATERAL generate_series(1, s.n_pass) AS g(i);

-- Give every CNF passenger a berth of the right class, in order, per train and date.
WITH cnf AS (
    SELECT p.passenger_id, r.train_id, r.class_code,
           row_number() OVER (PARTITION BY r.train_id, r.run_date, r.class_code
                              ORDER BY p.passenger_id) AS rn
    FROM reservation_passengers p JOIN reservations r USING (pnr)
    WHERE p.current_status = 'CNF'
), bl AS (
    SELECT c.train_id, c.class_code, b.berth_id, b.coach_id, b.berth_number,
           row_number() OVER (PARTITION BY c.train_id, c.class_code
                              ORDER BY c.coach_code, b.berth_number) AS rn
    FROM coaches c JOIN berths b USING (coach_id)
)
UPDATE reservation_passengers p
   SET berth_id = bl.berth_id, coach_id = bl.coach_id, berth_no = bl.berth_number
  FROM cnf JOIN bl ON bl.train_id = cnf.train_id AND bl.class_code = cnf.class_code AND bl.rn = cnf.rn
 WHERE p.passenger_id = cnf.passenger_id;

-- Waitlist numbers
UPDATE reservation_passengers SET wl_number = 1 WHERE current_status = 'WL';

-- Occupy the berths for the stops each passenger travels.
INSERT INTO berth_allocations (berth_id, run_date, stops, passenger_id)
SELECT p.berth_id, r.run_date, int4range(fs.seq, ts.seq), p.passenger_id
FROM reservation_passengers p
JOIN reservations r ON r.pnr = p.pnr
JOIN train_stops fs ON fs.train_id = r.train_id AND fs.station_id = r.from_station_id
JOIN train_stops ts ON ts.train_id = r.train_id AND ts.station_id = r.to_station_id
WHERE p.berth_id IS NOT NULL AND p.current_status = 'CNF';

-- One cancelled booking: the passenger gave the berth up, no full refund.
DELETE FROM berth_allocations WHERE passenger_id IN
    (SELECT passenger_id FROM reservation_passengers WHERE pnr = '9000000012');
UPDATE reservation_passengers
   SET current_status = 'CANCELLED', berth_id = NULL, coach_id = NULL, berth_no = NULL
 WHERE pnr = '9000000012';
INSERT INTO cancellations (pnr, passenger_id, fare_amount, cancelled_at, full_refund, reason)
SELECT p.pnr, p.passenger_id, p.fare, r.departure_at - INTERVAL '30 hours', false, 'Change of plans'
FROM reservation_passengers p JOIN reservations r USING (pnr)
WHERE p.pnr = '9000000012';

-- =====================================================================
-- PART 2: G6's own tables
-- =====================================================================

-- Train runs. Past runs are DEPARTED with a chart; today's 12301 is DELAYED (running late) with no
-- chart yet (use it to test prepare_chart); tomorrow's runs are SCHEDULED (use 12302 to test
-- cancelling a whole run). One past run is CANCELLED by the railway with no bookings.
INSERT INTO train_runs (train_id, run_date, status, delay_minutes, chart_prepared)
SELECT t.train_id, CURRENT_DATE + v.day_off, v.status, v.delay, v.chart
FROM (VALUES
  ('12301',-5,'DEPARTED',  0,true), ('12301',-4,'DEPARTED', 25,true),
  ('12301',-3,'DEPARTED',  0,true), ('12301',-2,'DEPARTED', 90,true),
  ('12301',-1,'DEPARTED', 15,true), ('12301', 0,'DELAYED',   45,false),
  ('12301', 1,'SCHEDULED',  0,false),
  ('12302',-4,'DEPARTED', 10,true), ('12302',-3,'DEPARTED',  0,true),
  ('12302',-2,'DEPARTED',  0,true), ('12302',-1,'CANCELLED',  0,false),
  ('12302', 1,'SCHEDULED',  0,false),
  ('12420',-3,'DEPARTED',  5,true), ('12420',-1,'DEPARTED',  0,true),
  ('12420', 0,'SCHEDULED',  0,false)
) AS v(train_no, day_off, status, delay, chart)
JOIN trains t ON t.train_no = v.train_no
ON CONFLICT (train_id, run_date) DO NOTHING;

-- Events behind the delays and the cancellation.
INSERT INTO run_events (run_id, event_type, station_id, delay_minutes, notes, recorded_by, recorded_at)
SELECT r.run_id, e.event_type, s.station_id, e.delay, e.notes, u.user_id,
       (r.run_date + TIME '08:00') AT TIME ZONE 'Asia/Kolkata'
FROM (VALUES
  ('12301',-4,'DELAY',    'DDU', 25,'Signal failure'),
  ('12301',-2,'DELAY',    'DDU', 60,'Track maintenance ahead'),
  ('12301',-2,'DELAY',    'CNB', 90,'Waiting for a platform'),
  ('12301',-1,'DELAY',    'CNB', 15,'Late running of previous train'),
  ('12301', 0,'DELAY',    'DDU', 45,'Dense fog'),
  ('12302',-4,'DELAY',    'CNB', 10,'Crew change'),
  ('12302',-1,'CANCEL', NULL,NULL,'Track maintenance, run cancelled'),
  ('12420',-3,'DELAY',    'LKO',  5,'Late arrival at terminus')
) AS e(train_no, day_off, event_type, station_code, delay, notes)
JOIN trains t      ON t.train_no = e.train_no
JOIN train_runs r  ON r.train_id = t.train_id AND r.run_date = CURRENT_DATE + e.day_off
LEFT JOIN stations s ON s.station_code = e.station_code
CROSS JOIN (SELECT user_id FROM users WHERE email = 'staff@yatrio.test') u;

-- Charts for every run marked chart_prepared: vacant = total berths - confirmed passengers.
INSERT INTO charts (run_id, prepared_at, prepared_by, final_vacant_berths)
SELECT r.run_id,
       (r.run_date + TIME '02:00') AT TIME ZONE 'Asia/Kolkata',
       u.user_id,
       (SELECT COALESCE(SUM(c.total_berths), 0) FROM coaches c WHERE c.train_id = r.train_id)
       - (SELECT COUNT(*) FROM reservation_passengers p JOIN reservations rs USING (pnr)
           WHERE rs.train_id = r.train_id AND rs.run_date = r.run_date AND p.current_status = 'CNF')
FROM train_runs r
CROSS JOIN (SELECT user_id FROM users WHERE email = 'staff@yatrio.test') u
WHERE r.chart_prepared;

INSERT INTO chart_entries (chart_id, passenger_id, coach_code, berth_no, berth_type, quota_code)
SELECT ch.chart_id, p.passenger_id, c.coach_code, p.berth_no, b.berth_type, rs.quota_code
FROM charts ch
JOIN train_runs r  ON r.run_id = ch.run_id
JOIN reservations rs ON rs.train_id = r.train_id AND rs.run_date = r.run_date
JOIN reservation_passengers p ON p.pnr = rs.pnr AND p.current_status = 'CNF'
JOIN coaches c ON c.coach_id = p.coach_id
JOIN berths b  ON b.berth_id = p.berth_id;

COMMIT;
