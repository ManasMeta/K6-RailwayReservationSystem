import pytest

from app.core.auth import UserPayload, get_current_user
from app.main import app


@pytest.fixture(autouse=True)
def signed_in_admin():
    """The operations endpoints are staff/admin only; these tests exercise them as an admin."""
    app.dependency_overrides[get_current_user] = lambda: UserPayload(
        user_id=1, email="admin@example.com", role="admin"
    )
    yield
    app.dependency_overrides.pop(get_current_user, None)
