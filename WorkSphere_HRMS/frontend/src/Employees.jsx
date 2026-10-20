
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

const initialForm = {
  user_id: "",
  full_name: "",
  designation: "",
  department: "",
  joining_date: "",
  salary: "",
  status: "ACTIVE",
};

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadEmployees(query = search) {
    setLoading(true);
    setError("");

    try {
      const suffix = query.trim()
        ? `?q=${encodeURIComponent(query.trim())}`
        : "";

      const result = await request(`/employees${suffix}`);

      setEmployees(
        Array.isArray(result)
          ? result
          : result?.employees || result?.items || result?.data || []
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees("");
  }, []);

  function changeForm(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function addEmployee() {
    setEditingId(null);
    setForm(initialForm);
    setError("");
    setMessage("");
    setShowForm(true);
  }

  function editEmployee(employee) {
    setEditingId(employee.id);
    setForm({
      user_id: employee.user_id ?? "",
      full_name: employee.full_name ?? "",
      designation: employee.designation ?? "",
      department: employee.department ?? "",
      joining_date: employee.joining_date
        ? String(employee.joining_date).slice(0, 10)
        : "",
      salary: employee.salary ?? "",
      status: employee.status ?? "ACTIVE",
    });
    setError("");
    setMessage("");
    setShowForm(true);
  }

  async function saveEmployee(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const payload = {
      full_name: form.full_name.trim(),
      designation: form.designation.trim(),
      department: form.department.trim(),
      joining_date: form.joining_date,
      salary: Number(form.salary),
      status: form.status,
    };

    if (!payload.full_name || !payload.designation || !payload.department) {
      setError("Please fill in the name, designation, and department.");
      return;
    }

    if (!payload.joining_date || !Number.isFinite(payload.salary)) {
      setError("Please enter a valid joining date and salary.");
      return;
    }

    try {
      if (editingId !== null) {
        await request(`/employees/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setMessage("Employee updated successfully.");
      } else {
        if (!form.user_id || Number(form.user_id) < 1) {
          setError("Enter a valid User ID.");
          return;
        }

        await request("/employees", {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            user_id: Number(form.user_id),
          }),
        });
        setMessage("Employee added successfully.");
      }

      setShowForm(false);
      setEditingId(null);
      setForm(initialForm);
      await loadEmployees();
    } catch (err) {
      setError(err.message);
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
    setMessage("");

    try {
      await request(`/employees/${employee.id}`, {
        method: "DELETE",
      });
      setMessage("Employee deleted successfully.");
      await loadEmployees();
    } catch (err) {
      setError(err.message);
    }
  }

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    marginTop: "5px",
  };

  const buttonStyle = {
    border: 0,
    padding: "10px 14px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 600,
  };

  return (
    <main style={{ padding: "25px", color: "#1e293b" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1>Employee Management</h1>
          <p>Manage employee records in WorkSphere HRMS.</p>
        </div>

        <button
          style={{ ...buttonStyle, background: "#2563eb", color: "white" }}
          onClick={addEmployee}
        >
          + Add Employee
        </button>
      </header>

      {error && (
        <p
          role="alert"
          style={{ background: "#fee2e2", color: "#991b1b", padding: "12px" }}
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          style={{ background: "#dcfce7", color: "#166534", padding: "12px" }}
        >
          {message}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={saveEmployee}
          style={{
            background: "white",
            padding: "20px",
            margin: "20px 0",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
          }}
        >
          <h2>{editingId !== null ? "Edit Employee" : "Add Employee"}</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "15px",
            }}
          >
            {editingId === null && (
              <label>
                User ID *
                <input
                  style={inputStyle}
                  type="number"
                  name="user_id"
                  min="1"
                  value={form.user_id}
                  onChange={changeForm}
                  required
                />
              </label>
            )}

            <label>
              Full Name *
              <input
                style={inputStyle}
                name="full_name"
                value={form.full_name}
                onChange={changeForm}
                required
              />
            </label>

            <label>
              Designation *
              <input
                style={inputStyle}
                name="designation"
                value={form.designation}
                onChange={changeForm}
                required
              />
            </label>

            <label>
              Department *
              <input
                style={inputStyle}
                name="department"
                value={form.department}
                onChange={changeForm}
                required
              />
            </label>

            <label>
              Joining Date *
              <input
                style={inputStyle}
                type="date"
                name="joining_date"
                value={form.joining_date}
                onChange={changeForm}
                required
              />
            </label>

            <label>
              Salary *
              <input
                style={inputStyle}
                type="number"
                min="0"
                step="0.01"
                name="salary"
                value={form.salary}
                onChange={changeForm}
                required
              />
            </label>

            <label>
              Status
              <select
                style={inputStyle}
                name="status"
                value={form.status}
                onChange={changeForm}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
            <button
              type="submit"
              style={{ ...buttonStyle, background: "#16a34a", color: "white" }}
            >
              {editingId !== null ? "Save Changes" : "Create Employee"}
            </button>

            <button
              type="button"
              style={{ ...buttonStyle, background: "#e2e8f0" }}
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(initialForm);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          loadEmployees(search);
        }}
        style={{ display: "flex", gap: "10px", margin: "20px 0" }}
      >
        <input
          style={{ ...inputStyle, marginTop: 0, flex: 1 }}
          placeholder="Search by employee name..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <button
          style={{ ...buttonStyle, background: "#334155", color: "white" }}
          type="submit"
        >
          Search
        </button>

        <button
          style={{ ...buttonStyle, background: "#e2e8f0" }}
          type="button"
          onClick={() => {
            setSearch("");
            loadEmployees("");
          }}
        >
          Clear
        </button>
      </form>

      <p>Total employees: {employees.length}</p>

      <div style={{ overflowX: "auto", background: "white" }}>
        <table
          style={{
            width: "100%",
            minWidth: "900px",
            borderCollapse: "collapse",
          }}
        >
          <thead style={{ background: "#f1f5f9" }}>
            <tr>
              {[
                "ID",
                "User ID",
                "Full Name",
                "Designation",
                "Department",
                "Joining Date",
                "Salary",
                "Status",
                "Actions",
              ].map((heading) => (
                <th key={heading} style={{ padding: "12px", textAlign: "left" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ padding: "20px" }}>
                  Loading employees...
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ padding: "20px" }}>
                  No employees found.
                </td>
              </tr>
            ) : (
              employees.map((employee) => (
                <tr key={employee.id}>
                  <td style={{ padding: "12px" }}>{employee.id}</td>
                  <td style={{ padding: "12px" }}>{employee.user_id ?? "-"}</td>
                  <td style={{ padding: "12px" }}>{employee.full_name}</td>
                  <td style={{ padding: "12px" }}>{employee.designation}</td>
                  <td style={{ padding: "12px" }}>{employee.department}</td>
                  <td style={{ padding: "12px" }}>
                    {employee.joining_date
                      ? String(employee.joining_date).slice(0, 10)
                      : "-"}
                  </td>
                  <td style={{ padding: "12px" }}>
                    {employee.salary ?? "-"}
                  </td>
                  <td style={{ padding: "12px" }}>{employee.status}</td>
                  <td style={{ padding: "12px", whiteSpace: "nowrap" }}>
                    <button
                      style={{
                        ...buttonStyle,
                        background: "#dbeafe",
                        color: "#1d4ed8",
                        marginRight: "6px",
                      }}
                      onClick={() => editEmployee(employee)}
                    >
                      Edit
                    </button>

                    <button
                      style={{
                        ...buttonStyle,
                        background: "#fee2e2",
                        color: "#b91c1c",
                      }}
                      onClick={() => deleteEmployee(employee)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}


