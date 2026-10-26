"""Generate coaches and berths for trains that have none (G3).

Coaches and berths are generated per train from train_consist, not imported. This calls
generate_train_consist_coaches(train_id) for every train without coaches; a train with no
train_consist rows gets the default make-up (2 x 2A, 4 x 3A, 6 x SL). Reruns are no-ops.

Usage: python db/import/generate_inventory.py [--limit N]
DATABASE_URL must point at a migrated database with the timetable already imported.
"""
import argparse
import os
import sys

import psycopg


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--limit", type=int, help="generate for at most N trains")
    args = parser.parse_args(argv)

    url = os.getenv("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL is not set")

    query = """
        SELECT t.train_id FROM trains t
         WHERE NOT EXISTS (SELECT 1 FROM coaches c WHERE c.train_id = t.train_id)
         ORDER BY t.train_id
    """
    params = ()
    if args.limit:
        query += " LIMIT %s"
        params = (args.limit,)

    with psycopg.connect(url) as conn:
        train_ids = [row[0] for row in conn.execute(query, params).fetchall()]
        coaches = 0
        for train_id in train_ids:
            coaches += conn.execute(
                "SELECT generate_train_consist_coaches(%s)", (train_id,)
            ).fetchone()[0]
            conn.commit()  # one train per transaction keeps a failure from losing the rest
        berths = conn.execute("SELECT count(*) FROM berths").fetchone()[0]
    print(f"generated {coaches} coaches for {len(train_ids)} trains ({berths} berths in total)")


if __name__ == "__main__":
    main()
