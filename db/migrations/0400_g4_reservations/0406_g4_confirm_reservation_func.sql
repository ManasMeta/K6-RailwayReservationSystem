-- Author: G4 Member 2 (Backend)
-- Description: confirm_reservation() function to confirm a pending hold upon successful payment

CREATE OR REPLACE FUNCTION confirm_reservation(p_pnr VARCHAR(10))
RETURNS BOOLEAN AS $$
DECLARE
    v_res RECORD;
BEGIN
    SELECT * INTO v_res
    FROM reservations
    WHERE pnr = p_pnr
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation with PNR % not found', p_pnr
            USING ERRCODE = 'P0002';
    END IF;

    IF v_res.status = 'CONFIRMED' THEN
        RETURN true; -- Idempotent success
    END IF;

    IF v_res.status <> 'PENDING_PAYMENT' THEN
        RAISE EXCEPTION 'Cannot confirm reservation with status %', v_res.status
            USING ERRCODE = '22023';
    END IF;

    IF v_res.hold_expires_at < now() THEN
        RAISE EXCEPTION 'Hold expired for PNR % at %', p_pnr, v_res.hold_expires_at
            USING ERRCODE = '22023';
    END IF;

    UPDATE reservations
    SET status = 'CONFIRMED',
        updated_at = now()
    WHERE pnr = p_pnr;

    RETURN true;
END;
$$ LANGUAGE plpgsql;
