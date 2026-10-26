-- Author: G6-Backend (G6 Member 2)
-- Description: mv_revenue - paid money per travel day and class, from ONE query using GROUPING SETS.
--   "paid" = a booking that is CONFIRMED / PARTIALLY_CANCELLED, or was cancelled after being paid.
--   refunded = completed refunds of that booking. net = gross - refunded.
--   grouping_level (from GROUPING(day, class_code)):
--     0 = one row per day AND class     1 = one row per day (all classes)
--     2 = one row per class (all days)  3 = the grand total
--   day_key / class_key are never NULL, only so a UNIQUE index can exist, and that index is what
--   allows REFRESH MATERIALIZED VIEW CONCURRENTLY (readers are not blocked while it refreshes).
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_revenue AS
WITH paid AS (
    SELECT r.run_date AS day,
           r.class_code,
           r.total_fare,
           COALESCE((SELECT SUM(f.amount) FROM refunds f
                      WHERE f.pnr = r.pnr AND f.status = 'COMPLETED'), 0) AS refunded
      FROM reservations r
     WHERE r.status IN ('CONFIRMED', 'PARTIALLY_CANCELLED')
        OR EXISTS (SELECT 1 FROM cancellations c WHERE c.reservation_id = r.reservation_id)
)
SELECT GROUPING(day, class_code)                       AS grouping_level,
       day,
       class_code,
       COALESCE(day, DATE '1900-01-01')                AS day_key,
       COALESCE(class_code, 'ALL')                     AS class_key,
       COUNT(*)::INT                                   AS bookings,
       SUM(total_fare)                                 AS gross,
       SUM(refunded)                                   AS refunded,
       SUM(total_fare) - SUM(refunded)                 AS net
  FROM paid
 GROUP BY GROUPING SETS ((day), (class_code), (day, class_code), ());

CREATE UNIQUE INDEX IF NOT EXISTS uq_mv_revenue ON mv_revenue (grouping_level, day_key, class_key);
