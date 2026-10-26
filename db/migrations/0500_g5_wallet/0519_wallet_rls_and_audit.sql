-- Author: G5 database
-- Description: a user can see and change only their own wallet; wallet changes are audited.
-- Staff, admins and background jobs (app_is_privileged()) keep full access so that a railway
-- cancellation can refund passengers' wallets.

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallets_owner_policy ON wallets;
CREATE POLICY wallets_owner_policy ON wallets
    FOR ALL
    USING (user_id = app_user_id() OR app_is_privileged())
    WITH CHECK (user_id = app_user_id() OR app_is_privileged());

DROP TRIGGER IF EXISTS trg_wallets_audit ON wallets;
CREATE TRIGGER trg_wallets_audit
    AFTER INSERT OR UPDATE OR DELETE ON wallets
    FOR EACH ROW EXECUTE FUNCTION fn_audit('wallet_id');
