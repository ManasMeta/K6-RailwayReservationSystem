-- Author: Aditya Patil (G5 database)
-- G5 dependency: G1 users table. Confirm exact PK name before integration.
CREATE TABLE wallets (
    wallet_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(user_id),
    balance NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
