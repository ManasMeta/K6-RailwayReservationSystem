-- Author: G4 Member 2 (Backend)
-- Description: release_expired_holds() function to clean up pending reservations whose 10-minute hold window has elapsed

CREATE OR REPLACE FUNCTION release_expired_holds()
RETURNS INT AS $$
DECLARE
    v_res RECORD;
    v_count INT := 0;
BEGIN
    FOR v_res IN
        SELECT reservation_id, pnr
        FROM reservations
        WHERE status = 'PENDING_PAYMENT'
          AND hold_expires_at < now()
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Delete berth allocations tied to passengers of this reservation
        DELETE FROM berth_allocations
        WHERE passenger_id IN (
            SELECT passenger_id
            FROM reservation_passengers
            WHERE reservation_id = v_res.reservation_id
        );

        -- Mark passengers as EXPIRED
        UPDATE reservation_passengers
        SET current_status = 'EXPIRED',
            coach_code = NULL,
            berth_number = NULL,
            berth_id = NULL,
            rac_number = NULL,
            wl_number = NULL,
            updated_at = now()
        WHERE reservation_id = v_res.reservation_id;

        -- Mark reservation as EXPIRED
        UPDATE reservations
        SET status = 'EXPIRED',
            updated_at = now()
        WHERE reservation_id = v_res.reservation_id;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
