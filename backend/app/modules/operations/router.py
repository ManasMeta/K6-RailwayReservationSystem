from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from psycopg import Connection

from app.core.database import get_db_connection
from app.modules.operations import service
from app.modules.operations.schemas import (
    CancelOut,
    CancelRequest,
    DelayRequest,
    RunOut,
)

router = APIRouter(prefix="/ops", tags=["Operations"])
Db = Annotated[Connection, Depends(get_db_connection)]

# TODO(G1): staff-only. Add a require_staff dependency here once G1's login and roles exist.


@router.get("/runs", response_model=list[RunOut])
def list_runs(conn: Db, run_date: date | None = None):
    """List train runs. Pass ?run_date=2026-10-24 to see one day only."""
    return service.list_runs(conn, run_date)


@router.get("/runs/{run_id}", response_model=RunOut)
def get_run(run_id: int, conn: Db):
    """One run, or 404 RUN_NOT_FOUND."""
    return service.get_run(conn, run_id)


@router.post("/runs/{run_id}/delay", response_model=RunOut)
def add_delay(run_id: int, body: DelayRequest, conn: Db):
    """Record a delay. delay_minutes is the run's total delay so far (0 clears it)."""
    return service.add_delay(conn, run_id, body.delay_minutes, body.station_code, body.notes)


@router.post("/runs/{run_id}/cancel", response_model=CancelOut)
def cancel_run(run_id: int, conn: Db, body: CancelRequest | None = None):
    """Cancel a run: every passenger is cancelled with a full refund."""
    return service.cancel_run(conn, run_id, body.reason if body else None)
