import sys
import re
from pathlib import Path

print("Preparing view/download and CSS fixes...")

# =====================================================================
# 1. Update backend/routes/test_series.py
# =====================================================================
ts_path = r"d:\Adhi\Shine\Shine-Exam\backend\routes\test_series.py"
with open(ts_path, "r", encoding="utf-8") as f:
    ts_code = f.read()

# Replace download_submission with robust view & download handler
old_download = '''@test_series_bp.route("/submissions/<attempt_id>/download", methods=["GET"])
def download_submission(attempt_id):
    """Download a student's descriptive submission file."""
    db = get_db()
    try:
        oid = ObjectId(attempt_id)
    except Exception:
        return jsonify({"error": "Invalid attempt ID"}), 400

    attempt = db.series_attempts.find_one({"_id": oid})
    if not attempt:
        return jsonify({"error": "Submission not found"}), 404

    filename = attempt.get("filename", "")
    file_path = SUBMISSIONS_DIR / filename
    if not file_path.is_file():
        return jsonify({"error": "File not found on server"}), 404

    original_name = attempt.get("originalName", filename)
    return send_file(str(file_path), download_name=original_name, as_attachment=True)'''

new_download = '''@test_series_bp.route("/submissions/<attempt_id>/download", methods=["GET"])
@test_series_bp.route("/submissions/<attempt_id>/view", methods=["GET"])
def download_submission(attempt_id):
    """Download or view a student's descriptive submission file in browser."""
    db = get_db()
    attempt = None
    try:
        if ObjectId.is_valid(attempt_id):
            attempt = db.series_attempts.find_one({"_id": ObjectId(attempt_id)})
    except Exception:
        pass

    if not attempt:
        attempt = db.series_attempts.find_one({"_id": attempt_id})
    if not attempt:
        attempt = db.results.find_one({"$or": [{"attemptId": attempt_id}, {"_id": attempt_id}]})
    if not attempt and ObjectId.is_valid(attempt_id):
        attempt = db.results.find_one({"_id": ObjectId(attempt_id)})
    if not attempt:
        attempt = db.attempts.find_one({"_id": attempt_id})
    if not attempt and ObjectId.is_valid(attempt_id):
        attempt = db.attempts.find_one({"_id": ObjectId(attempt_id)})

    if not attempt:
        return jsonify({"error": "Submission not found"}), 404

    filename = str(attempt.get("filename") or attempt.get("submittedFile") or attempt.get("file") or "").strip()
    if not filename:
        return jsonify({"error": "No file attached to this submission"}), 404

    clean_name = filename.replace("\\\\", "/").split("/")[-1]
    backend_dir = Path(__file__).resolve().parents[1]

    candidates = [
        SUBMISSIONS_DIR / clean_name,
        SUBMISSIONS_DIR / filename,
        backend_dir / "uploads" / "series_submissions" / clean_name,
        backend_dir / "uploads" / clean_name,
        backend_dir / "uploads" / filename,
        backend_dir / "uploads" / "attachments" / clean_name,
        backend_dir / "uploads" / "documents" / clean_name,
    ]

    target_file = None
    for cand in candidates:
        if cand and cand.is_file():
            target_file = cand
            break

    # Fallback search in SUBMISSIONS_DIR if clean_name didn't match directly
    if not target_file and SUBMISSIONS_DIR.is_dir():
        uid = str(attempt.get("userId") or "").strip()
        for f in SUBMISSIONS_DIR.glob("*"):
            if f.is_file() and (clean_name in f.name or (uid and f"_{uid}_" in f.name)):
                target_file = f
                break

    if not target_file:
        return jsonify({
            "error": "Submission file not found on server",
            "filename": filename,
            "searched": [str(c) for c in candidates[:3]]
        }), 404

    is_view = request.args.get("view") in ("1", "true") or request.path.endswith("/view")
    original_name = attempt.get("originalName") or clean_name or "submission.pdf"

    ext = target_file.suffix.lower().lstrip(".")
    mime_types = {
        "pdf": "application/pdf",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
        "heic": "image/heic",
        "doc": "application/msword",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "txt": "text/plain",
    }
    mimetype = mime_types.get(ext, "application/octet-stream")

    resp = send_file(
        str(target_file),
        mimetype=mimetype,
        as_attachment=not is_view,
        download_name=original_name,
        conditional=True
    )
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, HEAD, OPTIONS"
    resp.headers["Access-Control-Expose-Headers"] = "Content-Disposition, Content-Type, Content-Length"
    resp.headers.pop("X-Frame-Options", None)
    return resp'''

if old_download in ts_code:
    ts_code = ts_code.replace(old_download, new_download)
    print("1. Patched download_submission in test_series.py (added /view and robust file resolution)")
else:
    print("WARNING: old_download not found in test_series.py")

with open(ts_path, "w", encoding="utf-8") as f:
    f.write(ts_code)


# =====================================================================
# 2. Update frontend/src/components/TestSeries/AdminTestSeriesDashboard.css
# =====================================================================
css_path = r"d:\Adhi\Shine\Shine-Exam\frontend\src\components\TestSeries\AdminTestSeriesDashboard.css"
with open(css_path, "r", encoding="utf-8") as f:
    css_code = f.read()

eval_styles = """
/* ── Evaluation Queue Cards & Grid ───────────────────────────── */
.ats-eval-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ats-eval-card {
  background: #ffffff;
  border: 1.5px solid #e2e8f0;
  border-radius: 16px;
  padding: 18px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}

.ats-eval-card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.07);
  transform: translateY(-1px);
}

.ats-eval-avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
  color: #4f46e5;
  font-weight: 800;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid #c7d2fe;
}

.ats-eval-info {
  flex: 1;
  min-width: 0;
}

.ats-eval-info h4 {
  margin: 0 0 4px;
  font-size: 1.05rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.ats-eval-info p {
  margin: 0 0 10px;
  font-size: 0.88rem;
  font-weight: 700;
  color: #4f46e5;
}

.ats-eval-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  font-size: 0.8rem;
  color: #64748b;
}

.ats-eval-status {
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: inline-flex;
  align-items: center;
}

.ats-eval-status.pending {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fde68a;
}

.ats-eval-status.evaluated {
  background: #dbeafe;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}

.ats-eval-status.published {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.ats-eval-tag {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 2.5px 8px;
  border-radius: 6px;
  font-weight: 700;
  color: #475569;
  font-size: 0.7rem;
  text-transform: uppercase;
}

.ats-eval-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.ats-card-actions-menu {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ── Inline Sheet Preview ────────────────────────────────────── */
.ats-inline-preview-box {
  margin: 16px 0 20px;
  border: 1.5px solid #cbd5e1;
  border-radius: 12px;
  overflow: hidden;
  background: #f8fafc;
}

.ats-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
  font-weight: 700;
  font-size: 0.85rem;
  color: #334155;
}

.ats-preview-iframe {
  width: 100%;
  height: 520px;
  border: none;
  background: #ffffff;
  display: block;
}
"""

# Append eval_styles before media queries or at end
if ".ats-eval-grid" not in css_code:
    css_code = css_code + "\n" + eval_styles
    print("2. Added missing evaluation CSS classes to AdminTestSeriesDashboard.css")
else:
    print("Evaluation CSS already present in AdminTestSeriesDashboard.css")

with open(css_path, "w", encoding="utf-8") as f:
    f.write(css_code)


# =====================================================================
# 3. Update frontend/src/components/TestSeries/AdminTestSeriesDashboard.tsx
# =====================================================================
tsx_path = r"d:\Adhi\Shine\Shine-Exam\frontend\src\components\TestSeries\AdminTestSeriesDashboard.tsx"
with open(tsx_path, "r", encoding="utf-8") as f:
    tsx_code = f.read()

# 3a. In EvalModal, add view sheet button & preview toggle
old_eval_modal_header_buttons = '''              {submission.filename ? (
                <a href={downloadUrl} target="_blank" rel="noreferrer" className="ats-btn ats-btn-primary ats-btn-sm" style={{ textDecoration: "none", flexShrink: 0 }}>
                  <DownloadIcon size={14} style={{ marginRight: 5 }} /> Download Sheet
                </a>
              ) : (
                <span className="ats-eval-tag" style={{ fontWeight: 700, color: "#2563eb", background: "#eff6ff" }}>
                  💻 Online Attempt
                </span>
              )}'''

new_eval_modal_header_buttons = '''              {submission.filename ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                  <button
                    type="button"
                    className={`ats-btn ats-btn-sm ${showDocPreview ? "ats-btn-primary" : "ats-btn-secondary"}`}
                    onClick={() => setShowDocPreview(!showDocPreview)}
                    title="Toggle preview of candidate answer sheet"
                  >
                    <EyeIcon size={14} style={{ marginRight: 4 }} />
                    {showDocPreview ? "Hide Preview" : "View Sheet"}
                  </button>
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ats-btn ats-btn-primary ats-btn-sm"
                    style={{ textDecoration: "none" }}
                    title="Download original submission file"
                  >
                    <DownloadIcon size={14} style={{ marginRight: 5 }} /> Download Sheet
                  </a>
                </div>
              ) : (
                <span className="ats-eval-tag" style={{ fontWeight: 700, color: "#2563eb", background: "#eff6ff" }}>
                  💻 Online Attempt
                </span>
              )}'''

if old_eval_modal_header_buttons in tsx_code:
    tsx_code = tsx_code.replace(old_eval_modal_header_buttons, new_eval_modal_header_buttons)
    print("3a. Patched EvalModal header buttons")
else:
    print("WARNING: old_eval_modal_header_buttons not found")

# Add showDocPreview state to EvalModal
old_eval_modal_state = '''function EvalModal({ submission, onClose, onSaved }: {
  submission: Submission;
  onClose: () => void;
  onSaved: (s: Submission) => void;
}) {
  const [score, setScore] = useState<string>(submission.score != null ? String(submission.score) : "");'''

new_eval_modal_state = '''function EvalModal({ submission, onClose, onSaved }: {
  submission: Submission;
  onClose: () => void;
  onSaved: (s: Submission) => void;
}) {
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [score, setScore] = useState<string>(submission.score != null ? String(submission.score) : "");'''

if old_eval_modal_state in tsx_code:
    tsx_code = tsx_code.replace(old_eval_modal_state, new_eval_modal_state)
    print("3b. Added showDocPreview state to EvalModal")
else:
    print("WARNING: old_eval_modal_state not found")

# Add inline preview box inside EvalModal right after ats-eval-info-card
old_info_card_close = '''            )}
          </div>

          <div className="ats-form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginTop: 16 }}>'''

new_info_card_close = '''            )}
          </div>

          {showDocPreview && submission.filename && (
            <div className="ats-inline-preview-box">
              <div className="ats-preview-header">
                <span>📄 Candidate Submission: {submission.originalName || submission.filename}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <a
                    href={buildUrl(`/admin/test-series/submissions/${submission.id}/download?view=1`)}
                    target="_blank"
                    rel="noreferrer"
                    className="ats-btn ats-btn-secondary ats-btn-sm"
                    style={{ textDecoration: "none" }}
                  >
                    ↗ Open Full Page
                  </a>
                  <button type="button" className="ats-btn ats-btn-secondary ats-btn-sm" onClick={() => setShowDocPreview(false)}>
                    ✕ Close
                  </button>
                </div>
              </div>
              <iframe
                src={buildUrl(`/admin/test-series/submissions/${submission.id}/download?view=1`)}
                className="ats-preview-iframe"
                title="Candidate Answer Sheet Preview"
              />
            </div>
          )}

          <div className="ats-form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginTop: 16 }}>'''

if old_info_card_close in tsx_code:
    tsx_code = tsx_code.replace(old_info_card_close, new_info_card_close)
    print("3c. Added inline preview frame to EvalModal")
else:
    print("WARNING: old_info_card_close not found")

# 3d. In SubmissionsView cards, add View and Download buttons right on each card
old_eval_actions = '''              <div className="ats-eval-actions">
                <button className="ats-btn ats-btn-primary ats-btn-sm" onClick={() => setEvalTarget(sub)}>
                  <EditIcon size={13} style={{ marginRight: 4 }} />
                  {sub.status === "pending" ? "Evaluate" : "Re-Evaluate"}
                </button>
                {sub.status === "evaluated" && (
                  <button className="ats-btn ats-btn-secondary ats-btn-sm" onClick={() => publishSingle(sub)}>
                    <CheckIcon size={13} style={{ marginRight: 4 }} /> Publish
                  </button>
                )}
              </div>'''

new_eval_actions = '''              <div className="ats-eval-actions">
                {sub.filename ? (
                  <>
                    <a
                      href={buildUrl(`/admin/test-series/submissions/${sub.id}/download?view=1`)}
                      target="_blank"
                      rel="noreferrer"
                      className="ats-btn ats-btn-secondary ats-btn-sm"
                      style={{ textDecoration: "none" }}
                      title="View student answer sheet in new tab"
                    >
                      <EyeIcon size={13} style={{ marginRight: 4 }} /> View
                    </a>
                    <a
                      href={buildUrl(`/admin/test-series/submissions/${sub.id}/download`)}
                      target="_blank"
                      rel="noreferrer"
                      className="ats-btn ats-btn-secondary ats-btn-sm"
                      style={{ textDecoration: "none" }}
                      title="Download answer sheet"
                    >
                      <DownloadIcon size={13} style={{ marginRight: 4 }} /> Download
                    </a>
                  </>
                ) : null}
                <button className="ats-btn ats-btn-primary ats-btn-sm" onClick={() => setEvalTarget(sub)}>
                  <EditIcon size={13} style={{ marginRight: 4 }} />
                  {sub.status === "pending" ? "Evaluate" : "Re-Evaluate"}
                </button>
                {sub.status === "evaluated" && (
                  <button className="ats-btn ats-btn-secondary ats-btn-sm" onClick={() => publishSingle(sub)}>
                    <CheckIcon size={13} style={{ marginRight: 4 }} /> Publish
                  </button>
                )}
              </div>'''

if old_eval_actions in tsx_code:
    tsx_code = tsx_code.replace(old_eval_actions, new_eval_actions)
    print("3d. Added View and Download buttons on queue cards")
else:
    print("WARNING: old_eval_actions not found")

with open(tsx_path, "w", encoding="utf-8") as f:
    f.write(tsx_code)

print("\nAll patches prepared successfully!")
