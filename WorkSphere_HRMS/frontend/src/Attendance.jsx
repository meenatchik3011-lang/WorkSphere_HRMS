
import React, { useCallback, useEffect, useState } from "react";

const API_BASE = "http://127.0.0.1:8000/api";

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    ""
  );
}

function getStoredUser() {
  for (const key of ["user", "currentUser", "auth_user"]) {
    try {
      const value = localStorage.getItem(key);
      if (value) return JSON.parse(value);
    } catch {
      // Ignore invalid stored JSON.
    }
  }
  return {};
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function calculateWorkingHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return "—";

  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return "—";
  }

  const totalSeconds = Math.floor((end - start) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}h ${minutes}m ${seconds}s`;
}

function getErrorMessage(data, fallback) {
  if (typeof data?.detail === "string") return data.detail;
  if (Array.isArray(data?.detail)) {
    return data.detail.map((item) => item.msg).join(", ");
  }
  if (typeof data?.message === "string") return data.message;
  return fallback;
}

export default function Attendance() {
  const user = getStoredUser();
  const role = String(
    user.role || localStorage.getItem("role") || ""
  ).toUpperCase();

  const isHR = role === "HR" || role === "ADMIN";
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("PRESENT");
  const [loading, setLoading] = useState(false);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const request = useCallback(async (path, options = {}) => {
    const token = getToken();

    if (!token) {
      throw new Error("Please log in again. Your authentication token was not found.");
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      throw new Error(
        getErrorMessage(data, `Request failed (${response.status})`)
      );
    }

    return data;
  }, []);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await request("/attendance");
      const list = Array.isArray(data)
        ? data
        : data?.items || data?.records || [];

      setRecords(list);
    } catch (err) {
      setError(err.message || "Unable to load attendance history.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  const loadEmployees = useCallback(async () => {
    if (!isHR) return;

    setEmployeesLoading(true);

    try {
      const data = await request("/employees");
      const list = Array.isArray(data)
        ? data
        : data?.items || data?.employees || [];

      setEmployees(list);
      if (list.length > 0) {
        setEmployeeId((current) => current || String(list[0].id));
      }
    } catch (err) {
      setError(
        `Could not load employees for HR marking: ${err.message}`
      );
    } finally {
      setEmployeesLoading(false);
    }
  }, [isHR, request]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  async function handleCheckIn() {
    setError("");
    setSuccess("");

    try {
      const result = await request("/attendance/check-in", {
        method: "POST",
      });

      setSuccess(result?.message || "Check-in successful.");
      await loadAttendance();
    } catch (err) {
      setError(err.message || "Check-in failed.");
    }
  }

  async function handleCheckOut() {
    setError("");
    setSuccess("");

    try {
      const result = await request("/attendance/check-out", {
        method: "POST",
      });

      setSuccess(result?.message || "Check-out successful.");
      await loadAttendance();
    } catch (err) {
      setError(err.message || "Check-out failed.");
    }
  }

  async function handleMarkAttendance(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!employeeId) {
      setError("Please select an employee.");
      return;
    }

    try {
      await request("/attendance/mark", {
        method: "POST",
        body: JSON.stringify({
          employee_id: Number(employeeId),
          status,
        }),
      });

      setSuccess("Attendance marked successfully.");
      await loadAttendance();
    } catch (err) {
      setError(err.message || "Unable to mark attendance.");
    }
  }

  const styles = {
    page: {
      padding: "28px",
      background: "#f4f6fb",
      minHeight: "100vh",
      color: "#14213d",
      fontFamily: "Arial, sans-serif",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "16px",
      flexWrap: "wrap",
      marginBottom: "24px",
    },
    card: {
      background: "#fff",
      border: "1px solid #e4e9f2",
      borderRadius: "18px",
      padding: "24px",
      marginBottom: "24px",
      boxShadow: "0 4px 16px rgba(20, 33, 61, 0.03)",
    },
    button: {
      background: "#5145e5",
      color: "#fff",
      border: 0,
      borderRadius: "10px",
      padding: "12px 18px",
      fontWeight: 600,
      cursor: "pointer",
    },
    secondaryButton: {
      background: "#ededff",
      color: "#5145e5",
      border: 0,
      borderRadius: "10px",
      padding: "12px 18px",
      fontWeight: 600,
      cursor: "pointer",
    },
    input: {
      width: "100%",
      boxSizing: "border-box",
      padding: "12px",
      border: "1px solid #d9dfeb",
      borderRadius: "9px",
      marginTop: "8px",
      marginBottom: "16px",
      background: "#fff",
    },
    tableWrapper: {
      overflowX: "auto",
      background: "#fff",
      border: "1px solid #e4e9f2",
      borderRadius: "16px",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      minWidth: "850px",
    },
    th: {
      textAlign: "left",
      padding: "15px",
      fontSize: "12px",
      color: "#71809b",
      background: "#fafbfe",
      borderBottom: "1px solid #e4e9f2",
      whiteSpace: "nowrap",
    },
    td: {
      padding: "15px",
      fontSize: "14px",
      borderBottom: "1px solid #edf0f6",
      whiteSpace: "nowrap",
    },
  };

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <div
            style={{
              color: "#71809b",
              fontSize: "12px",
              letterSpacing: "2px",
              marginBottom: "10px",
            }}
          >
            WORKSPACE / ATTENDANCE
          </div>
          <h1 style={{ margin: 0, fontSize: "34px" }}>Attendance</h1>
        </div>

        <div
          style={{
            background: "#fff",
            padding: "12px 18px",
            border: "1px solid #e4e9f2",
            borderRadius: "30px",
          }}
        >
          {user.email || "Logged-in user"} · {role || "USER"}
        </div>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            padding: "14px",
            marginBottom: "18px",
            borderRadius: "10px",
            background: "#fff0f0",
            color: "#c62828",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          style={{
            padding: "14px",
            marginBottom: "18px",
            borderRadius: "10px",
            background: "#eaf8ef",
            color: "#19723a",
          }}
        >
          {success}
        </div>
      )}

      <section style={styles.card}>
        <h2 style={{ marginTop: 0, fontSize: "21px" }}>
          Today’s attendance
        </h2>
        <p style={{ color: "#71809b", lineHeight: 1.6 }}>
          Employee check-in and check-out require an active, linked employee
          profile.
        </p>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button type="button" style={styles.button} onClick={handleCheckIn}>
            Check in
          </button>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={handleCheckOut}
          >
            Check out
          </button>
          <button
            type="button"
            style={styles.secondaryButton}
            onClick={loadAttendance}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh history"}
          </button>
        </div>
      </section>

      {isHR && (
        <section style={styles.card}>
          <h2 style={{ marginTop: 0 }}>HR/Admin: Mark attendance</h2>
          <p style={{ color: "#71809b" }}>
            Select an employee and submit their attendance status.
          </p>

          <form onSubmit={handleMarkAttendance}>
            <label htmlFor="attendance-employee">
              Employee
            </label>
            <select
              id="attendance-employee"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              style={styles.input}
              required
              disabled={employeesLoading || employees.length === 0}
            >
              {employees.length === 0 && (
                <option value="">
                  {employeesLoading
                    ? "Loading employees..."
                    : "No employees available"}
                </option>
              )}

              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  ID {employee.id} —{" "}
                  {employee.full_name || employee.name || employee.username}
                  {employee.status ? ` (${employee.status})` : ""}
                </option>
              ))}
            </select>

            <label htmlFor="attendance-status">
              Attendance status
            </label>
            <select
              id="attendance-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              style={styles.input}
            >
              <option value="PRESENT">PRESENT</option>
              <option value="ABSENT">ABSENT</option>
              <option value="HALF_DAY">HALF_DAY</option>
              <option value="LEAVE">LEAVE</option>
            </select>

            <button
              type="submit"
              style={styles.button}
              disabled={!employeeId || employeesLoading}
            >
              Mark attendance
            </button>
          </form>
        </section>
      )}

      <section style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              {[
                "ID",
                "EMPLOYEE ID",
                "DATE",
                "CHECK IN",
                "CHECK OUT",
                "STATUS",
                "WORKING HOURS",
              ].map((heading) => (
                <th key={heading} style={styles.th}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading && records.length === 0 ? (
              <tr>
                <td colSpan="7" style={styles.td}>
                  Loading attendance...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan="7" style={styles.td}>
                  No attendance records found.
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id}>
                  <td style={styles.td}>{record.id}</td>
                  <td style={styles.td}>{record.employee_id ?? "—"}</td>
                  <td style={styles.td}>
                    {record.date
                      ? String(record.date).slice(0, 10)
                      : record.check_in
                        ? String(record.check_in).slice(0, 10)
                        : "—"}
                  </td>
                  <td style={styles.td}>
                    {formatDateTime(record.check_in)}
                  </td>
                  <td style={styles.td}>
                    {formatDateTime(record.check_out)}
                  </td>
                  <td style={styles.td}>{record.status || "—"}</td>
                  <td style={styles.td}>
                    {record.working_hours != null
                      ? `${record.working_hours}`
                      : calculateWorkingHours(
                          record.check_in,
                          record.check_out
                        )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
