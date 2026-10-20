
import React, { useCallback, useEffect, useState } from "react";
import "./style.css";

const API = "http://127.0.0.1:8000/api";

async function request(path) {
  const token = localStorage.getItem("ws_token");

  if (!token) {
    throw new Error("Please log in again.");
  }

  const response = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = data.detail ?? data.message ?? `HTTP ${response.status}`;
    throw new Error(
      typeof detail === "string" ? detail : JSON.stringify(detail)
    );
  }

  return data;
}

function getRows(result) {
  if (Array.isArray(result)) return result;
  return result?.items || result?.data || result?.results || [];
}

function money(value) {
  if (value === null || value === undefined || value === "") return "—";

  return Number(value).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

function date(value) {
  if (!value) return "—";

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value).slice(0, 10)
    : parsed.toLocaleDateString("en-IN");
}

function dateTime(value) {
  if (!value) return "—";

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("en-IN");
}

function workingHours(checkIn, checkOut, savedValue) {
  if (savedValue !== null && savedValue !== undefined) {
    return String(savedValue);
  }

  if (!checkIn || !checkOut) return checkIn ? "In progress" : "—";

  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return "—";
  }

  const minutes = Math.floor((end - start) / 60000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function Status({ value }) {
  const status = String(value || "UNKNOWN").toUpperCase();

  const className =
    status === "PRESENT" || status === "APPROVED" || status === "ACTIVE"
      ? "success"
      : status === "PENDING"
        ? "pending"
        : status === "ABSENT" ||
            status === "REJECTED" ||
            status === "INACTIVE"
          ? "error"
          : "muted";

  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 10px",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: 600,
        background:
          className === "success"
            ? "#dcfce7"
            : className === "pending"
              ? "#fef3c7"
              : className === "error"
                ? "#fee2e2"
                : "#e2e8f0",
        color:
          className === "success"
            ? "#166534"
            : className === "pending"
              ? "#92400e"
              : className === "error"
                ? "#991b1b"
                : "#475569",
      }}
    >
      {status}
    </span>
  );
}

function DataTable({ columns, rows, emptyMessage }) {
  return (
    <div className="panel tablewrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ textAlign: "center", padding: "24px" }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.id ?? index}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {column.render
                      ? column.render(row)
                      : row[column.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function EmployeeDashboard() {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    setWarnings([]);

    try {
      const results = await Promise.allSettled([
        request("/auth/me"),
        request("/attendance"),
        request("/leaves"),
        request("/payroll"),
      ]);

      if (results.every((item) => item.status === "rejected")) {
        throw new Error(
          results[0].reason?.message || "Unable to load dashboard data."
        );
      }

      const sectionNames = [
        "User profile",
        "Attendance",
        "Leaves",
        "Payroll",
      ];

      const nextWarnings = [];

      results.forEach((result, index) => {
        if (result.status === "rejected") {
          nextWarnings.push(
            `${sectionNames[index]}: ${result.reason?.message || "Unable to load"}`
          );
        }
      });

      setWarnings(nextWarnings);

      let currentUser = null;

      if (results[0].status === "fulfilled") {
        const result = results[0].value;
        currentUser = result?.user || result;
        setUser(currentUser);
      }

      const attendanceRows =
        results[1].status === "fulfilled"
          ? getRows(results[1].value)
          : [];

      const leaveRows =
        results[2].status === "fulfilled"
          ? getRows(results[2].value)
          : [];

      const payrollRows =
        results[3].status === "fulfilled"
          ? getRows(results[3].value)
          : [];

      setAttendance(attendanceRows);
      setLeaves(leaveRows);
      setPayroll(payrollRows);

      // Use a linked employee profile if the /auth/me response provides one.
      const linkedProfile =
        currentUser?.employee ||
        currentUser?.employee_profile ||
        null;

      // Otherwise, infer the employee ID only from records returned by the API.
      const recordEmployeeId =
        attendanceRows[0]?.employee_id ??
        leaveRows[0]?.employee_id ??
        payrollRows[0]?.employee_id ??
        null;

      setEmployee(
        linkedProfile ||
          (currentUser?.employee_id != null
            ? { id: currentUser.employee_id }
            : recordEmployeeId != null
              ? { id: recordEmployeeId }
              : null)
      );
    } catch (err) {
      setError(err.message || "Unable to load employee dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const displayName =
    employee?.full_name ||
    employee?.name ||
    user?.username ||
    user?.email ||
    "Employee";

  const pendingLeaves = leaves.filter(
    (item) => String(item.status).toUpperCase() === "PENDING"
  ).length;

  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  const todaysAttendance = attendance.find((item) => {
    const recordDate = item.date
      ? String(item.date).slice(0, 10)
      : item.check_in
        ? String(item.check_in).slice(0, 10)
        : "";

    return recordDate === todayKey;
  });

  const payrollTotal = payroll.reduce((sum, item) => {
    const amount = Number(
      item.net_salary ?? item.net_amount ?? item.total_amount ?? 0
    );

    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  return (
    <div>
      <header>
        <div>
          <span className="eyebrow">WORKSPACE / EMPLOYEE</span>
          <h1>Employee Dashboard</h1>
          <p className="muted">Welcome back, {displayName}.</p>
        </div>

        <button
          type="button"
          className="secondary"
          onClick={loadDashboard}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {error && <div className="alert error">{error}</div>}

      {warnings.length > 0 && (
        <div className="alert error">
          <strong>Some dashboard sections could not be loaded:</strong>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {loading && <p className="muted">Loading dashboard...</p>}

      {!loading && !employee && (
        <div className="panel">
          <h3>Employee profile not linked</h3>
          <p className="muted">
            Your login account does not currently expose a linked employee ID.
            Ask HR/Admin to check the employee record and its user_id mapping.
          </p>
        </div>
      )}

      <section className="stats">
        <div className="stat">
          <span>Employee ID</span>
          <strong>{employee?.id ?? "—"}</strong>
        </div>

        <div className="stat">
          <span>Today's attendance</span>
          <strong style={{ fontSize: "18px" }}>
            {todaysAttendance?.status || "Not marked"}
          </strong>
        </div>

        <div className="stat">
          <span>Pending leaves</span>
          <strong>{pendingLeaves}</strong>
        </div>

        <div className="stat">
          <span>Payroll total</span>
          <strong style={{ fontSize: "18px" }}>{money(payrollTotal)}</strong>
        </div>
      </section>

      <section className="panel">
        <h3>My Profile</h3>

        <div className="formgrid">
          <div>
            <label>Full name</label>
            <p>{displayName}</p>
          </div>

          <div>
            <label>Email</label>
            <p>{user?.email || "—"}</p>
          </div>

          <div>
            <label>Role</label>
            <p>{user?.role || "EMPLOYEE"}</p>
          </div>

          <div>
            <label>Department</label>
            <p>{employee?.department || "—"}</p>
          </div>

          <div>
            <label>Designation</label>
            <p>{employee?.designation || "—"}</p>
          </div>

          <div>
            <label>Joining date</label>
            <p>{date(employee?.joining_date)}</p>
          </div>

          <div>
            <label>Employment status</label>
            <p>
              {employee?.status ? (
                <Status value={employee.status} />
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2>My Attendance</h2>

        <DataTable
          emptyMessage="No attendance records found."
          rows={attendance}
          columns={[
            {
              key: "date",
              label: "DATE",
              render: (row) => date(row.date || row.check_in),
            },
            {
              key: "check_in",
              label: "CHECK IN",
              render: (row) => dateTime(row.check_in),
            },
            {
              key: "check_out",
              label: "CHECK OUT",
              render: (row) => dateTime(row.check_out),
            },
            {
              key: "status",
              label: "STATUS",
              render: (row) => <Status value={row.status} />,
            },
            {
              key: "working_hours",
              label: "WORKING HOURS",
              render: (row) =>
                workingHours(
                  row.check_in,
                  row.check_out,
                  row.working_hours
                ),
            },
          ]}
        />
      </section>

      <section>
        <h2>My Leave Requests</h2>

        <DataTable
          emptyMessage="No leave requests found."
          rows={leaves}
          columns={[
            { key: "id", label: "ID" },
            {
              key: "leave_type",
              label: "LEAVE TYPE",
              render: (row) => row.leave_type || row.type || "—",
            },
            {
              key: "start_date",
              label: "START DATE",
              render: (row) => date(row.start_date),
            },
            {
              key: "end_date",
              label: "END DATE",
              render: (row) => date(row.end_date),
            },
            {
              key: "status",
              label: "STATUS",
              render: (row) => <Status value={row.status} />,
            },
          ]}
        />
      </section>

      <section>
        <h2>My Payroll</h2>

        <DataTable
          emptyMessage="No payroll records found."
          rows={payroll}
          columns={[
            { key: "id", label: "PAYROLL ID" },
            {
              key: "month",
              label: "MONTH",
              render: (row) => row.month || row.pay_month || "—",
            },
            {
              key: "basic_salary",
              label: "BASIC SALARY",
              render: (row) => money(row.basic_salary),
            },
            {
              key: "deductions",
              label: "DEDUCTIONS",
              render: (row) => money(row.deductions),
            },
            {
              key: "net_salary",
              label: "NET SALARY",
              render: (row) =>
                money(row.net_salary ?? row.net_amount ?? row.total_amount),
            },
          ]}
        />
      </section>

      <footer>
        WorkSphere HRMS <span>Employee Self-Service Dashboard</span>
      </footer>
    </div>
  );
}
