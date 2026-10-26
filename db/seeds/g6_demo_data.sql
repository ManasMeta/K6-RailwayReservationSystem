-- LOCAL DEMO ONLY - never load this in production.
-- G6 demo data: bookings, runs, delays, charts, so delays, cancellations, charts and
-- the admin analytics have something to show.
--
-- Load order on a fresh database:
--   python db/migrate.py up
--   python db/import/load_sample.py          (sample timetable: 86 stations, 475 trains; this seed uses the 6 hand-written ones)
--   python db/import/generate_inventory.py   (coaches and berths)
--   psql -f db/seeds/g1_demo_users.sql       (demo accounts)
--   psql -f db/seeds/g6_demo_data.sql        (this file)
-- Run it ONCE; a second run stops instead of adding duplicates.
--
-- Everything is relative to CURRENT_DATE. It uses trains 12301, 12302 and 12420 and the
-- stations HWH, DDU, CNB, NDLS, LKO from the sample timetable. Bookings go through the real
-- book_tickets() and pay_reservation(), so berths, fares and the ledger are genuine.

BEGIN;
SET LOCAL app.skip_booking_window_check = 'true';   -- bookings on past dates

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM reservations WHERE pnr = '9000000001') THEN
        RAISE EXCEPTION 'g6_demo_data.sql was already loaded on this database';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'staff@yatrio.test') THEN
        RAISE EXCEPTION 'load db/seeds/g1_demo_users.sql first';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM coaches c JOIN trains t USING (train_id) WHERE t.train_no = '12301') THEN
        RAISE EXCEPTION 'run db/import/generate_inventory.py first';
    END IF;
END $$;

-- Wallet money for the demo passengers, through a balanced ledger transaction each.
DO $$
DECLARE
    v_user BIGINT; v_wallet BIGINT; v_topup BIGINT; v_txn BIGINT;
BEGIN
    FOR v_user IN SELECT user_id FROM users WHERE email::TEXT IN ('alice@yatrio.test', 'bob@yatrio.test', 'carol@yatrio.test') LOOP
        INSERT INTO wallets (user_id) VALUES (v_user) ON CONFLICT (user_id) DO NOTHING;
        SELECT wallet_id INTO v_wallet FROM wallets WHERE user_id = v_user;
        INSERT INTO topups (wallet_id, idempotency_key, amount, status)
        VALUES (v_wallet, 'demo-seed-' || v_user, 100000, 'PENDING') RETURNING topup_id INTO v_topup;
        INSERT INTO ledger_txns (txn_type, reference_type, reference_id, status, description)
        VALUES ('TOPUP', 'TOPUP', v_topup::TEXT, 'PENDING', 'Demo seed top-up') RETURNING ledger_txn_id INTO v_txn;
        INSERT INTO ledger_entries (ledger_txn_id, account_code, entry_side, amount)
        VALUES (v_txn, 'RAILWAY_CLEARING', 'DEBIT', 100000), (v_txn, 'CUSTOMER_WALLET', 'CREDIT', 100000);
        UPDATE wallets SET balance = balance + 100000 WHERE wallet_id = v_wallet;
        UPDATE ledger_txns SET status = 'POSTED' WHERE ledger_txn_id = v_txn;
        UPDATE topups SET ledger_txn_id = v_txn, status = 'COMPLETED' WHERE topup_id = v_topup;
    END LOOP;
END $$;

-- Bookings: pnr, user, train, days from today, from, to, class, quota, passengers, pay?
CREATE TEMP TABLE seed_res (
    pnr VARCHAR(10), email TEXT, train_no TEXT, day_off INT, from_code TEXT, to_code TEXT,
    class_code TEXT, quota_code TEXT, n_pass INT, pay BOOLEAN
) ON COMMIT DROP;
INSERT INTO seed_res VALUES
 ('9000000001','alice@yatrio.test','12301',-5,'HWH','NDLS','3A','GN',2,true),
 ('9000000002','bob@yatrio.test',  '12301',-5,'HWH','CNB', 'SL','TQ',1,true),
 ('9000000003','carol@yatrio.test','12301',-4,'DDU','NDLS','3A','GN',3,true),
 ('9000000004','alice@yatrio.test','12301',-3,'HWH','NDLS','SL','GN',2,true),
 ('9000000005','bob@yatrio.test',  '12301',-3,'HWH','NDLS','3A','LD',1,true),
 ('9000000006','carol@yatrio.test','12302',-4,'NDLS','HWH','3A','GN',2,true),
 ('9000000007','alice@yatrio.test','12302',-2,'NDLS','CNB','SL','GN',3,true),
 ('9000000008','bob@yatrio.test',  '12302',-2,'CNB','HWH', '3A','SS',1,true),
 ('9000000009','carol@yatrio.test','12420',-3,'CNB','LKO','3A','GN',2,true),
 ('9000000010','alice@yatrio.test','12420',-1,'CNB','LKO','3A','TQ',1,true),
 ('9000000011','bob@yatrio.test',  '12301',-1,'HWH','NDLS','3A','GN',2,true),
 ('9000000012','carol@yatrio.test','12301',-1,'HWH','CNB', 'SL','GN',1,true),
 ('9000000013','alice@yatrio.test','12301', 0,'HWH','NDLS','3A','GN',3,true),
 ('9000000014','bob@yatrio.test',  '12302', 1,'NDLS','HWH','3A','GN',2,true),
 ('9000000015','carol@yatrio.test','12301', 1,'HWH','NDLS','SL','GN',2,true),
 ('9000000016','alice@yatrio.test','12420', 0,'CNB','LKO','3A','GN',2,false);

DO $$
DECLARE
    s RECORD;
    v_user BIGINT; v_res BIGINT; v_from INT; v_to INT; v_train BIGINT; v_date DATE;
BEGIN
    FOR s IN SELECT * FROM seed_res ORDER BY pnr LOOP
        v_date := current_date + s.day_off;
        SELECT user_id INTO v_user FROM users WHERE email::TEXT = s.email;
        SELECT t.train_id INTO v_train FROM trains t WHERE t.train_no = s.train_no;
        SELECT ts.seq INTO v_from FROM train_stops ts JOIN stations st USING (station_id)
         WHERE ts.train_id = v_train AND st.station_code = s.from_code;
        SELECT ts.seq INTO v_to FROM train_stops ts JOIN stations st USING (station_id)
         WHERE ts.train_id = v_train AND st.station_code = s.to_code;

        INSERT INTO reservations (pnr, user_id, train_no, run_date, from_station_code, to_station_code,
                                  from_seq, to_seq, class_code, quota_code)
        VALUES (s.pnr, v_user, s.train_no, v_date, s.from_code, s.to_code, v_from, v_to, s.class_code, s.quota_code)
        RETURNING reservation_id INTO v_res;

        INSERT INTO reservation_passengers (reservation_id, passenger_name, age, gender, berth_preference)
        SELECT v_res, 'Passenger ' || right(s.pnr, 2) || '-' || i, 18 + (i * 13 + right(s.pnr, 2)::INT * 3) % 50,
               CASE WHEN i % 2 = 1 THEN 'Female' ELSE 'Male' END, (ARRAY['LB','MB','UB'])[1 + i % 3]
          FROM generate_series(1, s.n_pass) i;

        CALL book_tickets(v_res);
        IF s.pay THEN
            PERFORM pay_reservation(v_user, s.pnr);
        END IF;
    END LOOP;
END $$;

-- One booking is cancelled by the passenger, one passenger is left waitlisted.
SELECT cancel_passenger(rp.passenger_id, 'Change of plans')
  FROM reservation_passengers rp JOIN reservations r USING (reservation_id)
 WHERE r.pnr = '9000000012';

UPDATE reservation_passengers rp
   SET current_status = 'WL', booking_status = 'WL', wl_number = 1, berth_type = 'WL',
       coach_code = NULL, berth_number = NULL, berth_id = NULL
  FROM reservations r
 WHERE r.reservation_id = rp.reservation_id AND r.pnr = '9000000011' AND rp.passenger_id = (
       SELECT max(passenger_id) FROM reservation_passengers WHERE reservation_id = r.reservation_id);
DELETE FROM berth_allocations WHERE passenger_id IN (
    SELECT passenger_id FROM reservation_passengers rp JOIN reservations r USING (reservation_id)
     WHERE r.pnr = '9000000011' AND rp.current_status = 'WL');

-- Train runs. Past runs are DEPARTED with a chart; today's 12301 is DELAYED with no chart yet
-- (use it to try prepare_chart); tomorrow's runs are SCHEDULED (use 12302 to try cancelling a
-- whole run). One past run was CANCELLED by the railway with no bookings.
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
CROSS JOIN (SELECT user_id FROM users WHERE email::TEXT = 'staff@yatrio.test') u;

-- Charts for every run marked chart_prepared: vacant = total berths - confirmed passengers.
INSERT INTO charts (run_id, prepared_at, prepared_by, final_vacant_berths, waiting_before, promoted)
SELECT r.run_id,
       (r.run_date + TIME '02:00') AT TIME ZONE 'Asia/Kolkata',
       u.user_id,
       (SELECT COALESCE(SUM(c.total_berths), 0) FROM coaches c WHERE c.train_id = r.train_id)
       - (SELECT COUNT(*) FROM reservation_passengers p
            JOIN reservations rs ON rs.reservation_id = p.reservation_id
           WHERE rs.train_no = t.train_no AND rs.run_date = r.run_date AND p.current_status = 'CNF'),
       2 + (r.run_id % 3),
       (2 + (r.run_id % 3)) - (r.run_id % 2)
FROM train_runs r
JOIN trains t ON t.train_id = r.train_id
CROSS JOIN (SELECT user_id FROM users WHERE email::TEXT = 'staff@yatrio.test') u
WHERE r.chart_prepared;

INSERT INTO chart_entries (chart_id, passenger_id, coach_code, berth_no, berth_type, quota_code)
SELECT ch.chart_id, p.passenger_id, p.coach_code, p.berth_number, p.berth_type, rs.quota_code
FROM charts ch
JOIN train_runs r  ON r.run_id = ch.run_id
JOIN trains t      ON t.train_id = r.train_id
JOIN reservations rs ON rs.train_no = t.train_no AND rs.run_date = r.run_date
JOIN reservation_passengers p ON p.reservation_id = rs.reservation_id AND p.current_status = 'CNF'
ON CONFLICT DO NOTHING;

SELECT refresh_mv_occupancy();
SELECT refresh_mv_revenue();

COMMIT;
