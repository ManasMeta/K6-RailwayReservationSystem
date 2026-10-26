"""Admin reports (G6). Read-only, except refresh_views()."""

from app.modules.operations import reports_sql as sql
from app.modules.operations.errors import OperationsError

# revenue "by" -> grouping_level in mv_revenue
REVENUE_LEVELS = {"day_class": 0, "day": 1, "class": 2, "total": 3}


def _check_dates(date_from, date_to):
    if date_from and date_to and date_from > date_to:
        raise OperationsError(400, "'from' must not be after 'to'", "INVALID_DATE_RANGE")


def revenue(conn, by, date_from=None, date_to=None):
    _check_dates(date_from, date_to)
    params = {"level": REVENUE_LEVELS[by], "date_from": date_from, "date_to": date_to}
    return conn.execute(sql.REVENUE, params).fetchall()


def occupancy(conn, by, date_from=None, date_to=None):
    _check_dates(date_from, date_to)
    query = sql.OCCUPANCY_BY_CLASS if by == "class" else sql.OCCUPANCY_BY_RUN
    return conn.execute(query, {"date_from": date_from, "date_to": date_to}).fetchall()


def wl_conversion(conn, date_from=None, date_to=None):
    """Of the passengers still waiting when a chart was prepared, how many got a berth."""
    _check_dates(date_from, date_to)
    row = conn.execute(sql.WL_CONVERSION, {"date_from": date_from, "date_to": date_to}).fetchone()
    waiting, promoted = row["waiting"], row["promoted"]
    rate = round(100.0 * promoted / waiting, 2) if waiting else None
    return {"waiting": waiting, "promoted": promoted, "conversion_pct": rate}


def busiest_segments(conn, date_from=None, date_to=None, limit=10):
    _check_dates(date_from, date_to)
    params = {"date_from": date_from, "date_to": date_to, "limit": limit}
    return conn.execute(sql.BUSIEST_SEGMENTS, params).fetchall()


def refresh_views(conn):
    """Bring mv_occupancy and mv_revenue up to date without blocking readers."""
    try:
        conn.execute(sql.REFRESH_OCCUPANCY)
        conn.execute(sql.REFRESH_REVENUE)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"refreshed": ["mv_occupancy", "mv_revenue"]}
