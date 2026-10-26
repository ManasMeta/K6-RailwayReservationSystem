#!/usr/bin/env python3
"""Create (or update) the login role the API connects as, and put it in nrrms_app.

nrrms_app is a NOLOGIN group created by migration 0102; row-level security applies to it.
This makes a role that can actually sign in and grants it that group. Idempotent.

Usage:  APP_DB_USER=nrrms_api APP_DB_PASSWORD=... DATABASE_URL=<admin url> python db/create_login_role.py
Optionally APP_DB_REPORT_USER / APP_DB_REPORT_PASSWORD does the same for a reporting login.
"""
import os
import sys

import psycopg
from psycopg import sql


def ensure_login(conn, name, password, group):
    exists = conn.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (name,)).fetchone()
    verb = "ALTER" if exists else "CREATE"
    conn.execute(
        sql.SQL("{} ROLE {} LOGIN PASSWORD {}").format(
            sql.SQL(verb), sql.Identifier(name), sql.Literal(password)
        )
    )
    conn.execute(sql.SQL("GRANT {} TO {}").format(sql.Identifier(group), sql.Identifier(name)))
    print(f"login role {name} is a member of {group}")


def main():
    url = os.getenv("DATABASE_URL")
    user = os.getenv("APP_DB_USER")
    password = os.getenv("APP_DB_PASSWORD")
    if not (url and user and password):
        sys.exit("DATABASE_URL, APP_DB_USER and APP_DB_PASSWORD must be set")

    with psycopg.connect(url, autocommit=True) as conn:
        ensure_login(conn, user, password, "nrrms_app")
        report_user = os.getenv("APP_DB_REPORT_USER")
        report_password = os.getenv("APP_DB_REPORT_PASSWORD")
        if report_user and report_password:
            ensure_login(conn, report_user, report_password, "nrrms_report")


if __name__ == "__main__":
    main()
