
from app.database import SessionLocal
from app.models import User

db = SessionLocal()

try:
    users = db.query(User).order_by(User.id).all()

    print("\n========== WORKSPHERE USER LIST ==========")

    for user in users:
        print(
            f"ID: {user.id} | "
            f"Username: {user.username} | "
            f"Email: {user.email} | "
            f"Role: {user.role}"
        )

    print("==========================================")

finally:
    db.close()
