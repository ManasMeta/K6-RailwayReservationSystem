-- Author: G1 Member 3 (Database)
-- Description: fn_audit() stores only the columns that changed, as JSONB, and works for any table.
--
-- Attach with the table's key column as the trigger argument:
--   CREATE TRIGGER trg_x_audit AFTER INSERT OR UPDATE OR DELETE ON x
--       FOR EACH ROW EXECUTE FUNCTION fn_audit('x_id');
-- INSERT logs the new row and DELETE the old row. UPDATE logs the before and after values of
-- the columns that changed, and nothing at all when no column changed. Password hashes are
-- never stored. It runs as the table owner, so the API role needs no access to audit_log.
CREATE OR REPLACE FUNCTION fn_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user BIGINT := app_user_id();
    v_pk TEXT := COALESCE(TG_ARGV[0], 'id');
    v_old JSONB;
    v_new JSONB;
    v_old_diff JSONB;
    v_new_diff JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by)
        VALUES (TG_TABLE_NAME, (to_jsonb(NEW) ->> v_pk)::BIGINT, 'INSERT',
                to_jsonb(NEW) - 'password_hash', v_user);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values, changed_by)
        VALUES (TG_TABLE_NAME, (to_jsonb(OLD) ->> v_pk)::BIGINT, 'DELETE',
                to_jsonb(OLD) - 'password_hash', v_user);
        RETURN OLD;
    END IF;

    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    SELECT jsonb_object_agg(n.key, n.value), jsonb_object_agg(n.key, v_old -> n.key)
      INTO v_new_diff, v_old_diff
      FROM jsonb_each(v_new) n
     WHERE v_old -> n.key IS DISTINCT FROM n.value;

    IF v_new_diff IS NULL THEN
        RETURN NEW;  -- nothing changed
    END IF;

    -- keep the fact that the hash changed, never the hash itself
    IF v_new_diff ? 'password_hash' THEN
        v_new_diff := jsonb_set(v_new_diff, '{password_hash}', '"[changed]"');
        v_old_diff := jsonb_set(v_old_diff, '{password_hash}', '"[redacted]"');
    END IF;

    INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, changed_by)
    VALUES (TG_TABLE_NAME, (v_new ->> v_pk)::BIGINT, 'UPDATE', v_old_diff, v_new_diff, v_user);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_audit ON users;
CREATE TRIGGER trg_users_audit
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_audit('user_id');
