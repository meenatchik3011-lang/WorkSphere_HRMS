
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User


# =====================================================
# SECURITY CONFIGURATION
# =====================================================

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = (
    settings.access_token_expire_minutes
)

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)

# Swagger obtains tokens from the form-based endpoint.
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/token",
)


# =====================================================
# PASSWORD HASHING
# =====================================================

def hash_password(password: str) -> str:
    """Hash a password before saving it to the database."""

    if not password:
        raise ValueError("Password cannot be empty.")

    if len(password.encode("utf-8")) > 72:
        raise ValueError(
            "Password must not exceed 72 UTF-8 bytes."
        )

    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    """Verify a password against its stored hash."""

    if not plain_password or not hashed_password:
        return False

    if len(plain_password.encode("utf-8")) > 72:
        return False

    try:
        return pwd_context.verify(
            plain_password,
            hashed_password,
        )
    except (ValueError, TypeError):
        return False


# =====================================================
# JWT TOKEN CREATION
# =====================================================

def create_token(user: User) -> str:
    """Create a signed JWT for an authenticated user."""

    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user.id),
        "role": user.role,
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        settings.secret_key,
        algorithm=ALGORITHM,
    )


def create_access_token(user: User) -> str:
    """Compatibility alias for existing code."""
    return create_token(user)


# =====================================================
# GET CURRENT AUTHENTICATED USER
# =====================================================

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Validate a JWT and retrieve the current database user."""

    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[ALGORITHM],
        )

        subject = payload.get("sub")

        if subject is None:
            raise credentials_error

        user_id = int(subject)

    except (JWTError, ValueError, TypeError):
        raise credentials_error

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if user is None:
        raise credentials_error

    return user


# =====================================================
# ROLE-BASED ACCESS CONTROL
# =====================================================

def require_roles(*allowed_roles: str):
    """
    Restrict endpoint access to specified roles.

    Example:
        Depends(require_roles("HR", "ADMIN"))
    """

    def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:

        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You do not have permission "
                    "to access this resource."
                ),
            )

        return current_user

    return role_checker




