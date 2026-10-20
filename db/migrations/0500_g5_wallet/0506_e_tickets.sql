-- Author: Aditya Patil (G5 database)
-- Store a relative/generated file path or payload metadata, not a large PDF blob.
CREATE TABLE e_tickets (
    e_ticket_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pnr TEXT NOT NULL UNIQUE,
    ticket_number TEXT NOT NULL UNIQUE,
    file_path TEXT,
    qr_payload TEXT NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_e_tickets_issued_at ON e_tickets(issued_at);
