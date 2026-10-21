"""Load Train_details_22122017.csv into the G2 network tables.

Steps (see docs/g2-database-design.md):
1. COPY the file into staging_train_stops as text. The file is Latin-1 and
   values carry trailing spaces, so nothing is cleaned in Python.
2. SELECT import_train_details() normalises into stations, trains,
   train_stops and train_running_days, derives day_offset and truncates
   staging. Reruns are no-ops.

Usage: python db/import/load_train_details.py CSV [--limit N]
DATABASE_URL must point at a database where migrations 0201-0208 are applied.
"""
import argparse
import csv
import os
import sys
from itertools import islice

import psycopg

STAGING_COLUMNS = (
    "train_no, train_name, seq, station_code, station_name, arrival, "
    "departure, distance, source_station_code, source_station_name, "
    "destination_station_code, destination_station_name"
)
COLUMN_COUNT = 12


def read_rows(path, limit=None):
    with open(path, newline="", encoding="latin-1") as handle:
        reader = csv.reader(handle)
        next(reader, None)  # header
        for line_no, row in enumerate(islice(reader, limit), start=2):
            if len(row) != COLUMN_COUNT:
                raise ValueError(
                    f"{path}:{line_no}: expected {COLUMN_COUNT} columns, got {len(row)}"
                )
            yield row


def load(connection, path, limit=None):
    """Stage and import one CSV; returns the number of staged rows."""
    with connection.cursor() as cursor:
        cursor.execute("TRUNCATE staging_train_stops")
        with cursor.copy(
            f"COPY staging_train_stops ({STAGING_COLUMNS}) FROM STDIN"
        ) as copy:
            for row in read_rows(path, limit):
                copy.write_row(row)
        cursor.execute("SELECT import_train_details()")
        staged = cursor.fetchone()[0]
    connection.commit()
    return staged


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("csv_path")
    parser.add_argument("--limit", type=int, help="only import the first N data rows")
    args = parser.parse_args(argv)

    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL is not set")
    with psycopg.connect(url) as connection:
        staged = load(connection, args.csv_path, args.limit)
        counts = connection.execute(
            "SELECT (SELECT count(*) FROM stations),"
            " (SELECT count(*) FROM trains), (SELECT count(*) FROM train_stops)"
        ).fetchone()
    print(
        f"staged {staged} rows -> {counts[0]} stations, "
        f"{counts[1]} trains, {counts[2]} train stops"
    )


if __name__ == "__main__":
    main()
