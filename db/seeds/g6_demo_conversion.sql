-- G6 DEMO DATA ONLY. The charts in g6_demo_data.sql were made before charts had the columns
-- waiting_before / promoted (migration 0619), so the "WL to confirmed rate" report shows 0 / 0.
-- This gives each old demo chart some plausible numbers. Safe to run more than once.
-- Real charts do not need it: prepare_chart() fills both columns itself.
UPDATE charts
   SET waiting_before = 2 + (run_id % 3),
       promoted       = (2 + (run_id % 3)) - (run_id % 2)
 WHERE waiting_before = 0 AND promoted = 0;
