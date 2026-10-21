-- G5 wallet assertions: refund tiers, pay_reservation(), the cancellation
-- refund trigger and the running-balance statement.
-- Needs G1 users and G4 reservations/cancellations/confirm_reservation (or the
-- stand-ins in db/tests/support/g5_contract_stubs.sql):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/g5_wallet.sql
-- Each block runs in a transaction that is rolled back.

-- 1. refund_amount: tiers, boundaries, full refund, bad input.
BEGIN;
DO $$
BEGIN
    IF refund_amount(1000, 72) <> 900.00 THEN RAISE EXCEPTION '72h should refund 90%%'; END IF;
    IF refund_amount(1000, 48) <> 900.00 THEN RAISE EXCEPTION '48h boundary should refund 90%%'; END IF;
    IF refund_amount(1000, 47.99) <> 750.00 THEN RAISE EXCEPTION '47.99h should refund 75%%'; END IF;
    IF refund_amount(1000, 6) <> 500.00 THEN RAISE EXCEPTION '6h should refund 50%%'; END IF;
    IF refund_amount(1000, 2) <> 0.00 THEN RAISE EXCEPTION '2h should refund nothing'; END IF;
    IF refund_amount(1000, -3) <> 0.00 THEN RAISE EXCEPTION 'after departure should refund nothing'; END IF;
    IF refund_amount(1000, 1, true) <> 1000.00 THEN RAISE EXCEPTION 'full refund ignores tiers'; END IF;
    IF refund_amount(0, 72) <> 0.00 OR refund_amount(NULL, 72) <> 0.00 THEN
        RAISE EXCEPTION 'no fare means no refund';
    END IF;
    IF refund_amount(333.33, 24) <> 250.00 THEN RAISE EXCEPTION 'rounding wrong: %', refund_amount(333.33, 24); END IF;
END $$;
ROLLBACK;

-- Test helper: credit a wallet through a balanced, posted ledger transaction.
CREATE OR REPLACE FUNCTION pg_temp.fund(p_wallet BIGINT, p_amount NUMERIC)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_topup BIGINT;
    v_txn BIGINT;
BEGIN
    INSERT INTO topups (wallet_id, idempotency_key, amount, status)
    VALUES (p_wallet, 'fund-' || gen_random_uuid(), p_amount, 'PENDING')
    RETURNING topup_id INTO v_topup;
    INSERT INTO ledger_txns (txn_type, reference_type, reference_id, status, description)
    VALUES ('TOPUP', 'TOPUP', v_topup::TEXT, 'PENDING', 'test top-up')
    RETURNING ledger_txn_id INTO v_txn;
    INSERT INTO ledger_entries (ledger_txn_id, account_code, entry_side, amount)
    VALUES (v_txn, 'RAILWAY_CLEARING', 'DEBIT', p_amount),
           (v_txn, 'CUSTOMER_WALLET', 'CREDIT', p_amount);
    UPDATE wallets SET balance = balance + p_amount WHERE wallet_id = p_wallet;
    UPDATE ledger_txns SET status = 'POSTED' WHERE ledger_txn_id = v_txn;
    UPDATE topups SET ledger_txn_id = v_txn, status = 'COMPLETED' WHERE topup_id = v_topup;
END $$;

-- 2. pay_reservation: happy path, replay, ledger balance, ticket.
BEGIN;
DO $$
DECLARE
    v_user BIGINT;
    v_wallet BIGINT;
    r RECORD;
BEGIN
    INSERT INTO users DEFAULT VALUES RETURNING user_id INTO v_user;
    INSERT INTO wallets (user_id) VALUES (v_user) RETURNING wallet_id INTO v_wallet;
    PERFORM pg_temp.fund(v_wallet, 1000);
    INSERT INTO reservations (pnr, user_id, total_fare, departure_at)
    VALUES ('1000000001', v_user, 400.00, now() + interval '3 days');

    SELECT * INTO r FROM pay_reservation(v_user, '1000000001');
    IF r.o_amount <> 400.00 OR r.o_balance <> 600.00 OR r.o_replayed
       OR r.o_ticket_number <> 'NRRMS-1000000001' THEN
        RAISE EXCEPTION 'first payment wrong: %', r;
    END IF;
    IF (SELECT status FROM reservations WHERE pnr = '1000000001') <> 'CONFIRMED' THEN
        RAISE EXCEPTION 'reservation was not confirmed';
    END IF;
    IF (SELECT balance FROM wallets WHERE wallet_id = v_wallet) <> 600.00 THEN
        RAISE EXCEPTION 'wallet not debited';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM e_tickets WHERE pnr = '1000000001') THEN
        RAISE EXCEPTION 'e-ticket not issued';
    END IF;

    -- A retry returns the same payment and charges nothing more.
    SELECT * INTO r FROM pay_reservation(v_user, '1000000001');
    IF NOT r.o_replayed OR r.o_balance <> 600.00 THEN RAISE EXCEPTION 'retry charged again: %', r; END IF;
    IF (SELECT count(*) FROM payments WHERE pnr = '1000000001') <> 1 THEN
        RAISE EXCEPTION 'duplicate payment rows';
    END IF;

    -- The ledger balances at COMMIT; force the deferred check now.
    SET CONSTRAINTS ALL IMMEDIATE;
    IF (SELECT sum(amount) FILTER (WHERE entry_side = 'DEBIT')
             - sum(amount) FILTER (WHERE entry_side = 'CREDIT')
        FROM ledger_entries WHERE ledger_txn_id =
             (SELECT ledger_txn_id FROM payments WHERE pnr = '1000000001')) <> 0 THEN
        RAISE EXCEPTION 'payment ledger unbalanced';
    END IF;
END $$;
ROLLBACK;

-- 3. pay_reservation failures leave no trace.
BEGIN;
DO $$
DECLARE
    v_user BIGINT;
    v_other BIGINT;
    v_wallet BIGINT;
BEGIN
    INSERT INTO users DEFAULT VALUES RETURNING user_id INTO v_user;
    INSERT INTO users DEFAULT VALUES RETURNING user_id INTO v_other;
    INSERT INTO wallets (user_id) VALUES (v_user) RETURNING wallet_id INTO v_wallet;
    PERFORM pg_temp.fund(v_wallet, 100);
    INSERT INTO reservations (pnr, user_id, total_fare, departure_at)
    VALUES ('1000000002', v_user, 250.00, now() + interval '3 days');
    INSERT INTO reservations (pnr, user_id, total_fare, status, departure_at)
    VALUES ('1000000003', v_user, 50.00, 'CONFIRMED', now() + interval '3 days');

    BEGIN
        PERFORM pay_reservation(v_user, '1000000002');
        RAISE EXCEPTION 'insufficient funds was accepted';
    EXCEPTION WHEN SQLSTATE 'NR001' THEN NULL;
    END;
    IF (SELECT balance FROM wallets WHERE wallet_id = v_wallet) <> 100.00
       OR EXISTS (SELECT 1 FROM payments WHERE pnr = '1000000002')
       OR (SELECT status FROM reservations WHERE pnr = '1000000002') <> 'PENDING_PAYMENT' THEN
        RAISE EXCEPTION 'failed payment changed state';
    END IF;

    BEGIN
        PERFORM pay_reservation(v_other, '1000000002');  -- someone else's PNR
        RAISE EXCEPTION 'paying another user''s reservation was accepted';
    EXCEPTION WHEN SQLSTATE 'NR002' THEN NULL;
    END;
    BEGIN
        PERFORM pay_reservation(v_user, '9999999999');
        RAISE EXCEPTION 'unknown PNR was accepted';
    EXCEPTION WHEN SQLSTATE 'NR002' THEN NULL;
    END;
    BEGIN
        PERFORM pay_reservation(v_user, '1000000003');   -- already confirmed, never paid here
        RAISE EXCEPTION 'non-payable reservation was accepted';
    EXCEPTION WHEN SQLSTATE 'NR003' THEN NULL;
    END;
END $$;
ROLLBACK;

-- 4. Cancellation trigger: tiered refund, cap at the amount paid, full
--    refund for a cancelled run, nothing for an unpaid hold.
BEGIN;
DO $$
DECLARE
    v_user BIGINT;
    v_wallet BIGINT;
BEGIN
    INSERT INTO users DEFAULT VALUES RETURNING user_id INTO v_user;
    INSERT INTO wallets (user_id) VALUES (v_user) RETURNING wallet_id INTO v_wallet;
    PERFORM pg_temp.fund(v_wallet, 2000);
    INSERT INTO reservations (pnr, user_id, total_fare, departure_at)
    VALUES ('1000000004', v_user, 1000.00, now() + interval '24 hours'),
           ('1000000005', v_user, 300.00, now() + interval '24 hours');
    PERFORM pay_reservation(v_user, '1000000004');

    -- 24h before departure: 75% of the cancelled passenger's 400.
    INSERT INTO cancellations (pnr, fare_amount) VALUES ('1000000004', 400.00);
    IF (SELECT amount FROM refunds WHERE pnr = '1000000004') <> 300.00
       OR (SELECT balance FROM wallets WHERE wallet_id = v_wallet) <> 1300.00 THEN
        RAISE EXCEPTION 'tiered refund wrong, balance %',
            (SELECT balance FROM wallets WHERE wallet_id = v_wallet);
    END IF;

    -- Railway cancelled the run: full refund of the rest, capped at what was paid.
    INSERT INTO cancellations (pnr, fare_amount, full_refund) VALUES ('1000000004', 900.00, true);
    IF (SELECT sum(amount) FROM refunds WHERE pnr = '1000000004') <> 1000.00
       OR (SELECT balance FROM wallets WHERE wallet_id = v_wallet) <> 2000.00 THEN
        RAISE EXCEPTION 'cap wrong: refunds %, balance %',
            (SELECT sum(amount) FROM refunds WHERE pnr = '1000000004'),
            (SELECT balance FROM wallets WHERE wallet_id = v_wallet);
    END IF;

    -- Nothing left to refund.
    INSERT INTO cancellations (pnr, fare_amount, full_refund) VALUES ('1000000004', 50.00, true);
    IF (SELECT count(*) FROM refunds WHERE pnr = '1000000004') <> 2 THEN
        RAISE EXCEPTION 'refunded more than was paid';
    END IF;

    -- An unpaid hold has nothing to refund.
    INSERT INTO cancellations (pnr, fare_amount, full_refund) VALUES ('1000000005', 300.00, true);
    IF EXISTS (SELECT 1 FROM refunds WHERE pnr = '1000000005') THEN
        RAISE EXCEPTION 'unpaid hold was refunded';
    END IF;

    SET CONSTRAINTS ALL IMMEDIATE;  -- every refund transaction balances
END $$;
ROLLBACK;

-- 5. Statement: running balance across top-up, payment and refund.
BEGIN;
DO $$
DECLARE
    v_user BIGINT;
    v_wallet BIGINT;
    v_balances NUMERIC[];
    v_kinds TEXT[];
BEGIN
    INSERT INTO users DEFAULT VALUES RETURNING user_id INTO v_user;
    INSERT INTO wallets (user_id) VALUES (v_user) RETURNING wallet_id INTO v_wallet;
    PERFORM pg_temp.fund(v_wallet, 1000);
    INSERT INTO reservations (pnr, user_id, total_fare, departure_at)
    VALUES ('1000000006', v_user, 400.00, now() + interval '30 hours');
    PERFORM pay_reservation(v_user, '1000000006');
    INSERT INTO cancellations (pnr, fare_amount) VALUES ('1000000006', 400.00);  -- 75% = 300

    SELECT array_agg(balance_after ORDER BY ledger_txn_id), array_agg(kind ORDER BY ledger_txn_id)
      INTO v_balances, v_kinds
      FROM v_wallet_statement WHERE wallet_id = v_wallet;
    IF v_kinds <> ARRAY['TOPUP', 'PAYMENT', 'REFUND']
       OR v_balances <> ARRAY[1000.00, 600.00, 900.00] THEN
        RAISE EXCEPTION 'statement wrong: % %', v_kinds, v_balances;
    END IF;
    IF v_balances[3] <> (SELECT balance FROM wallets WHERE wallet_id = v_wallet) THEN
        RAISE EXCEPTION 'statement does not end at the wallet balance';
    END IF;
END $$;
ROLLBACK;
