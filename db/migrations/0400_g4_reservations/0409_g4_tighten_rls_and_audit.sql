-- Author: G4 Member 3 (Database)
-- Description: replace the permissive reservation policies from 0402 and attach fn_audit().
--
-- 0402 let every row through whenever app.user_id was unset, so a connection that forgot to
-- identify the caller saw everyone's bookings. These policies match nothing unless the caller
-- is the owner, or staff/admin/system (app_is_privileged(), defined by G1 in 0102).

DROP POLICY IF EXISTS reservations_passenger_policy ON reservations;
DROP POLICY IF EXISTS reservation_passengers_policy ON reservation_passengers;
DROP POLICY IF EXISTS cancellations_passenger_policy ON cancellations;

CREATE POLICY reservations_passenger_policy ON reservations
    FOR ALL
    USING (user_id = app_user_id() OR app_is_privileged())
    WITH CHECK (user_id = app_user_id() OR app_is_privileged());

CREATE POLICY reservation_passengers_policy ON reservation_passengers
    FOR ALL
    USING (
        app_is_privileged()
        OR EXISTS (SELECT 1 FROM reservations r
                    WHERE r.reservation_id = reservation_passengers.reservation_id
                      AND r.user_id = app_user_id())
    )
    WITH CHECK (
        app_is_privileged()
        OR EXISTS (SELECT 1 FROM reservations r
                    WHERE r.reservation_id = reservation_passengers.reservation_id
                      AND r.user_id = app_user_id())
    );

CREATE POLICY cancellations_passenger_policy ON cancellations
    FOR ALL
    USING (
        app_is_privileged()
        OR EXISTS (SELECT 1 FROM reservations r
                    WHERE r.reservation_id = cancellations.reservation_id
                      AND r.user_id = app_user_id())
    )
    WITH CHECK (
        app_is_privileged()
        OR EXISTS (SELECT 1 FROM reservations r
                    WHERE r.reservation_id = cancellations.reservation_id
                      AND r.user_id = app_user_id())
    );

DROP TRIGGER IF EXISTS trg_reservations_audit ON reservations;
CREATE TRIGGER trg_reservations_audit
    AFTER INSERT OR UPDATE OR DELETE ON reservations
    FOR EACH ROW EXECUTE FUNCTION fn_audit('reservation_id');
