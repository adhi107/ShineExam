import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPostForm } from "../services/api";
import { normalizeSearchText } from "../utils/filterUtils";
import "./DocumentManagement.css";

interface Doc {
  id: string;
  title: string;
  description: string;
  originalName: string;
  size: number;
  createdAt: string;
  assignedCount: number;
  assignedUserIds: string[];
}

interface Student {
  name: string;
  userId: string;
  email: string;
  isActive: boolean;
}

const DocumentManagement: React.FC = () => {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [assigning, setAssigning] = useState<Doc | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const [fileType, setFileType] = useState("all");
  const [assignment, setAssignment] = useState("all");
  const [feedbackNotice, setFeedbackNotice] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [docs, users] = await Promise.all([
      apiGet<{ documents: Doc[] }>("/admin/documents"),
      apiGet<{ users: Student[] }>("/admin/users")
    ]);
    setDocuments(docs.documents || []);
    setStudents(users.users || []);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const visibleStudents = useMemo(() => {
    const query = normalizeSearchText(studentSearch);
    return students.filter(student => 
      normalizeSearchText(`${student.name} ${student.userId} ${student.email}`).includes(query)
    );
  }, [students, studentSearch]);

  const filteredDocuments = useMemo(() => documents.filter(doc => {
    const matchesSearch = normalizeSearchText(`${doc.title} ${doc.description} ${doc.originalName}`).includes(normalizeSearchText(documentSearch));
    const extension = doc.originalName.split(".").pop()?.toLowerCase() || "";
    const matchesType = fileType === "all" || (
      fileType === "pdf" ? extension === "pdf" : 
      fileType === "image" ? ["png", "jpg", "jpeg"].includes(extension) : 
      !["pdf", "png", "jpg", "jpeg"].includes(extension)
    );
    const matchesAssignment = assignment === "all" || (
      assignment === "assigned" ? doc.assignedCount > 0 : doc.assignedCount === 0
    );
    return matchesSearch && matchesType && matchesAssignment;
  }), [documents, documentSearch, fileType, assignment]);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !file) return;
    setUploading(true);
    setFeedbackNotice("");
    try {
      const body = new FormData();
      body.append("title", title.trim());
      body.append("description", description.trim());
      body.append("file", file);
      await apiPostForm("/admin/documents", body);
      setTitle("");
      setDescription("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFeedbackNotice("✓ Document uploaded successfully.");
      await load();
    } catch (error: any) {
      alert(error?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const openAssign = (doc: Doc) => {
    setAssigning(doc);
    setSelected(doc.assignedUserIds || []);
    setStudentSearch("");
  };

  const saveAssignments = async () => {
    if (!assigning) return;
    try {
      await apiPost(`/admin/documents/${assigning.id}/assign`, { userIds: selected });
      setAssigning(null);
      setFeedbackNotice("✓ Document assignments updated.");
      await load();
    } catch (error: any) {
      alert(error?.message || "Assignment failed");
    }
  };

  const remove = async (doc: Doc) => {
    if (!window.confirm(`Delete document "${doc.title}"?`)) return;
    try {
      await apiDelete(`/admin/documents/${doc.id}`);
      setFeedbackNotice("Document deleted.");
      await load();
    } catch (error: any) {
      alert(error?.message || "Delete failed");
    }
  };

  const size = (bytes: number) => bytes >= 1048576 
    ? `${(bytes / 1048576).toFixed(1)} MB` 
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

  return (
    <section className="document-admin">
      <header className="page-header-title">
        <div>
          <span className="header-kicker">LEARNING RESOURCES</span>
          <h1>Documents</h1>
          <p>Upload study material, formula sheets, and assign them to selected students.</p>
        </div>
      </header>

      {/* Modern Upload Card */}
      <div className="document-upload-card">
        <div className="composer-heading">
          <span>NEW UPLOAD</span>
          <h2>Upload a Document</h2>
          <p>Support for PDF, Word documents, Excel sheets, text files, and images.</p>
        </div>

        <form onSubmit={upload} className="document-upload-form">
          <div className="form-fields-grid">
            <div className="form-group">
              <label>Document Title</label>
              <input 
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                placeholder="Enter title (e.g. Reasoning Practice Set Vol 1)"
                required
              />
            </div>

            <div className="form-group">
              <label>Short Description</label>
              <input 
                type="text" 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Brief description for candidate reference"
              />
            </div>
          </div>

          <div className="form-file-row">
            <div className="file-picker-container">
              <input 
                ref={fileInputRef}
                type="file" 
                id="doc-file-input"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg" 
                onChange={e => setFile(e.target.files?.[0] || null)}
                style={{ display: "none" }}
              />
              <button 
                type="button" 
                className="choose-file-action-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                📁 {file ? "Change File" : "Choose Document File"}
              </button>
              <span className="selected-filename">
                {file ? `${file.name} (${size(file.size)})` : "No file selected"}
              </span>
              {file && (
                <button 
                  type="button" 
                  className="clear-file-btn" 
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  ✕ Clear
                </button>
              )}
            </div>

            <button 
              type="submit" 
              className="upload-submit-btn"
              disabled={uploading || !file || !title.trim()}
            >
              {uploading ? "Uploading…" : "Upload Document →"}
            </button>
          </div>

          {feedbackNotice && <div className="announcement-notice-banner">{feedbackNotice}</div>}
        </form>
      </div>

      {/* Filter Bar */}
      <div className="document-filters">
        <div className="filter-group search-group">
          <label>Search Documents</label>
          <input 
            type="text" 
            value={documentSearch} 
            onChange={e => setDocumentSearch(e.target.value)} 
            placeholder="Search title, description or filename…"
          />
        </div>

        <div className="filter-group status-group">
          <label>File Type</label>
          <select value={fileType} onChange={e => setFileType(e.target.value)}>
            <option value="all">All File Types</option>
            <option value="pdf">PDF Documents (.pdf)</option>
            <option value="image">Images (.png, .jpg)</option>
            <option value="other">Office & Other</option>
          </select>
        </div>

        <div className="filter-group status-group">
          <label>Assignment</label>
          <select value={assignment} onChange={e => setAssignment(e.target.value)}>
            <option value="all">All Documents</option>
            <option value="assigned">Assigned (1+ students)</option>
            <option value="unassigned">Not Assigned (0)</option>
          </select>
        </div>

        <div className="filter-group button-group">
          <label className="invisible-label">&nbsp;</label>
          <button 
            type="button" 
            className="clear-filters-btn" 
            onClick={() => { setDocumentSearch(""); setFileType("all"); setAssignment("all"); }}
          >
            Clear Filters ✕
          </button>
        </div>
      </div>

      {/* Document Cards List */}
      <div className="document-grid">
        {filteredDocuments.map(doc => (
          <article key={doc.id}>
            <div className="document-type">
              {doc.originalName.endsWith(".pdf") ? "PDF" : doc.originalName.match(/\.(png|jpg|jpeg)$/i) ? "IMG" : "DOC"}
            </div>
            <div className="document-copy">
              <h3>{doc.title}</h3>
              <p>{doc.description || doc.originalName}</p>
              <span>{doc.originalName} • {size(doc.size)}</span>
            </div>
            <div className="document-assigned">
              <strong>{doc.assignedCount}</strong>
              <span>students</span>
            </div>
            <button type="button" onClick={() => openAssign(doc)}>
              Assign
            </button>
            <button type="button" className="danger" onClick={() => remove(doc)}>
              Delete
            </button>
          </article>
        ))}
        {filteredDocuments.length === 0 && (
          <div className="document-empty">No documents match these filters.</div>
        )}
      </div>

      {/* Candidate Assignment Modal */}
      {assigning && (
        <div className="document-modal-backdrop" onMouseDown={() => setAssigning(null)}>
          <div className="document-modal" onMouseDown={e => e.stopPropagation()}>
            <header>
              <div>
                <span>ASSIGN DOCUMENT</span>
                <h2>{assigning.title}</h2>
              </div>
              <button type="button" onClick={() => setAssigning(null)}>×</button>
            </header>

            <input 
              type="text" 
              className="student-search-input" 
              placeholder="Search student name, ID or email…" 
              value={studentSearch} 
              onChange={e => setStudentSearch(e.target.value)} 
            />

            <label className="select-all">
              <input 
                type="checkbox" 
                checked={visibleStudents.length > 0 && visibleStudents.every(s => selected.includes(s.userId))} 
                onChange={e => setSelected(e.target.checked ? Array.from(new Set([...selected, ...visibleStudents.map(s => s.userId)])) : selected.filter(id => !visibleStudents.some(s => s.userId === id)))} 
              />
              Select all visible students
            </label>

            <div className="document-students">
              {visibleStudents.map(student => (
                <label key={student.userId}>
                  <input 
                    type="checkbox" 
                    checked={selected.includes(student.userId)} 
                    onChange={e => setSelected(e.target.checked ? [...selected, student.userId] : selected.filter(id => id !== student.userId))} 
                  />
                  <span>
                    {student.name}
                    <small>{student.userId} • {student.email}</small>
                  </span>
                </label>
              ))}
            </div>

            <footer>
              <span>{selected.length} students selected</span>
              <button type="button" onClick={saveAssignments}>Assign document</button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
};

export default DocumentManagement;
