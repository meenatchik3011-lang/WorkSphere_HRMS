
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from datetime import date
from typing import Optional, Literal


# =========================
# USER ROLES
# =========================

Role = Literal["EMPLOYEE", "HR", "ADMIN"]

EmployeeStatus = Literal["ACTIVE", "INACTIVE"]

AttendanceStatus = Literal["PRESENT", "ABSENT", "HALF_DAY"]

LeaveType = Literal["SICK", "CASUAL", "PAID"]

LeaveStatus = Literal["PENDING", "APPROVED", "REJECTED"]


# =========================
# USER REGISTRATION
# =========================

class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Role = "EMPLOYEE"


# =========================
# USER LOGIN
# =========================

class LoginIn(BaseModel):
    email: EmailStr
    password: str


# =========================
# USER RESPONSE
# =========================

class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: Role

    model_config = ConfigDict(from_attributes=True)


# =========================
# EMPLOYEE MANAGEMENT
# =========================

class EmployeeIn(BaseModel):
    user_id: Optional[int] = None
    full_name: str = Field(min_length=1, max_length=160)
    designation: str = ""
    department: str = ""
    joining_date: date
    salary: float = Field(ge=0)
    status: EmployeeStatus = "ACTIVE"


class EmployeeOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    full_name: str
    designation: str
    department: str
    joining_date: date
    salary: float
    status: EmployeeStatus

    model_config = ConfigDict(from_attributes=True)


# =========================
# ATTENDANCE MANAGEMENT
# =========================

class AttendanceIn(BaseModel):
    employee_id: int = Field(gt=0)
    date: date
    status: AttendanceStatus = "PRESENT"


class AttendanceOut(BaseModel):
    id: int
    employee_id: int
    date: date
    status: AttendanceStatus

    model_config = ConfigDict(from_attributes=True)


# =========================
# LEAVE MANAGEMENT
# =========================

class LeaveIn(BaseModel):
    employee_id: int
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: str = Field(default="", max_length=2000)


class LeaveDecision(BaseModel):
    status: Literal["APPROVED", "REJECTED"]


# =========================
# PAYROLL MANAGEMENT
# =========================

class PayrollIn(BaseModel):
    employee_id: int
    basic_salary: float = Field(ge=0)
    deductions: float = Field(default=0, ge=0)
    bonus: float = Field(default=0, ge=0)
    month: str = Field(
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$"
    )


# =========================
# ROLE MANAGEMENT
# =========================

class UserRoleUpdate(BaseModel):
    role: Role
