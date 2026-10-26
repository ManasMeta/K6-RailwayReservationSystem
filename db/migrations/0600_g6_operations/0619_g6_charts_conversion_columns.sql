-- Author: G6-Backend (G6 Member 2)
-- Description: remember, per chart, how many passengers were waiting and how many got a berth.
--   Used by the admin report "WL to confirmed rate". Runs before 0620_g6_prepare_chart.sql.
ALTER TABLE charts ADD COLUMN IF NOT EXISTS waiting_before INT NOT NULL DEFAULT 0 CHECK (waiting_before >= 0);
ALTER TABLE charts ADD COLUMN IF NOT EXISTS promoted       INT NOT NULL DEFAULT 0 CHECK (promoted >= 0);
