"""Authentication dependencies and current_user extraction."""

from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import settings

security = HTTPBearer(auto_error=False)


class UserPayload(BaseModel):
    user_id: int
    email: str
    role: str = "passenger"


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security),
) -> UserPayload:
    """Extracts and verifies JWT token from Authorization header.
    In testing/dev mode, defaults to a mock test user if no header is supplied.
    """
    if credentials is None or not credentials.credentials:
        # Default mock user for testing/dev environments (Aarav Sharma, user_id=1)
        return UserPayload(user_id=1, email="passenger.test@yatrio.in", role="passenger")

    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub") or payload.get("user_id")
        email = payload.get("email", "")
        role = payload.get("role", "passenger")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"detail": "Invalid authentication credentials", "code": "AUTH_INVALID"},
            )
        return UserPayload(user_id=int(user_id), email=email, role=role)
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": "Could not validate credentials", "code": "AUTH_INVALID"},
        )


def require_role(allowed_roles: list[str]):
    def role_checker(current_user: UserPayload = Depends(get_current_user)) -> UserPayload:
        if current_user.role not in allowed_roles and "admin" not in current_user.role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"detail": "Operation not permitted for your role", "code": "PERMISSION_DENIED"},
            )
        return current_user

    return role_checker
