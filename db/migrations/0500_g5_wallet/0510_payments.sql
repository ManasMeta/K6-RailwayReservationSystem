-- Author: G5 database
-- One wallet payment per PNR. Links a reservation payment to its wallet and
-- its posted ledger transaction (ledger_entries have no wallet column).
CREATE TABLE payments (
    payment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pnr TEXT NOT NULL UNIQUE,
    wallet_id BIGINT NOT NULL REFERENCES wallets(wallet_id) ON DELETE RESTRICT,
    ledger_txn_id BIGINT NOT NULL UNIQUE REFERENCES ledger_txns(ledger_txn_id) ON DELETE RESTRICT,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_wallet ON payments(wallet_id, created_at);
