-- Author: G5 database
-- Refund for the fare of cancelled passengers, by hours before departure.
-- p_full = true (train cancelled by the railway) refunds everything.
CREATE OR REPLACE FUNCTION refund_amount(
    p_fare NUMERIC,
    p_hours_before NUMERIC,
    p_full BOOLEAN DEFAULT false
)
RETURNS NUMERIC(10,2)
LANGUAGE sql
STABLE
AS $$
    SELECT CASE
        WHEN p_fare IS NULL OR p_fare <= 0 THEN 0.00
        WHEN p_full THEN round(p_fare, 2)
        ELSE COALESCE((
            SELECT round(p_fare * r.refund_percent / 100, 2)
            FROM refund_rules r
            WHERE r.min_hours_before <= GREATEST(COALESCE(p_hours_before, 0), 0)
            ORDER BY r.min_hours_before DESC
            LIMIT 1
        ), 0.00)
    END::NUMERIC(10,2);
$$;
