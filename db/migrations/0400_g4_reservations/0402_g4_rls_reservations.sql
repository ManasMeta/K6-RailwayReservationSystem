-- Author: G4 Member 3 (Database)
-- Description: Row-Level Security (RLS) policies on reservations and reservation_passengers

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist for clean rerun
DROP POLICY IF EXISTS reservations_passenger_policy ON reservations;
DROP POLICY IF EXISTS reservation_passengers_policy ON reservation_passengers;
DROP POLICY IF EXISTS cancellations_passenger_policy ON cancellations;

CREATE POLICY reservations_passenger_policy ON reservations
    FOR ALL
    USING (
        current_setting('app.user_id', true) IS NULL
        OR current_setting('app.user_id', true) = ''
        OR current_setting('app.is_admin', true) = 'true'
        OR current_setting('app.user_role', true) IN ('staff', 'admin')
        OR user_id = current_setting('app.user_id', true)::BIGINT
    )
    WITH CHECK (
        current_setting('app.user_id', true) IS NULL
        OR current_setting('app.user_id', true) = ''
        OR current_setting('app.is_admin', true) = 'true'
        OR current_setting('app.user_role', true) IN ('staff', 'admin')
        OR user_id = current_setting('app.user_id', true)::BIGINT
    );

CREATE POLICY reservation_passengers_policy ON reservation_passengers
    FOR ALL
    USING (
        current_setting('app.user_id', true) IS NULL
        OR current_setting('app.user_id', true) = ''
        OR current_setting('app.is_admin', true) = 'true'
        OR current_setting('app.user_role', true) IN ('staff', 'admin')
        OR EXISTS (
            SELECT 1 FROM reservations r
            WHERE r.reservation_id = reservation_passengers.reservation_id
              AND r.user_id = current_setting('app.user_id', true)::BIGINT
        )
    )
    WITH CHECK (
        current_setting('app.user_id', true) IS NULL
        OR current_setting('app.user_id', true) = ''
        OR current_setting('app.is_admin', true) = 'true'
        OR current_setting('app.user_role', true) IN ('staff', 'admin')
        OR EXISTS (
            SELECT 1 FROM reservations r
            WHERE r.reservation_id = reservation_passengers.reservation_id
              AND r.user_id = current_setting('app.user_id', true)::BIGINT
        )
    );

CREATE POLICY cancellations_passenger_policy ON cancellations
    FOR ALL
    USING (
        current_setting('app.user_id', true) IS NULL
        OR current_setting('app.user_id', true) = ''
        OR current_setting('app.is_admin', true) = 'true'
        OR current_setting('app.user_role', true) IN ('staff', 'admin')
        OR EXISTS (
            SELECT 1 FROM reservations r
            WHERE r.reservation_id = cancellations.reservation_id
              AND r.user_id = current_setting('app.user_id', true)::BIGINT
        )
    );
