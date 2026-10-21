from fastapi import HTTPException, Request, status


def get_current_user_id(request: Request) -> int:
    """Return the user ID established by trusted authentication middleware."""
    user_id = getattr(request.state, "user_id", None)

    if (
        not isinstance(user_id, int)
        or isinstance(user_id, bool)
        or user_id <= 0
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user_id
