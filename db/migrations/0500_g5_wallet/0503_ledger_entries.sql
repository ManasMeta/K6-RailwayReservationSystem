-- Author: Aditya Patil (G5 database)
CREATE TABLE ledger_entries (
    ledger_entry_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ledger_txn_id BIGINT NOT NULL REFERENCES ledger_txns(ledger_txn_id) ON DELETE RESTRICT,
    account_code TEXT NOT NULL CHECK (account_code IN ('CUSTOMER_WALLET', 'RAILWAY_CLEARING')),
    entry_side TEXT NOT NULL CHECK (entry_side IN ('DEBIT', 'CREDIT')),
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_entries_txn ON ledger_entries(ledger_txn_id);
