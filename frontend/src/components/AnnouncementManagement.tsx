import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPostForm } from "../services/api";
import { normalizeSearchText } from "../utils/filterUtils";
import ConfirmDialog, { DialogVariant } from "./ConfirmDialog";
import AlertDialog, { AlertVariant } from "./AlertDialog";
import "./DocumentManagement.css";

interface Announcement {
  id: string;
  title: string;
  message: string;
  linkUrl: string;
  imageUrl: string;
  publishAt: string;
  expiresAt: string;
  createdAt?: string;
  assignedCount: number;
  assignedUserIds: string[];
}

interface Student {
  name: string;
  userId: string;
  email: string;
}

const toInputDateTime = (value: string) => value ? value.slice(0, 16) : "";

const announcementState = (item: Announcement) => {
  const now = Date.now();
  const start = new Date(item.publishAt || item.createdAt || Date.now()).getTime();
  const end = item.expiresAt ? new Date(item.expiresAt).getTime() : Infinity;
  return start > now ? "scheduled" : end < now ? "expired" : "published";
};

const AnnouncementManagement: React.FC = () => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [publishAt, setPublishAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [assigning, setAssigning] = useState<Announcement | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [showLink, setShowLink] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [notice, setNotice] = useState("");

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    confirmText: string;
    variant: DialogVariant;
    icon?: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    variant?: AlertVariant;
    icon?: string;
  } | null>(null);

  const imageRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [a, u] = await Promise.all([
      apiGet<{ announcements: Announcement[] }>("/admin/announcements"),
      apiGet<{ users: Student[] }>("/admin/users")
    ]);
    setItems(a.announcements || []);
    setStudents(u.users || []);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const visibleStudents = useMemo(() => {
    const query = normalizeSearchText(studentSearch);
    return students.filter(s => normalizeSearchText(`${s.name} ${s.userId} ${s.email}`).includes(query));
  }, [students, studentSearch]);

  const filtered = useMemo(() => items.filter(item => 
    normalizeSearchText(`${item.title} ${item.message} ${item.linkUrl}`).includes(normalizeSearchText(search)) && 
    (status === "all" || status === announcementState(item))
  ), [items, search, status]);

  const publish = async () => {
    setNotice("");
    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    if (!cleanTitle || !cleanMessage) {
      setNotice("Please fill in both title and message before publishing.");
      return;
    }
    if (publishAt && expiresAt && new Date(expiresAt) <= new Date(publishAt)) {
      setNotice("Expiration date must be after the publish date.");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("title", cleanTitle);
      body.append("message", cleanMessage);
      body.append("linkUrl", linkUrl.trim());
      if (publishAt) body.append("publishAt", new Date(publishAt).toISOString());
      if (expiresAt) body.append("expiresAt", new Date(expiresAt).toISOString());
      if (image) body.append("image", image);
      await apiPostForm("/admin/announcements", body);
      setTitle(""); setMessage(""); setLinkUrl(""); setImage(null); setPublishAt(""); setExpiresAt(""); setShowLink(false); setShowImage(false);
      if (imageRef.current) imageRef.current.value = "";
      setNotice("✓ Announcement created and published successfully.");
      await load();
    } catch (e: any) {
      setAlertDialog({
        isOpen: true,
        title: "Announcement Error",
        message: e?.message || "Announcement could not be published",
        variant: "danger"
      });
    } finally {
      setUploading(false);
    }
  };

  const openAssign = (item: Announcement) => {
    setAssigning(item);
    setSelected(item.assignedUserIds || []);
    setStudentSearch("");
  };

  const save = async () => {
    if (!assigning) return;
    try {
      await apiPost(`/admin/announcements/${assigning.id}/assign`, { userIds: selected });
      setAssigning(null);
      setNotice("Announcement assignment updated.");
      await load();
    } catch (error: any) {
      setAlertDialog({
        isOpen: true,
        title: "Assignment Error",
        message: error?.message || "Announcement assignment could not be saved.",
        variant: "danger"
      });
    }
  };

  const remove = (item: Announcement) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Announcement",
      message: (
        <>
          Are you sure you want to delete announcement <strong>"{item.title}"</strong>?
          <br />
          This notice will be permanently removed from candidate boards.
        </>
      ),
      confirmText: "Yes, Delete Announcement",
      variant: "danger",
      icon: "🗑️",
      onConfirm: async () => {
        try {
          await apiDelete(`/admin/announcements/${item.id}`);
          setNotice("Announcement deleted successfully.");
          await load();
        } catch(err: any) {
          setAlertDialog({
            isOpen: true,
            title: "Delete Failed",
            message: err?.message || "Could not delete announcement.",
            variant: "danger"
          });
        }
      }
    });
  };

  return (
    <section className="document-admin">
      <header className="page-header-title">
        <div>
          <span className="header-kicker">STUDENT COMMUNICATIONS</span>
          <h1>Announcements</h1>
          <p>Publish student notices and schedule future update messages.</p>
        </div>
      </header>

      {/* Modern Composer Card */}
      <div className="announcement-composer">
        <div className="composer-heading">
          <span>NEW ANNOUNCEMENT</span>
          <h2>Create Announcement</h2>
          <p>Publish immediately or schedule a future student update.</p>
        </div>

        <form onSubmit={e => { e.preventDefault(); void publish(); }} className="announcement-form">
          <div className="form-group full-width">
            <label>Announcement Title</label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="Enter title (e.g. Upcoming Mock Exam Schedule)"
              required
            />
          </div>

          <div className="form-group full-width">
            <label>Announcement Message</label>
            <textarea 
              value={message} 
              onChange={e => setMessage(e.target.value)} 
              placeholder="Write the complete announcement message for candidates…"
              required
            />
          </div>

          {/* Attachments Section */}
          <div className="form-attachments-row">
            <button 
              type="button" 
              className={`attachment-toggle-btn ${showLink ? "active" : ""}`} 
              onClick={() => setShowLink(v => !v)}
            >
              <span className="icon">🔗</span>
              <div className="btn-text">
                <strong>Add Link</strong>
                <small>{showLink ? "Click to remove link field" : "Attach a batch or info page URL"}</small>
              </div>
            </button>

            <button 
              type="button" 
              className={`attachment-toggle-btn ${showImage ? "active" : ""}`} 
              onClick={() => setShowImage(v => !v)}
            >
              <span className="icon">🖼️</span>
              <div className="btn-text">
                <strong>Upload Image</strong>
                <small>{showImage ? "Click to remove image field" : "PNG or JPG announcement banner"}</small>
              </div>
            </button>
          </div>

          {showLink && (
            <div className="form-group full-width expanded-field">
              <label>Page Link URL</label>
              <input 
                type="url" 
                value={linkUrl} 
                onChange={e => setLinkUrl(e.target.value)} 
                placeholder="https://example.com/future-test-update"
              />
            </div>
          )}

          {showImage && (
            <div className="announcement-image-picker">
              <input 
                ref={imageRef} 
                type="file" 
                accept=".png,.jpg,.jpeg" 
                onChange={e => setImage(e.target.files?.[0] || null)}
              />
              <button type="button" onClick={() => imageRef.current?.click()}>
                📂 Choose Image File
              </button>
              <span className="file-name">{image ? image.name : "No image selected"}</span>
              {image && (
                <button 
                  type="button" 
                  className="remove-picked-file" 
                  onClick={() => {
                    setImage(null);
                    if (imageRef.current) imageRef.current.value = "";
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          )}

          {/* Schedule & Action Row */}
          <div className="form-schedule-row">
            <div className="form-group">
              <label>Publish From</label>
              <input 
                type="datetime-local" 
                value={toInputDateTime(publishAt)} 
                onChange={e => setPublishAt(e.target.value)}
              />
              <small className="help-text">Leave empty to publish immediately</small>
            </div>

            <div className="form-group">
              <label>Expire On</label>
              <input 
                type="datetime-local" 
                value={toInputDateTime(expiresAt)} 
                onChange={e => setExpiresAt(e.target.value)}
              />
              <small className="help-text">Optional end date for unpublishing</small>
            </div>

            <div className="form-group action-group">
              <label className="invisible-label">&nbsp;</label>
              <button 
                type="submit" 
                className="publish-announcement-btn" 
                disabled={uploading || !title.trim() || !message.trim()} 
              >
                {uploading ? "Publishing…" : "Publish Announcement →"}
              </button>
            </div>
          </div>

          {notice && <div className="announcement-notice-banner">{notice}</div>}
        </form>
      </div>

      {/* Filter Bar */}
      <div className="document-filters">
        <div className="filter-group search-group">
          <label>Search Announcements</label>
          <input 
            type="text" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search title, message or link…"
          />
        </div>

        <div className="filter-group status-group">
          <label>Status Filter</label>
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        <div className="filter-group button-group">
          <label className="invisible-label">&nbsp;</label>
          <button 
            type="button" 
            className="clear-filters-btn"
            onClick={() => { setSearch(""); setStatus("all"); }}
          >
            Clear Filters ✕
          </button>
        </div>
      </div>

      {/* Announcement Grid */}
      <div className="document-grid">
        {filtered.map(item => (
          <article key={item.id}>
            <div className="document-type">NEWS</div>
            <div className="document-copy">
              <h3>{item.title}</h3>
              <p>{item.message}</p>
              <span>{item.linkUrl || "No external page"} • {announcementState(item)}</span>
            </div>
            <div className="document-assigned">
              <strong>{item.assignedCount}</strong>
              <span>students</span>
            </div>
            <button type="button" onClick={() => openAssign(item)}>
              Assign
            </button>
            <button type="button" className="danger" onClick={() => remove(item)}>
              Delete
            </button>
          </article>
        ))}
        {filtered.length === 0 && (
          <div className="document-empty">No announcements match these filters.</div>
        )}
      </div>

      {/* Student Assignment Modal */}
      {assigning && (
        <div className="document-modal-backdrop" onMouseDown={() => setAssigning(null)}>
          <div className="document-modal" onMouseDown={e => e.stopPropagation()}>
            <header>
              <div>
                <span>ASSIGN ANNOUNCEMENT</span>
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
              {visibleStudents.map(s => (
                <label key={s.userId}>
                  <input 
                    type="checkbox" 
                    checked={selected.includes(s.userId)} 
                    onChange={e => setSelected(e.target.checked ? [...selected, s.userId] : selected.filter(id => id !== s.userId))} 
                  />
                  <span>
                    {s.name}
                    <small>{s.userId} • {s.email}</small>
                  </span>
                </label>
              ))}
            </div>

            <footer>
              <span>{selected.length} students selected</span>
              <button type="button" onClick={save}>Assign announcement</button>
            </footer>
          </div>
        </div>
      )}

      {/* Screen Center Custom Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          variant={confirmDialog.variant}
          icon={confirmDialog.icon}
          onConfirm={async () => {
            const cb = confirmDialog.onConfirm;
            setConfirmDialog(null);
            await cb();
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* Screen Center Custom Alert Dialog */}
      {alertDialog && (
        <AlertDialog
          isOpen={alertDialog.isOpen}
          title={alertDialog.title}
          message={alertDialog.message}
          variant={alertDialog.variant}
          icon={alertDialog.icon}
          onClose={() => setAlertDialog(null)}
        />
      )}
    </section>
  );
};

export default AnnouncementManagement;

