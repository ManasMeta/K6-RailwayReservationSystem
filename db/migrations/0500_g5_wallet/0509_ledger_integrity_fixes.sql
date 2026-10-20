-- G5 ledger integrity corrections.
-- Apply after 0508_wallet_updated_at.sql.
--
-- Lifecycle:
-- PENDING -> POSTED -> REVERSED
-- A posted transaction is corrected through a separate reversal transaction.

-- New headers must start pending so entries can be added before posting.
ALTER TABLE ledger_txns
    ALTER COLUMN status SET DEFAULT 'PENDING';

-- Validate the final state of any non-pending transaction.
CREATE OR REPLACE FUNCTION fn_validate_ledger_txn(p_txn_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_status TEXT;
    v_debits NUMERIC(12,2);
    v_credits NUMERIC(12,2);
    v_count BIGINT;
BEGIN
    -- Serialize validation against entry changes for this transaction.
    SELECT status
      INTO v_status
      FROM ledger_txns
     WHERE ledger_txn_id = p_txn_id
     FOR UPDATE;

    IF NOT FOUND OR v_status = 'PENDING' THEN
        RETURN;
    END IF;

    SELECT
        COALESCE(SUM(amount) FILTER (WHERE entry_side = 'DEBIT'), 0),
        COALESCE(SUM(amount) FILTER (WHERE entry_side = 'CREDIT'), 0),
        COUNT(*)
      INTO v_debits, v_credits, v_count
      FROM ledger_entries
     WHERE ledger_txn_id = p_txn_id;

    IF v_count < 2 OR v_debits <> v_credits THEN
        RAISE EXCEPTION
            'Ledger transaction % is not balanced (debits %, credits %, entries %)',
            p_txn_id, v_debits, v_credits, v_count
            USING ERRCODE = '23514';
    END IF;
END;
$$;

-- Explicitly handle INSERT, UPDATE and DELETE events.
CREATE OR REPLACE FUNCTION fn_assert_ledger_txn_balanced()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_TABLE_NAME = 'ledger_txns' THEN
        PERFORM fn_validate_ledger_txn(NEW.ledger_txn_id);

    ELSIF TG_OP = 'INSERT' THEN
        PERFORM fn_validate_ledger_txn(NEW.ledger_txn_id);

    ELSIF TG_OP = 'DELETE' THEN
        PERFORM fn_validate_ledger_txn(OLD.ledger_txn_id);

    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM fn_validate_ledger_txn(OLD.ledger_txn_id);

        IF NEW.ledger_txn_id IS DISTINCT FROM OLD.ledger_txn_id THEN
            PERFORM fn_validate_ledger_txn(NEW.ledger_txn_id);
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_txn_balanced ON ledger_entries;
DROP TRIGGER IF EXISTS trg_ledger_header_balanced ON ledger_txns;

CREATE CONSTRAINT TRIGGER trg_ledger_txn_balanced
AFTER INSERT OR UPDATE OR DELETE ON ledger_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION fn_assert_ledger_txn_balanced();

CREATE CONSTRAINT TRIGGER trg_ledger_header_balanced
AFTER INSERT OR UPDATE ON ledger_txns
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION fn_assert_ledger_txn_balanced();

-- Lock the parent header before changing entries. Do not allow an entry
-- to be reassigned to a different transaction.
CREATE OR REPLACE FUNCTION fn_guard_posted_ledger_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_status TEXT;
BEGIN
    IF TG_OP = 'UPDATE'
       AND NEW.ledger_txn_id IS DISTINCT FROM OLD.ledger_txn_id THEN
        RAISE EXCEPTION 'A ledger entry cannot be reassigned to another transaction'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'DELETE' THEN
        SELECT status
          INTO v_status
          FROM ledger_txns
         WHERE ledger_txn_id = OLD.ledger_txn_id
         FOR UPDATE;
    ELSE
        SELECT status
          INTO v_status
          FROM ledger_txns
         WHERE ledger_txn_id = NEW.ledger_txn_id
         FOR UPDATE;
    END IF;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Ledger transaction header does not exist'
            USING ERRCODE = '23503';
    END IF;

    IF v_status IN ('POSTED', 'REVERSED') THEN
        RAISE EXCEPTION
            'Entries for % transaction are immutable',
            v_status
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_posted_ledger_entry ON ledger_entries;

CREATE TRIGGER trg_guard_posted_ledger_entry
BEFORE INSERT OR UPDATE OR DELETE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION fn_guard_posted_ledger_entry();

-- Protect posted headers. The only permitted change to a posted header
-- is its status becoming REVERSED; its identifying data stays unchanged.
CREATE OR REPLACE FUNCTION fn_guard_ledger_txn_header()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('POSTED', 'REVERSED') THEN
            RAISE EXCEPTION 'Cannot delete a % ledger transaction', OLD.status
                USING ERRCODE = '23514';
        END IF;

        RETURN OLD;
    END IF;

    IF NEW.ledger_txn_id IS DISTINCT FROM OLD.ledger_txn_id THEN
        RAISE EXCEPTION 'Ledger transaction ID is immutable'
            USING ERRCODE = '23514';
    END IF;

    IF OLD.status = 'PENDING' THEN
        IF NEW.status NOT IN ('PENDING', 'POSTED') THEN
            RAISE EXCEPTION 'Invalid ledger status transition: % to %',
                OLD.status, NEW.status
                USING ERRCODE = '23514';
        END IF;

    ELSIF OLD.status = 'POSTED' THEN
        IF NEW.status <> 'REVERSED'
           OR NEW.txn_type IS DISTINCT FROM OLD.txn_type
           OR NEW.reference_type IS DISTINCT FROM OLD.reference_type
           OR NEW.reference_id IS DISTINCT FROM OLD.reference_id
           OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
           OR NEW.description IS DISTINCT FROM OLD.description
           OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION
                'Posted transaction is immutable except for transition to REVERSED'
                USING ERRCODE = '23514';
        END IF;

    ELSE
        RAISE EXCEPTION 'A reversed transaction is immutable'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_ledger_txn_header ON ledger_txns;

CREATE TRIGGER trg_guard_ledger_txn_header
BEFORE UPDATE OR DELETE ON ledger_txns
FOR EACH ROW
EXECUTE FUNCTION fn_guard_ledger_txn_header();
