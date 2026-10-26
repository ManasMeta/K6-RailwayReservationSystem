from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from psycopg import Connection
from pydantic import BaseModel

from app.core.auth import UserPayload, require_role
from app.core.database import get_db_connection
from app.modules.operations import chart_service

StaffOnly = Depends(require_role(["staff", "admin"]))
router = APIRouter(prefix="/ops", tags=["Operations"], dependencies=[StaffOnly])
Db = Annotated[Connection, Depends(get_db_connection)]

# TODO(G1): staff-only. Add the same require_staff dependency as the other /ops routes.


class ChartSummaryOut(BaseModel):
    run_id: int
    chart_id: int
    promoted: int               # waiting passengers who got a berth just now
    remaining_rac: int
    remaining_wl: int
    final_vacant_berths: int
    already_prepared: bool      # true if the chart existed before this call


class ChartEntryOut(BaseModel):
    passenger_id: int
    pnr: str
    name: str                   # full name: staff only
    status: str                 # CNF / RAC / WL
    coach_code: str | None = None
    berth_no: int | None = None
    berth_type: str | None = None
    quota_code: str | None = None


class ChartOut(BaseModel):
    chart_id: int
    run_id: int
    prepared_at: datetime
    final_vacant_berths: int
    entries: list[ChartEntryOut]


@router.post("/runs/{run_id}/chart", response_model=ChartSummaryOut)
def prepare_chart(
    run_id: int,
    conn: Db,
    staff: Annotated[UserPayload, Depends(require_role(["staff", "admin"]))],
):
    """Prepare the final chart: waiting passengers get freed berths, then the run is locked."""
    return chart_service.prepare_chart(conn, run_id, staff.user_id)


@router.get("/runs/{run_id}/chart", response_model=ChartOut)
def get_chart(run_id: int, conn: Db):
    """The prepared chart, coach by coach. 404 CHART_NOT_PREPARED until staff prepare it."""
    return chart_service.get_chart(conn, run_id)
