from fastapi import Request
from fastapi.responses import JSONResponse


class AccountsError(Exception):
    """Error rendered as {"detail": "...", "code": "..."}."""

    def __init__(self, status_code: int, detail: str, code: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.code = code


async def accounts_error_handler(request: Request, exc: AccountsError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": exc.code},
    )
