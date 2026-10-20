
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import (
    hash_password,
    verify_password,
    create_token,
    get_current_user,
)


# ==========================================
# Router Configuration
# ==========================================

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


# ==========================================
# Role Definition
# ==========================================

Role = Literal["EMPLOYEE", "HR", "ADMIN"]


# ==========================================
# Pydantic Schemas
# ==========================================

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role: Role = "EMPLOYEE"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: Role
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class UserRoleUpdate(BaseModel):
    role: Role


# ==========================================
# User Registration
# ==========================================

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    data: RegisterRequest,
    db: Session = Depends(get_db),
):
    existing_user = (
        db.query(User)
        .filter(
            (User.email == str(data.email))
            | (User.username == data.username)
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already exists",
        )

    # Public registration always creates an EMPLOYEE.
    # Never trust a role supplied by a public client.
    user = User(
        username=data.username,
        email=str(data.email),
        hashed_password=hash_password(data.password),
        role="EMPLOYEE",
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already exists",
        )

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to register user",
        )

    return user


# ==========================================
# JSON Login (Frontend)
# ==========================================

@router.post("/login")
def login_user(
    data: LoginRequest,
    db: Session = Depends(get_db),
):
    user = (
        db.query(User)
        .filter(User.email == str(data.email))
        .first()
    )

    if user is None or not verify_password(
        data.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_token(user)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "user": UserResponse.model_validate(user).model_dump(
            mode="json"
        ),
    }


# ==========================================
# OAuth2 Token Endpoint (Swagger)
# ==========================================

@router.post("/token", include_in_schema=False)
def swagger_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    # Swagger's username field accepts the user's email.
    user = (
        db.query(User)
        .filter(User.email == form_data.username)
        .first()
    )

    if user is None or not verify_password(
        form_data.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "access_token": create_token(user),
        "token_type": "bearer",
    }


# ==========================================
# Current User Profile
# ==========================================

@router.get(
    "/me",
    response_model=UserResponse,
)
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return current_user


