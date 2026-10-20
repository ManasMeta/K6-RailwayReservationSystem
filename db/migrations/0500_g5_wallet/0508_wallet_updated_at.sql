-- Author: Aditya Patil (G5 database)
CREATE OR REPLACE FUNCTION fn_set_wallet_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_wallet_updated_at
BEFORE UPDATE ON wallets
FOR EACH ROW
EXECUTE FUNCTION fn_set_wallet_updated_at();
