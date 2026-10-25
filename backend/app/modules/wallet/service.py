from decimal import Decimal

import psycopg
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
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING topup_id
        """,
        (
            wallet["wallet_id"],
            idempotency_key,
            amount,
            f"MOCK-UPI-{idempotency_key[:24]}",
        ),
    ).fetchone()

    if topup is None:
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
        raise RuntimeError("Concurrent topup conflict could not be resolved")

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



_KIND_REFERENCE_TYPE = {
    "TOPUP": "TOPUP",
    "PAYMENT": "RESERVATION",
    "REFUND": "CANCELLATION",
}


def get_wallet_transactions(
    connection: Connection,
    user_id: int,
    limit: int = 20,
    offset: int = 0,
) -> dict:
    """Paginated statement (newest first) with the running balance after each row."""
    if not 1 <= limit <= 100:
        raise ValueError("Limit must be between 1 and 100")
    if offset < 0:
        raise ValueError("Offset cannot be negative")

    wallet = connection.execute(
        "SELECT wallet_id FROM wallets WHERE user_id = %s",
        (user_id,),
    ).fetchone()

    if wallet is None:
        return {"items": [], "limit": limit, "offset": offset, "total": 0}

    wallet_id = wallet["wallet_id"]

    total_row = connection.execute(
        "SELECT COUNT(*) AS total FROM v_wallet_statement WHERE wallet_id = %s",
        (wallet_id,),
    ).fetchone()

    rows = connection.execute(
        """
        SELECT ledger_txn_id, kind, reference_id, description,
               signed_amount, posted_at, balance_after
        FROM v_wallet_statement
        WHERE wallet_id = %s
        ORDER BY posted_at DESC, ledger_txn_id DESC
        LIMIT %s OFFSET %s
        """,
        (wallet_id, limit, offset),
    ).fetchall()

    items = []
    for row in rows:
        signed = Decimal(row["signed_amount"])
        items.append({
            "ledger_txn_id": row["ledger_txn_id"],
            "type": row["kind"],
            "reference_type": _KIND_REFERENCE_TYPE[row["kind"]],
            "reference_id": row["reference_id"],
            "status": "POSTED",
            "description": row["description"],
            "amount": abs(signed),
            "direction": "CREDIT" if signed > 0 else "DEBIT",
            "balance_after": Decimal(row["balance_after"]),
            "created_at": row["posted_at"],
        })

    return {
        "items": items,
        "limit": limit,
        "offset": offset,
        "total": total_row["total"],
    }


class ReservationNotFound(Exception):
    """The PNR does not exist or belongs to someone else."""


class ReservationNotPayable(Exception):
    """The reservation is not waiting for payment."""


class InsufficientFunds(Exception):
    """The wallet balance is lower than the reservation fare."""


class TicketNotFound(Exception):
    """No e-ticket was issued for this PNR and user."""


_PAY_ERRORS = {
    "NR001": InsufficientFunds,
    "NR002": ReservationNotFound,
    "NR003": ReservationNotPayable,
}


def pay_reservation(
    connection: Connection,
    user_id: int,
    pnr: str,
    idempotency_key: str | None = None,
) -> dict:
    """Pay a PENDING_PAYMENT reservation from the wallet (all work is in pay_reservation())."""
    try:
        row = connection.execute(
            "SELECT * FROM pay_reservation(%s, %s, %s)",
            (user_id, pnr, idempotency_key),
        ).fetchone()
    except psycopg.Error as exc:
        error = _PAY_ERRORS.get(getattr(exc, "sqlstate", None))
        if error is None:
            raise
        message = exc.diag.message_primary or str(exc)
        if error is InsufficientFunds and exc.diag.message_detail:
            message = f"{message} ({exc.diag.message_detail})"
        raise error(message) from exc

    return {
        "payment_id": row["o_payment_id"],
        "pnr": row["o_pnr"],
        "amount": Decimal(row["o_amount"]),
        "balance": Decimal(row["o_balance"]),
        "ticket_number": row["o_ticket_number"],
        "replayed": row["o_replayed"],
    }


def get_payment_quote(connection: Connection, user_id: int, pnr: str) -> dict:
    """What the user would pay for a reservation of theirs (G4 owns reservations)."""
    row = connection.execute(
        """
        SELECT r.pnr, r.total_fare, r.status,
               COALESCE(w.balance, 0) AS balance
        FROM reservations r
        LEFT JOIN wallets w ON w.user_id = r.user_id
        WHERE r.pnr = %s AND r.user_id = %s
        """,
        (pnr, user_id),
    ).fetchone()
    if row is None:
        raise ReservationNotFound(f"Reservation {pnr} was not found")

    return {
        "pnr": row["pnr"],
        "amount": Decimal(row["total_fare"]),
        "status": row["status"],
        "balance": Decimal(row["balance"]),
        "payable": row["status"] == "PENDING_PAYMENT",
    }


def get_refunds(
    connection: Connection,
    user_id: int,
    limit: int = 20,
    offset: int = 0,
) -> dict:
    if not 1 <= limit <= 100:
        raise ValueError("Limit must be between 1 and 100")
    if offset < 0:
        raise ValueError("Offset cannot be negative")

    total = connection.execute(
        """
        SELECT COUNT(*) AS total
        FROM refunds r JOIN wallets w ON w.wallet_id = r.wallet_id
        WHERE w.user_id = %s
        """,
        (user_id,),
    ).fetchone()["total"]

    rows = connection.execute(
        """
        SELECT r.refund_id, r.pnr, r.amount, r.reason, r.status, r.created_at
        FROM refunds r JOIN wallets w ON w.wallet_id = r.wallet_id
        WHERE w.user_id = %s
        ORDER BY r.created_at DESC, r.refund_id DESC
        LIMIT %s OFFSET %s
        """,
        (user_id, limit, offset),
    ).fetchall()

    return {
        "items": [
            {**row, "amount": Decimal(row["amount"])} for row in rows
        ],
        "limit": limit,
        "offset": offset,
        "total": total,
    }


def get_ticket(connection: Connection, user_id: int, pnr: str) -> dict:
    """The user's e-ticket for a paid PNR; other users' PNRs look like missing ones."""
    row = connection.execute(
        """
        SELECT t.pnr, t.ticket_number, t.qr_payload, t.issued_at, p.amount
        FROM e_tickets t
        JOIN payments p ON p.pnr = t.pnr
        JOIN wallets w ON w.wallet_id = p.wallet_id
        WHERE t.pnr = %s AND w.user_id = %s
        """,
        (pnr, user_id),
    ).fetchone()
    if row is None:
        raise TicketNotFound(f"No e-ticket found for PNR {pnr}")

    return {**row, "amount": Decimal(row["amount"])}
