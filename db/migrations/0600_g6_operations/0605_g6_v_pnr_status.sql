-- Author: G6-DB (G6 Member 3)
-- Description: v_pnr_status - six-table join so the PNR page needs one simple SELECT
-- Joins: reservations, reservation_passengers, trains, stations (x2: from/to), berths (LEFT), train_runs (LEFT)
CREATE OR REPLACE VIEW v_pnr_status AS
SELECT
    r.pnr,
    r.status                          AS reservation_status,
    t.train_no,
    t.name                            AS train_name,
    r.run_date,
    fs.station_code                   AS from_station_code,
    fs.name                           AS from_station_name,
    ts.station_code                   AS to_station_code,
    ts.name                           AS to_station_name,
    r.class_code,
    r.quota_code,
    rp.passenger_id,
    rp.passenger_name                 AS passenger_name,
    rp.current_status                 AS passenger_status,   -- CNF / RAC / WL / CANCELLED
    rp.coach_code,
    rp.berth_number                   AS berth_no,
    COALESCE(b.berth_type, rp.berth_type) AS berth_type,
    rp.rac_number,
    rp.wl_number,
    COALESCE(tr.status, 'SCHEDULED')  AS run_status,
    COALESCE(tr.delay_minutes, 0)     AS delay_minutes,
    COALESCE(tr.chart_prepared, false) AS chart_prepared
FROM reservations r
JOIN reservation_passengers rp ON rp.reservation_id = r.reservation_id
JOIN trains   t  ON t.train_no      = r.train_no
JOIN stations fs ON fs.station_code = r.from_station_code
JOIN stations ts ON ts.station_code = r.to_station_code
LEFT JOIN berths b ON b.berth_id = rp.berth_id
LEFT JOIN train_runs tr ON tr.train_id = t.train_id AND tr.run_date = r.run_date;  -- run row may not exist yet
