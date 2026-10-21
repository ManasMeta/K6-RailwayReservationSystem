from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock

from app.modules.wallet.service import fetch_wallet


def test_fetch_wallet_returns_wallet_data():
    connection = MagicMock()
    now = datetime.now(timezone.utc)
    connection.execute.return_value.fetchone.return_value = {
        "wallet_id": 7,
        "balance": Decimal("500.00"),
        "currency": "INR",
        "created_at": now,
        "updated_at": now,
    }

    result = fetch_wallet(connection, 42)

    assert result is not None
    assert result["wallet_id"] == 7
    assert result["balance"] == Decimal("500.00")
    assert result["currency"] == "INR"
    connection.execute.assert_called_once()
    args = connection.execute.call_args.args
    assert "WHERE user_id = %s" in args[0]
    assert args[1] == (42,)


def test_fetch_wallet_returns_none_when_missing():
    connection = MagicMock()
    connection.execute.return_value.fetchone.return_value = None

    result = fetch_wallet(connection, 42)

    assert result is None
    args = connection.execute.call_args.args
    assert args[1] == (42,)


def test_wallet_transactions_returns_empty_when_wallet_missing():
    from app.modules.wallet.service import get_wallet_transactions

    connection = MagicMock()
    connection.execute.return_value.fetchone.return_value = None

    result = get_wallet_transactions(connection, 42)

    assert result == {
        "items": [],
        "limit": 20,
        "offset": 0,
        "total": 0,
    }
    connection.execute.assert_called_once()
    assert connection.execute.call_args.args[1] == (42,)


def test_wallet_transactions_rejects_invalid_limit():
    import pytest

    from app.modules.wallet.service import get_wallet_transactions

    connection = MagicMock()

    with pytest.raises(ValueError, match="Limit must be between 1 and 100"):
        get_wallet_transactions(connection, 42, limit=101)

    connection.execute.assert_not_called()


def test_wallet_transactions_rejects_negative_offset():
    import pytest

    from app.modules.wallet.service import get_wallet_transactions

    connection = MagicMock()

    with pytest.raises(ValueError, match="Offset cannot be negative"):
        get_wallet_transactions(connection, 42, offset=-1)

    connection.execute.assert_not_called()


def test_create_mock_topup_replays_existing_transaction():
    from app.modules.wallet.service import create_mock_topup

    connection = MagicMock()
    # First query is advisory lock, second is checking existing topup
    connection.execute.return_value.fetchone.return_value = {
        "topup_id": 10,
        "wallet_id": 5,
        "amount": Decimal("250.00"),
        "status": "COMPLETED",
        "provider_reference": "MOCK-UPI-12345678",
        "user_id": 42,
        "balance": Decimal("500.00"),
        "currency": "INR",
    }

    result = create_mock_topup(connection, 42, Decimal("250.00"), "idemp-key-1234")

    assert result["replayed"] is True
    assert result["topup_id"] == 10
    assert result["amount"] == Decimal("250.00")
    assert result["balance"] == Decimal("500.00")


def test_create_mock_topup_raises_conflict_on_mismatched_amount():
    import pytest
    from app.modules.wallet.service import IdempotencyConflict, create_mock_topup

    connection = MagicMock()
    connection.execute.return_value.fetchone.return_value = {
        "topup_id": 10,
        "wallet_id": 5,
        "amount": Decimal("100.00"),  # existing is 100, but request is 250
        "status": "COMPLETED",
        "provider_reference": "MOCK-UPI-12345678",
        "user_id": 42,
        "balance": Decimal("500.00"),
        "currency": "INR",
    }

    with pytest.raises(IdempotencyConflict, match="different request details"):
        create_mock_topup(connection, 42, Decimal("250.00"), "idemp-key-1234")