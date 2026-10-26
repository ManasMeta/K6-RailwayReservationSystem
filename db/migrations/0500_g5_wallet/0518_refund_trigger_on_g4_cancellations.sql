-- Author: G5 database
-- Description: point the cancellation refund trigger at G4's real cancellations table.
--
-- 0514 assumed cancellations(pnr, fare_amount). G4 keys cancellations by reservation_id and
-- passenger_id and stores the fare on reservation_passengers. This redefines the trigger
-- function (0515 already attached it) and writes the amount actually credited back to
-- cancellations.refund_amount / cancellation_charge, so G4's API reports what the wallet got.
CREATE OR REPLACE FUNCTION fn_create_refund_on_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_pnr TEXT;
    v_departure TIMESTAMPTZ;
    v_fare NUMERIC(10,2);
    v_pay payments%ROWTYPE;
    v_hours NUMERIC;
    v_amount NUMERIC(10,2);
    v_already NUMERIC(10,2);
    v_txn BIGINT;
BEGIN
    SELECT r.pnr, r.departure_at INTO v_pnr, v_departure
      FROM reservations r WHERE r.reservation_id = NEW.reservation_id;

    SELECT rp.fare INTO v_fare
      FROM reservation_passengers rp WHERE rp.passenger_id = NEW.passenger_id;

    SELECT * INTO v_pay FROM payments WHERE pnr = v_pnr;
    IF NOT FOUND THEN
        RETURN NEW;  -- unpaid hold: nothing to refund
    END IF;

    PERFORM 1 FROM wallets WHERE wallet_id = v_pay.wallet_id FOR UPDATE;

    v_hours := EXTRACT(EPOCH FROM (v_departure - COALESCE(NEW.cancelled_at, now()))) / 3600;
    v_amount := refund_amount(v_fare, v_hours, COALESCE(NEW.full_refund, false));

    SELECT COALESCE(sum(amount), 0) INTO v_already
      FROM refunds WHERE pnr = v_pnr AND status = 'COMPLETED';
    v_amount := GREATEST(LEAST(v_amount, v_pay.amount - v_already), 0);

    UPDATE cancellations
       SET refund_amount = v_amount,
           cancellation_charge = GREATEST(COALESCE(v_fare, 0) - v_amount, 0)
     WHERE cancellation_id = NEW.cancellation_id;

    IF v_amount <= 0 THEN
        RETURN NEW;
    END IF;

    INSERT INTO ledger_txns
        (txn_type, reference_type, reference_id, status, description)
    VALUES
        ('REFUND', 'CANCELLATION', NEW.cancellation_id::TEXT, 'PENDING',
         'Refund for PNR ' || v_pnr)
    ON CONFLICT (txn_type, reference_type, reference_id) DO NOTHING
    RETURNING ledger_txn_id INTO v_txn;

    IF v_txn IS NULL THEN
        RETURN NEW;  -- this cancellation was already refunded
    END IF;

    INSERT INTO ledger_entries (ledger_txn_id, account_code, entry_side, amount)
    VALUES (v_txn, 'RAILWAY_CLEARING', 'DEBIT', v_amount),
           (v_txn, 'CUSTOMER_WALLET', 'CREDIT', v_amount);

    UPDATE wallets SET balance = balance + v_amount WHERE wallet_id = v_pay.wallet_id;
    UPDATE ledger_txns SET status = 'POSTED' WHERE ledger_txn_id = v_txn;

    INSERT INTO refunds (pnr, wallet_id, ledger_txn_id, amount, reason)
    VALUES (v_pnr, v_pay.wallet_id, v_txn, v_amount,
            'Cancellation #' || NEW.cancellation_id);

    RETURN NEW;
END;
$$;
