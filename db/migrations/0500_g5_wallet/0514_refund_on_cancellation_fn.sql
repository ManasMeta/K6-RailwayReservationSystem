-- Author: G5 database
-- Trigger function for G4's cancellations table: refunds a paid reservation to
-- the wallet through a balanced ledger transaction. Nothing happens for an
-- unpaid hold. Refunds for one PNR never exceed what was paid, and the ledger
-- reference (REFUND, CANCELLATION, cancellation_id) makes it idempotent.
--
-- Contract assumed from G4 (confirm when G4 merges):
--   cancellations(cancellation_id, pnr TEXT, fare_amount NUMERIC(10,2),
--                 cancelled_at TIMESTAMPTZ, full_refund BOOLEAN)
--   reservations.departure_at TIMESTAMPTZ
-- full_refund is true when the railway cancels the run (G6), so G5 refunds 100%.
CREATE OR REPLACE FUNCTION fn_create_refund_on_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_pay payments%ROWTYPE;
    v_departure TIMESTAMPTZ;
    v_hours NUMERIC;
    v_amount NUMERIC(10,2);
    v_already NUMERIC(10,2);
    v_txn BIGINT;
BEGIN
    SELECT * INTO v_pay FROM payments WHERE pnr = NEW.pnr;
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    PERFORM 1 FROM wallets WHERE wallet_id = v_pay.wallet_id FOR UPDATE;

    SELECT r.departure_at INTO v_departure FROM reservations r WHERE r.pnr = NEW.pnr;
    v_hours := EXTRACT(EPOCH FROM (v_departure - COALESCE(NEW.cancelled_at, now()))) / 3600;
    v_amount := refund_amount(NEW.fare_amount, v_hours, COALESCE(NEW.full_refund, false));

    SELECT COALESCE(sum(amount), 0) INTO v_already
      FROM refunds WHERE pnr = NEW.pnr AND status = 'COMPLETED';
    v_amount := LEAST(v_amount, v_pay.amount - v_already);

    IF v_amount <= 0 THEN
        RETURN NEW;
    END IF;

    INSERT INTO ledger_txns
        (txn_type, reference_type, reference_id, status, description)
    VALUES
        ('REFUND', 'CANCELLATION', NEW.cancellation_id::TEXT, 'PENDING',
         'Refund for PNR ' || NEW.pnr)
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
    VALUES (NEW.pnr, v_pay.wallet_id, v_txn, v_amount,
            'Cancellation #' || NEW.cancellation_id);

    RETURN NEW;
END;
$$;
