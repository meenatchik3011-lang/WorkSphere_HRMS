
from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .database import Base


# =====================================================
# 1. USERS TABLE
# =====================================================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    username = Column(
        String(80),
        unique=True,
        nullable=False,
        index=True,
    )

    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    hashed_password = Column(
        String(255),
        nullable=False,
    )

    role = Column(
        String(20),
        nullable=False,
        default="EMPLOYEE",
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    employee = relationship(
        "Employee",
        back_populates="user",
        uselist=False,
    )

    notifications = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint(
            "role IN ('EMPLOYEE', 'HR', 'ADMIN')",
            name="check_user_role",
        ),
    )


# =====================================================
# 2. EMPLOYEES TABLE
# =====================================================

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        unique=True,
        nullable=True,
        index=True,
    )

    full_name = Column(
        String(160),
        nullable=False,
    )

    designation = Column(
        String(120),
        nullable=False,
        default="",
    )

    department = Column(
        String(120),
        nullable=False,
        default="",
        index=True,
    )

    joining_date = Column(
        Date,
        nullable=False,
        default=date.today,
    )

    salary = Column(
        Float,
        nullable=False,
        default=0.0,
    )

    status = Column(
        String(20),
        nullable=False,
        default="ACTIVE",
        index=True,
    )

    # Relationships
    user = relationship(
        "User",
        back_populates="employee",
    )

    attendance_records = relationship(
        "Attendance",
        back_populates="employee",
        cascade="all, delete-orphan",
    )

    leave_requests = relationship(
        "Leave",
        back_populates="employee",
        cascade="all, delete-orphan",
    )

    payroll_records = relationship(
        "Payroll",
        back_populates="employee",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('ACTIVE', 'INACTIVE')",
            name="check_employee_status",
        ),
        CheckConstraint(
            "salary >= 0",
            name="check_employee_salary",
        ),
    )


# =====================================================
# 3. ATTENDANCE TABLE
# =====================================================

class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    check_in = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    check_out = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    date = Column(
        Date,
        nullable=False,
        default=date.today,
        index=True,
    )

    status = Column(
        String(20),
        nullable=False,
        default="PRESENT",
    )

    employee = relationship(
        "Employee",
        back_populates="attendance_records",
    )

    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "date",
            name="unique_employee_attendance_per_day",
        ),
        CheckConstraint(
            "status IN ('PRESENT', 'ABSENT', 'HALF_DAY')",
            name="check_attendance_status",
        ),
    )

    @property
    def working_hours(self):
        if self.check_in is None or self.check_out is None:
            return None

        hours = (
            self.check_out - self.check_in
        ).total_seconds() / 3600

        return round(max(hours, 0), 2)


# =====================================================
# 4. LEAVES TABLE
# =====================================================

class Leave(Base):
    __tablename__ = "leaves"

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    leave_type = Column(
        String(20),
        nullable=False,
    )

    start_date = Column(
        Date,
        nullable=False,
    )

    end_date = Column(
        Date,
        nullable=False,
    )

    reason = Column(
        Text,
        nullable=False,
        default="",
    )

    status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    employee = relationship(
        "Employee",
        back_populates="leave_requests",
    )

    __table_args__ = (
        CheckConstraint(
            "leave_type IN ('SICK', 'CASUAL', 'PAID')",
            name="check_leave_type",
        ),
        CheckConstraint(
            "status IN ('PENDING', 'APPROVED', 'REJECTED')",
            name="check_leave_status",
        ),
        CheckConstraint(
            "end_date >= start_date",
            name="check_leave_date_range",
        ),
    )


# =====================================================
# 5. PAYROLL TABLE
# =====================================================

class Payroll(Base):
    __tablename__ = "payroll"

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    basic_salary = Column(
        Float,
        nullable=False,
        default=0.0,
    )

    deductions = Column(
        Float,
        nullable=False,
        default=0.0,
    )

    bonus = Column(
        Float,
        nullable=False,
        default=0.0,
    )

    net_salary = Column(
        Float,
        nullable=False,
        default=0.0,
    )

    month = Column(
        String(7),
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    employee = relationship(
        "Employee",
        back_populates="payroll_records",
    )

    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "month",
            name="unique_employee_payroll_per_month",
        ),
        CheckConstraint(
            "basic_salary >= 0",
            name="check_payroll_basic_salary",
        ),
        CheckConstraint(
            "deductions >= 0",
            name="check_payroll_deductions",
        ),
        CheckConstraint(
            "bonus >= 0",
            name="check_payroll_bonus",
        ),
        CheckConstraint(
            "net_salary >= 0",
            name="check_payroll_net_salary",
        ),
    )


# =====================================================
# 6. NOTIFICATIONS TABLE
# =====================================================

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title = Column(
        String(160),
        nullable=False,
    )

    message = Column(
        Text,
        nullable=False,
    )

    is_read = Column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    user = relationship(
        "User",
        back_populates="notifications",
    )

