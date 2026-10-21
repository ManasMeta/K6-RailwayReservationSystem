-- Author: G1 Member 3 (Database)
-- Description: Core tables for Accounts (users, roles, user_roles, saved_passengers, audit_log) and fn_audit() trigger

CREATE TABLE IF NOT EXISTS roles (
    role_id INT PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO roles (role_id, role_name) VALUES
    (1, 'passenger'),
    (2, 'staff'),
    (3, 'admin')
ON CONFLICT (role_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email email_addr UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone mobile_no,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_id INT NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS saved_passengers (
    passenger_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    age INT NOT NULL CHECK (age > 0 AND age <= 125),
    gender VARCHAR(10) NOT NULL,
    berth_preference VARCHAR(20),
    senior_citizen BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
    audit_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id BIGINT,
    action TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by BIGINT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION fn_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id BIGINT;
    v_old JSONB;
    v_new JSONB;
BEGIN
    BEGIN
        v_user_id := NULLIF(current_setting('app.user_id', true), '')::BIGINT;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by)
        VALUES (TG_TABLE_NAME, (to_jsonb(NEW)->>'id')::BIGINT, 'INSERT', to_jsonb(NEW), v_user_id);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, changed_by)
        VALUES (TG_TABLE_NAME, (to_jsonb(NEW)->>'id')::BIGINT, 'UPDATE', v_old, v_new, v_user_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values, changed_by)
        VALUES (TG_TABLE_NAME, (to_jsonb(OLD)->>'id')::BIGINT, 'DELETE', to_jsonb(OLD), v_user_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
