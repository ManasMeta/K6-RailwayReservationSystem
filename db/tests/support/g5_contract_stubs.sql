-- STAND-INS for tables owned by other groups, used only to test G5 on its own.
-- Apply BEFORE db/migrations/0500_g5_wallet when G1 (users) and G4
-- (reservations, cancellations, confirm_reservation) have not merged yet.
-- Never apply this on a database that already has the real G1/G4 objects.
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS reservations (
    pnr TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    total_fare NUMERIC(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    departure_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS cancellations (
    cancellation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pnr TEXT NOT NULL REFERENCES reservations(pnr),
    fare_amount NUMERIC(10,2) NOT NULL,
    cancelled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    full_refund BOOLEAN NOT NULL DEFAULT false
);

CREATE OR REPLACE FUNCTION confirm_reservation(p_pnr TEXT)
RETURNS VOID
LANGUAGE sql
AS $$
    UPDATE reservations SET status = 'CONFIRMED'
     WHERE pnr = p_pnr AND status = 'PENDING_PAYMENT';
$$;
