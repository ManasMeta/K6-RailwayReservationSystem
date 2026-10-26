-- Author: G4 Member 3 (Database)
-- Description: Create reservation_passengers, cancellations, and alter berth_allocations to add passenger_id foreign key

CREATE TABLE IF NOT EXISTS reservation_passengers (
    passenger_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reservation_id BIGINT NOT NULL REFERENCES reservations(reservation_id) ON DELETE CASCADE,
    passenger_name TEXT NOT NULL,
    age INT NOT NULL CHECK (age > 0 AND age <= 125),
    gender VARCHAR(10) NOT NULL,
    berth_preference VARCHAR(20),
    senior_citizen BOOLEAN NOT NULL DEFAULT false,
    booking_status VARCHAR(20) NOT NULL DEFAULT 'WL',
    current_status VARCHAR(20) NOT NULL DEFAULT 'WL',
    coach_code VARCHAR(10),
    berth_number INT,
    berth_type VARCHAR(10),
    berth_id BIGINT REFERENCES berths(berth_id),
    rac_number INT,
    wl_number INT,
    fare NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservation_passengers_res_id ON reservation_passengers(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_passengers_status ON reservation_passengers(current_status);
CREATE INDEX IF NOT EXISTS idx_reservation_passengers_rac ON reservation_passengers(rac_number) WHERE rac_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reservation_passengers_wl ON reservation_passengers(wl_number) WHERE wl_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS cancellations (
    cancellation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reservation_id BIGINT NOT NULL REFERENCES reservations(reservation_id) ON DELETE CASCADE,
    passenger_id BIGINT NOT NULL REFERENCES reservation_passengers(passenger_id) ON DELETE CASCADE,
    refund_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    cancellation_charge NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    cancelled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_cancellations_reservation_id ON cancellations(reservation_id);
CREATE INDEX IF NOT EXISTS idx_cancellations_passenger_id ON cancellations(passenger_id);

-- Alter berth_allocations to connect allocations to reservation passengers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'berth_allocations' AND column_name = 'passenger_id'
    ) THEN
        ALTER TABLE berth_allocations
            ADD COLUMN passenger_id BIGINT REFERENCES reservation_passengers(passenger_id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_berth_allocations_passenger_id ON berth_allocations(passenger_id);
