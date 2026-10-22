-- Author: G3 database (Manas)
-- Segment-wise berth allocation with PostgreSQL GiST exclusion constraint.
-- A berth is sold for a range of stops [boarding_seq, alighting_seq).
-- The database itself rejects overlapping sales of the same berth on the same run date!

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS berth_allocations (
    allocation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    berth_id BIGINT NOT NULL REFERENCES berths(berth_id) ON DELETE CASCADE,
    run_date DATE NOT NULL,
    stops INT4RANGE NOT NULL,
    passenger_id BIGINT NULL,
    allocation_type VARCHAR(10) NOT NULL DEFAULT 'CNF',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    EXCLUDE USING gist (berth_id WITH =, run_date WITH =, stops WITH &&)
);

CREATE INDEX IF NOT EXISTS ix_berth_alloc_date_stops ON berth_allocations (berth_id, run_date);
