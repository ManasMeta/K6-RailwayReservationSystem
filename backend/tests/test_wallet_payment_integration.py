"""Payment, refund, ticket and statement flows against a real PostgreSQL 16.

Runs on the fully migrated database (G1 users, G4 reservations, G5 wallet) with the CI
sample timetable loaded (train 12301, HWH -> NDLS). Skipped when no database is reachable.
"""
import os
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from uuid import uuid4

import psycopg
import pytest
from psycopg.rows import dict_row

from app.modules.wallet.service import (
    InsufficientFunds,
    ReservationNotFound,
    ReservationNotPayable,
    TicketNotFound,
    create_mock_topup,
    get_payment_quote,
    get_refunds,
    get_ticket,
    get_wallet_transactions,
    pay_reservation,
)
from app.modules.wallet.ticket_pdf import render_ticket_pdf

URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5433/nrrms")


def connect():
    return psycopg.connect(URL, row_factory=dict_row, connect_timeout=3)


@pytest.fixture
def db():
    try:
        connection = connect()
        ready = connection.execute("SELECT to_regproc('pay_reservation') IS NOT NULL").fetchone()
    except psycopg.Error:
        pytest.skip("G5 schema is not available")
    if not next(iter(ready.values())):
        pytest.skip("G5 payment migrations are not applied")
    try:
        yield connection
    finally:
        connection.rollback()
        connection.close()


def make_user(connection):
    return connection.execute(
        "INSERT INTO users (email, password_hash, full_name) VALUES (%s, 'x', 'Wallet Test') RETURNING user_id",
        (f"wallet-{uuid4().hex}@example.com",),
    ).fetchone()["user_id"]


def make_reservation(connection, user_id, fare="400.00", hours=72, status="PENDING_PAYMENT"):
    pnr = str(uuid4().int)[:10]
    connection.execute(
        """
        INSERT INTO reservations (pnr, user_id, train_no, run_date, from_station_code, to_station_code,
                                  from_seq, to_seq, class_code, quota_code, total_fare, status, departure_at)
        VALUES (%s, %s, '12301', current_date + 5, 'HWH', 'NDLS', 1, 4, '3A', 'GN', %s, %s,
                now() + make_interval(hours => %s))
        """,
        (pnr, user_id, Decimal(fare), status, hours),
    )
    return pnr


def cancel(connection, pnr, fare="400.00"):
    """Cancel one passenger of the reservation, which fires G5's refund trigger."""
    reservation_id = connection.execute(
        "SELECT reservation_id FROM reservations WHERE pnr = %s", (pnr,)
    ).fetchone()["reservation_id"]
    passenger_id = connection.execute(
        """
        INSERT INTO reservation_passengers (reservation_id, passenger_name, age, gender, fare,
                                            booking_status, current_status)
        VALUES (%s, 'Test Passenger', 30, 'Male', %s, 'CNF', 'CNF') RETURNING passenger_id
        """,
        (reservation_id, Decimal(fare)),
    ).fetchone()["passenger_id"]
    connection.execute(
        "INSERT INTO cancellations (reservation_id, passenger_id) VALUES (%s, %s)",
        (reservation_id, passenger_id),
    )


def fund(connection, user_id, amount):
    create_mock_topup(connection, user_id, Decimal(amount), f"fund-{uuid4().hex}")


def test_payment_debits_wallet_confirms_reservation_and_issues_ticket(db):
    user = make_user(db)
    fund(db, user, "1000.00")
    pnr = make_reservation(db, user)

    result = pay_reservation(db, user, pnr)

    assert result["amount"] == Decimal("400.00")
    assert result["balance"] == Decimal("600.00")
    assert result["replayed"] is False
    assert result["ticket_number"] == f"YTR-{pnr}"
    assert db.execute("SELECT status FROM reservations WHERE pnr = %s", (pnr,)).fetchone()[
        "status"
    ] == "CONFIRMED"
    ticket = get_ticket(db, user, pnr)
    assert ticket["amount"] == Decimal("400.00")
    assert render_ticket_pdf(ticket).startswith(b"%PDF")
    db.execute("SET CONSTRAINTS ALL IMMEDIATE")  # ledger balances


def test_retry_returns_original_payment_without_charging_again(db):
    user = make_user(db)
    fund(db, user, "1000.00")
    pnr = make_reservation(db, user)

    first = pay_reservation(db, user, pnr, "retry-key-1")
    second = pay_reservation(db, user, pnr, "retry-key-1")

    assert second["replayed"] is True
    assert second["payment_id"] == first["payment_id"]
    assert second["balance"] == Decimal("600.00")


def test_insufficient_funds_changes_nothing(db):
    user = make_user(db)
    fund(db, user, "100.00")
    pnr = make_reservation(db, user, fare="400.00")

    # transaction() is a savepoint, so the setup rows survive the failure
    with pytest.raises(InsufficientFunds, match="Insufficient wallet balance"), db.transaction():
        pay_reservation(db, user, pnr)

    assert get_payment_quote(db, user, pnr)["status"] == "PENDING_PAYMENT"
    assert db.execute("SELECT count(*) AS n FROM payments WHERE pnr = %s", (pnr,)).fetchone()["n"] == 0


def test_cannot_pay_someone_elses_reservation_or_a_confirmed_one(db):
    owner, other = make_user(db), make_user(db)
    fund(db, other, "1000.00")
    pnr = make_reservation(db, owner)
    confirmed = make_reservation(db, other, status="CONFIRMED")

    with pytest.raises(ReservationNotFound), db.transaction():
        pay_reservation(db, other, pnr)
    with pytest.raises(ReservationNotFound):
        get_payment_quote(db, other, pnr)
    with pytest.raises(ReservationNotPayable), db.transaction():
        pay_reservation(db, other, confirmed)


def test_refund_after_cancellation_appears_in_refunds_and_statement(db):
    user = make_user(db)
    fund(db, user, "1000.00")
    pnr = make_reservation(db, user, fare="400.00", hours=30)
    pay_reservation(db, user, pnr)

    cancel(db, pnr, "400.00")

    refunds = get_refunds(db, user)
    assert refunds["total"] == 1
    assert refunds["items"][0]["amount"] == Decimal("300.00")  # 75% tier
    history = get_wallet_transactions(db, user)
    assert [(i["type"], i["direction"], i["balance_after"]) for i in history["items"]] == [
        ("REFUND", "CREDIT", Decimal("900.00")),
        ("PAYMENT", "DEBIT", Decimal("600.00")),
        ("TOPUP", "CREDIT", Decimal("1000.00")),
    ]
    db.execute("SET CONSTRAINTS ALL IMMEDIATE")


def test_other_users_see_no_refunds_and_no_ticket(db):
    user, other = make_user(db), make_user(db)
    fund(db, user, "1000.00")
    pnr = make_reservation(db, user)
    pay_reservation(db, user, pnr)

    assert get_refunds(db, other)["total"] == 0
    with pytest.raises(TicketNotFound):
        get_ticket(db, other, pnr)


def test_parallel_payments_of_one_pnr_charge_once():
    setup = connect()
    user = make_user(setup)
    fund(setup, user, "1000.00")
    pnr = make_reservation(setup, user)
    setup.commit()

    def attempt(_):
        connection = connect()
        try:
            result = pay_reservation(connection, user, pnr)
            connection.commit()
            return result["replayed"]
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=4) as pool:
        replayed = list(pool.map(attempt, range(4)))

    balance = setup.execute("SELECT balance FROM wallets WHERE user_id = %s", (user,)).fetchone()
    setup.close()
    assert replayed.count(False) == 1
    assert balance["balance"] == Decimal("600.00")
