import os
from decimal import Decimal
from uuid import uuid4

import psycopg
import pytest
from psycopg.rows import dict_row

from app.modules.wallet.service import (
    IdempotencyConflict,
    create_mock_topup,
)


@pytest.fixture
def db():
    url = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5433/nrrms",
    )
    connection = psycopg.connect(url, row_factory=dict_row)
    try:
        connection.execute(
            "SET search_path TO g5_migration_check, public"
        )
        yield connection
    finally:
        connection.rollback()
        connection.close()


def make_user(connection):
    row = connection.execute(
        "INSERT INTO users DEFAULT VALUES RETURNING user_id"
    ).fetchone()
    return row["user_id"]


def test_topup_credits_wallet_and_posts_balanced_ledger(db):
    user_id = make_user(db)
    key = f"test-{uuid4().hex}"

    result = create_mock_topup(
        db, user_id, Decimal("500.00"), key
    )

    assert result["status"] == "COMPLETED"
    assert result["amount"] == Decimal("500.00")
    assert result["balance"] == Decimal("500.00")
    assert result["simulated"] is True
    assert result["replayed"] is False

    entries = db.execute(
        """
        SELECT le.account_code, le.entry_side, le.amount, lt.status
        FROM ledger_entries le
        JOIN ledger_txns lt USING (ledger_txn_id)
        JOIN topups t USING (ledger_txn_id)
        WHERE t.idempotency_key = %s
        ORDER BY le.account_code
        """,
        (key,),
    ).fetchall()

    assert len(entries) == 2
    assert sum(
        (r["amount"] for r in entries if r["entry_side"] == "DEBIT"),
        Decimal("0"),
    ) == Decimal("500.00")
    assert sum(
        (r["amount"] for r in entries if r["entry_side"] == "CREDIT"),
        Decimal("0"),
    ) == Decimal("500.00")
    assert all(r["status"] == "POSTED" for r in entries)

    db.execute("SET CONSTRAINTS ALL IMMEDIATE")


def test_same_key_retry_does_not_credit_twice(db):
    user_id = make_user(db)
    key = f"retry-{uuid4().hex}"

    first = create_mock_topup(db, user_id, Decimal("125.00"), key)
    second = create_mock_topup(db, user_id, Decimal("125.00"), key)

    assert first["replayed"] is False
    assert second["replayed"] is True
    assert second["balance"] == Decimal("125.00")

    assert db.execute(
        "SELECT count(*) AS n FROM topups WHERE idempotency_key = %s",
        (key,),
    ).fetchone()["n"] == 1

    assert db.execute(
        "SELECT balance FROM wallets WHERE user_id = %s",
        (user_id,),
    ).fetchone()["balance"] == Decimal("125.00")

    db.execute("SET CONSTRAINTS ALL IMMEDIATE")


def test_same_key_with_different_amount_is_rejected(db):
    user_id = make_user(db)
    key = f"conflict-{uuid4().hex}"

    create_mock_topup(db, user_id, Decimal("100.00"), key)

    with pytest.raises(IdempotencyConflict):
        create_mock_topup(db, user_id, Decimal("200.00"), key)

    db.execute("SET CONSTRAINTS ALL IMMEDIATE")


def test_database_failure_can_be_rolled_back(db):
    user_id = make_user(db)
    key = f"rollback-{uuid4().hex}"

    # Seed a conflicting ledger key. The top-up insert will happen first,
    # then the ledger insert will fail on its unique idempotency constraint.
    db.execute(
        """
        INSERT INTO ledger_txns (
            txn_type, reference_type, reference_id,
            idempotency_key, status, description
        )
        VALUES ('TOPUP', 'TEST', %s, %s, 'PENDING', 'Rollback test')
        """,
        (uuid4().hex, key),
    )
    db.commit()

    try:
        with pytest.raises(psycopg.errors.UniqueViolation):
            create_mock_topup(db, user_id, Decimal("75.00"), key)

        db.rollback()

        assert db.execute(
            "SELECT count(*) AS n FROM topups WHERE idempotency_key = %s",
            (key,),
        ).fetchone()["n"] == 0

        wallet = db.execute(
            "SELECT balance FROM wallets WHERE user_id = %s",
            (user_id,),
        ).fetchone()
        assert wallet is None or wallet["balance"] == Decimal("0.00")

    finally:
        db.rollback()
        db.execute(
            "DELETE FROM ledger_txns WHERE idempotency_key = %s AND status = 'PENDING'",
            (key,),
        )
        db.commit()
