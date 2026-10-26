-- Author: G1 Member 1 (Frontend & Domains)
-- Description: Create shared domain types for mobile_no, pincode, email_addr with CHECK constraints

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mobile_no') THEN
        CREATE DOMAIN mobile_no AS VARCHAR(15)
            CHECK (VALUE ~ '^[6-9][0-9]{9}$');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pincode') THEN
        CREATE DOMAIN pincode AS VARCHAR(10)
            CHECK (VALUE ~ '^[1-9][0-9]{5}$');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_addr') THEN
        CREATE DOMAIN email_addr AS citext
            CHECK (VALUE ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
    END IF;
END $$;
