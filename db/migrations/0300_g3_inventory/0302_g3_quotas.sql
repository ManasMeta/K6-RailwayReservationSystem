-- Author: G3 database (Manas)
-- Booking quotas master table.

CREATE TABLE IF NOT EXISTS quotas (
    quota_code VARCHAR(5) PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default quotas
INSERT INTO quotas (quota_code, name) VALUES
    ('GN', 'General Quota'),
    ('TQ', 'Tatkal Quota'),
    ('LD', 'Ladies Quota'),
    ('SS', 'Senior Citizen Quota')
ON CONFLICT (quota_code) DO UPDATE
SET name = EXCLUDED.name;
