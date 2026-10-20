-- Author: Aditya Patil (G5 database)
-- Top-up requests are simulated; no real payment gateway is connected.
CREATE TABLE topups (
    topup_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    wallet_id BIGINT NOT NULL REFERENCES wallets(wallet_id) ON DELETE RESTRICT,
    ledger_txn_id BIGINT UNIQUE REFERENCES ledger_txns(ledger_txn_id) ON DELETE RESTRICT,
    idempotency_key TEXT NOT NULL UNIQUE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    provider_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
