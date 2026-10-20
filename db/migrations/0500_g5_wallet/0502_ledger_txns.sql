-- Author: Aditya Patil (G5 database)
CREATE TABLE ledger_txns (
    ledger_txn_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    txn_type TEXT NOT NULL CHECK (txn_type IN ('TOPUP', 'PAYMENT', 'REFUND')),
    reference_type TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('PENDING', 'POSTED', 'REVERSED')),
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (txn_type, reference_type, reference_id)
);
