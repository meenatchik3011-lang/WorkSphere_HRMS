
import React, { useEffect, useState } from "react";
import "./style.css";
import EmployeeDashboard from "./EmployeeDashboard";

const API = "http://127.0.0.1:8000/api";

async function request(path, options = {}) {
  const token = localStorage.getItem("ws_token");

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    let message = data.detail ?? data.message ?? `HTTP ${response.status}`;

    // FastAPI can return validation details as an array or object.
    if (Array.isArray(message)) {
      message = message
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            const field = Array.isArray(item.loc) ? item.loc.join(".") : "";
            return [field, item.msg || JSON.stringify(item)]
              .filter(Boolean)
              .join(": ");
          }
          return String(item);
        })
        .join("; ");
    } else if (message && typeof message === "object") {
      message = message.msg || message.message || JSON.stringify(message);
    }

    throw new Error(String(message));
  }

  return data;
}


function errorMessage(err) {
  const value = err?.message ?? err?.detail ?? err;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") return item.msg || JSON.stringify(item);
      return String(item);
    }).join("; ");
  }
  if (value && typeof value === "object") {
    return value.msg || value.message || value.detail || JSON.stringify(value);
  }
  return "An unexpected error occurred.";
}

const today = () => new Date().toISOString().slice(0, 10);

const initialForm = {
  full_name: "",
  designation: "",
  department: "",
  joining_date: today(),
  salary: "0",
  status: "ACTIVE",
  user_id: "",
  employee_id: "",
  leave_type: "CASUAL",
  start_date: "",
  end_date: "",
  reason: "",
  basic_salary: "0",
  deductions: "0",
  bonus: "0",
  month: today().slice(0, 7),
};

function getRows(result) {
  if (Array.isArray(result)) return result;
  return result?.items || result?.data || result?.results || [];
}

export default function App() {
  const [token, setToken] = useState(
    localStorage.getItem("ws_token") || ""
  );
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("Dashboard");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [data, setData] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("admin@worksphere.com");
  const [password, setPassword] = useState("Admin@12345");
  const [username, setUsername] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [form, setForm] = useState(initialForm);
  const [employees, setEmployees] = useState([]);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [attendanceEmployeeId, setAttendanceEmployeeId] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState("PRESENT");
  const [attendanceDate, setAttendanceDate] = useState(today());
  const [selectedPayroll, setSelectedPayroll] = useState(null);

  const set = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const admin = ["HR", "ADMIN"].includes(user?.role);

  // Employee Dashboard is available only to non-admin users.
  const nav = [
    "Dashboard",
    ...(!admin ? ["Employee Dashboard"] : []),
    "Employees",
    "Attendance",
    "Leaves",
    "Payroll",
    "Notifications",
  ];

  function logout() {
    localStorage.removeItem("ws_token");
    setToken("");
    setUser(null);
    setData([]);
    setNotificationCount(0);
    setStats(null);
    setError("");
    setNotice("");
  }

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    request("/auth/me")
      .then(setUser)
      .catch(() => logout());
  }, [token]);

  useEffect(() => {
    if (admin && page === "Employee Dashboard") {
      setPage("Dashboard");
      return;
    }
    if (token && user) load();
  }, [token, user, page, admin]);

  async function load() {
    setError("");

    try {
      if (page === "Dashboard" && admin) {
        try {
          setStats(await request("/dashboard"));
        } catch {
          setStats(null);
        }
      }

      const paths = {
        Employees:
          "/employees" +
          (search.trim()
            ? `?q=${encodeURIComponent(search.trim())}`
            : ""),
        Attendance: "/attendance",
        Leaves: "/leaves",
        Payroll: "/payroll",
        Notifications: "/notifications",
      };

      if (paths[page]) {
        setData(getRows(await request(paths[page])));
      }

      // Keep the sidebar badge updated for the current user's notifications.
      const notificationRows = getRows(await request("/notifications"));
      setNotificationCount(
        notificationRows.filter((notification) => !notification.is_read).length
      );

      if (["Employees", "Leaves", "Payroll"].includes(page) || (page === "Attendance" && admin)) {
        const employeeRows = getRows(await request("/employees"));
        setEmployees(employeeRows);
        if (!attendanceEmployeeId && employeeRows.length > 0) {
          setAttendanceEmployeeId(String(employeeRows[0].id));
        }
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function act(callback, successMessage) {
    setError("");
    setNotice("");

    try {
      await callback();
      setNotice(successMessage);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function login(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    try {
      const result = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("ws_token", result.access_token);
      setToken(result.access_token);
      setUser(result.user);
      setNotice("Signed in successfully.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function register(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    try {
      await request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
      });

      setNotice("Account created. Please sign in.");
      setAuthMode("login");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function resetEmployeeForm() {
    setEditingEmployee(null);
    setForm((previous) => ({
      ...previous,
      full_name: "",
      designation: "",
      department: "",
      joining_date: today(),
      salary: "0",
      status: "ACTIVE",
      user_id: "",
    }));
  }

  function startEditEmployee(employee) {
    setEditingEmployee(employee);

    setForm((previous) => ({
      ...previous,
      full_name: employee.full_name || "",
      designation: employee.designation || "",
      department: employee.department || "",
      joining_date: employee.joining_date
        ? String(employee.joining_date).slice(0, 10)
        : today(),
      salary: String(employee.salary ?? 0),
      status: employee.status || "ACTIVE",
      user_id: employee.user_id ?? "",
    }));

    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitEmployee(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const payload = {
      full_name: form.full_name.trim(),
      designation: form.designation.trim(),
      department: form.department.trim(),
      joining_date: form.joining_date,
      salary: Number(form.salary),
      status: form.status,
    };

    if (
      !payload.full_name ||
      !payload.designation ||
      !payload.department ||
      !payload.joining_date
    ) {
      setError("Please fill in all required employee fields.");
      return;
    }

    if (!Number.isFinite(payload.salary) || payload.salary < 0) {
      setError("Enter a valid salary.");
      return;
    }

    try {
      if (editingEmployee) {
        await request(`/employees/${editingEmployee.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        setNotice("Employee updated successfully.");
      } else {
        await request("/employees", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            user_id: form.user_id ? Number(form.user_id) : null,
          }),
        });

        setNotice("Employee added successfully.");
      }

      resetEmployeeForm();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function deleteEmployee(employee) {
    if (
      !window.confirm(
        `Are you sure you want to delete ${employee.full_name}?`
      )
    ) {
      return;
    }

    setError("");
    setNotice("");

    try {
      await request(`/employees/${employee.id}`, {
        method: "DELETE",
      });

      setNotice("Employee deleted successfully.");

      const result = await request(
        "/employees" +
          (search.trim()
            ? `?q=${encodeURIComponent(search.trim())}`
            : "")
      );

      const rows = getRows(result);
      setData(rows);
      setEmployees(rows);
    } catch (err) {
      setError(`Delete failed: ${errorMessage(err)}`);
    }
  }

  async function submitLeave(event) {
    event.preventDefault();

    await act(
      () =>
        request("/leaves", {
          method: "POST",
          body: JSON.stringify({
            employee_id: Number(form.employee_id),
            leave_type: form.leave_type,
            start_date: form.start_date,
            end_date: form.end_date,
            reason: form.reason,
          }),
        }),
      "Leave request submitted."
    );
  }

  async function changeLeaveStatus(leave, status) {
    await act(
      () =>
        request(`/leaves/${leave.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }),
      `Leave ${status.toLowerCase()}.`
    );
  }

  async function generatePayroll(event) {
    event.preventDefault();

    if (!form.employee_id) {
      setError("Please select an employee.");
      return;
    }

    const basicSalary = Number(form.basic_salary);
    const deductions = Number(form.deductions || 0);
    const bonus = Number(form.bonus || 0);

    if (![basicSalary, deductions, bonus].every(Number.isFinite) ||
        basicSalary < 0 || deductions < 0 || bonus < 0) {
      setError("Salary, deductions, and bonus must be valid non-negative numbers.");
      return;
    }

    await act(
      () =>
        request("/payroll", {
          method: "POST",
          body: JSON.stringify({
            employee_id: Number(form.employee_id),
            basic_salary: basicSalary,
            deductions,
            bonus,
            month: form.month,
          }),
        }),
      "Payroll generated successfully."
    );
  }

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    });
  }

  function downloadPayslip(payroll) {
    const employee = employees.find(
      (item) => Number(item.id) === Number(payroll.employee_id)
    );
    const employeeName = employee?.full_name || `Employee #${payroll.employee_id}`;
    const safe = (value) => String(value ?? "-").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[char]));
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Payslip - ${safe(payroll.month)}</title>
<style>
body{font-family:Arial,sans-serif;color:#172033;margin:40px} .slip{max-width:760px;margin:auto;border:1px solid #dbe3f0;border-radius:12px;padding:32px}h1{margin:0 0 6px;color:#4f46e5}p{color:#64748b}.row{display:flex;justify-content:space-between;border-bottom:1px solid #e5e7eb;padding:13px 0}.net{font-size:20px;font-weight:bold;color:#047857;border-bottom:0}.foot{margin-top:28px;font-size:12px}
</style></head><body><div class="slip"><h1>WorkSphere</h1><p>Salary Payslip</p>
<div class="row"><strong>Employee</strong><span>${safe(employeeName)}</span></div>
<div class="row"><strong>Employee ID</strong><span>${safe(payroll.employee_id)}</span></div>
<div class="row"><strong>Payroll month</strong><span>${safe(payroll.month)}</span></div>
<div class="row"><strong>Basic salary</strong><span>${safe(formatCurrency(payroll.basic_salary))}</span></div>
<div class="row"><strong>Bonus</strong><span>${safe(formatCurrency(payroll.bonus))}</span></div>
<div class="row"><strong>Deductions</strong><span>${safe(formatCurrency(payroll.deductions))}</span></div>
<div class="row net"><strong>Net salary</strong><span>${safe(formatCurrency(payroll.net_salary))}</span></div>
<div class="foot">Generated by WorkSphere HRMS. Created at: ${safe(payroll.created_at || "-")}</div></div></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payslip-${payroll.month || "salary"}-employee-${payroll.employee_id}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function submitAttendance(event) {
    event.preventDefault();
    if (!attendanceEmployeeId) {
      setError("Please select an employee.");
      return;
    }

    await act(
      () => request("/attendance/mark", {
        method: "POST",
        body: JSON.stringify({
          employee_id: Number(attendanceEmployeeId),
          date: attendanceDate,
          status: attendanceStatus,
        }),
      }),
      "Attendance marked successfully."
    );
  }

  if (!token || !user) {
    return (
      <div className="auth">
        <div className="brand">
          <div className="logo">W</div>
          <h1>WorkSphere</h1>
          <p>People. Process. Progress.</p>
        </div>

        <form
          className="panel"
          onSubmit={authMode === "login" ? login : register}
        >
          <h2>{authMode === "login" ? "Welcome back" : "Create account"}</h2>

          <p className="muted">
            {authMode === "login"
              ? "Sign in to your HR workspace"
              : "Create your WorkSphere account"}
          </p>

          {authMode === "register" && (
            <>
              <label>Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </>
          )}

          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={authMode === "register" ? 8 : undefined}
            required
          />

          <button type="submit">
            {authMode === "login" ? "Sign in" : "Register"}
          </button>

          {authMode === "login" && (
            <p className="muted small">
              Demo admin email: admin@worksphere.com (use the password configured for your admin account).
            </p>
          )}

          <button
            type="button"
            className="secondary"
            onClick={() =>
              setAuthMode(authMode === "login" ? "register" : "login")
            }
          >
            {authMode === "login"
              ? "Create employee account"
              : "Back to sign in"}
          </button>

          {error && <p className="error">{error}</p>}
          {notice && <p className="success">{notice}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <aside>
        <div className="brand side">
          <div className="logo">W</div>
          <div>
            <b>WorkSphere</b>
            <small>HR MANAGEMENT</small>
          </div>
        </div>

        <div className="navtitle">WORKSPACE</div>

        {nav
          .filter((item) => item !== "Dashboard" || admin)
          .map((item) => (
            <button
              key={item}
              className={`nav ${page === item ? "active" : ""}`}
              onClick={() => {
                setPage(item);
                setError("");
                setNotice("");
              }}
            >
              {item}
              {item === "Notifications" && notificationCount > 0 && (
                <span className="notification-count">{notificationCount}</span>
              )}
            </button>
          ))}

        <div className="sidebottom">
          <div className="avatar">{user.username?.[0]?.toUpperCase()}</div>
          <div>
            <b>{user.username}</b>
            <small>{user.role}</small>
          </div>
          <button className="out" onClick={logout}>
            ↗
          </button>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <span className="eyebrow">WORKSPACE / {page.toUpperCase()}</span>
            <h1>{page}</h1>
          </div>
          <div className="userpill">
            <span className="dot"></span>
            {user.email}
            <span className="role">{user.role}</span>
          </div>
        </header>

        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}

        {page === "Dashboard" && (
          <>
            <p className="muted">
              Here's what's happening across your organization today.
            </p>

            {admin && stats ? (
              <div className="stats">
                {[
                  ["Total employees", stats.total_employees],
                  ["Active employees", stats.active_employees],
                  ["Present today", stats.present_today],
                  ["Pending leaves", stats.pending_leaves],
                  ["Approved leaves", stats.approved_leaves],
                  ["Rejected leaves", stats.rejected_leaves],
                  ["Payroll records", stats.payroll_records],
                  [
                    "Payroll total",
                    Number(stats.payroll_total || 0).toLocaleString(
                      "en-IN",
                      { style: "currency", currency: "INR" }
                    ),
                  ],
                ].map(([title, value]) => (
                  <div className="stat" key={title}>
                    <span>{title}</span>
                    <strong>{value ?? 0}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="panel welcome">
                <div className="welcomeicon">✦</div>
                <h2>Your workday, organized.</h2>
                <p>
                  Use the menu to manage attendance, leave requests, payroll,
                  and notifications.
                </p>
                <button onClick={() => setPage("Attendance")}>
                  Go to attendance →
                </button>
              </div>
            )}

            <div className="panel">
              <h3>Quick actions</h3>
              <div className="quick">
                {["Attendance", "Leaves", "Payroll", "Notifications"].map(
                  (item) => (
                    <button
                      className="quickbtn"
                      key={item}
                      onClick={() => setPage(item)}
                    >
                      {item} <span>→</span>
                    </button>
                  )
                )}
              </div>
            </div>
          </>
        )}

        {page === "Employee Dashboard" && !admin && <EmployeeDashboard />}

        {page === "Employees" && (
          <>
            <div className="toolbar">
              <input
                placeholder="Search name or department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className="secondary" onClick={load}>
                Search
              </button>
            </div>

            {admin && (
              <form className="panel formgrid" onSubmit={submitEmployee}>
                <h3 className="full">
                  {editingEmployee ? "Edit employee" : "Add employee"}
                </h3>

                <input
                  placeholder="Full name"
                  value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                  required
                />

                <input
                  placeholder="Designation"
                  value={form.designation}
                  onChange={(e) => set("designation", e.target.value)}
                  required
                />

                <input
                  placeholder="Department"
                  value={form.department}
                  onChange={(e) => set("department", e.target.value)}
                  required
                />

                <input
                  type="date"
                  value={form.joining_date}
                  onChange={(e) => set("joining_date", e.target.value)}
                  required
                />

                <input
                  type="number"
                  min="0"
                  placeholder="Salary"
                  value={form.salary}
                  onChange={(e) => set("salary", e.target.value)}
                  required
                />

                {!editingEmployee && (
                  <input
                    type="number"
                    min="1"
                    placeholder="Linked user ID (optional)"
                    value={form.user_id}
                    onChange={(e) => set("user_id", e.target.value)}
                  />
                )}

                <select
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>

                <button className="full" type="submit">
                  {editingEmployee ? "Save changes" : "Add employee"}
                </button>

                {editingEmployee && (
                  <button
                    className="full secondary"
                    type="button"
                    onClick={resetEmployeeForm}
                  >
                    Cancel edit
                  </button>
                )}
              </form>
            )}

            <Table
              rows={data}
              columns={[
                "id",
                "full_name",
                "designation",
                "department",
                "joining_date",
                "salary",
                "status",
              ]}
              action={
                admin
                  ? (employee) => (
                      <div className="actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => startEditEmployee(employee)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          style={{ background: "#fee2e2", color: "#b91c1c" }}
                          onClick={() => deleteEmployee(employee)}
                        >
                          Delete
                        </button>
                      </div>
                    )
                  : null
              }
            />
          </>
        )}

        {page === "Attendance" && (
          <>
            {admin ? (
              <form className="panel formgrid" onSubmit={submitAttendance}>
                <h3 className="full">Mark employee attendance</h3>
                <select
                  value={attendanceEmployeeId}
                  onChange={(e) => setAttendanceEmployeeId(e.target.value)}
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option value={employee.id} key={employee.id}>
                      {employee.full_name} (#{employee.id})
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  required
                  aria-label="Attendance date"
                />

                <select
                  value={attendanceStatus}
                  onChange={(e) => setAttendanceStatus(e.target.value)}
                  required
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="HALF_DAY">HALF DAY</option>
                  <option value="ABSENT">ABSENT</option>
                </select>

                <button className="full" type="submit" disabled={employees.length === 0}>
                  Mark Attendance
                </button>
                {employees.length === 0 && (
                  <p className="muted full">No employee profiles found. Add an employee first.</p>
                )}
              </form>
            ) : (
              <div className="panel">
                <h3>Today's attendance</h3>
                <p className="muted">
                  Check-in and check-out require your account to be linked to an active employee profile.
                </p>
                <div className="actions">
                  <button
                    onClick={() => act(
                      () => request("/attendance/check-in", { method: "POST" }),
                      "Checked in successfully."
                    )}
                  >
                    Check in
                  </button>
                  <button
                    className="secondary"
                    onClick={() => act(
                      () => request("/attendance/check-out", { method: "POST" }),
                      "Checked out successfully."
                    )}
                  >
                    Check out
                  </button>
                </div>
              </div>
            )}

            <Table
              rows={data}
              columns={[
                "id",
                "employee_id",
                "date",
                "check_in",
                "check_out",
                "status",
                "working_hours",
              ]}
            />
          </>
        )}

        {page === "Leaves" && (
          <>
            <form className="panel formgrid" onSubmit={submitLeave}>
              <h3 className="full">Apply for leave</h3>

              <select
                value={form.employee_id}
                onChange={(e) => set("employee_id", e.target.value)}
                required
              >
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option value={employee.id} key={employee.id}>
                    {employee.full_name} (#{employee.id})
                  </option>
                ))}
              </select>

              <select
                value={form.leave_type}
                onChange={(e) => set("leave_type", e.target.value)}
              >
                <option value="SICK">SICK</option>
                <option value="CASUAL">CASUAL</option>
                <option value="PAID">PAID</option>
              </select>

              <input
                type="date"
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
                required
              />

              <input
                type="date"
                value={form.end_date}
                onChange={(e) => set("end_date", e.target.value)}
                required
              />

              <input
                className="full"
                placeholder="Reason"
                value={form.reason}
                onChange={(e) => set("reason", e.target.value)}
                required
              />

              <button className="full" type="submit">
                Submit leave request
              </button>
            </form>

            <Table
              rows={data}
              columns={[
                "id",
                "employee_id",
                "leave_type",
                "start_date",
                "end_date",
                "reason",
                "status",
              ]}
              action={
                admin
                  ? (leave) => (
                      <div className="actions">
                        <button
                          onClick={() => changeLeaveStatus(leave, "APPROVED")}
                        >
                          Approve
                        </button>
                        <button
                          className="secondary"
                          onClick={() => changeLeaveStatus(leave, "REJECTED")}
                        >
                          Reject
                        </button>
                      </div>
                    )
                  : null
              }
            />
          </>
        )}

        {page === "Payroll" && (
          <>
            {admin && (
              <form className="panel formgrid" onSubmit={generatePayroll}>
                <h3 className="full">Generate payroll</h3>

                <select
                  value={form.employee_id}
                  onChange={(e) => {
                    const employeeId = e.target.value;
                    const selected = employees.find(
                      (employee) => String(employee.id) === employeeId
                    );
                    set("employee_id", employeeId);
                    if (selected) set("basic_salary", String(selected.salary ?? 0));
                  }}
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option value={employee.id} key={employee.id}>
                      {employee.full_name} (#{employee.id})
                    </option>
                  ))}
                </select>

                <input
                  type="month"
                  value={form.month}
                  onChange={(e) => set("month", e.target.value)}
                  required
                />

                <input
                  type="number"
                  min="0"
                  placeholder="Basic salary"
                  value={form.basic_salary}
                  onChange={(e) => set("basic_salary", e.target.value)}
                  required
                />

                <input
                  type="number"
                  min="0"
                  placeholder="Deductions"
                  value={form.deductions}
                  onChange={(e) => set("deductions", e.target.value)}
                />

                <input
                  type="number"
                  min="0"
                  placeholder="Bonus"
                  value={form.bonus}
                  onChange={(e) => set("bonus", e.target.value)}
                />

                <button className="full" type="submit">
                  Generate payroll
                </button>
              </form>
            )}

            <Table
              rows={data}
              columns={[
                "id",
                "employee_id",
                "month",
                "basic_salary",
                "deductions",
                "bonus",
                "net_salary",
                "created_at",
              ]}
              action={(payroll) => (
                <div className="actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setSelectedPayroll(payroll)}
                  >
                    View details
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadPayslip(payroll)}
                  >
                    Download payslip
                  </button>
                </div>
              )}
            />

            {selectedPayroll && (
              <div className="panel" role="dialog" aria-modal="true" aria-label="Salary details">
                <div className="notification-heading">
                  <h3>Salary details — {selectedPayroll.month}</h3>
                  <button className="secondary" type="button" onClick={() => setSelectedPayroll(null)}>
                    Close
                  </button>
                </div>
                <div className="salary-details">
                  <p><strong>Payroll ID:</strong> {selectedPayroll.id}</p>
                  <p><strong>Employee ID:</strong> {selectedPayroll.employee_id}</p>
                  <p><strong>Month:</strong> {selectedPayroll.month}</p>
                  <p><strong>Basic salary:</strong> {formatCurrency(selectedPayroll.basic_salary)}</p>
                  <p><strong>Bonus:</strong> {formatCurrency(selectedPayroll.bonus)}</p>
                  <p><strong>Deductions:</strong> {formatCurrency(selectedPayroll.deductions)}</p>
                  <p><strong>Net salary:</strong> {formatCurrency(selectedPayroll.net_salary)}</p>
                  <p><strong>Created at:</strong> {selectedPayroll.created_at || "-"}</p>
                </div>
                <button type="button" onClick={() => downloadPayslip(selectedPayroll)}>
                  Download payslip
                </button>
              </div>
            )}
          </>
        )}

        {page === "Notifications" && (
          <div className="panel">
            <div className="notification-heading">
              <h3>Your notifications</h3>
              <button
                className="secondary"
                disabled={notificationCount === 0}
                onClick={() =>
                  act(
                    () => request("/notifications/read-all", { method: "PATCH" }),
                    "All notifications marked as read."
                  )
                }
              >
                Mark all as read
              </button>
            </div>

            {data.length === 0 ? (
              <p className="muted">You're all caught up.</p>
            ) : (
              data.map((notification) => (
                <div
                  className={
                    "notification " + (notification.is_read ? "read" : "")
                  }
                  key={notification.id}
                >
                  <div>
                    <b>{notification.title}</b>
                    <p>{notification.message}</p>
                    <small>{notification.created_at}</small>
                  </div>

                  {!notification.is_read && (
                    <button
                      className="secondary"
                      onClick={() =>
                        act(
                          () =>
                            request(
                              `/notifications/${notification.id}/read`,
                              { method: "PATCH" }
                            ),
                          "Notification marked as read."
                        )
                      }
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        <footer>
          WorkSphere HRMS <span>Secure people operations</span>
        </footer>
      </main>
    </div>
  );
}

function formatWorkingHours(row) {
  const checkIn = row.check_in ? new Date(row.check_in) : null;
  const checkOut = row.check_out ? new Date(row.check_out) : null;

  if (!checkIn || Number.isNaN(checkIn.getTime())) return "-";

  // Use check-out when present; otherwise show elapsed time up to now.
  const end =
    checkOut && !Number.isNaN(checkOut.getTime()) ? checkOut : new Date();

  const totalMinutes = Math.max(
    0,
    Math.floor((end.getTime() - checkIn.getTime()) / 60000)
  );

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function Table({ rows = [], columns = [], action = null }) {
  return (
    <div className="panel tablewrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>
                {column.replaceAll("_", " ").toUpperCase()}
              </th>
            ))}
            {action && <th>ACTIONS</th>}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (action ? 1 : 0)}
                style={{ padding: "20px", textAlign: "center" }}
              >
                No records found.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column}>
                    {column === "working_hours"
                      ? formatWorkingHours(row)
                      : row[column] == null
                        ? "-"
                        : String(row[column])}
                  </td>
                ))}
                {action && <td>{action(row)}</td>}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}