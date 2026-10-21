"""Main FastAPI application for NRRMS."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import close_db_pool, init_db_pool
from app.modules.reservations.router import router as reservations_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database pool
    init_db_pool()
    yield
    # Shutdown: clean up pool
    close_db_pool()


app = FastAPI(
    title="Yatrio NRRMS API",
    description="National Railway Reservation and Management System - Group 4 Reservation Engine",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration for React + Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount modules under /api/v1
app.include_router(reservations_router, prefix="/api/v1")


@app.get("/health", tags=["System"])
def health_check():
    return {"status": "healthy", "module": "G4_Reservation_Engine", "version": "1.0.0"}
