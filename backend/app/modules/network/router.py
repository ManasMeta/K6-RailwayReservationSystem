from datetime import date
from typing import Annotated

import psycopg
from fastapi import APIRouter, Depends, Path, Query
from psycopg import Connection

from app.core.database import get_db_connection
from app.modules.network import service
from app.modules.network.errors import NetworkError
from app.modules.network.schemas import JourneyResults, StationPage, Timetable

router = APIRouter(tags=["Network"])

STATION_CODE = r"^[A-Za-z0-9]{1,10}$"
TRAIN_NO = r"^[A-Za-z0-9]{1,10}$"

Db = Annotated[Connection, Depends(get_db_connection)]


@router.get("/stations", response_model=StationPage)
def list_stations(
    connection: Db,
    q: Annotated[str, Query(max_length=60, description="Name or code fragment")] = "",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 10,
) -> dict:
    try:
        return service.search_stations(connection, q, page, page_size)
    except psycopg.Error as exc:
        raise _unavailable() from exc


@router.get("/journeys", response_model=JourneyResults)
def search_journeys(
    connection: Db,
    from_code: Annotated[str, Query(alias="from", pattern=STATION_CODE)],
    to_code: Annotated[str, Query(alias="to", pattern=STATION_CODE)],
    travel_date: Annotated[date, Query(alias="date")],
    limit: Annotated[
        int, Query(ge=1, le=100, description="Max connecting journeys")
    ] = 20,
) -> dict:
    try:
        return service.search_journeys(connection, from_code, to_code, travel_date, limit)
    except psycopg.Error as exc:
        raise _unavailable() from exc


@router.get("/trains/{train_no}/timetable", response_model=Timetable)
def train_timetable(
    connection: Db,
    train_no: Annotated[str, Path(pattern=TRAIN_NO)],
) -> dict:
    try:
        return service.get_timetable(connection, train_no)
    except psycopg.Error as exc:
        raise _unavailable() from exc


def _unavailable() -> NetworkError:
    return NetworkError(
        503, "Network database is unavailable or its schema is not ready", "DB_UNAVAILABLE"
    )
