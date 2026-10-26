from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from psycopg import Connection
from pydantic import BaseModel

from app.core.database import get_db_connection
from app.modules.operations import pnr_service

router = APIRouter(tags=["PNR Status"])
Db = Annotated[Connection, Depends(get_db_connection)]


class PassengerStatus(BaseModel):
    name: str                      # masked, e.g. "P****** S*****"
    status: str                    # CNF / RAC / WL / CANCELLED
    coach_code: str | None = None
    berth_no: int | None = None
    berth_type: str | None = None
    rac_number: int | None = None
    wl_number: int | None = None


class PnrStatusOut(BaseModel):
    pnr: str
    reservation_status: str
    train_no: str
    train_name: str
    run_date: date
    from_station_code: str
    from_station_name: str
    to_station_code: str
    to_station_name: str
    class_code: str
    quota_code: str | None = None
    run_status: str
    delay_minutes: int
    chart_prepared: bool
    passengers: list[PassengerStatus]


# Public on purpose: no login needed to check a PNR.
@router.get("/pnr/{pnr}", response_model=PnrStatusOut)
def pnr_status(pnr: str, conn: Db):
    """Status of one booking. 400 INVALID_PNR if not 10 digits, 404 PNR_NOT_FOUND if unknown."""
    return pnr_service.get_pnr_status(conn, pnr)
