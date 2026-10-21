-- Rerunning the import with unchanged data must not change any row counts.
-- Run after load_sample.py: this file stages the same rows again from SQL.
BEGIN;
CREATE TEMP TABLE _before AS
SELECT (SELECT count(*) FROM stations) AS stations,
       (SELECT count(*) FROM trains) AS trains,
       (SELECT count(*) FROM train_stops) AS stops,
       (SELECT count(*) FROM train_running_days) AS days;

INSERT INTO staging_train_stops (train_no, train_name, seq, station_code, station_name,
                                 arrival, departure, distance)
VALUES ('''12420''', 'LUCKNOW MAIL ', '1', 'CNB ', 'KANPUR CENTRAL ', '00:00:00', '05:30:00', '0'),
       ('''12420''', 'LUCKNOW MAIL ', '2', 'LKO ', 'LUCKNOW NR ', '07:00:00', '00:00:00', '74');
SELECT import_train_details();

DO $$
BEGIN
    IF (SELECT count(*) FROM stations) <> (SELECT stations FROM _before)
       OR (SELECT count(*) FROM trains) <> (SELECT trains FROM _before)
       OR (SELECT count(*) FROM train_stops) <> (SELECT stops FROM _before)
       OR (SELECT count(*) FROM train_running_days) <> (SELECT days FROM _before) THEN
        RAISE EXCEPTION 'import rerun changed row counts';
    END IF;
END $$;
ROLLBACK;
