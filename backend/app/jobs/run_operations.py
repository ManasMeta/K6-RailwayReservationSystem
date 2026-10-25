"""Command line for G6's scheduled jobs.

One pass (what cron / Windows Task Scheduler should call every 15 minutes):
    python -m app.jobs.run_operations

Keep running and repeat every 15 minutes (handy for a demo, no cron needed):
    python -m app.jobs.run_operations --loop --every 15
"""

import argparse
import logging
import time

from app.jobs.operations_jobs import CHART_CUTOFF_HOURS, run_once


def main(argv=None):
    parser = argparse.ArgumentParser(description="Run G6 scheduled jobs")
    parser.add_argument("--loop", action="store_true", help="keep running instead of one pass")
    parser.add_argument("--every", type=int, default=15, help="minutes between passes with --loop")
    parser.add_argument("--cutoff-hours", type=int, default=CHART_CUTOFF_HOURS,
                        help="prepare a chart this many hours before departure")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
    while True:
        result = run_once(args.cutoff_hours)
        print(result)
        if not args.loop:
            return result
        time.sleep(args.every * 60)


if __name__ == "__main__":
    main()
