-- TEST DATA ONLY - do not load in production.
-- Author: G6-DB (G6 Member 3)
-- Creates: 1 test user, 2 runs for tomorrow, a few coaches and berths,
--          1 confirmed reservation (PNR 1000000000), a few RAC and WL passengers.
-- NOTE: column names of users / coaches / berths / reservations / reservation_passengers
--       are taken from the ER diagram description; check them against g6_contract_stubs.sql.
DO $$
DECLARE
    v_user   BIGINT;
    v_train1 BIGINT;
    v_train2 BIGINT;
    v_from   BIGINT;
    v_to     BIGINT;
    v_date   DATE := CURRENT_DATE + 1;
BEGIN
    -- 1 test user
    INSERT INTO users (email) VALUES ('g6.test@example.com') ON CONFLICT DO NOTHING;
    SELECT user_id INTO v_user FROM users WHERE email = 'g6.test@example.com';

    -- two trains' runs for tomorrow
    SELECT train_id INTO v_train1 FROM trains ORDER BY train_id LIMIT 1;
    SELECT train_id INTO v_train2 FROM trains ORDER BY train_id OFFSET 1 LIMIT 1;
    INSERT INTO train_runs (train_id, run_date)
    VALUES (v_train1, v_date), (v_train2, v_date)
    ON CONFLICT (train_id, run_date) DO NOTHING;

    -- a few coaches and berths on train 1
    INSERT INTO coaches (train_id, coach_code, class_code, total_berths)
    SELECT v_train1, c, 'SL', 8 FROM (VALUES ('S1'), ('S2')) AS x(c)
    WHERE NOT EXISTS (SELECT 1 FROM coaches WHERE train_id = v_train1 AND coach_code = x.c);

    INSERT INTO berths (coach_id, berth_number, berth_type)
    SELECT co.coach_id, n, (ARRAY['LB','MB','UB','LB','MB','UB','SL','SU'])[n]
    FROM coaches co, generate_series(1, 8) AS n
    WHERE co.train_id = v_train1
      AND NOT EXISTS (SELECT 1 FROM berths b WHERE b.coach_id = co.coach_id AND b.berth_number = n);

    -- from / to = first and last stop of train 1
    SELECT station_id INTO v_from FROM train_stops WHERE train_id = v_train1 ORDER BY seq ASC  LIMIT 1;
    SELECT station_id INTO v_to   FROM train_stops WHERE train_id = v_train1 ORDER BY seq DESC LIMIT 1;

    -- one confirmed reservation + passengers (1 CNF, 2 RAC, 2 WL)
    INSERT INTO reservations (pnr, user_id, train_id, from_station_id, to_station_id,
                              run_date, class_code, quota_code, status, total_fare, departure_at)
    VALUES ('1000000000', v_user, v_train1, v_from, v_to, v_date, 'SL', 'GN', 'PENDING_PAYMENT', 650.00,
            (v_date + TIME '06:00') AT TIME ZONE 'Asia/Kolkata')
    ON CONFLICT (pnr) DO NOTHING;

    INSERT INTO reservation_passengers (pnr, full_name, age, gender, current_status, coach_id, berth_id, berth_no, rac_number, wl_number, fare)
    SELECT p.pnr, p.name, 30, 'F', p.status,
           (SELECT coach_id FROM coaches WHERE train_id = v_train1 AND coach_code = p.coach_code),
           (SELECT b.berth_id FROM berths b JOIN coaches co ON co.coach_id = b.coach_id
             WHERE co.train_id = v_train1 AND co.coach_code = p.coach_code AND b.berth_number = p.berth_no),
           p.berth_no, p.rac_number, p.wl_number, 130.00
    FROM (VALUES
        ('1000000000', 'Asha Sharma',  'CNF', 'S1', 1, 'LB', NULL::int, NULL::int),
        ('1000000000', 'Ravi Kumar',   'RAC', 'S1', 7, 'SL', 1,         NULL),
        ('1000000000', 'Meera Nair',   'RAC', 'S1', 7, 'SL', 2,         NULL),
        ('1000000000', 'Imran Shaikh', 'WL',  NULL, NULL, NULL, NULL,    1),
        ('1000000000', 'Priya Joshi',  'WL',  NULL, NULL, NULL, NULL,    2)
    ) AS p(pnr, name, status, coach_code, berth_no, berth_type, rac_number, wl_number)
    WHERE NOT EXISTS (SELECT 1 FROM reservation_passengers WHERE pnr = '1000000000');
    -- pay for the booking through G5 so the run-cancel trigger has a real payment to refund
    INSERT INTO wallets (user_id) VALUES (v_user) ON CONFLICT DO NOTHING;
    UPDATE wallets SET balance = 1000 WHERE user_id = v_user AND balance < 1000;
    PERFORM pay_reservation(v_user, '1000000000');
END $$;
