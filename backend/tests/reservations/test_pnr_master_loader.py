"""G4 PNR_Master loader (db/import/load_pnr_master.py).

Reader tests use small generated workbooks. The load tests book on the CI sample train 12301
(HWH 1 -> DDU 2 -> CNB 3 -> NDLS 4) through book_tickets() and pay_reservation(), then roll
back; they are skipped when no database is reachable.
"""
import os
import sys
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

import openpyxl
import psycopg
import pytest
from psycopg.rows import dict_row, tuple_row

from app.modules.wallet.service import create_mock_topup

IMPORT_DIR = Path(__file__).resolve().parents[3] / "db" / "import"
sys.path.insert(0, str(IMPORT_DIR))

import load_pnr_master  # noqa: E402  (path is added just above)

HEADER = ["PNR No", "Train No", "Journey Date", "From", "To", "Class", "Quota",
          "Passenger Name", "Age", "Gender", "Booking Status"]


def make_workbook(tmp_path, rows, header=HEADER):
    workbook = openpyxl.Workbook()
    workbook.active.title = "Lookup_Tables"
    sheet = workbook.create_sheet("PNR_Master")
    sheet.append(header)
    for row in rows:
        sheet.append(row)
    path = tmp_path / "book.xlsx"
    workbook.save(path)
    return path


def test_groups_passenger_rows_by_pnr(tmp_path):
    path = make_workbook(tmp_path, [
        [4512345678, "12301", datetime(2017, 12, 22), "hwh", "ndls", "3A", "Tatkal", "Asha Rao", 34, "F", "CNF"],
        [4512345678, "12301", datetime(2017, 12, 22), "HWH", "NDLS", "3A", "Tatkal", "Ravi Rao", 36, "M", "CNF"],
        ["123-456", "'12420'", "23-12-2017", "CNB", "LKO", "SL", "GN", "Meena", None, "female", "CAN"],
    ])

    first, second = load_pnr_master.read_bookings(path)

    assert first["pnr"] == "4512345678"
    assert (first["train_no"], first["from"], first["to"], first["quota"]) == ("12301", "HWH", "NDLS", "Tatkal")
    assert first["run_date"] == date(2017, 12, 22)
    assert [p["passenger_name"] for p in first["passengers"]] == ["Asha Rao", "Ravi Rao"]
    assert first["passengers"][0]["gender"] == "Female"
    # a short PNR is padded to 10 digits behind an 8; quotes around the train number go
    assert second["pnr"] == "8000123456" and second["train_no"] == "12420"
    assert second["run_date"] == date(2017, 12, 23)
    assert second["status"] == "CAN"
    assert second["passengers"][0]["age"] == 30  # blank age gets a default


def test_passenger_count_column_without_names(tmp_path):
    header = ["PNR", "Train Number", "Date", "From Station", "To Station", "Class", "No of Passengers"]
    path = make_workbook(tmp_path, [[1000000001, 12301, "2017-12-22", "HWH", "CNB", "SL", 3]], header)

    (booking,) = load_pnr_master.read_bookings(path)

    assert len(booking["passengers"]) == 3
    assert booking["quota"] == "GN"


def test_missing_columns_are_reported(tmp_path):
    path = make_workbook(tmp_path, [], header=["PNR", "Passenger Name"])
    with pytest.raises(ValueError, match="no column for train_no"):
        load_pnr_master.read_bookings(path)


def test_rebase_moves_the_earliest_journey_to_tomorrow():
    bookings = [{"run_date": date(2017, 12, 25)}, {"run_date": date(2017, 12, 22)}, {"run_date": None}]

    load_pnr_master.rebase_dates(bookings, today=date(2026, 10, 26))

    assert [b["run_date"] for b in bookings] == [date(2026, 10, 30), date(2026, 10, 27), None]


@pytest.fixture
def db():
    url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5433/nrrms")
    try:
        connection = psycopg.connect(url, connect_timeout=3)
        ready = connection.execute(
            "SELECT to_regproc('pay_reservation') IS NOT NULL"
            " AND EXISTS (SELECT 1 FROM trains WHERE train_no = '12301')"
        ).fetchone()[0]
    except psycopg.Error:
        pytest.skip("database is not reachable")
    if not ready:
        connection.close()
        pytest.skip("migrations or the sample timetable are not loaded")
    try:
        yield connection
    finally:
        connection.rollback()
        connection.close()


def make_user_with_money(connection, amount=Decimal("50000.00")):
    email = f"pnr-master-{uuid4().hex}@example.com"
    user_id = connection.execute(
        "INSERT INTO users (email, password_hash, full_name) VALUES (%s, 'x', 'PNR Master') RETURNING user_id",
        (email,),
    ).fetchone()[0]
    connection.row_factory = dict_row  # the wallet service reads rows by column name
    try:
        create_mock_topup(connection, user_id, amount, f"seed-{uuid4().hex}")
    finally:
        connection.row_factory = tuple_row
    return email, user_id


def booking(pnr, status="CNF", train_no="12301", origin="HWH", destination="NDLS", n=2):
    return {
        "pnr": pnr, "train_no": train_no, "run_date": date.today() + timedelta(days=5), "from": origin, "to": destination,
        "class_code": "3A", "quota": "General", "status": status, "email": None,
        "passengers": [{"passenger_name": f"P{i}", "age": 30, "gender": "Male"} for i in range(n)],
    }


def test_load_books_pays_and_cancels_through_the_engine(db):
    email, user_id = make_user_with_money(db)
    pnr_ok, pnr_cancel, pnr_bad = (str(uuid4().int)[:9].rjust(10, "7") for _ in range(3))
    bookings = [
        booking(pnr_ok),
        booking(pnr_cancel, status="CAN", n=1),
        booking(pnr_bad, origin="NDLS", destination="HWH"),  # 12301 never runs this way
    ]

    booked, existing, skipped = load_pnr_master.load(db, bookings, default_email=email, pay=True)

    assert booked == [pnr_ok, pnr_cancel] and existing == []
    assert [pnr for pnr, _ in skipped] == [pnr_bad] and "does not run" in skipped[0][1]
    status, quota, seats = db.execute(
        "SELECT r.status, r.quota_code, count(rp.berth_id) FROM reservations r"
        " JOIN reservation_passengers rp USING (reservation_id) WHERE r.pnr = %s GROUP BY 1, 2",
        (pnr_ok,),
    ).fetchone()
    assert (status, quota, seats) == ("CONFIRMED", "GN", 2)
    assert db.execute("SELECT status FROM reservations WHERE pnr = %s", (pnr_cancel,)).fetchone()[0] == "CANCELLED"
    assert db.execute("SELECT count(*) FROM refunds WHERE pnr = %s", (pnr_cancel,)).fetchone()[0] == 1

    # a rerun books nothing new
    booked, existing, skipped = load_pnr_master.load(db, bookings, default_email=email, pay=True)
    assert booked == [] and existing == [pnr_ok, pnr_cancel]


def test_load_reports_an_unknown_owner(db):
    booked, _, skipped = load_pnr_master.load(db, [booking("7123456789")], default_email=None)

    assert booked == []
    assert skipped[0][0] == "7123456789" and "pass --user" in skipped[0][1]
