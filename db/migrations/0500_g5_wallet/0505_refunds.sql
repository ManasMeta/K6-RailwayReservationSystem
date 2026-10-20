-- Author: Aditya Patil (G5 database)
-- G4 reservation PNR type/column must be confirmed before enabling this FK.
CREATE TABLE refunds (
    refund_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pnr TEXT NOT NULL,
    wallet_id BIGINT NOT NULL REFERENCES wallets(wallet_id) ON DELETE RESTRICT,
    ledger_txn_id BIGINT UNIQUE REFERENCES ledger_txns(ledger_txn_id) ON DELETE RESTRICT,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL DEFAULT 'Reservation cancellation',
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pnr, wallet_id, reason)
);
CREATE INDEX idx_refunds_pnr ON refunds(pnr);
