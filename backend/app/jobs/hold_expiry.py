"""Scheduled background job to release expired reservation holds every minute."""

import logging
import time

from app.modules.reservations.service import ReservationService

logger = logging.getLogger(__name__)


def run_hold_expiry_job() -> int:
    """Executes hold release check and logs result."""
    try:
        released = ReservationService.release_expired_holds()
        if released > 0:
            logger.info("Released %d expired reservation holds and restored inventory.", released)
        return released
    except Exception as exc:
        logger.error("Error during hold expiry job execution: %s", exc)
        return 0


def start_hold_expiry_loop(interval_seconds: int = 60):
    """Continuous polling loop for hold expiry background worker."""
    logger.info("Starting hold expiry worker with %ds interval...", interval_seconds)
    while True:
        run_hold_expiry_job()
        time.sleep(interval_seconds)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    start_hold_expiry_loop()
