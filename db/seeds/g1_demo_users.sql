-- LOCAL DEMO ONLY - never load this in production: the passwords are public.
-- Author: G1 Member 3 (Database)
-- Five demo accounts so every screen can be tried without signing up first.
-- All use the password  yatrio-demo-1
--   passenger  alice@yatrio.test, bob@yatrio.test, carol@yatrio.test
--   staff      staff@yatrio.test   (run board, delays, cancellations, charts)
--   admin      admin@yatrio.test   (everything staff can do, plus the analytics reports)
-- Safe to run more than once.
INSERT INTO users (email, password_hash, full_name, phone) VALUES
    ('alice@yatrio.test', '$2b$10$kTwbRAiTfgqxUXt37sfbhe1sSUluRibqW8l4EPPbFVFPFmbNwzBv.', 'Alice Sharma', '9876500001'),
    ('bob@yatrio.test',   '$2b$10$kTwbRAiTfgqxUXt37sfbhe1sSUluRibqW8l4EPPbFVFPFmbNwzBv.', 'Bob Verma',   '9876500002'),
    ('carol@yatrio.test', '$2b$10$kTwbRAiTfgqxUXt37sfbhe1sSUluRibqW8l4EPPbFVFPFmbNwzBv.', 'Carol Singh', '9876500003'),
    ('staff@yatrio.test', '$2b$10$kTwbRAiTfgqxUXt37sfbhe1sSUluRibqW8l4EPPbFVFPFmbNwzBv.', 'Station Staff', '9876500004'),
    ('admin@yatrio.test', '$2b$10$kTwbRAiTfgqxUXt37sfbhe1sSUluRibqW8l4EPPbFVFPFmbNwzBv.', 'Yatrio Admin', '9876500005')
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
  FROM users u
  JOIN roles r ON r.role_name = CASE u.email::TEXT
                                    WHEN 'staff@yatrio.test' THEN 'staff'
                                    WHEN 'admin@yatrio.test' THEN 'admin'
                                    ELSE 'passenger' END
 WHERE u.email::TEXT IN ('alice@yatrio.test', 'bob@yatrio.test', 'carol@yatrio.test',
                         'staff@yatrio.test', 'admin@yatrio.test')
ON CONFLICT DO NOTHING;
