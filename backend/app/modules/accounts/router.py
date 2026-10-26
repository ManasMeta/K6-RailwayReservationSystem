from typing import Annotated

from fastapi import APIRouter, Depends, Path, Response, status
from psycopg import Connection

from app.core.auth import UserPayload, get_current_user
from app.core.database import get_db_connection
from app.modules.accounts import service
from app.modules.accounts.schemas import (
    LoginRequest,
    ProfileUpdate,
    SavedPassengerIn,
    SavedPassengerOut,
    SignupRequest,
    TokenResponse,
    UserOut,
)

router = APIRouter(tags=["Accounts"])

Db = Annotated[Connection, Depends(get_db_connection)]
CurrentUser = Annotated[UserPayload, Depends(get_current_user)]


@router.post("/auth/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(data: SignupRequest, connection: Db) -> dict:
    return service.signup(connection, data)


@router.post("/auth/login", response_model=TokenResponse)
def login(data: LoginRequest, connection: Db) -> dict:
    return service.login(connection, data)


@router.post("/auth/refresh", response_model=TokenResponse)
def refresh(current_user: CurrentUser, connection: Db) -> dict:
    return service.refresh(connection, current_user.user_id)


@router.get("/me", response_model=UserOut)
def me(current_user: CurrentUser, connection: Db) -> dict:
    return service.get_user(connection, current_user.user_id)


@router.patch("/me", response_model=UserOut)
def update_me(data: ProfileUpdate, current_user: CurrentUser, connection: Db) -> dict:
    return service.update_profile(connection, current_user.user_id, data)


@router.get("/me/passengers", response_model=list[SavedPassengerOut])
def list_passengers(current_user: CurrentUser, connection: Db) -> list[dict]:
    return service.list_passengers(connection, current_user.user_id)


@router.post(
    "/me/passengers", response_model=SavedPassengerOut, status_code=status.HTTP_201_CREATED
)
def add_passenger(data: SavedPassengerIn, current_user: CurrentUser, connection: Db) -> dict:
    return service.add_passenger(connection, current_user.user_id, data)


@router.delete("/me/passengers/{passenger_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_passenger(
    passenger_id: Annotated[int, Path(ge=1)], current_user: CurrentUser, connection: Db
) -> Response:
    service.delete_passenger(connection, current_user.user_id, passenger_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
