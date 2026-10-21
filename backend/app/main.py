from collections.abc import Generator

from fastapi import Depends, FastAPI, HTTPException
from psycopg import Connection

from app.core.database import get_db_connection
from app.modules.network.errors import NetworkError, network_error_handler
from app.modules.network.router import router as network_router
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


app.add_exception_handler(NetworkError, network_error_handler)
app.add_exception_handler(WalletError, wallet_error_handler)
app.include_router(network_router, prefix="/api/v1")
app.include_router(wallet_router, prefix="/api/v1")


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
