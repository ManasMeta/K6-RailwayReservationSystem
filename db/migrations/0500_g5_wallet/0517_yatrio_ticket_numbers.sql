-- Author: G5 database
-- Replaces pay_reservation() from 0513 so new e-tickets use the Yatrio prefix:
-- ticket number YTR-<pnr> and QR payload YATRIO|PNR=...|TKT=...|AMT=...
-- Behaviour is otherwise unchanged (see 0513 for the contract, error codes and
-- the locking order). Tickets issued before this file keep their old numbers.
CREATE OR REPLACE FUNCTION pay_reservation(
    p_user_id BIGINT,
    p_pnr TEXT,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
    o_payment_id BIGINT,
    o_pnr TEXT,
    o_amount NUMERIC(10,2),
    o_balance NUMERIC(10,2),
    o_ticket_number TEXT,
    o_replayed BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_wallet wallets%ROWTYPE;
    v_res RECORD;
    v_pay payments%ROWTYPE;
    v_txn BIGINT;
    v_ticket TEXT;
BEGIN
    IF p_pnr IS NULL OR btrim(p_pnr) = '' THEN
        RAISE EXCEPTION 'PNR is required' USING ERRCODE = 'NR002';
    END IF;

    INSERT INTO wallets (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Serialises every payment by this user, so a retried request waits here
    -- and then sees the first one's payment row instead of charging again.
    SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;

    SELECT r.user_id, r.total_fare, r.status
      INTO v_res
      FROM reservations r
     WHERE r.pnr = p_pnr
       FOR UPDATE;

    IF NOT FOUND OR v_res.user_id IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'Reservation % was not found', p_pnr USING ERRCODE = 'NR002';
    END IF;

    SELECT * INTO v_pay FROM payments WHERE payments.pnr = p_pnr;
    IF FOUND THEN
        SELECT t.ticket_number INTO v_ticket FROM e_tickets t WHERE t.pnr = p_pnr;
        RETURN QUERY SELECT v_pay.payment_id, p_pnr, v_pay.amount,
                            v_wallet.balance, v_ticket, true;
        RETURN;
    END IF;

    IF v_res.status <> 'PENDING_PAYMENT' THEN
        RAISE EXCEPTION 'Reservation % is % and cannot be paid', p_pnr, v_res.status
            USING ERRCODE = 'NR003';
    END IF;

    IF v_res.total_fare IS NULL OR v_res.total_fare <= 0 THEN
        RAISE EXCEPTION 'Reservation % has no payable fare', p_pnr USING ERRCODE = 'NR003';
    END IF;

    IF v_wallet.balance < v_res.total_fare THEN
        RAISE EXCEPTION 'Insufficient wallet balance'
            USING ERRCODE = 'NR001',
                  DETAIL = format('required %s, available %s', v_res.total_fare, v_wallet.balance);
    END IF;

    INSERT INTO ledger_txns
        (txn_type, reference_type, reference_id, idempotency_key, status, description)
    VALUES
        ('PAYMENT', 'RESERVATION', p_pnr, COALESCE(p_idempotency_key, 'PAY-' || p_pnr),
         'PENDING', 'Wallet payment for PNR ' || p_pnr)
    RETURNING ledger_txn_id INTO v_txn;

    INSERT INTO ledger_entries (ledger_txn_id, account_code, entry_side, amount)
    VALUES (v_txn, 'CUSTOMER_WALLET', 'DEBIT', v_res.total_fare),
           (v_txn, 'RAILWAY_CLEARING', 'CREDIT', v_res.total_fare);

    UPDATE wallets SET balance = balance - v_res.total_fare
     WHERE wallet_id = v_wallet.wallet_id
    RETURNING balance INTO v_wallet.balance;

    UPDATE ledger_txns SET status = 'POSTED' WHERE ledger_txn_id = v_txn;

    INSERT INTO payments (pnr, wallet_id, ledger_txn_id, amount, idempotency_key)
    VALUES (p_pnr, v_wallet.wallet_id, v_txn, v_res.total_fare, p_idempotency_key)
    RETURNING * INTO v_pay;

    PERFORM confirm_reservation(p_pnr);

    v_ticket := 'YTR-' || p_pnr;
    INSERT INTO e_tickets (pnr, ticket_number, qr_payload)
    VALUES (p_pnr, v_ticket,
            format('YATRIO|PNR=%s|TKT=%s|AMT=%s', p_pnr, v_ticket, v_res.total_fare))
    ON CONFLICT (pnr) DO NOTHING;

    RETURN QUERY SELECT v_pay.payment_id, p_pnr, v_pay.amount,
                        v_wallet.balance, v_ticket, false;
END;
$$;
