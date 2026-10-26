from pydantic import BaseModel, Field, field_validator

# Mirrors the email_addr and mobile_no domains in db/migrations/0100_g1_accounts.
EMAIL_PATTERN = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
MOBILE_PATTERN = r"^[6-9][0-9]{9}$"
MAX_SAVED_PASSENGERS = 10


class SignupRequest(BaseModel):
    email: str = Field(pattern=EMAIL_PATTERN, max_length=254)
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=1, max_length=100)
    phone: str | None = Field(default=None, pattern=MOBILE_PATTERN)

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("full_name must not be blank")
        return value

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        # bcrypt only reads the first 72 bytes; refuse rather than silently truncate.
        if len(value.encode("utf-8")) > 72:
            raise ValueError("password must be at most 72 bytes")
        return value


class LoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=72)


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    phone: str | None = Field(default=None, pattern=MOBILE_PATTERN)

    _strip_name = field_validator("full_name")(SignupRequest.strip_name.__func__)


class UserOut(BaseModel):
    user_id: int
    email: str
    full_name: str
    phone: str | None = None
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class SavedPassengerIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=1, le=125)
    gender: str = Field(min_length=1, max_length=10)
    berth_preference: str | None = Field(default=None, max_length=20)
    senior_citizen: bool = False


class SavedPassengerOut(SavedPassengerIn):
    passenger_id: int
    user_id: int
