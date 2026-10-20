WorkSphere – HR Management System (HRMS)
WorkSphere is a full-stack HR Management System built with FastAPI, SQLAlchemy, SQLite, JWT authentication, and React with Vite. It provides core HR workflows for employee management, attendance, leave requests, payroll, dashboard KPIs, and notifications.
> **Project status:** Learning/demo application. Review security, authorization rules, audit logging, and payroll/legal requirements before production use.
Features
Authentication and roles: `EMPLOYEE`, `HR`, and `ADMIN`
Employee management: Manage employee records and status
Attendance management: Check-in, check-out, and working-hours tracking
Leave management: Submit leave requests and allow HR/Admin to approve or reject them
Payroll management: Generate and list payroll records
Dashboard and analytics: View key workforce and payroll statistics
Notifications: View notifications and mark them as read
Technology Stack
Backend
Python 3.10+
FastAPI
SQLAlchemy
SQLite
JWT authentication
Frontend
Node.js 18+
React
Vite
Project Structure
```text
WorkSphere_HRMS/
├── backend/
│   ├── app/
│   │   └── main.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── seed_admin.py
│   └── worksphere.db          # Created automatically when the app runs
└── frontend/
    ├── src/
    ├── package.json
    └── ...
```
The structure above is representative; your local project may contain additional files.
Prerequisites
Install the following before running the project:
Python 3.10 or newer
Node.js 18 or newer
npm (included with Node.js)
Verify the installations in PowerShell:
```powershell
python --version
node --version
npm --version
```
Setup and Run the Backend (Windows PowerShell)
Open PowerShell in the project root, then run:
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python seed_admin.py
python -m uvicorn app.main:app --reload
```
If PowerShell blocks activation scripts, run this command for the current terminal session, then activate the environment again:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```
The backend normally runs at:
API base URL: http://127.0.0.1:8000
Interactive API documentation: http://127.0.0.1:8000/docs
Demo Admin Account
The starter configuration lists these demo credentials:
Email: `admin@worksphere.local`
Password: `Admin@12345`
Use these credentials only for local development. Change the password and JWT secret before any deployment. If your local seed script uses different credentials, follow the values defined in that script.
Environment Configuration
The `.env` file is created from `.env.example`. Keep `.env` private and do not commit secrets to version control. Set a strong, unique JWT secret before deployment.
Database
SQLite is used for local development. The database is created automatically at:
```text
backend/worksphere.db
```
Back up the database before making schema or data changes. Automatic table creation does not necessarily migrate existing tables when models change.
Setup and Run the Frontend
Open a second PowerShell terminal from the project root:
```powershell
cd frontend
npm install
npm run dev
```
Open the Vite URL printed in the terminal. It is normally:
http://localhost:5173
Keep both terminals running while using the application: one for FastAPI and one for Vite.
API Documentation and Testing
Start the backend.
Open http://127.0.0.1:8000/docs.
Use the authentication endpoints to register or log in.
Authorize requests as needed.
Test employee, attendance, leave, payroll, dashboard, and notification endpoints.
API access depends on the logged-in user's role. Employee self-service is restricted to the employee linked to the account where implemented. HR/Admin users can manage organization-wide records where permitted by the backend authorization rules.
Typical Workflows
Employee
Log in.
View the linked employee profile.
Check in and check out.
Submit a leave request and track its status.
View personal payroll records.
View notifications and mark them as read.
HR/Admin
Log in with an authorized HR/Admin account.
Manage employee records.
Review and approve or reject leave requests.
Mark attendance for employees where supported.
Generate payroll records.
Review dashboard KPIs and notifications.
Troubleshooting
`uvicorn` is not recognized
Activate the virtual environment and run:
```powershell
python -m uvicorn app.main:app --reload
```
`npm` is not recognized
Install Node.js 18+ and reopen PowerShell. Then verify `node --version` and `npm --version`.
API returns `401 Unauthorized`
Log in again and use a current access token. Check that the frontend is sending the token expected by the backend.
API returns `403 Forbidden`
Check that the logged-in account has the role required for the endpoint.
Database column or schema errors
Back up `worksphere.db` before changing anything. SQLAlchemy `create_all()` creates missing tables but does not automatically add new columns to existing tables. Use a migration or a carefully planned database update.
Frontend does not start
Run `npm install` from the `frontend` directory, check for errors, then run `npm run dev`.
Security Notes
This project is intended for learning and demonstration.
Change the demo admin password and JWT secret before deployment.
Never commit `.env`, credentials, or production database files.
Review role-based access control and employee data ownership.
Add appropriate audit logging, backups, monitoring, and tests before production use.
Payroll and employment rules vary by jurisdiction; validate business and legal requirements before using real payroll data.
License
No license is specified in this README. Add a license file if you intend to distribute or publish the project.