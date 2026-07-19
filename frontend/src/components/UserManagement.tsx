import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut } from "../services/api";
import { normalizeSearchText } from "../utils/filterUtils";
import ValueHelpField, { ValueHelpOption } from "./ValueHelpField";
import "./UserManagement.css";
import "./UserManagementFilters.css";

interface Student {
  id: string; name: string; email: string; userId: string; isActive: boolean;
  createdAt?: string; lastLoginAt?: string; attempts?: number; validUntil?: string; isExpired?: boolean;
}

const defaultStudentValidity = () => { const date = new Date(); date.setFullYear(date.getFullYear() + 1); return date.toISOString().slice(0, 10); };
const emptyForm = { name: "", email: "", userId: "", password: "", validUntil: defaultStudentValidity() };

const UserManagement: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "blocked">("all");
  const [attemptFilter, setAttemptFilter] = useState<"all" | "none" | "attempted" | "multiple">("all");
  const [activityFilter, setActivityFilter] = useState<"all" | "recent" | "inactive" | "never">("all");
  const [joinedFilter, setJoinedFilter] = useState<"all" | "week" | "month" | "older">("all");
  const [sortBy, setSortBy] = useState<"newest" | "name" | "attempts">("newest");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Student | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadStudents = async () => {
    setLoading(true);
    try { const response = await apiGet<{ users: Student[] }>("/admin/users"); setStudents(response.users || []); }
    catch (error) { console.error(error); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadStudents(); }, []);

  const visible = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    return students.filter(student => {
      const text = normalizeSearchText(`${student.name} ${student.userId} ${student.email}`);
      const attempts = student.attempts || 0;
      const lastLogin = student.lastLoginAt ? new Date(student.lastLoginAt).getTime() : 0;
      const joined = student.createdAt ? new Date(student.createdAt).getTime() : 0;
      const statusMatch = status === "all" || (status === "active" ? student.isActive : !student.isActive);
      const attemptMatch = attemptFilter === "all" || (attemptFilter === "none" ? attempts === 0 : attemptFilter === "attempted" ? attempts > 0 : attempts > 1);
      const activityMatch = activityFilter === "all" || (activityFilter === "never" ? !lastLogin : activityFilter === "recent" ? lastLogin >= now - 7 * day : !!lastLogin && lastLogin < now - 30 * day);
      const joinedMatch = joinedFilter === "all" || (joinedFilter === "week" ? joined >= now - 7 * day : joinedFilter === "month" ? joined >= now - 30 * day : !!joined && joined < now - 30 * day);
      return text.includes(normalizeSearchText(search)) && statusMatch && attemptMatch && activityMatch && joinedMatch;
    }).sort((a, b) => sortBy === "name" ? (a.name || a.userId).localeCompare(b.name || b.userId) : sortBy === "attempts" ? (b.attempts || 0) - (a.attempts || 0) : new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [students, search, status, attemptFilter, activityFilter, joinedFilter, sortBy]);
  const active = students.filter(student => student.isActive).length;
  const studentOptions = useMemo<ValueHelpOption[]>(() => students.map(student => ({ value: student.name || student.userId, label: student.name || student.userId, keywords: [student.userId, student.email].filter(Boolean) })), [students]);

  const openAdd = () => { setForm(emptyForm); setAdding(true); setEditing(null); };
  const openEdit = (student: Student) => { setForm({ name: student.name || "", email: student.email || "", userId: student.userId, password: "", validUntil: student.validUntil ? student.validUntil.slice(0, 10) : defaultStudentValidity() }); setEditing(student); setAdding(false); };
  const closeModal = () => { setAdding(false); setEditing(null); setForm(emptyForm); };
  const save = async () => {
    if (!form.name.trim() || !form.email.trim() || (!editing && (!form.userId.trim() || form.password.length < 4))) return;
    setSaving(true);
    try {
      if (editing) await apiPut(`/admin/users/${editing.id}`, { name: form.name.trim(), email: form.email.trim(), validUntil: form.validUntil });
      else await apiPost("/admin/users", { ...form, role: "answerer" });
      closeModal(); await loadStudents();
    } catch (error: any) { alert(error?.message || "Student could not be saved."); }
    finally { setSaving(false); }
  };
  const toggleBlock = async (student: Student) => {
    const action = student.isActive ? "block" : "unblock";
    if (!window.confirm(`${action[0].toUpperCase() + action.slice(1)} ${student.name}?`)) return;
    try {
      await apiPut(`/admin/users/${student.id}/status`, { isActive: !student.isActive });
      await loadStudents();
    } catch (error: any) { alert(error?.message || `Could not ${action} student.`); }
  };
  const date = (value?: string) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return <section className="students-admin-page">
    <header className="students-page-head"><div><span>STUDENT DIRECTORY</span><h1>Students</h1><p>Manage candidate accounts and examination access.</p></div><button onClick={openAdd}>+ Add student</button></header>
    <div className="students-kpis"><button onClick={() => setStatus("all")}><span>Total students</span><strong>{students.length}</strong></button><button onClick={() => setStatus("active")}><span>Active</span><strong>{active}</strong></button><button onClick={() => setStatus("blocked")}><span>Blocked</span><strong>{students.length - active}</strong></button><div><span>Total attempts</span><strong>{students.reduce((sum, student) => sum + (student.attempts || 0), 0)}</strong></div></div>
    <div className="students-table-card">
      <div className="students-toolbar value-help-toolbar">
        <ValueHelpField label="Search Users" placeholder="Search name, email or ID" value={search} options={studentOptions} onChange={setSearch} allowFreeText />
        <ValueHelpField label="Status" placeholder="All statuses" value={status} options={[{value:"all",label:"All statuses"},{value:"active",label:"Active students"},{value:"blocked",label:"Blocked students"}]} onChange={value=>setStatus(value as typeof status)} />
        <ValueHelpField label="Exam Attempts" placeholder="All attempts" value={attemptFilter} options={[{value:"all",label:"All attempts"},{value:"none",label:"No attempts"},{value:"attempted",label:"Has attempted"},{value:"multiple",label:"Multiple attempts"}]} onChange={value=>setAttemptFilter(value as typeof attemptFilter)} />
        <ValueHelpField label="Login Activity" placeholder="All activity" value={activityFilter} options={[{value:"all",label:"All activity"},{value:"recent",label:"Active this week"},{value:"inactive",label:"Inactive 30+ days"},{value:"never",label:"Never logged in"}]} onChange={value=>setActivityFilter(value as typeof activityFilter)} />
        <ValueHelpField label="Joined Date" placeholder="Any join date" value={joinedFilter} options={[{value:"all",label:"Any join date"},{value:"week",label:"Joined this week"},{value:"month",label:"Joined this month"},{value:"older",label:"Joined earlier"}]} onChange={value=>setJoinedFilter(value as typeof joinedFilter)} />
        <ValueHelpField label="Sort By" placeholder="Newest first" value={sortBy} options={[{value:"newest",label:"Newest first"},{value:"name",label:"Name A–Z"},{value:"attempts",label:"Most attempts"}]} onChange={value=>setSortBy(value as typeof sortBy)} />
        <small>{visible.length} records</small>
      </div>
      {loading ? <div className="students-empty">Loading students…</div> : visible.length === 0 ? <div className="students-empty">No students match this view.</div> : <div className="students-table-wrap"><table><thead><tr><th>Student</th><th>Username</th><th>Email</th><th>Attempts</th><th>Joined</th><th>Valid until</th><th>Last login</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visible.map(student => <tr key={student.id}><td><div className="student-cell"><span>{(student.name || student.userId).charAt(0).toUpperCase()}</span><strong>{student.name || student.userId}</strong></div></td><td><code>{student.userId}</code></td><td>{student.email || "—"}</td><td>{student.attempts || 0}</td><td>{date(student.createdAt)}</td><td>{date(student.validUntil)}</td><td>{date(student.lastLoginAt)}</td><td><span className={`student-status ${student.isActive ? "active" : "blocked"}`}>{student.isActive ? "● Active" : student.isExpired ? "● Expired" : "● Blocked"}</span></td><td><div className="student-actions"><button onClick={() => openEdit(student)}>Edit</button><button className={student.isActive ? "block" : "unblock"} onClick={() => toggleBlock(student)}>{student.isActive ? "Block" : "Unblock"}</button></div></td></tr>)}</tbody></table></div>}
    </div>
    {(adding || editing) && <div className="student-modal-backdrop" onMouseDown={closeModal}><div className="student-modal" onMouseDown={event => event.stopPropagation()}><header><div><span>{editing ? "EDIT STUDENT" : "NEW STUDENT"}</span><h2>{editing ? editing.name : "Create student account"}</h2></div><button onClick={closeModal}>×</button></header><div className="student-form"><label>Full name<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label>Email address<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label><label>Username<input disabled={!!editing} value={form.userId} onChange={event => setForm({ ...form, userId: event.target.value })} /></label>{!editing && <label>Temporary password<input type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="Minimum 4 characters" /></label>}<label>Account valid until<input type="date" min={new Date().toISOString().slice(0,10)} value={form.validUntil} onChange={event => setForm({ ...form, validUntil: event.target.value })} /></label></div><footer><button onClick={closeModal}>Cancel</button><button className="save" disabled={saving} onClick={save}>{saving ? "Saving…" : editing ? "Save changes" : "Create student"}</button></footer></div></div>}
  </section>;
};

export default UserManagement;
