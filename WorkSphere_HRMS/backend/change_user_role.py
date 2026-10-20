
from app.database import SessionLocal
from app.models import User

TARGET_EMAIL = "hr@worksphere.com"
NEW_ROLE = "HR"  # EMPLOYEE, HR, or ADMIN

db = SessionLocal()

try:
    user = (
        db.query(User)
        .filter(User.email.ilike(TARGET_EMAIL))
        .first()
    )

    if user is None:
        print(f"User not found: {TARGET_EMAIL}")
    else:
        user.role = NEW_ROLE
        db.commit()
        db.refresh(user)

        print("Role updated successfully.")
        print(f"User ID : {user.id}")
        print(f"Username: {user.username}")
        print(f"Email   : {user.email}")
        print(f"New role: {user.role}")

except Exception as exc:
    db.rollback()
    print("Could not update role:", exc)

finally:
    db.close()
