from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from psycopg import Connection

from app.core.database import get_db_connection
from app.modules.operations import service

router = APIRouter(prefix="/ops", tags=["Operations"])
Db = Annotated[Connection, Depends(get_db_connection)]


@router.get("/runs")
def list_runs(conn: Db, run_date: date | None = None):
    """List train runs. Pass ?run_date=2026-10-24 to see one day only."""
    return service.list_runs(conn, run_date)