"""G3 workbook loader (db/import/load_workbook.py): reading the sheets, and upserting them.

The reader tests build small workbooks in the layout the loader expects. The load tests run
against the migrated database and roll back; they are skipped when no database is reachable.
"""
import os
import sys
from decimal import Decimal
from pathlib import Path

import openpyxl
import psycopg
import pytest

IMPORT_DIR = Path(__file__).resolve().parents[3] / "db" / "import"
sys.path.insert(0, str(IMPORT_DIR))

import load_workbook  # noqa: E402  (path is added just above)


def make_workbook(tmp_path, lookups, fares):
    workbook = openpyxl.Workbook()
    workbook.active.title = "Lookup_Tables"
    for row in lookups:
        workbook.active.append(row)
    sheet = workbook.create_sheet("Fare_Matrix")
    for row in fares:
        sheet.append(row)
    path = tmp_path / "book.xlsx"
    workbook.save(path)
    return path


# Classes and quotas side by side, concessions stacked under them with no blank row.
LOOKUPS = [
    ["Class Code", "Class Name", "AC", None, "Quota Code", "Quota Name"],
    ["sl", "Sleeper", "No", None, "GN", "General"],
    ["3E", "AC 3 Economy", "Yes", None, "tq", "Tatkal"],
    ["2S", None, None, None, "PT", "Premium Tatkal"],
    [None, None, None, None, None, None],
    ["Concession Type", "Discount %", "Min Age", "Max Age", "Gender", "Description"],
    ["Senior Citizen (Female)", "50%", 58, None, "F", "Women aged 58 and over"],
    ["Divyangjan", 75, None, None, None, None],
]

LONG_FARES = [
    ["Class", "From KM", "To KM", "Base Fare", "Rate per KM", "Reservation Fee"],
    ["SL", 0, 300, 120, 0.45, 20],
    ["3E", 0, 500, 400, "1.10", None],
]

WIDE_FARES = [
    ["From KM", "To KM", "SL", "3A"],
    [301, 1000, 0.40, 1.15],
    [0, 300, 0.50, 1.25],
]


def test_reads_classes_quotas_and_concessions(tmp_path):
    data = load_workbook.read_workbook(make_workbook(tmp_path, LOOKUPS, LONG_FARES))

    assert data["classes"] == [
        {"class_code": "SL", "name": "Sleeper", "has_ac": False, "base_multiplier": None},
        {"class_code": "3E", "name": "AC 3 Economy", "has_ac": True, "base_multiplier": None},
        # blank name and AC cells: an existing row keeps its values
        {"class_code": "2S", "name": None, "has_ac": None, "base_multiplier": None},
    ]
    assert [q["quota_code"] for q in data["quotas"]] == ["GN", "TQ", "PT"]
    senior, divyang = data["concessions"]
    assert senior == {
        "concession_code": "SENIOR_CITIZEN_FEMALE", "description": "Women aged 58 and over",
        "discount_pct": Decimal("50"), "min_age": 58, "max_age": None, "gender": "F",
    }
    assert divyang["concession_code"] == "DIVYANGJAN" and divyang["discount_pct"] == Decimal("75")


def test_reads_long_fare_slabs(tmp_path):
    slabs = load_workbook.read_workbook(make_workbook(tmp_path, LOOKUPS, LONG_FARES))["fare_slabs"]

    assert slabs[0]["class_code"] == "SL"
    assert (slabs[0]["min_km"], slabs[0]["max_km"], slabs[0]["per_km_rate"]) == (0, 300, Decimal("0.45"))
    assert slabs[0]["reservation_fee"] == Decimal("20")
    assert slabs[1]["reservation_fee"] is None  # left to the column default


def test_wide_fare_slabs_continue_the_previous_slab(tmp_path):
    slabs = load_workbook.read_workbook(make_workbook(tmp_path, LOOKUPS, WIDE_FARES))["fare_slabs"]
    by_key = {(s["class_code"], s["min_km"]): s for s in slabs}

    assert set(by_key) == {("SL", 0), ("SL", 301), ("3A", 0), ("3A", 301)}
    assert by_key[("SL", 0)]["base_fare"] == Decimal("0.00")
    # 300 km at 0.50 = 150.00 carried into the next slab
    assert by_key[("SL", 301)]["base_fare"] == Decimal("150.00")
    assert by_key[("3A", 301)]["base_fare"] == Decimal("375.00")


def test_rejects_a_bad_discount(tmp_path):
    lookups = [["Concession Code", "Discount %"], ["BROKEN", 140]]
    with pytest.raises(ValueError, match="outside 0-100"):
        load_workbook.read_workbook(make_workbook(tmp_path, lookups, LONG_FARES))


def test_rejects_an_empty_slab(tmp_path):
    fares = [["Class", "From KM", "To KM", "Base Fare", "Per KM"], ["SL", 300, 300, 10, 1]]
    with pytest.raises(ValueError, match="is empty"):
        load_workbook.read_workbook(make_workbook(tmp_path, LOOKUPS, fares))


def test_missing_sheet_is_reported(tmp_path):
    workbook = openpyxl.Workbook()
    workbook.active.title = "Lookup_Tables"
    path = tmp_path / "book.xlsx"
    workbook.save(path)

    with pytest.raises(ValueError, match="no sheet with 'fare'"):
        load_workbook.read_workbook(path)


@pytest.fixture
def db():
    url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5433/nrrms")
    try:
        connection = psycopg.connect(url, connect_timeout=3)
        ready = connection.execute("SELECT to_regclass('fare_slabs') IS NOT NULL").fetchone()[0]
    except psycopg.Error:
        pytest.skip("database is not reachable")
    if not ready:
        connection.close()
        pytest.skip("G3 migrations are not applied")
    try:
        yield connection
    finally:
        connection.rollback()
        connection.close()


def test_load_upserts_and_a_rerun_changes_nothing(tmp_path, db):
    data = load_workbook.read_workbook(make_workbook(tmp_path, LOOKUPS, LONG_FARES))

    first = load_workbook.load(db, data)
    second = load_workbook.load(db, data)

    # SL matches the seed, 2S has blank cells, so only 3E is new; the seeded SL slab is unchanged
    assert (first["classes"], first["concessions"], first["fare_slabs"]) == (1, 2, 1)
    assert second == {"classes": 0, "quotas": 0, "concessions": 0, "fare_slabs": 0}
    assert db.execute(
        "SELECT name, has_ac FROM travel_classes WHERE class_code = '3E'"
    ).fetchone() == ("AC 3 Economy", True)
    assert db.execute(
        "SELECT name FROM travel_classes WHERE class_code = '2S'"
    ).fetchone() == ("Second Sitting",)
    slab = db.execute(
        "SELECT base_fare, per_km_rate, reservation_fee FROM fare_slabs"
        " WHERE class_code = '3E' AND min_km = 0 AND max_km = 500"
    ).fetchone()
    assert slab == (Decimal("400.00"), Decimal("1.1000"), Decimal("20.00"))
    assert db.execute(
        "SELECT discount_pct FROM concession_rules WHERE concession_code = 'DIVYANGJAN'"
    ).fetchone()[0] == Decimal("75.00")
