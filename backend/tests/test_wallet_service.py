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