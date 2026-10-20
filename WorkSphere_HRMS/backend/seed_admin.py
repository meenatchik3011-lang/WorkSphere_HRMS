from app.database import Base, engine, SessionLocal
from app.models import User
from app.security import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()
try:
    email = "admin@worksphere.local"
    user = db.query(User).filter_by(email=email).first()
    if user:
        print("Demo admin already exists.")
    else:
        db.add(User(username="admin", email=email, hashed_password=hash_password("Admin@12345"), role="ADMIN"))
        db.commit()
        print("Demo admin created.")
finally:
    db.close()
