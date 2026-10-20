import sqlite3

conn = sqlite3.connect("worksphere.db")
cursor = conn.cursor()

cursor.execute("SELECT id, username, email, role FROM users")

for user in cursor.fetchall():
    print(user)

conn.close()