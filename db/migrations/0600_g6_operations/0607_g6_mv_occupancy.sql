-- Author: G6-DB (G6 Member 3)
-- Description: mv_occupancy - berths total / booked / percent per run and class
-- DISTINCT is needed: a berth can have several segment allocations on the same date.
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_occupancy AS
SELECT
    tr.run_id,
    c.class_code,
    COUNT(DISTINCT b.berth_id)  AS total_berths,
    COUNT(DISTINCT ba.berth_id) AS booked_berths,
    ROUND(100.0 * COUNT(DISTINCT ba.berth_id) / NULLIF(COUNT(DISTINCT b.berth_id), 0), 2) AS occupancy_pct
FROM train_runs tr
JOIN coaches c ON c.train_id = tr.train_id
JOIN berths  b ON b.coach_id = c.coach_id
LEFT JOIN berth_allocations ba ON ba.berth_id = b.berth_id AND ba.run_date = tr.run_date
GROUP BY tr.run_id, c.class_code;

-- unique index lets us run REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_occupancy ON mv_occupancy (run_id, class_code);
