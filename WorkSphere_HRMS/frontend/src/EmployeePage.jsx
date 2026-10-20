
import React, { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000/api";

const getToken = () =>
  localStorage.getItem("access_token") ||
  localStorage.getItem("token") ||
  "";

async function request(path, options = {}) {
  const token = getToken();

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      data?.detail || data?.message || `Request failed: ${response.status}`
    );
  }

  return data;
}

function getArray(data) {
  if (Array.isArray(data)) return data;
  return data?.items || data?.data || data?.results || [];
}

function Section({ title, children }) {
  return (
    <section
      style={{
        background: "white",
        padding: "20px",
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        marginBottom: "20px",
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: "19px" }}>{title}</h2>
      {children}
    </section>
  );
}

function DataTable({ columns, rows }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#f1f5f9" }}>
          <tr>
            {columns.map((column) => (
              <th
                key={column.label}
                style={{ padding: "11px", textAlign: "left" }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: "16px", color: "#64748b" }}
              >
                No records available.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.id ?? index}>
                {columns.map((column) => (
                  <td
                    key={column.label}
                    style={{
                      padding: "11px",
                      borderTop: "1px solid #e2e8f0",
                    }}
                  >
                    {column.render
                      ? column.render(row)
                      : row[column.key] ?? "-"}
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

export default function EmployeePage() {
  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [leaveForm, setLeaveForm] = useState({
    start_date: "",
    end_date: "",
    reason: "",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      request("/auth/me"),
      request("/attendance"),
      request("/leaves"),
      request("/payroll"),
      request("/notifications"),
    ]);

    if (results[0].status === "fulfilled") {
      setProfile(results[0].value);
    } else {
      setError(
        "Unable to load your profile: " + results[0].reason.message
      );
    }

    if (results[1].status === "fulfilled") {
      setAttendance(getArray(results[1].value));
    }

    if (results[2].status === "fulfilled") {
      setLeaves(getArray(results[2].value));
    }

    if (results[3].status === "fulfilled") {
      setPayroll(getArray(results[3].value));
    }

    if (results[4].status === "fulfilled") {
      setNotifications(getArray(results[4].value));
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function submitLeave(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (
      !leaveForm.start_date ||
      !leaveForm.end_date ||
      !leaveForm.reason.trim()
    ) {
      setError("Please complete all leave request fields.");
      return;
    }

    if (leaveForm.end_date < leaveForm.start_date) {
      setError("End date cannot be earlier than start date.");
      return;
    }

    try {
      await request("/leaves", {
        method: "POST",
        body: JSON.stringify({
          start_date: leaveForm.start_date,
          end_date: leaveForm.end_date,
          reason: leaveForm.reason.trim(),
        }),
      });

      setMessage("Leave request submitted successfully.");
      setLeaveForm({
        start_date: "",
        end_date: "",
        reason: "",
      });

      const result = await request("/leaves");
      setLeaves(getArray(result));
    } catch (err) {
      setError(err.message);
    }
  }

  const pageStyle = {
    minHeight: "100vh",
    padding: "25px",
    background: "#f8fafc",
    color: "#1e293b",
    fontFamily: "Arial, sans-serif",
  };

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px",
    marginTop: "6px",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
  };

  const cards = [
    { title: "Attendance Records", value: attendance.length },
    { title: "Leave Requests", value: leaves.length },
    { title: "Payroll Records", value: payroll.length },
    { title: "Notifications", value: notifications.length },
  ];

  if (loading) {
    return <main style={pageStyle}>Loading employee dashboard...</main>;
  }

  return (
    <main style={pageStyle}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "25px",
        }}
      >
        <div>
          <h1 style={{ marginBottom: "6px" }}>Employee Dashboard</h1>
          <p style={{ margin: 0, color: "#64748b" }}>
            Welcome to WorkSphere HRMS
          </p>
        </div>

        <button
          onClick={loadDashboard}
          style={{
            padding: "10px 15px",
            border: 0,
            borderRadius: "6px",
            background: "#2563eb",
            color: "white",
            cursor: "pointer",
          }}
        >
          Refresh Dashboard
        </button>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            padding: "12px",
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: "7px",
            marginBottom: "15px",
          }}
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          style={{
            padding: "12px",
            background: "#dcfce7",
            color: "#166534",
            borderRadius: "7px",
            marginBottom: "15px",
          }}
        >
          {message}
        </div>
      )}

      <Section title="My Profile">
        {profile ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "15px",
            }}
          >
            <p>
              <strong>Name:</strong>{" "}
              {profile.full_name || profile.username || "-"}
            </p>
            <p>
              <strong>Email:</strong> {profile.email || "-"}
            </p>
            <p>
              <strong>Role:</strong> {profile.role || "-"}
            </p>
            <p>
              <strong>User ID:</strong> {profile.id ?? "-"}
            </p>
          </div>
        ) : (
          <p>Profile details are unavailable.</p>
        )}
      </Section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "15px",
          marginBottom: "20px",
        }}
      >
        {cards.map((card) => (
          <div
            key={card.title}
            style={{
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "20px",
            }}
          >
            <p style={{ color: "#64748b", marginTop: 0 }}>{card.title}</p>
            <h2 style={{ fontSize: "28px", marginBottom: 0 }}>
              {card.value}
            </h2>
          </div>
        ))}
      </div>

      <Section title="My Attendance">
        <DataTable
          columns={[
            { label: "Date", key: "date" },
            { label: "Check In", key: "check_in" },
            { label: "Check Out", key: "check_out" },
            { label: "Status", key: "status" },
          ]}
          rows={attendance}
        />
      </Section>

      <Section title="Apply for Leave">
        <form onSubmit={submitLeave}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "15px",
            }}
          >
            <label>
              Start Date
              <input
                style={inputStyle}
                type="date"
                value={leaveForm.start_date}
                onChange={(event) =>
                  setLeaveForm({
                    ...leaveForm,
                    start_date: event.target.value,
                  })
                }
                required
              />
            </label>

            <label>
              End Date
              <input
                style={inputStyle}
                type="date"
                value={leaveForm.end_date}
                onChange={(event) =>
                  setLeaveForm({
                    ...leaveForm,
                    end_date: event.target.value,
                  })
                }
                required
              />
            </label>

            <label>
              Reason
              <input
                style={inputStyle}
                value={leaveForm.reason}
                onChange={(event) =>
                  setLeaveForm({
                    ...leaveForm,
                    reason: event.target.value,
                  })
                }
                placeholder="Enter reason for leave"
                required
              />
            </label>
          </div>

          <button
            type="submit"
            style={{
              marginTop: "15px",
              padding: "10px 16px",
              border: 0,
              borderRadius: "6px",
              background: "#2563eb",
              color: "white",
              cursor: "pointer",
            }}
          >
            Submit Leave Request
          </button>
        </form>
      </Section>

      <Section title="My Leave Requests">
        <DataTable
          columns={[
            { label: "Start Date", key: "start_date" },
            { label: "End Date", key: "end_date" },
            { label: "Reason", key: "reason" },
            { label: "Status", key: "status" },
          ]}
          rows={leaves}
        />
      </Section>

      <Section title="My Payroll">
        <DataTable
          columns={[
            { label: "Month", key: "month" },
            { label: "Basic Salary", key: "basic_salary" },
            { label: "Deductions", key: "deductions" },
            { label: "Net Salary", key: "net_salary" },
            { label: "Status", key: "status" },
          ]}
          rows={payroll}
        />
      </Section>

      <Section title="Notifications">
        {notifications.length === 0 ? (
          <p>No notifications available.</p>
        ) : (
          <ul style={{ paddingLeft: "20px" }}>
            {notifications.map((notification, index) => (
              <li
                key={notification.id ?? index}
                style={{ marginBottom: "12px" }}
              >
                <strong>
                  {notification.title || notification.subject || "Notification"}
                </strong>
                <p>
                  {notification.message ||
                    notification.content ||
                    notification.description ||
                    ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}

