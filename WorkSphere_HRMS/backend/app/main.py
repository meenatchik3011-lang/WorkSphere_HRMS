
from datetime import date, datetime

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    Query,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from .database import Base, engine, get_db
from . import models, schemas
from .security import (
    hash_password,
    verify_password,
    create_token,
    get_current_user,
    require_roles,
)


# =====================================================
# DATABASE INITIALIZATION
# =====================================================

Base.metadata.create_all(bind=engine)


# =====================================================
# FASTAPI APPLICATION
# =====================================================

app = FastAPI(
    title="WorkSphere HRMS API",
    description="Human Resource Management System API",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================
# COMMON HELPER FUNCTIONS
# =====================================================

def commit_changes(db: Session):
    """Commit database changes and handle database errors."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="The operation conflicts with existing database records.",
        )
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="A database error occurred.",
        )


def notify(
    db: Session,
    user_id: int,
    title: str,
    message: str,
):
    """Add a notification to the current transaction."""
    notification = models.Notification(
        user_id=user_id,
        title=title,
        message=message,
    )
    db.add(notification)


def notify_all_admins(
    db: Session,
    title: str,
    message: str,
):
    """Add a notification for every Admin user in the same transaction."""
    admin_users = (
        db.query(models.User)
        .filter(func.upper(models.User.role) == "ADMIN")
        .all()
    )

    for admin_user in admin_users:
        notify(db, admin_user.id, title, message)


def employee_for_user(
    db: Session,
    user: models.User,
) -> models.Employee:
    """Find the employee profile linked to the current user."""
    employee = (
        db.query(models.Employee)
        .filter(models.Employee.user_id == user.id)
        .first()
    )

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="No employee profile is linked to this user.",
        )

    return employee


def get_employee_or_404(
    db: Session,
    employee_id: int,
) -> models.Employee:
    """Retrieve an employee or return 404."""
    employee = (
        db.query(models.Employee)
        .filter(models.Employee.id == employee_id)
        .first()
    )

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found.",
        )

    return employee


# =====================================================
# ROOT ENDPOINT
# =====================================================

@app.get("/", tags=["Root"])
def root():
    return {
        "message": "WorkSphere HRMS API is running",
        "documentation": "/docs",
        "version": "1.0.0",
    }


# =====================================================
# MODULE 1: AUTHENTICATION
# =====================================================

@app.post(
    "/api/auth/register",
    response_model=schemas.UserOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Authentication"],
)
def register(
    payload: schemas.RegisterIn,
    db: Session = Depends(get_db),
):
    existing_user = (
        db.query(models.User)
        .filter(
            or_(
                models.User.email == payload.email,
                models.User.username == payload.username,
            )
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Username or email already exists.",
        )

    user = models.User(
        username=payload.username,
        email=str(payload.email).lower(),
        hashed_password=hash_password(payload.password),
        role="EMPLOYEE",
    )

    db.add(user)
    commit_changes(db)
    db.refresh(user)

    return user


@app.post(
    "/api/auth/login",
    tags=["Authentication"],
)
def login(
    payload: schemas.LoginIn,
    db: Session = Depends(get_db),
):
    email = str(payload.email).lower()

    user = (
        db.query(models.User)
        .filter(func.lower(models.User.email) == email)
        .first()
    )

    if not user or not verify_password(
        payload.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_token(user)

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "user": schemas.UserOut.model_validate(user).model_dump(
            mode="json"
        ),
    }



@app.post(
    "/api/auth/token",
    tags=["Authentication"],
    include_in_schema=False,
)
def swagger_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """OAuth2 form-based login endpoint used by Swagger UI."""
    email = form_data.username.strip().lower()

    user = (
        db.query(models.User)
        .filter(func.lower(models.User.email) == email)
        .first()
    )

    if user is None or not verify_password(
        form_data.password,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "access_token": create_token(user),
        "token_type": "bearer",
    }

@app.get(
    "/api/auth/me",
    response_model=schemas.UserOut,
    tags=["Authentication"],
)
def me(
    user: models.User = Depends(get_current_user),
):
    return user


# =====================================================
# MODULE 2: EMPLOYEE MANAGEMENT
# =====================================================

@app.get(
    "/api/employees",
    tags=["Employees"],
)
def list_employees(
    q: str = Query(default="", max_length=100),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    query = db.query(models.Employee)

    # Employees can only see their own profile.
    if user.role == "EMPLOYEE":
        query = query.filter(
            models.Employee.user_id == user.id
        )

    if q.strip():
        search_term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.Employee.full_name.ilike(search_term),
                models.Employee.department.ilike(search_term),
                models.Employee.designation.ilike(search_term),
            )
        )

    return query.order_by(
        models.Employee.id.desc()
    ).all()


@app.get(
    "/api/employees/{employee_id}",
    tags=["Employees"],
)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    employee = get_employee_or_404(db, employee_id)

    if (
        user.role == "EMPLOYEE"
        and employee.user_id != user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only view your own employee profile.",
        )

    return employee


@app.post(
    "/api/employees",
    status_code=status.HTTP_201_CREATED,
    tags=["Employees"],
)
def create_employee(
    payload: schemas.EmployeeIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    if payload.user_id is not None:
        linked_user = (
            db.query(models.User)
            .filter(models.User.id == payload.user_id)
            .first()
        )

        if not linked_user:
            raise HTTPException(
                status_code=404,
                detail="Linked user not found.",
            )

        existing_employee = (
            db.query(models.Employee)
            .filter(
                models.Employee.user_id == payload.user_id
            )
            .first()
        )

        if existing_employee:
            raise HTTPException(
                status_code=409,
                detail="This user already has an employee profile.",
            )

    employee = models.Employee(
        **payload.model_dump()
    )

    db.add(employee)
    commit_changes(db)
    db.refresh(employee)

    return employee


@app.put(
    "/api/employees/{employee_id}",
    tags=["Employees"],
)
def update_employee(
    employee_id: int,
    payload: schemas.EmployeeIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    employee = get_employee_or_404(db, employee_id)
    data = payload.model_dump()

    if data["user_id"] is not None:
        linked_user = (
            db.query(models.User)
            .filter(models.User.id == data["user_id"])
            .first()
        )

        if not linked_user:
            raise HTTPException(
                status_code=404,
                detail="Linked user not found.",
            )

        duplicate = (
            db.query(models.Employee)
            .filter(
                models.Employee.user_id == data["user_id"],
                models.Employee.id != employee_id,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="This user is linked to another employee.",
            )

    for field, value in data.items():
        setattr(employee, field, value)

    commit_changes(db)
    db.refresh(employee)

    return employee


@app.delete(
    "/api/employees/{employee_id}",
    tags=["Employees"],
)
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    # Soft deletion preserves historical attendance,
    # leave and payroll records.
    employee = get_employee_or_404(db, employee_id)

    employee.status = "INACTIVE"

    commit_changes(db)

    return {
        "message": "Employee deactivated successfully.",
        "employee_id": employee.id,
        "status": employee.status,
    }


# =====================================================
# MODULE 3: ATTENDANCE MANAGEMENT
# =====================================================

@app.get(
    "/api/attendance",
    tags=["Attendance"],
)
def attendance_history(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    query = db.query(models.Attendance)

    if user.role == "EMPLOYEE":
        employee = employee_for_user(db, user)
        query = query.filter(
            models.Attendance.employee_id == employee.id
        )

    return query.order_by(
        models.Attendance.date.desc(),
        models.Attendance.id.desc(),
    ).limit(300).all()


@app.post(
    "/api/attendance/check-in",
    tags=["Attendance"],
)
def check_in(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    employee = employee_for_user(db, user)

    if employee.status != "ACTIVE":
        raise HTTPException(
            status_code=403,
            detail="Inactive employees cannot check in.",
        )

    today = date.today()

    record = (
        db.query(models.Attendance)
        .filter_by(
            employee_id=employee.id,
            date=today,
        )
        .first()
    )

    if record and record.check_in:
        raise HTTPException(
            status_code=409,
            detail="Already checked in today.",
        )

    if record is None:
        record = models.Attendance(
            employee_id=employee.id,
            date=today,
            status="PRESENT",
        )
        db.add(record)

    record.check_in = datetime.now()

    commit_changes(db)
    db.refresh(record)

    return record


@app.post(
    "/api/attendance/check-out",
    tags=["Attendance"],
)
def check_out(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    employee = employee_for_user(db, user)

    record = (
        db.query(models.Attendance)
        .filter_by(
            employee_id=employee.id,
            date=date.today(),
        )
        .first()
    )

    if not record or not record.check_in:
        raise HTTPException(
            status_code=400,
            detail="Check in before checking out.",
        )

    if record.check_out:
        raise HTTPException(
            status_code=409,
            detail="Already checked out today.",
        )

    record.check_out = datetime.now()

    working_hours = round(
        (
            record.check_out - record.check_in
        ).total_seconds() / 3600,
        2,
    )

    if working_hours < 0:
        raise HTTPException(
            status_code=400,
            detail="Check-out time cannot precede check-in time.",
        )

    commit_changes(db)
    db.refresh(record)

    return {
        "id": record.id,
        "employee_id": record.employee_id,
        "date": record.date,
        "check_in": record.check_in,
        "check_out": record.check_out,
        "status": record.status,
        "working_hours": working_hours,
    }


@app.post(
    "/api/attendance/mark",
    tags=["Attendance"],
)
def mark_attendance(
    payload: schemas.AttendanceIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    """Create or update an employee's attendance for the submitted date.

    AttendanceIn.status should allow PRESENT, HALF_DAY, and ABSENT.
    """
    employee = get_employee_or_404(
        db, payload.employee_id
    )

    record = (
        db.query(models.Attendance)
        .filter_by(
            employee_id=employee.id,
            date=payload.date,
        )
        .first()
    )

    if record is None:
        record = models.Attendance(
            employee_id=employee.id,
            date=payload.date,
            status=payload.status,
        )
        db.add(record)
    else:
        record.status = payload.status

    commit_changes(db)
    db.refresh(record)

    return record


# =====================================================
# MODULE 4: LEAVE MANAGEMENT
# =====================================================

@app.get(
    "/api/leaves",
    tags=["Leaves"],
)
def list_leaves(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    query = db.query(models.Leave)

    if user.role == "EMPLOYEE":
        employee = employee_for_user(db, user)

        query = query.filter(
            models.Leave.employee_id == employee.id
        )

    return query.order_by(
        models.Leave.created_at.desc()
    ).all()


@app.post(
    "/api/leaves",
    status_code=status.HTTP_201_CREATED,
    tags=["Leaves"],
)
def apply_leave(
    payload: schemas.LeaveIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if payload.end_date < payload.start_date:
        raise HTTPException(
            status_code=422,
            detail="End date cannot be before start date.",
        )

    employee = get_employee_or_404(
        db, payload.employee_id
    )

    if user.role == "EMPLOYEE":
        own_employee = employee_for_user(db, user)

        if payload.employee_id != own_employee.id:
            raise HTTPException(
                status_code=403,
                detail="You can only apply for your own leave.",
            )

    if employee.status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Inactive employees cannot apply for leave.",
        )

    leave = models.Leave(
        **payload.model_dump(),
        status="PENDING",
    )

    db.add(leave)

    # Notify the employee that their request was submitted.
    if employee.user_id:
        notify(
            db,
            employee.user_id,
            "Leave submitted",
            "Your leave request is pending review.",
        )

    # Automatically notify every Admin when an employee submits leave.
    if user.role == "EMPLOYEE":
        notify_all_admins(
            db,
            "New leave request",
            f"{employee.full_name} submitted a leave request "
            f"from {payload.start_date} to {payload.end_date}.",
        )

    commit_changes(db)
    db.refresh(leave)

    return leave


@app.patch(
    "/api/leaves/{leave_id}",
    tags=["Leaves"],
)
def decide_leave(
    leave_id: int,
    payload: schemas.LeaveDecision,
    db: Session = Depends(get_db),
    user: models.User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    leave = (
        db.query(models.Leave)
        .filter(models.Leave.id == leave_id)
        .first()
    )

    if not leave:
        raise HTTPException(
            status_code=404,
            detail="Leave request not found.",
        )

    if leave.status != "PENDING":
        raise HTTPException(
            status_code=409,
            detail="This leave request has already been processed.",
        )

    leave.status = payload.status

    employee = (
        db.query(models.Employee)
        .filter(models.Employee.id == leave.employee_id)
        .first()
    )

    if employee and employee.user_id:
        notify(
            db,
            employee.user_id,
            f"Leave {payload.status.lower()}",
            f"Your leave request has been {payload.status.lower()}.",
        )

    commit_changes(db)
    db.refresh(leave)

    return leave


# =====================================================
# MODULE 5: PAYROLL MANAGEMENT
# =====================================================

@app.get(
    "/api/payroll",
    tags=["Payroll"],
)
def list_payroll(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    query = db.query(models.Payroll)

    if user.role == "EMPLOYEE":
        employee = employee_for_user(db, user)

        query = query.filter(
            models.Payroll.employee_id == employee.id
        )

    return query.order_by(
        models.Payroll.month.desc()
    ).all()


@app.post(
    "/api/payroll",
    status_code=status.HTTP_201_CREATED,
    tags=["Payroll"],
)
def generate_payroll(
    payload: schemas.PayrollIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    employee = get_employee_or_404(
        db, payload.employee_id
    )

    existing = (
        db.query(models.Payroll)
        .filter_by(
            employee_id=employee.id,
            month=payload.month,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Payroll already exists for this employee and month.",
        )

    data = payload.model_dump()

    net_salary = round(
        data["basic_salary"]
        + data["bonus"]
        - data["deductions"],
        2,
    )

    if net_salary < 0:
        raise HTTPException(
            status_code=422,
            detail="Net salary cannot be negative.",
        )

    data["net_salary"] = net_salary

    payroll = models.Payroll(**data)
    db.add(payroll)

    if employee.user_id:
        notify(
            db,
            employee.user_id,
            "Payroll generated",
            f"Your payroll for {payroll.month} is available.",
        )

    commit_changes(db)
    db.refresh(payroll)

    return payroll


# =====================================================
# MODULE 6: DASHBOARD AND ANALYTICS
# =====================================================

@app.get(
    "/api/dashboard",
    tags=["Dashboard"],
)
def dashboard(
    db: Session = Depends(get_db),
    user: models.User = Depends(
        require_roles("HR", "ADMIN")
    ),
):
    today = date.today()

    total_employees = (
        db.query(models.Employee).count()
    )

    active_employees = (
        db.query(models.Employee)
        .filter_by(status="ACTIVE")
        .count()
    )

    present_today = (
        db.query(models.Attendance)
        .filter_by(
            date=today,
            status="PRESENT",
        )
        .count()
    )

    pending_leaves = (
        db.query(models.Leave)
        .filter_by(status="PENDING")
        .count()
    )

    approved_leaves = (
        db.query(models.Leave)
        .filter_by(status="APPROVED")
        .count()
    )

    rejected_leaves = (
        db.query(models.Leave)
        .filter_by(status="REJECTED")
        .count()
    )

    payroll_records = (
        db.query(models.Payroll).count()
    )

    payroll_total = (
        db.query(func.sum(models.Payroll.net_salary))
        .scalar()
        or 0
    )

    return {
        "total_employees": total_employees,
        "active_employees": active_employees,
        "present_today": present_today,
        "pending_leaves": pending_leaves,
        "approved_leaves": approved_leaves,
        "rejected_leaves": rejected_leaves,
        "payroll_records": payroll_records,
        "payroll_total": round(float(payroll_total), 2),
    }


# =====================================================
# MODULE 7: NOTIFICATIONS
# =====================================================

class NotificationCreate(BaseModel):
    employee_id: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=2000)


@app.post(
    "/api/notifications",
    status_code=status.HTTP_201_CREATED,
    tags=["Notifications"],
)
def create_notification(
    payload: NotificationCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_roles("HR", "ADMIN")),
):
    """Create a notification for an employee who has a linked user account."""
    employee = get_employee_or_404(db, payload.employee_id)

    if employee.user_id is None:
        raise HTTPException(
            status_code=400,
            detail="This employee has no linked user account.",
        )

    title = payload.title.strip()
    message = payload.message.strip()

    if not title or not message:
        raise HTTPException(
            status_code=422,
            detail="Title and message cannot be blank.",
        )

    notification = models.Notification(
        user_id=employee.user_id,
        title=title,
        message=message,
    )

    db.add(notification)
    commit_changes(db)
    db.refresh(notification)

    return notification


@app.get(
    "/api/notifications",
    tags=["Notifications"],
)
def notifications(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == user.id
        )
        .order_by(
            models.Notification.created_at.desc()
        )
        .all()
    )


@app.patch(
    "/api/notifications/{notification_id}/read",
    tags=["Notifications"],
)
def read_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    notification = (
        db.query(models.Notification)
        .filter(
            models.Notification.id == notification_id,
            models.Notification.user_id == user.id,
        )
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=404,
            detail="Notification not found.",
        )

    notification.is_read = True

    commit_changes(db)
    db.refresh(notification)

    return notification

@app.patch(
    "/api/notifications/read-all",
    tags=["Notifications"],
)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Mark all notifications belonging to the current user as read."""
    updated_count = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == user.id,
            models.Notification.is_read.is_(False),
        )
        .update(
            {models.Notification.is_read: True},
            synchronize_session=False,
        )
    )

    commit_changes(db)

    return {
        "message": "All notifications marked as read.",
        "updated_count": updated_count,
    }


