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
