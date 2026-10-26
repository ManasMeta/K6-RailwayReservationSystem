-- Author: G6-DB (G6 Member 3)
-- Description: when staff set a run to CANCELLED, cancel every live passenger with a full refund
-- cancel_passenger(passenger_id, reason, full_refund) -> G5's trigger on cancellations refunds the wallet.
CREATE OR REPLACE FUNCTION fn_cancel_run_reservations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    p        RECORD;
    v_count  INT := 0;
BEGIN
    FOR p IN
        SELECT rp.passenger_id
        FROM reservation_passengers rp
        JOIN reservations r ON r.reservation_id = rp.reservation_id
        JOIN trains t ON t.train_no = r.train_no
        WHERE t.train_id = NEW.train_id
          AND r.run_date = NEW.run_date
          AND rp.current_status NOT IN ('CANCELLED', 'EXPIRED')
          AND r.status IN ('CONFIRMED', 'PARTIALLY_CANCELLED', 'PENDING_PAYMENT')
        ORDER BY rp.passenger_id
    LOOP
        PERFORM cancel_passenger(p.passenger_id, 'Train cancelled by railway', true);
        v_count := v_count + 1;
    END LOOP;

    INSERT INTO run_events (run_id, event_type, notes)
    VALUES (NEW.run_id, 'CANCEL',
            format('Run cancelled; %s passenger(s) cancelled with full refund', v_count));

    RETURN NULL;   -- AFTER trigger: return value ignored
END;
$$;

DROP TRIGGER IF EXISTS trg_train_runs_cancel ON train_runs;
CREATE TRIGGER trg_train_runs_cancel
    AFTER UPDATE OF status ON train_runs
    FOR EACH ROW
    WHEN (NEW.status = 'CANCELLED' AND OLD.status IS DISTINCT FROM 'CANCELLED')  -- fires once only
    EXECUTE FUNCTION fn_cancel_run_reservations();
