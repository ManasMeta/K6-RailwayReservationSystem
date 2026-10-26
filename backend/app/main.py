from collections.abc import Generator

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import JSONResponse
from psycopg import Connection
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.database import get_db_connection
from app.modules.accounts.errors import AccountsError, accounts_error_handler
from app.modules.accounts.router import router as accounts_router
from app.modules.inventory.errors import InventoryError, inventory_error_handler
from app.modules.inventory.router import router as inventory_router
from app.modules.network.errors import NetworkError, network_error_handler
from app.modules.network.router import router as network_router
from app.modules.operations.chart_router import router as chart_router
from app.modules.operations.errors import OperationsError, operations_error_handler
from app.modules.operations.pnr_router import router as pnr_router
from app.modules.operations.reports_router import router as reports_router
from app.modules.operations.router import router as operations_router
from app.modules.reservations.router import router as reservations_router
from app.modules.wallet.errors import WalletError, wallet_error_handler
from app.modules.wallet.router import router as wallet_router

app = FastAPI(
    title="Yatrio",
    version="0.1.0",
)


def database_connection() -> Generator[Connection, None, None]:
    connection_generator = get_db_connection()
    try:
        yield next(connection_generator)
    finally:
        connection_generator.close()


@app.exception_handler(StarletteHTTPException)
async def flatten_error_detail(request: Request, exc: StarletteHTTPException):
    """Render HTTPException(detail={"detail", "code"}) as the project-wide {"detail", "code"} body."""
    if isinstance(exc.detail, dict) and "code" in exc.detail:
        return JSONResponse(exc.detail, status_code=exc.status_code, headers=exc.headers)
    return await http_exception_handler(request, exc)


app.add_exception_handler(AccountsError, accounts_error_handler)
app.add_exception_handler(NetworkError, network_error_handler)
app.add_exception_handler(WalletError, wallet_error_handler)
app.add_exception_handler(OperationsError, operations_error_handler)
app.add_exception_handler(InventoryError, inventory_error_handler)
app.include_router(accounts_router, prefix="/api/v1")
app.include_router(reservations_router, prefix="/api/v1")
app.include_router(network_router, prefix="/api/v1")
app.include_router(inventory_router, prefix="/api/v1")
app.include_router(wallet_router, prefix="/api/v1")
app.include_router(operations_router, prefix="/api/v1")
app.include_router(pnr_router, prefix="/api/v1")
app.include_router(chart_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/database")
def database_health(
    connection: Connection = Depends(database_connection),
) -> dict[str, str]:
    try:
        connection.execute("SELECT 1")
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed",
        ) from exc
