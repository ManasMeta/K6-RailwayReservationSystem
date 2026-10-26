"""Authentication dependencies: JWT issue/verify, current_user and require_role()."""

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import get_settings

bearer_scheme = HTTPBearer(auto_error=False)


class UserPayload(BaseModel):
    user_id: int
    email: str
    role: str = "passenger"


def _unauthorized(detail: str, code: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"detail": detail, "code": code},
        headers={"WWW-Authenticate": "Bearer"},
    )


def create_access_token(user_id: int, email: str, role: str) -> str:
    settings = get_settings()
    if not settings.jwt_secret:
        raise RuntimeError("JWT_SECRET is not configured")
    now = datetime.now(timezone.utc)
    claims = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> UserPayload:
    settings = get_settings()
    if not settings.jwt_secret:
        raise RuntimeError("JWT_SECRET is not configured")
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return UserPayload(
            user_id=int(claims["sub"]),
            email=claims.get("email", ""),
            role=claims.get("role", "passenger"),
        )
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Session expired, please sign in again", "AUTH_EXPIRED") from None
    except (jwt.PyJWTError, KeyError, ValueError):
        raise _unauthorized("Could not validate credentials", "AUTH_INVALID") from None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
) -> UserPayload:
    """The signed-in user from the Authorization: Bearer header."""
    if credentials is None or not credentials.credentials:
        raise _unauthorized("Authentication required", "AUTH_REQUIRED")
    return decode_access_token(credentials.credentials)


def get_current_user_id(request: Request) -> int:
    """Return the signed-in user's ID.

    Identity set on request.state by trusted middleware wins; otherwise the bearer
    token is verified. Used by the wallet routes.
    """
    user_id = getattr(request.state, "user_id", None)
    if isinstance(user_id, int) and not isinstance(user_id, bool) and user_id > 0:
        return user_id

    scheme, _, token = (getattr(request, "headers", {}).get("authorization") or "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise _unauthorized("Authentication required", "AUTH_REQUIRED")
    return decode_access_token(token.strip()).user_id


def require_role(allowed_roles: list[str]):
    """Dependency factory: allow the listed roles; admin may do anything."""

    def role_checker(current_user: UserPayload = Depends(get_current_user)) -> UserPayload:
        if current_user.role != "admin" and current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"detail": "Operation not permitted for your role", "code": "PERMISSION_DENIED"},
            )
        return current_user

    return role_checker
