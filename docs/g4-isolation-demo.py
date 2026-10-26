"""Two-session demonstration: READ COMMITTED vs REPEATABLE READ on a berth sale (G4).

    DATABASE_URL=postgresql://... python docs/g4-isolation-demo.py

Needs a migrated database with generated coaches (db/import/generate_inventory.py). It books
and then removes a row in berth_allocations on a date far in the future.
"""
import os

import psycopg

URL = os.environ["DATABASE_URL"]
DAY = "2031-01-15"

setup = psycopg.connect(URL, autocommit=True)
berth = setup.execute(
    """SELECT b.berth_id FROM berths b JOIN coaches c USING (coach_id) JOIN trains t USING (train_id)
        WHERE c.class_code = '3A' ORDER BY b.berth_id LIMIT 1"""
).fetchone()[0]
setup.execute("DELETE FROM berth_allocations WHERE berth_id = %s AND run_date = %s", (berth, DAY))


def count(conn):
    return conn.execute(
        "SELECT count(*) FROM berth_allocations WHERE berth_id = %s AND run_date = %s", (berth, DAY)
    ).fetchone()[0]


for level in ("READ COMMITTED", "REPEATABLE READ"):
    a = psycopg.connect(URL, autocommit=True)
    b = psycopg.connect(URL)
    a.execute(f"BEGIN ISOLATION LEVEL {level}")
    first = count(a)

    # session B sells stops [1,3) of the berth and commits
    b.execute(
        "INSERT INTO berth_allocations (berth_id, run_date, stops) VALUES (%s, %s, int4range(1, 3))",
        (berth, DAY),
    )
    b.commit()

    second = count(a)
    try:
        # session A now tries to sell the overlapping stops [2,4)
        a.execute(
            "INSERT INTO berth_allocations (berth_id, run_date, stops) VALUES (%s, %s, int4range(2, 4))",
            (berth, DAY),
        )
        outcome = "second sale ACCEPTED (double sale)"
    except psycopg.Error as error:
        outcome = f"second sale rejected: {type(error).__name__} (SQLSTATE {error.sqlstate})"
    a.execute("ROLLBACK")
    print(f"{level:16} A sees {first}, then after B commits sees {second}; {outcome}")
    setup.execute("DELETE FROM berth_allocations WHERE berth_id = %s AND run_date = %s", (berth, DAY))
    a.close()
    b.close()
