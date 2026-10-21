#!/usr/bin/env python3
"""Database migration runner for NRRMS.
Validates migration file numbering and ranges, and executes migrations against PostgreSQL.
"""

import os
import re
import sys
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"

GROUP_RANGES = {
    "0000_platform": (0, 99),
    "0100_g1_accounts": (100, 199),
    "0200_g2_network": (200, 299),
    "0300_g3_inventory": (300, 399),
    "0400_g4_reservations": (400, 499),
    "0500_g5_wallet": (500, 599),
    "0600_g6_operations": (600, 699),
}


def get_all_migrations():
    """Collects and sorts all .sql files in migrations directory."""
    migration_files = []
    if not MIGRATIONS_DIR.exists():
        return migration_files

    for folder in sorted(MIGRATIONS_DIR.iterdir()):
        if folder.is_dir() and not folder.name.startswith("."):
            for file in sorted(folder.glob("*.sql")):
                migration_files.append((folder.name, file))
    return sorted(migration_files, key=lambda x: x[1].name)


def check_migrations():
    """Validates migration numbering, duplicates, and group range boundaries."""
    migrations = get_all_migrations()
    seen_numbers = {}
    errors = []

    for folder_name, file_path in migrations:
        filename = file_path.name
        match = re.match(r"^(\d{4})_.*\.sql$", filename)
        if not match:
            errors.append(f"Invalid migration filename format: {filename} in {folder_name}")
            continue

        num = int(match.group(1))
        if num in seen_numbers:
            errors.append(
                f"Duplicate migration number {num:04d}: {filename} and {seen_numbers[num]}"
            )
        seen_numbers[num] = filename

        # Validate range
        if folder_name in GROUP_RANGES:
            min_r, max_r = GROUP_RANGES[folder_name]
            if not (min_r <= num <= max_r):
                errors.append(
                    f"Migration {filename} (number {num:04d}) is outside allowed range "
                    f"[{min_r:04d}, {max_r:04d}] for folder '{folder_name}'"
                )

    if errors:
        print("Migration check FAILED:")
        for err in errors:
            print(f"  - {err}")
        return False

    print(f"Migration check PASSED: {len(migrations)} migrations verified cleanly.")
    return True


def run_migrations():
    """Applies migrations sequentially using psycopg / DATABASE_URL."""
    if not check_migrations():
        sys.exit(1)

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL environment variable is not set. Skipping live migration execution.")
        return

    try:
        import psycopg
    except ImportError:
        print("psycopg not installed. Run 'pip install psycopg[binary]'.")
        sys.exit(1)

    with psycopg.connect(db_url, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version VARCHAR(255) PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                """
            )
            cur.execute("SELECT version FROM schema_migrations;")
            applied = {row[0] for row in cur.fetchall()}

        for folder_name, file_path in get_all_migrations():
            filename = file_path.name
            if filename in applied:
                continue

            print(f"Applying migration: {folder_name}/{filename}")
            sql_content = file_path.read_text(encoding="utf-8")
            with conn.cursor() as cur:
                cur.execute(sql_content)
                cur.execute(
                    "INSERT INTO schema_migrations (version) VALUES (%s);",
                    (filename,),
                )
            print(f"  -> Successfully applied {filename}")

    print("All migrations are up to date.")


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "check"
    if action == "check":
        success = check_migrations()
        sys.exit(0 if success else 1)
    elif action == "up":
        run_migrations()
    else:
        print(f"Unknown command: {action}. Use 'check' or 'up'.")
        sys.exit(1)
