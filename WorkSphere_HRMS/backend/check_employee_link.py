
from app.database import SessionLocal
from app.models import User, Employee

db = SessionLocal()

try:
    print("\n--- USERS ---")
    for user in db.query(User).all():
        print(
            "User ID:", user.id,
            "| Username:", user.username,
            "| Email:", user.email,
            "| Role:", user.role
        )

    print("\n--- EMPLOYEES ---")
    for employee in db.query(Employee).all():
        print(
            "Employee ID:", employee.id,
            "| User ID:", employee.user_id,
            "| Name:", employee.full_name,
            "| Status:", employee.status
        )
finally:
    db.close()
