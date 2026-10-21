from decimal import Decimal

from psycopg import Connection

MAX_AMOUNT = Decimal("99999999.99")


class IdempotencyConflict(Exception):
    """An idempotency key was reused with different request details."""


def fetch_wallet(connection: Connection, user_id: int) -> dict | None:
    row = connection.execute(
        """
        SELECT wallet_id, balance, currency, created_at, updated_at
        FROM wallets WHERE user_id = %s
        """,
        (user_id,),
    ).fetchone()

    if row is None:
        return None

    return {
        "wallet_id": row["wallet_id"],
        "balance": Decimal(row["balance"]),
        "currency": row["currency"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def get_or_create_wallet(connection: Connection, user_id: int) -> dict:
    connection.execute(
        """
        INSERT INTO wallets (user_id)
        VALUES (%s)
        ON CONFLICT (user_id) DO NOTHING
        """,
        (user_id,),
    )

    wallet = fetch_wallet(connection, user_id)
    if wallet is None:
        raise RuntimeError("Wallet could not be created or retrieved")

    return wallet


def create_mock_topup(
    connection: Connection,
    user_id: int,
    amount: Decimal,
    idempotency_key: str,
) -> dict:
    if not amount.is_finite() or amount <= 0 or amount > MAX_AMOUNT:
        raise ValueError("Amount must be between 0.01 and 99999999.99 INR")

    amount = amount.quantize(Decimal("0.01"))

    connection.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
        (idempotency_key,),
    )

    existing = connection.execute(
        """
        SELECT t.topup_id, t.wallet_id, t.amount, t.status,
               t.provider_reference, w.user_id, w.balance, w.currency
        FROM topups t
        JOIN wallets w ON w.wallet_id = t.wallet_id
        WHERE t.idempotency_key = %s
        """,
        (idempotency_key,),
    ).fetchone()

    if existing is not None:
        if (
            existing["user_id"] != user_id
            or Decimal(existing["amount"]) != amount
        ):
            raise IdempotencyConflict(
                "Idempotency key was already used with different request details"
            )

        return {
            "topup_id": existing["topup_id"],
            "wallet_id": existing["wallet_id"],
            "amount": Decimal(existing["amount"]),
            "status": existing["status"],
            "provider_reference": existing["provider_reference"],
            "balance": Decimal(existing["balance"]),
            "currency": existing["currency"],
            "simulated": True,
            "replayed": True,
        }

    connection.execute(
        """
        INSERT INTO wallets (user_id)
        VALUES (%s)
        ON CONFLICT (user_id) DO NOTHING
        """,
        (user_id,),
    )

    wallet = connection.execute(
        """
        SELECT wallet_id, balance, currency
        FROM wallets WHERE user_id = %s FOR UPDATE
        """,
        (user_id,),
    ).fetchone()

    if wallet is None:
        raise RuntimeError("User wallet could not be initialized")

    if wallet["currency"] != "INR":
        raise ValueError("Only INR wallets are supported")

    topup = connection.execute(
        """
        INSERT INTO topups (
            wallet_id, idempotency_key, amount, status, provider_reference
        )
        VALUES (%s, %s, %s, 'PENDING', %s)
        RETURNING topup_id
        """,
        (
            wallet["wallet_id"],
            idempotency_key,
            amount,
            f"MOCK-UPI-{idempotency_key[:24]}",
        ),
    ).fetchone()

    topup_id = topup["topup_id"]

    ledger = connection.execute(
        """
        INSERT INTO ledger_txns (
            txn_type, reference_type, reference_id,
            idempotency_key, status, description
        )
        VALUES ('TOPUP', 'TOPUP', %s, %s, 'PENDING', %s)
        RETURNING ledger_txn_id
        """,
        (str(topup_id), idempotency_key, "Simulated UPI wallet top-up"),
    ).fetchone()

    ledger_txn_id = ledger["ledger_txn_id"]

    connection.execute(
        """
        INSERT INTO ledger_entries (
            ledger_txn_id, account_code, entry_side, amount
        )
        VALUES
            (%s, 'RAILWAY_CLEARING', 'DEBIT', %s),
            (%s, 'CUSTOMER_WALLET', 'CREDIT', %s)
        """,
        (ledger_txn_id, amount, ledger_txn_id, amount),
    )

    connection.execute(
        "UPDATE wallets SET balance = balance + %s WHERE wallet_id = %s",
        (amount, wallet["wallet_id"]),
    )

    connection.execute(
        "UPDATE ledger_txns SET status = 'POSTED' WHERE ledger_txn_id = %s",
        (ledger_txn_id,),
    )

    connection.execute(
        """
        UPDATE topups
        SET ledger_txn_id = %s, status = 'COMPLETED'
        WHERE topup_id = %s
        """,
        (ledger_txn_id, topup_id),
    )

    updated = connection.execute(
        "SELECT balance, currency FROM wallets WHERE wallet_id = %s",
        (wallet["wallet_id"],),
    ).fetchone()

    return {
        "topup_id": topup_id,
        "wallet_id": wallet["wallet_id"],
        "amount": amount,
        "status": "COMPLETED",
        "provider_reference": f"MOCK-UPI-{idempotency_key[:24]}",
        "balance": Decimal(updated["balance"]),
        "currency": updated["currency"],
        "simulated": True,
        "replayed": False,
    }
