-- Author: G4 Member 3 (Database)
-- Description: Create 10-digit PNR sequence and reservations table with status constraints and indices

CREATE SEQUENCE IF NOT EXISTS pnr_seq
    START WITH 1000000000
    MINVALUE 1000000000
    MAXVALUE 9999999999
    CYCLE;

CREATE TABLE IF NOT EXISTS reservations (
    reservation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pnr VARCHAR(10) NOT NULL UNIQUE DEFAULT nextval('pnr_seq')::text,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    train_no VARCHAR(10) NOT NULL REFERENCES trains(train_no),
    run_date DATE NOT NULL,
    from_station_code VARCHAR(10) NOT NULL REFERENCES stations(station_code),
    to_station_code VARCHAR(10) NOT NULL REFERENCES stations(station_code),
    from_seq INT NOT NULL,
    to_seq INT NOT NULL,
    class_code VARCHAR(5) NOT NULL REFERENCES travel_classes(class_code),
    quota_code VARCHAR(5) NOT NULL REFERENCES quotas(quota_code),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_PAYMENT'
        CHECK (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'PARTIALLY_CANCELLED')),
    total_fare NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    hold_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_reservations_seq_range CHECK (from_seq < to_seq)
);

CREATE INDEX IF NOT EXISTS idx_reservations_pnr ON reservations(pnr);
CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_train_run ON reservations(train_no, run_date);
CREATE INDEX IF NOT EXISTS idx_reservations_hold_expiry ON reservations(status, hold_expires_at)
    WHERE status = 'PENDING_PAYMENT';
