
import sqlite3
import shutil
from pathlib import Path

db_path = Path("worksphere.db")

# Create a backup before changing the database
shutil.copy2(db_path, "worksphere_backup.db")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("""
    UPDATE users
    SET email = ?
    WHERE id = ? AND username = ?
""", ("admin@worksphere.com", 1, "admin"))

if cursor.rowcount == 1:
    conn.commit()
    print("Admin email updated successfully!")
else:
    conn.rollback()
    print("Admin user not found. No changes made.")

cursor.execute("SELECT id, username, email, role FROM users")
print("Current users:", cursor.fetchall())

conn.close()
