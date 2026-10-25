-- Author: G6-DB (G6 Member 3)
-- Description: v_pnr_status - eight-table join so the PNR page needs one simple SELECT
-- Joins: reservations, reservation_passengers, coaches (LEFT), berths (LEFT), trains, stations (x2: from/to), train_runs (LEFT)
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
    rp.full_name                      AS passenger_name,
    rp.current_status                 AS passenger_status,   -- CNF / RAC / WL / CANCELLED
    co.coach_code,
    rp.berth_no,
    b.berth_type,
    rp.rac_number,
    rp.wl_number,
    COALESCE(tr.status, 'SCHEDULED')  AS run_status,
    COALESCE(tr.delay_minutes, 0)     AS delay_minutes,
    COALESCE(tr.chart_prepared, false) AS chart_prepared
FROM reservations r
JOIN reservation_passengers rp ON rp.pnr = r.pnr
LEFT JOIN coaches co ON co.coach_id = rp.coach_id
LEFT JOIN berths  b  ON b.berth_id  = rp.berth_id
JOIN trains   t  ON t.train_id    = r.train_id
JOIN stations fs ON fs.station_id = r.from_station_id
JOIN stations ts ON ts.station_id = r.to_station_id
LEFT JOIN train_runs tr ON tr.train_id = r.train_id AND tr.run_date = r.run_date;  -- run row may not exist yet
