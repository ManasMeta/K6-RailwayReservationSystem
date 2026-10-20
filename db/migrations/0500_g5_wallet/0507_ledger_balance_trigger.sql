-- Author: Aditya Patil (G5 database)
-- A transaction must have at least one debit and one credit and the totals must balance.
CREATE OR REPLACE FUNCTION fn_assert_ledger_txn_balanced()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_txn_id BIGINT;
    v_debits NUMERIC(12,2);
    v_credits NUMERIC(12,2);
    v_count INTEGER;
BEGIN
    v_txn_id := COALESCE(NEW.ledger_txn_id, OLD.ledger_txn_id);

    SELECT
        COALESCE(SUM(amount) FILTER (WHERE entry_side = 'DEBIT'), 0),
        COALESCE(SUM(amount) FILTER (WHERE entry_side = 'CREDIT'), 0),
        COUNT(*)
    INTO v_debits, v_credits, v_count
    FROM ledger_entries
    WHERE ledger_txn_id = v_txn_id;

    IF v_count < 2 OR v_debits <> v_credits THEN
        RAISE EXCEPTION 'Ledger transaction % is not balanced (debits %, credits %, entries %)',
            v_txn_id, v_debits, v_credits, v_count
            USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_ledger_txn_balanced
AFTER INSERT OR UPDATE OR DELETE ON ledger_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION fn_assert_ledger_txn_balanced();
