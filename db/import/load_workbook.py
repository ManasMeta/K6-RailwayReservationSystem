"""Load G3 lookups from Indian_Railway_Reservation_System.xlsx (openpyxl).

Fills travel_classes, quotas and concession_rules from the 'Lookup_Tables' sheet and
fare_slabs from the 'Fare_Matrix' sheet. The migrations already seed the same tables with
standard values, so this only adds rows the workbook has and updates the ones it changes.
Reruns are no-ops.

Assumptions (check against the real workbook): a sheet may hold several small tables, side by
side or one under another. A table starts at a header row and ends at the first row whose
key cell is blank. Columns are found by their header text, case-insensitively:

  classes      "class code" + "class name" (optional "ac", "multiplier")
  quotas       "quota code" + "quota name"
  concessions  "concession code" (or type/category) + "discount" / "concession %" / "percent"
               (optional "description", "min age", "max age", "gender")
  fare slabs   long layout: "class" + "from km" + "to km" + "base fare" + "per km"
               (optional "reservation fee", "superfast", "tatkal min", "tatkal max", "tatkal %")
               wide layout: "from km" + "to km" + one column per class code holding the rate
               per km; each slab's base fare then continues the previous slab's fare.

Usage: python db/import/load_workbook.py WORKBOOK.xlsx
"""
import os
import re
import sys
from decimal import Decimal, InvalidOperation

import openpyxl
import psycopg

AC_CLASSES = {"1A", "2A", "3A", "3E", "CC", "EC", "EA"}
# Column titles a wide Fare_Matrix may use for its classes
KNOWN_CLASSES = AC_CLASSES | {"SL", "2S", "FC", "GN"}


def _title(cell):
    return re.sub(r"[^a-z0-9%]+", " ", str(cell or "").lower()).strip()


def _find(titles, *patterns, exclude=()):
    """Index of the first header matching any pattern (regex) and none of the excludes."""
    for i, title in enumerate(titles):
        if not title or any(re.search(e, title) for e in exclude):
            continue
        if any(re.search(p, title) for p in patterns):
            return i
    return None


def _text(value):
    return str(value).strip() if value is not None and str(value).strip() else None


def _number(value, what):
    if value is None or str(value).strip() == "":
        return None
    raw = str(value).strip().rstrip("%").replace(",", "")
    try:
        return Decimal(raw)
    except InvalidOperation as exc:
        raise ValueError(f"{what}: {value!r} is not a number") from exc


def _int(value, what):
    number = _number(value, what)
    return None if number is None else int(number)


def _bool(value):
    text = str(value or "").strip().lower()
    return text in {"y", "yes", "true", "1", "ac"}


def _sheet(workbook, keyword):
    name = next((n for n in workbook.sheetnames if keyword in n.lower()), None)
    if name is None:
        raise ValueError(f"no sheet with {keyword!r} in its name in {workbook.sheetnames}")
    return list(workbook[name].iter_rows(values_only=True))


def _blocks(row):
    """Split a row at blank cells into runs: [(start, end, titles)]."""
    titles = [_title(c) for c in row]
    runs, start = [], 0
    while start < len(titles):
        if not titles[start]:
            start += 1
            continue
        end = start
        while end < len(titles) and titles[end]:
            end += 1
        runs.append((start, end, titles[start:end]))
        start = end
    return runs


def _is_any_header(titles):
    return any(test(titles) for test in HEADER_TESTS)


def _tables(rows, header_test):
    """Yield (titles, data rows) for every header header_test accepts.

    A header row may carry more than one table side by side, so the row is split at blank
    header cells and each run of headers is tried separately. A table ends at a blank row or
    at the next header row, so tables stacked one under another need no gap between them.
    """
    for r, row in enumerate(rows):
        for start, end, block in _blocks(row):
            if not header_test(block):
                continue
            body = []
            for data in rows[r + 1:]:
                cells = list(data[start:end]) + [None] * (end - start - len(data[start:end]))
                if all(_text(c) is None for c in cells) or _is_any_header([_title(c) for c in cells]):
                    break
                body.append(cells)
            yield block, body


# --- Lookup_Tables -------------------------------------------------------------------------

def _is_class_header(t):
    return _find(t, r"class code") is not None and _find(t, r"class name", r"^name$", r"description") is not None


def _is_quota_header(t):
    return _find(t, r"quota code") is not None and _find(t, r"quota name", r"^name$", r"description") is not None


def _is_concession_header(t):
    return (_find(t, r"concession (code|type|category)") is not None
            and _find(t, r"discount", r"concession %", r"percent", r"%") is not None)


def read_classes(rows):
    for titles, body in _tables(rows, _is_class_header):
        code = _find(titles, r"class code")
        name = _find(titles, r"class name", r"^name$", r"description")
        ac = _find(titles, r"^ac\b", r"\bac$", r"air", exclude=(r"code", r"name"))
        mult = _find(titles, r"multiplier")
        for row in body:
            if _text(row[code]) is None:
                continue
            class_code = _text(row[code]).upper()
            # Blank cells stay None, so an existing row keeps its value; a new row falls back
            # to the code as its name and to AC_CLASSES for has_ac.
            yield {
                "class_code": class_code,
                "name": _text(row[name]),
                "has_ac": _bool(row[ac]) if ac is not None and _text(row[ac]) is not None else None,
                "base_multiplier": _number(row[mult], f"{class_code} multiplier") if mult is not None else None,
            }


def read_quotas(rows):
    for titles, body in _tables(rows, _is_quota_header):
        code = _find(titles, r"quota code")
        name = _find(titles, r"quota name", r"^name$", r"description")
        for row in body:
            if _text(row[code]) is None:
                continue
            quota_code = _text(row[code]).upper()
            yield {"quota_code": quota_code, "name": _text(row[name])}


def read_concessions(rows):
    for titles, body in _tables(rows, _is_concession_header):
        code = _find(titles, r"concession (code|type|category)")
        pct = _find(titles, r"discount", r"concession %", r"percent", r"%")
        desc = _find(titles, r"description", r"remarks", r"rule")
        min_age = _find(titles, r"min.*age", r"age.*from", r"age min")
        max_age = _find(titles, r"max.*age", r"age.*to", r"age max")
        gender = _find(titles, r"gender", r"\bsex\b")
        for row in body:
            label = _text(row[code])
            if label is None:
                continue
            concession_code = re.sub(r"[^A-Z0-9]+", "_", label.upper()).strip("_")[:30]
            discount = _number(row[pct], f"{label} discount") or Decimal(0)
            if not 0 <= discount <= 100:
                raise ValueError(f"{label}: discount {discount} is outside 0-100")
            sex = (_text(row[gender]) or "").upper()[:1] if gender is not None else ""
            yield {
                "concession_code": concession_code,
                "description": (_text(row[desc]) if desc is not None else None) or label,
                "discount_pct": discount,
                "min_age": _int(row[min_age], f"{label} min age") if min_age is not None else None,
                "max_age": _int(row[max_age], f"{label} max age") if max_age is not None else None,
                "gender": sex if sex in {"M", "F", "T"} else None,
            }


# --- Fare_Matrix ---------------------------------------------------------------------------

FROM_KM = (r"from km", r"min km", r"km from", r"^from$", r"start km")
TO_KM = (r"to km", r"max km", r"km to", r"^to$", r"end km", r"upto")
SLAB_EXTRAS = {
    "reservation_fee": (r"reservation",),
    "superfast_charge": (r"superfast", r"super fast"),
    "tatkal_min_charge": (r"tatkal min",),
    "tatkal_max_charge": (r"tatkal max",),
    "tatkal_pct": (r"tatkal %", r"tatkal pct", r"tatkal percent"),
}


def _is_long_slab_header(t):
    return (_find(t, r"^class", r"class code") is not None and _find(t, *FROM_KM) is not None
            and _find(t, *TO_KM) is not None and _find(t, r"per km", r"rate") is not None)


def _is_wide_slab_header(t):
    return (not _is_long_slab_header(t) and _find(t, *FROM_KM) is not None
            and _find(t, *TO_KM) is not None
            and any(x.upper() in KNOWN_CLASSES for x in t))


def read_fare_slabs(rows):
    for titles, body in _tables(rows, _is_long_slab_header):
        cls = _find(titles, r"^class", r"class code")
        lo, hi = _find(titles, *FROM_KM), _find(titles, *TO_KM)
        base = _find(titles, r"base", r"min.*fare")
        rate = _find(titles, r"per km", r"rate")
        extras = {k: _find(titles, *p) for k, p in SLAB_EXTRAS.items()}
        for row in body:
            if _text(row[cls]) is None:
                continue
            class_code = _text(row[cls]).upper()
            slab = {
                "class_code": class_code,
                "min_km": _int(row[lo], f"{class_code} from km"),
                "max_km": _int(row[hi], f"{class_code} to km"),
                "base_fare": (_number(row[base], f"{class_code} base fare") if base is not None else None) or Decimal(0),
                "per_km_rate": _number(row[rate], f"{class_code} rate per km"),
            }
            for key, col in extras.items():
                slab[key] = _number(row[col], f"{class_code} {key}") if col is not None else None
            yield _checked(slab)

    for titles, body in _tables(rows, _is_wide_slab_header):
        lo, hi = _find(titles, *FROM_KM), _find(titles, *TO_KM)
        class_cols = {i: t.upper() for i, t in enumerate(titles) if t.upper() in KNOWN_CLASSES and i not in (lo, hi)}
        running = {}  # class -> (fare at the end of the previous slab)
        body = [row for row in body if _text(row[lo]) is not None]
        for row in sorted(body, key=lambda r: _int(r[lo], "from km")):
            min_km, max_km = _int(row[lo], "from km"), _int(row[hi], "to km")
            if max_km is None or max_km <= min_km:
                raise ValueError(f"fare slab {min_km}-{max_km} km is empty")
            for col, class_code in class_cols.items():
                rate = _number(row[col], f"{class_code} rate per km")
                if rate is None:
                    continue
                base_fare = running.get(class_code, Decimal(0))
                running[class_code] = base_fare + (max_km - min_km) * rate
                yield _checked({
                    "class_code": class_code, "min_km": min_km, "max_km": max_km,
                    "base_fare": base_fare.quantize(Decimal("0.01")), "per_km_rate": rate,
                    **{k: None for k in SLAB_EXTRAS},
                })


HEADER_TESTS = (_is_class_header, _is_quota_header, _is_concession_header,
                _is_long_slab_header, _is_wide_slab_header)


def _checked(slab):
    if slab["min_km"] is None or slab["max_km"] is None or slab["per_km_rate"] is None:
        raise ValueError(f"fare slab for {slab['class_code']} is missing a distance or rate")
    if slab["max_km"] <= slab["min_km"]:
        raise ValueError(f"fare slab {slab['class_code']} {slab['min_km']}-{slab['max_km']} km is empty")
    return slab


def read_workbook(path):
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    lookups = _sheet(workbook, "lookup")
    fares = _sheet(workbook, "fare")
    return {
        "classes": list(read_classes(lookups)),
        "quotas": list(read_quotas(lookups)),
        "concessions": list(read_concessions(lookups)),
        "fare_slabs": list(read_fare_slabs(fares)),
    }


# --- database ------------------------------------------------------------------------------

UPSERT_CLASS = """
    INSERT INTO travel_classes (class_code, name, has_ac, base_multiplier)
    VALUES (%(class_code)s::text, COALESCE(%(name)s::text, %(class_code)s::text),
            COALESCE(%(has_ac)s::boolean, %(class_code)s::text = ANY(%(ac_classes)s)),
            COALESCE(%(base_multiplier)s::numeric, 1.00))
    ON CONFLICT (class_code) DO UPDATE
    SET name = COALESCE(%(name)s::text, travel_classes.name),
        has_ac = COALESCE(%(has_ac)s::boolean, travel_classes.has_ac),
        base_multiplier = COALESCE(%(base_multiplier)s::numeric, travel_classes.base_multiplier)
    WHERE travel_classes.name IS DISTINCT FROM COALESCE(%(name)s::text, travel_classes.name)
       OR travel_classes.has_ac IS DISTINCT FROM COALESCE(%(has_ac)s::boolean, travel_classes.has_ac)
       OR travel_classes.base_multiplier IS DISTINCT FROM COALESCE(%(base_multiplier)s::numeric, travel_classes.base_multiplier)
"""

UPSERT_QUOTA = """
    INSERT INTO quotas (quota_code, name) VALUES (%(quota_code)s::text, COALESCE(%(name)s::text, %(quota_code)s::text))
    ON CONFLICT (quota_code) DO UPDATE SET name = COALESCE(%(name)s::text, quotas.name)
    WHERE quotas.name IS DISTINCT FROM COALESCE(%(name)s::text, quotas.name)
"""

UPSERT_CONCESSION = """
    INSERT INTO concession_rules (concession_code, description, discount_pct, min_age, max_age, gender)
    VALUES (%(concession_code)s, %(description)s, %(discount_pct)s, %(min_age)s::int, %(max_age)s::int, %(gender)s::text)
    ON CONFLICT (concession_code) DO UPDATE
    SET description = EXCLUDED.description, discount_pct = EXCLUDED.discount_pct,
        min_age = EXCLUDED.min_age, max_age = EXCLUDED.max_age, gender = EXCLUDED.gender
    WHERE (concession_rules.description, concession_rules.discount_pct, concession_rules.min_age,
           concession_rules.max_age, concession_rules.gender)
          IS DISTINCT FROM (EXCLUDED.description, EXCLUDED.discount_pct, EXCLUDED.min_age,
                            EXCLUDED.max_age, EXCLUDED.gender)
"""

# Fees the workbook leaves out keep the column defaults (or the slab's current value).
UPSERT_SLAB = """
    INSERT INTO fare_slabs (class_code, min_km, max_km, base_fare, per_km_rate, reservation_fee,
                            superfast_charge, tatkal_min_charge, tatkal_max_charge, tatkal_pct)
    VALUES (%(class_code)s::text, %(min_km)s, %(max_km)s, %(base_fare)s, %(per_km_rate)s,
            COALESCE(%(reservation_fee)s::numeric, 20.00), COALESCE(%(superfast_charge)s::numeric, 30.00),
            COALESCE(%(tatkal_min_charge)s::numeric, 100.00), COALESCE(%(tatkal_max_charge)s::numeric, 500.00),
            COALESCE(%(tatkal_pct)s::numeric, 30.00))
    ON CONFLICT (class_code, min_km, max_km) DO UPDATE
    SET base_fare = EXCLUDED.base_fare,
        per_km_rate = EXCLUDED.per_km_rate,
        reservation_fee = COALESCE(%(reservation_fee)s::numeric, fare_slabs.reservation_fee),
        superfast_charge = COALESCE(%(superfast_charge)s::numeric, fare_slabs.superfast_charge),
        tatkal_min_charge = COALESCE(%(tatkal_min_charge)s::numeric, fare_slabs.tatkal_min_charge),
        tatkal_max_charge = COALESCE(%(tatkal_max_charge)s::numeric, fare_slabs.tatkal_max_charge),
        tatkal_pct = COALESCE(%(tatkal_pct)s::numeric, fare_slabs.tatkal_pct)
    WHERE (fare_slabs.base_fare, fare_slabs.per_km_rate) IS DISTINCT FROM (EXCLUDED.base_fare, EXCLUDED.per_km_rate)
       OR (%(reservation_fee)s::numeric IS NOT NULL AND fare_slabs.reservation_fee <> %(reservation_fee)s::numeric)
       OR (%(superfast_charge)s::numeric IS NOT NULL AND fare_slabs.superfast_charge <> %(superfast_charge)s::numeric)
       OR (%(tatkal_min_charge)s::numeric IS NOT NULL AND fare_slabs.tatkal_min_charge <> %(tatkal_min_charge)s::numeric)
       OR (%(tatkal_max_charge)s::numeric IS NOT NULL AND fare_slabs.tatkal_max_charge <> %(tatkal_max_charge)s::numeric)
       OR (%(tatkal_pct)s::numeric IS NOT NULL AND fare_slabs.tatkal_pct <> %(tatkal_pct)s::numeric)
"""


def load(connection, data):
    """Upsert everything; returns the number of rows changed per table.

    Nothing is committed here: main() commits when the connection closes, and tests roll back.
    """
    changed = {}
    with connection.cursor() as cursor:
        for key, statement in (("classes", UPSERT_CLASS), ("quotas", UPSERT_QUOTA),
                               ("concessions", UPSERT_CONCESSION), ("fare_slabs", UPSERT_SLAB)):
            changed[key] = 0
            for row in data[key]:
                cursor.execute(statement, {**row, "ac_classes": sorted(AC_CLASSES)})
                changed[key] += cursor.rowcount
    return changed


def main(argv):
    if len(argv) != 1:
        sys.exit(__doc__)
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("DATABASE_URL is not set")
    data = read_workbook(argv[0])
    with psycopg.connect(url) as connection:
        changed = load(connection, data)
    print(", ".join(f"{key}: {len(data[key])} read, {changed[key]} changed" for key in data))


if __name__ == "__main__":
    main(sys.argv[1:])
