-- Author: G5 database
-- Cancellation refund tiers, configurable without a code change. The rule with
-- the largest min_hours_before that is <= the hours left before departure applies.
CREATE TABLE refund_rules (
    min_hours_before NUMERIC(6,2) PRIMARY KEY CHECK (min_hours_before >= 0),
    refund_percent NUMERIC(5,2) NOT NULL CHECK (refund_percent BETWEEN 0 AND 100)
);

INSERT INTO refund_rules (min_hours_before, refund_percent) VALUES
    (48, 90.00),
    (12, 75.00),
    (4, 50.00),
    (0, 0.00)
ON CONFLICT (min_hours_before) DO NOTHING;
