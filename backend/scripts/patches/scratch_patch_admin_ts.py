import re
from pathlib import Path

path = Path("frontend/src/components/TestSeries/AdminTestSeriesDashboard.tsx")
content = path.read_text(encoding="utf-8")

# 1. Update Submission interface
old_iface_regex = re.compile(
    r'export interface Submission \{\s*\n'
    r'  id: string;\s*\n'
    r'  seriesId: string;\s*\n'
    r'  paperId: string;\s*\n'
    r'  seriesName: string;\s*\n'
    r'  paperName: string;\s*\n'
    r'  userId: string;\s*\n'
    r'  userName: string;\s*\n'
    r'  userEmail: string;\s*\n'
    r'  submittedAt\?: string;\s*\n'
    r'  status: "pending" \| "evaluated" \| "published";\s*\n'
    r'  filename: string;\s*\n'
    r'  originalName: string;\s*\n'
    r'  wordCount\?: number;\s*\n'
    r'  pageCount\?: number;\s*\n'
    r'  score\?: number;\s*\n'
    r'  maxMarks\?: number;\s*\n'
    r'  feedback: string;\s*\n'
    r'  improvementSuggestions\?: string;\s*\n'
    r'  strengths\?: string;\s*\n'
    r'  evaluatedAt\?: string;\s*\n'
    r'  evaluatedBy\?: string;\s*\n'
    r'  publishedAt\?: string;\s*\n'
    r'\}',
    re.DOTALL
)

new_iface = '''export interface Submission {
  id: string;
  seriesId: string;
  paperId: string;
  seriesName: string;
  paperName: string;
  paperType?: string;
  userId: string;
  userName: string;
  userEmail: string;
  submittedAt?: string;
  status: "pending" | "evaluated" | "published";
  rawStatus?: string;
  filename: string;
  originalName: string;
  wordCount?: number;
  pageCount?: number;
  score?: number;
  maxMarks?: number;
  feedback: string;
  improvementSuggestions?: string;
  strengths?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
  publishedAt?: string;
  questionReview?: Array<{
    questionId: string;
    question?: string;
    userAnswer?: any;
    correctAnswer?: any;
    isCorrect?: boolean;
    marks?: number;
    section?: string;
  }>;
  answers?: any;
}'''

if old_iface_regex.search(content):
    content = old_iface_regex.sub(new_iface, content, count=1)

# 2. Update EvalModal download button condition
old_dl_regex = re.compile(
    r'<a href=\{downloadUrl\} target="_blank" rel="noreferrer" className="ats-btn ats-btn-primary ats-btn-sm" style=\{\{ textDecoration: "none", flexShrink: 0 \}\}>\s*\n'
    r'\s*<DownloadIcon size=\{14\} style=\{\{ marginRight: 5 \}\} /> Download Sheet\s*\n'
    r'\s*</a>',
    re.DOTALL
)

new_dl = '''{submission.filename ? (
                <a href={downloadUrl} target="_blank" rel="noreferrer" className="ats-btn ats-btn-primary ats-btn-sm" style={{ textDecoration: "none", flexShrink: 0 }}>
                  <DownloadIcon size={14} style={{ marginRight: 5 }} /> Download Sheet
                </a>
              ) : (
                <span className="ats-eval-tag" style={{ fontWeight: 700, color: "#2563eb", background: "#eff6ff" }}>
                  💻 Online Attempt
                </span>
              )}'''

if old_dl_regex.search(content):
    content = old_dl_regex.sub(new_dl, content, count=1)

# 3. Add question review viewer in EvalModal
old_modal_end_regex = re.compile(
    r'(\s*<div className="ats-field full" style=\{\{ marginTop: 14 \}\}>\s*\n\s*<label className="ats-label">💡 Specific Improvement Suggestions.*?</textarea>\s*\n\s*</div>)',
    re.DOTALL
)

question_viewer_addition = r'''\1

          {/* Online Submission Question Review Inspector */}
          {submission.questionReview && submission.questionReview.length > 0 && (
            <div style={{ marginTop: 16, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "0.92rem", color: "#1e293b", fontWeight: 700 }}>
                📋 Student Question Responses ({submission.questionReview.length} Questions)
              </h4>
              <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, background: "#f8fafc" }}>
                {submission.questionReview.map((item, idx) => (
                  <div key={item.questionId || idx} style={{ padding: "8px 0", borderBottom: idx < (submission.questionReview?.length || 0) - 1 ? "1px solid #e2e8f0" : "none", fontSize: "0.82rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: "#334155" }}>
                      <span>Q{idx + 1}. {item.section ? `[${item.section}]` : ""} {item.question || `Question ID: ${item.questionId}`}</span>
                      <span style={{ color: item.isCorrect ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                        {item.isCorrect ? "✓ Correct" : "✗ Incorrect"}
                      </span>
                    </div>
                    <div style={{ marginTop: 4, display: "flex", gap: 14, color: "#64748b", fontSize: "0.78rem" }}>
                      <span>Given Answer: <strong style={{ color: "#0f172a" }}>{Array.isArray(item.userAnswer) ? item.userAnswer.join(", ") : String(item.userAnswer ?? "Unanswered")}</strong></span>
                      {item.correctAnswer && (
                        <span>Correct Answer: <strong style={{ color: "#16a34a" }}>{Array.isArray(item.correctAnswer) ? item.correctAnswer.join(", ") : String(item.correctAnswer)}</strong></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}'''

if old_modal_end_regex.search(content):
    content = old_modal_end_regex.sub(question_viewer_addition, content, count=1)

# 4. In SubmissionsView cards, add paperType badge
old_card_meta_regex = re.compile(
    r'<span className=\{`ats-eval-status \$\{sub\.status\}`\}>\{sub\.status\}</span>',
    re.DOTALL
)

new_card_meta = '''<span className={`ats-eval-status ${sub.status}`}>{sub.status}</span>
                  <span className="ats-eval-tag" style={{ textTransform: "uppercase", fontWeight: 700, fontSize: "0.7rem", color: "#475569" }}>
                    {sub.paperType || "mcq"}
                  </span>'''

if old_card_meta_regex.search(content):
    content = old_card_meta_regex.sub(new_card_meta, content, count=1)

# 5. Update empty message in SubmissionsView
old_empty_msg = '<p>Descriptive and essay submissions will appear here once students upload their papers.</p>'
new_empty_msg = '<p>Candidate test series submissions will appear here once students attempt papers or upload sheets.</p>'
content = content.replace(old_empty_msg, new_empty_msg)

path.write_text(content, encoding="utf-8")
print("SUCCESS: AdminTestSeriesDashboard.tsx updated!")

