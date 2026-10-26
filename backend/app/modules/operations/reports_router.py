from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from psycopg import Connection
from pydantic import BaseModel

from app.core.auth import require_role
from app.core.database import get_db_connection
from app.modules.operations import reports_service

router = APIRouter(
    prefix="/reports",
    tags=["Reports"],
    dependencies=[Depends(require_role(["admin"]))],
)
Db = Annotated[Connection, Depends(get_db_connection)]
DateFrom = Annotated[date | None, Query(alias="from", description="first day, e.g. 2026-10-20")]
DateTo = Annotated[date | None, Query(alias="to", description="last day, e.g. 2026-10-26")]

# TODO(G1): admin-only. Add a require_admin dependency to this router once G1's roles exist.


class RevenueRow(BaseModel):
    day: date | None = None          # empty when the row covers all days
    class_code: str | None = None    # empty when the row covers all classes
    bookings: int
    gross: float
    refunded: float
    net: float


class OccupancyClassRow(BaseModel):
    class_code: str
    total_berths: int
    booked_berths: int
    occupancy_pct: float | None = None


class OccupancyRunRow(OccupancyClassRow):
    run_id: int
    train_no: str
    train_name: str
    run_date: date


class WlConversionOut(BaseModel):
    waiting: int                     # passengers still waiting when their run's chart was prepared
    promoted: int                    # of those, how many got a berth at that moment
    conversion_pct: float | None = None   # empty when nobody was waiting


class SegmentRow(BaseModel):
    train_no: str
    train_name: str
    from_station_code: str
    from_station_name: str
    to_station_code: str
    to_station_name: str
    passengers: int


class RefreshOut(BaseModel):
    refreshed: list[str]


@router.get("/revenue", response_model=list[RevenueRow])
def revenue(
    conn: Db,
    by: Literal["day", "class", "day_class", "total"] = "day",
    date_from: DateFrom = None,
    date_to: DateTo = None,
):
    """Money from paid bookings by travel day (default), class, both, or one grand total.
    from/to only limit the day-based views."""
    return reports_service.revenue(conn, by, date_from, date_to)


@router.get("/occupancy", response_model=list[OccupancyClassRow] | list[OccupancyRunRow])
def occupancy(
    conn: Db,
    by: Literal["class", "run"] = "class",
    date_from: DateFrom = None,
    date_to: DateTo = None,
):
    """How full the trains are: per class (default) or per run and class. Cancelled runs are left out."""
    return reports_service.occupancy(conn, by, date_from, date_to)


@router.get("/wl-conversion", response_model=WlConversionOut)
def wl_conversion(conn: Db, date_from: DateFrom = None, date_to: DateTo = None):
    """Share of waiting passengers who got a berth when the chart was prepared."""
    return reports_service.wl_conversion(conn, date_from, date_to)


@router.get("/busiest-segments", response_model=list[SegmentRow])
def busiest_segments(
    conn: Db,
    date_from: DateFrom = None,
    date_to: DateTo = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
):
    """The stretches between two stops that carried the most passengers."""
    return reports_service.busiest_segments(conn, date_from, date_to, limit)


@router.post("/refresh", response_model=RefreshOut)
def refresh_views(conn: Db):
    """Refresh mv_occupancy and mv_revenue. Meant to be called by a scheduled job."""
    return reports_service.refresh_views(conn)
