-- Author: G5 database
-- G4 owns cancellations and migrates after G5's numbering is reserved, so the
-- trigger is attached by a helper. This file attaches it when the table already
-- exists; otherwise run `SELECT attach_cancellation_refund_trigger();` once
-- G4's cancellations table is applied.
CREATE OR REPLACE FUNCTION attach_cancellation_refund_trigger()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    IF to_regclass('cancellations') IS NULL THEN
        RETURN false;
    END IF;
    DROP TRIGGER IF EXISTS trg_cancellation_refund ON cancellations;
    CREATE TRIGGER trg_cancellation_refund
    AFTER INSERT ON cancellations
    FOR EACH ROW
    EXECUTE FUNCTION fn_create_refund_on_cancellation();
    RETURN true;
END;
$$;

SELECT attach_cancellation_refund_trigger();
