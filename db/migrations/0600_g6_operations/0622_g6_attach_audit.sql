-- Author: G6-DB (G6 Member 3)
-- Description: audit every change staff make to a train run (delays, cancellations, chart lock).
DROP TRIGGER IF EXISTS trg_train_runs_audit ON train_runs;
CREATE TRIGGER trg_train_runs_audit
    AFTER INSERT OR UPDATE OR DELETE ON train_runs
    FOR EACH ROW EXECUTE FUNCTION fn_audit('run_id');
