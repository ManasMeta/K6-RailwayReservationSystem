from datetime import date
from typing import Annotated

import psycopg
from fastapi import APIRouter, Depends, Path, Query
from psycopg import Connection

from app.core.database import get_db_connection
from app.modules.inventory import schemas, service
from app.modules.inventory.errors import InventoryError

router = APIRouter(tags=["Inventory & Fares"])

STATION_CODE = r"^[A-Za-z0-9]{1,10}$"
TRAIN_NO = r"^[A-Za-z0-9]{1,10}$"

Db = Annotated[Connection, Depends(get_db_connection)]


def _db_unavailable(exc: Exception) -> InventoryError:
    return InventoryError(503, "Database query failed", "DATABASE_ERROR")


@router.get("/travel-classes", response_model=list[schemas.TravelClassItem])
def list_travel_classes(connection: Db) -> list:
    try:
        return service.get_travel_classes(connection)
    except psycopg.Error as exc:
        raise _db_unavailable(exc) from exc


@router.get("/quotas", response_model=list[schemas.QuotaItem])
def list_quotas(connection: Db) -> list:
    try:
        return service.get_quotas(connection)
    except psycopg.Error as exc:
        raise _db_unavailable(exc) from exc


@router.get("/trains/{train_no}/availability", response_model=schemas.AvailabilityResponse)
def train_availability(
    connection: Db,
    train_no: Annotated[str, Path(pattern=TRAIN_NO)],
    from_code: Annotated[str, Query(alias="from", pattern=STATION_CODE)],
    to_code: Annotated[str, Query(alias="to", pattern=STATION_CODE)],
    travel_date: Annotated[date, Query(alias="date")],
    days: Annotated[int, Query(ge=1, le=14, description="Number of dates to show")] = 6,
    quota: Annotated[str, Query(max_length=5, description="Booking Quota")] = "GN",
) -> schemas.AvailabilityResponse:
    try:
        return service.get_availability(
            connection=connection,
            train_no=train_no,
            from_code=from_code,
            to_code=to_code,
            start_date=travel_date,
            days=days,
            quota=quota,
        )
    except psycopg.Error as exc:
        raise _db_unavailable(exc) from exc


@router.get("/fare", response_model=schemas.FareBreakdown)
def get_fare(
    connection: Db,
    train_no: Annotated[str, Query(pattern=TRAIN_NO)],
    from_code: Annotated[str, Query(alias="from", pattern=STATION_CODE)],
    to_code: Annotated[str, Query(alias="to", pattern=STATION_CODE)],
    class_code: Annotated[str, Query(max_length=5)],
    quota: Annotated[str, Query(max_length=5)] = "GN",
    concession: Annotated[str, Query(max_length=30)] = "GENERAL",
) -> schemas.FareBreakdown:
    try:
        return service.calculate_fare(
            connection=connection,
            train_no=train_no,
            from_code=from_code,
            to_code=to_code,
            class_code=class_code,
            quota_code=quota,
            concession_code=concession,
        )
    except psycopg.Error as exc:
        raise _db_unavailable(exc) from exc


@router.get("/trains/{train_no}/coaches", response_model=list[schemas.CoachSummary])
def get_train_coaches(
    connection: Db,
    train_no: Annotated[str, Path(pattern=TRAIN_NO)],
) -> list:
    try:
        return service.get_train_coaches(connection, train_no)
    except psycopg.Error as exc:
        raise _db_unavailable(exc) from exc


@router.get("/coaches/{coach_id}/layout", response_model=schemas.CoachLayoutResponse)
def coach_layout(
    connection: Db,
    coach_id: Annotated[int, Path(ge=1)],
    run_date: Annotated[date, Query(description="Train origin run date")],
    from_seq: Annotated[int, Query(ge=1, description="Boarding stop sequence")] = 1,
    to_seq: Annotated[int, Query(ge=1, description="Alighting stop sequence")] = 2,
) -> schemas.CoachLayoutResponse:
    try:
        return service.get_coach_layout(
            connection=connection,
            coach_id=coach_id,
            run_date=run_date,
            from_seq=from_seq,
            to_seq=to_seq,
        )
    except psycopg.Error as exc:
        raise _db_unavailable(exc) from exc
