from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.core.auth import get_current_user_id


def test_missing_user_identity_is_rejected():
    request = SimpleNamespace(state=SimpleNamespace())

    with pytest.raises(HTTPException) as exc:
        get_current_user_id(request)

    assert exc.value.status_code == 401


@pytest.mark.parametrize("user_id", [None, 0, -1, True, "42", 42.0])
def test_invalid_user_identity_is_rejected(user_id):
    request = SimpleNamespace(state=SimpleNamespace(user_id=user_id))

    with pytest.raises(HTTPException) as exc:
        get_current_user_id(request)

    assert exc.value.status_code == 401


def test_positive_integer_user_identity_is_accepted():
    request = SimpleNamespace(state=SimpleNamespace(user_id=42))

    assert get_current_user_id(request) == 42
