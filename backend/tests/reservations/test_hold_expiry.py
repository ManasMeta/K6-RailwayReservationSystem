"""Tests for hold expiry background job logic."""

from unittest.mock import patch

from app.jobs.hold_expiry import run_hold_expiry_job
from app.modules.reservations.service import ReservationService


def test_hold_expiry_job_execution():
    with patch.object(ReservationService, "release_expired_holds", return_value=3) as mock_release:
        released = run_hold_expiry_job()
        assert released == 3
        mock_release.assert_called_once()


def test_hold_expiry_job_handles_exceptions():
    with patch.object(ReservationService, "release_expired_holds", side_effect=Exception("Database error")):
        released = run_hold_expiry_job()
        assert released == 0
