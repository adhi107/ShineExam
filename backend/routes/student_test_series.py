"""
backend/routes/student_test_series.py
──────────────────────────────────────
Student-facing API routes for Test Series.
Enrollment-gated browsing, MCQ paper attempts, descriptive/essay uploads,
and result retrieval.
"""

from datetime import datetime
from pathlib import Path
import uuid

from bson import ObjectId
from flask import Blueprint, jsonify, request, send_file
from werkzeug.utils import secure_filename

from config.db import get_db
from utils.json import to_jsonable
from utils.tenant import get_request_tenant_id, DEFAULT_TENANT_ID
from services.scoring import compute_result

student_series_bp = Blueprint("student_series", __name__)

SUBMISSIONS_DIR = Path(__file__).resolve().parents[1] / "uploads" / "series_submissions"
SUBMISSIONS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_SUBMISSION_EXTENSIONS = {"pdf", "doc", "docx", "jpg", "jpeg", "png", "webp", "heic"}


# ────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────

def _get_user(db, user_id: str):
    uid = str(user_id).strip()
    return db.users.find_one({
        "$or": [{"userId": uid}, {"naxUnid": uid}],
        "role": "answerer"
    })


def _get_user_courses(db, user_id: str):
    """Return list of course IDs and course type tags enrolled by this student."""
    assignments = list(db.course_assignments.find({"userId": user_id}, {"courseId": 1}))
    if not assignments:
        return [], []
    course_ids = [a["courseId"] for a in assignments if a.get("courseId")]
    courses = list(db.courses.find({"_id": {"$in": course_ids}}, {"courseType": 1, "_id": 1}))
    course_types = [c.get("courseType", "") for c in courses if c.get("courseType")]
    return [str(c["_id"]) for c in courses], course_types


def _series_accessible(series, user_assigned_ids: set, user_course_types: list, user_doc: dict = None) -> bool:
    """Check if the series is accessible to this student (assigned, open to all, batch, or course-type match)."""
    # 1. Directly assigned
    if str(series.get("_id")) in user_assigned_ids:
        return True

    # 2. Open to all students
    assigned_to = series.get("assignedTo", "all")
    if assigned_to in ("all", "All", None, "", []):
        return True

    # 3. User identifiers or batches
    if user_doc:
        uid = str(user_doc.get("userId", "")).strip()
        nax = str(user_doc.get("naxUnid", "")).strip()
        batch = str(user_doc.get("batch", "")).strip()
        batches = [str(b).strip() for b in user_doc.get("batches", []) if str(b).strip()]

        assigned_students = series.get("assignedStudentIds") or series.get("assignedUsers") or []
        if isinstance(assigned_students, list) and (uid in assigned_students or nax in assigned_students):
            return True

        assigned_batches = series.get("assignedBatches") or []
        if isinstance(assigned_batches, list) and (batch in assigned_batches or any(b in assigned_batches for b in batches)):
            return True

    # 4. Course types match
    series_course_types = series.get("courseTypes", [])
    if series_course_types and user_course_types:
        if any(ct in series_course_types for ct in user_course_types):
            return True

    if not series_course_types and not series.get("assignedStudentIds"):
        return True

    return False


def _attempt_status_for_paper(db, user_id: str, paper_id):
    """Return the latest attempt record for a user+paper combo."""
    return db.series_attempts.find_one(
        {"userId": user_id, "paperId": paper_id},
        sort=[("submittedAt", -1)]
    )


def _serialize_series_card(series, papers, user_id, db):
    """Serialize series as a student-facing card with per-paper attempt status and optional subject tracking."""
    assignment = db.series_assignments.find_one({"seriesId": series["_id"], "userId": user_id}) if user_id else None
    selected_optional = assignment.get("optionalSubject", "") if assignment else ""

    # Collect all available optional subjects across papers in this series
    optional_subjects_set = set()
    for p in papers:
        if p.get("isOptional") and p.get("optionalSubject"):
            optional_subjects_set.add(p["optionalSubject"])
    available_optionals = sorted(list(optional_subjects_set))

    paper_list = []
    for p in papers:
        # Check paper-specific assignment (if assignedUserIds is populated, only assigned users see this paper)
        assigned_uids = p.get("assignedUserIds", [])
        if assigned_uids and user_id not in assigned_uids:
            continue

        is_opt = bool(p.get("isOptional", False))
        opt_subject = p.get("optionalSubject", "")

        attempt = _attempt_status_for_paper(db, user_id, p["_id"])
        paper_list.append({
            "id": str(p["_id"]),
            "paperNumber": p.get("paperNumber", 1),
            "paperName": p.get("paperName", ""),
            "paperType": p.get("paperType", "mcq"),
            "duration": p.get("duration", 60),
            "totalMarks": p.get("totalMarks", 100),
            "questionCount": p.get("questionCount", 0),
            "isOptional": is_opt,
            "optionalSubject": opt_subject,
            "subjectCategory": p.get("subjectCategory", "General Studies"),
            "paperStage": p.get("paperStage", "Mains"),
            "matchesUserOptional": (opt_subject == selected_optional) if is_opt and selected_optional else False,
            "submissionConfig": p.get("submissionConfig", {}),
            "attemptStatus": _resolve_attempt_status(attempt, p.get("paperType", "mcq")),
            "attemptId": str(attempt["_id"]) if attempt else None,
            "score": attempt.get("score") or attempt.get("scoredMarks") if attempt else None,
            "feedback": attempt.get("feedback", "") if attempt else "",
            "publishedAt": attempt.get("publishedAt") if attempt else None,
        })

    # Total and attempted calculations
    # If user has a selected optional, only count compulsory papers + their selected optional papers
    active_papers = [
        pp for pp in paper_list
        if not pp["isOptional"] or (selected_optional and pp["optionalSubject"] == selected_optional)
    ] if selected_optional else paper_list

    attempted_papers = sum(1 for pp in active_papers if pp["attemptStatus"] not in ("not_started", ""))
    total_active_marks = sum(int(pp["totalMarks"]) for pp in active_papers) if active_papers else int(series.get("totalMarks", 0))

    return {
        "id": str(series["_id"]),
        "name": series.get("name", ""),
        "description": series.get("description", ""),
        "examType": series.get("examType", "other"),
        "status": series.get("status", "draft"),
        "availableFrom": series.get("availableFrom"),
        "validUntil": series.get("validUntil"),
        "totalMarks": total_active_marks,
        "passingPercentage": series.get("passingPercentage", 33),
        "paperCount": len(active_papers),
        "attemptedPapers": attempted_papers,
        "availableOptionalSubjects": available_optionals,
        "selectedOptionalSubject": selected_optional,
        "hasOptionalPapers": len(available_optionals) > 0,
        "requiresOptionalSelection": len(available_optionals) > 0 and not selected_optional,
        "papers": paper_list,
    }


def _resolve_attempt_status(attempt, paper_type: str) -> str:
    if not attempt:
        return "not_started"
    status = attempt.get("status", "")
    if paper_type in ("descriptive", "essay"):
        # pending → submitted (under evaluation) → evaluated → published
        if status == "published":
            return "result_published"
        if status == "evaluated":
            return "under_evaluation"
        if status in ("submitted", "pending"):
            return "submitted"
        return "not_started"
    else:
        # MCQ
        if status == "submitted":
            return "submitted"
        if status == "in_progress":
            return "in_progress"
        return "not_started"


# ────────────────────────────────────────────────────────────────
# Browse Series
# ────────────────────────────────────────────────────────────────

@student_series_bp.route("", methods=["GET"])
@student_series_bp.route("/", methods=["GET"])
def list_accessible_series():
    """Student: List all test series accessible based on enrollment & assignments."""
    db = get_db()
    user_id = request.args.get("userId", "").strip()
    if not user_id:
        return jsonify({"error": "userId required"}), 400

    exam_type = request.args.get("examType", "")

    # Get user's course enrollments
    _, user_course_types = _get_user_courses(db, user_id)

    user_doc = db.users.find_one({"$or": [{"userId": user_id}, {"naxUnid": user_id}]})
    user_ids = [user_id]
    if user_doc:
        if user_doc.get("userId"):
            user_ids.append(str(user_doc.get("userId")).strip())
        if user_doc.get("naxUnid"):
            user_ids.append(str(user_doc.get("naxUnid")).strip())

    # Get series directly assigned to this student
    assigned = list(db.series_assignments.find({"userId": {"$in": user_ids}}, {"seriesId": 1}))
    assigned_series_ids = {str(a["seriesId"]) for a in assigned if a.get("seriesId")}

    # Fetch all active series for tenant
    tenant_id = get_request_tenant_id(user_doc)
    query = {"status": "active"}
    if tenant_id and tenant_id != "all":
        query["$or"] = [
            {"tenantId": tenant_id},
            {"tenantId": {"$exists": False}},
            {"tenantId": None},
        ]
    if exam_type:
        query["examType"] = exam_type

    all_series = list(db.test_series.find(query).sort("createdAt", -1))

    accessible = []
    for s in all_series:
        if _series_accessible(s, assigned_series_ids, user_course_types, user_doc):
            papers = list(db.series_papers.find({"seriesId": s["_id"]}).sort("paperNumber", 1))
            accessible.append(_serialize_series_card(s, papers, user_id, db))

    return jsonify({"series": to_jsonable(accessible)})


@student_series_bp.route("/<series_id>", methods=["GET"])
def get_series_detail(series_id):
    """Student: Get full series detail with per-paper attempt status."""
    db = get_db()
    user_id = request.args.get("userId", "").strip()
    if not user_id:
        return jsonify({"error": "userId required"}), 400

    try:
        oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid series ID"}), 400

    series = db.test_series.find_one({"_id": oid})
    if not series:
        return jsonify({"error": "Series not found"}), 404

    user_doc = db.users.find_one({"$or": [{"userId": user_id}, {"naxUnid": user_id}]})
    user_ids = [user_id]
    if user_doc:
        if user_doc.get("userId"):
            user_ids.append(str(user_doc.get("userId")).strip())
        if user_doc.get("naxUnid"):
            user_ids.append(str(user_doc.get("naxUnid")).strip())

    # Access check
    _, user_course_types = _get_user_courses(db, user_id)
    assigned = db.series_assignments.find_one({"seriesId": oid, "userId": {"$in": user_ids}})
    assigned_ids = {series_id} if assigned else set()
    if not _series_accessible(series, assigned_ids, user_course_types, user_doc):
        return jsonify({"error": "You do not have access to this series"}), 403

    papers = list(db.series_papers.find({"seriesId": oid}).sort("paperNumber", 1))
    return jsonify({"series": to_jsonable(_serialize_series_card(series, papers, user_id, db))})


@student_series_bp.route("/<series_id>/select-optional", methods=["POST"])
def select_optional_subject(series_id):
    """Student: Select or change optional subject track for a test series."""
    db = get_db()
    data = request.get_json(silent=True) or {}
    user_id = str(data.get("userId", "")).strip()
    optional_subject = str(data.get("optionalSubject", "")).strip()

    if not user_id:
        return jsonify({"error": "userId required"}), 400
    if not optional_subject:
        return jsonify({"error": "optionalSubject required"}), 400

    try:
        series_oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid series ID"}), 400

    series = db.test_series.find_one({"_id": series_oid})
    if not series:
        return jsonify({"error": "Series not found"}), 404

    now = datetime.utcnow().isoformat()
    db.series_assignments.update_one(
        {"seriesId": series_oid, "userId": user_id},
        {
            "$set": {
                "seriesId": series_oid,
                "userId": user_id,
                "optionalSubject": optional_subject,
                "assignedAt": now,
            }
        },
        upsert=True
    )

    papers = list(db.series_papers.find({"seriesId": series_oid}).sort("paperNumber", 1))
    return jsonify({
        "message": f"Optional subject set to '{optional_subject}' successfully",
        "series": to_jsonable(_serialize_series_card(series, papers, user_id, db))
    })


# ────────────────────────────────────────────────────────────────
# MCQ Paper Attempt
# ────────────────────────────────────────────────────────────────

@student_series_bp.route("/<series_id>/papers/<paper_id>/start", methods=["GET"])
def start_mcq_paper(series_id, paper_id):
    """Student: Start or resume an MCQ paper attempt."""
    db = get_db()
    user_id = request.args.get("userId", "").strip()
    if not user_id:
        return jsonify({"error": "userId required"}), 400

    try:
        series_oid = ObjectId(series_id)
        paper_oid = ObjectId(paper_id)
    except Exception:
        return jsonify({"error": "Invalid ID"}), 400

    paper = db.series_papers.find_one({"_id": paper_oid, "seriesId": series_oid})
    if not paper:
        return jsonify({"error": "Paper not found"}), 404
    if paper.get("paperType") != "mcq":
        return jsonify({"error": "This paper is not an MCQ paper"}), 400

    # Check if already submitted
    existing = _attempt_status_for_paper(db, user_id, paper_oid)
    if existing and existing.get("status") == "submitted":
        return jsonify({"error": "You have already submitted this paper"}), 400

    series = db.test_series.find_one({"_id": series_oid})
    return jsonify({
        "exam": to_jsonable({
            "id": str(paper_oid),
            "testName": f"{series.get('name', '')} — {paper.get('paperName', '')}",
            "duration": paper.get("duration", 60),
            "passingPercentage": paper.get("passingMarks", 33),
            "questions": paper.get("questions", []),
            "timerMode": "overall",
            "negativeMarkingScheme": paper.get("negativeMarkingScheme", "none"),
            "seriesId": series_id,
            "paperId": paper_id,
            "isSeries": True,
        }),
        "attemptId": str(existing["_id"]) if existing else None,
        "savedAnswers": existing.get("answers", {}) if existing else {},
    })


@student_series_bp.route("/<series_id>/papers/<paper_id>/submit", methods=["POST"])
def submit_mcq_paper(series_id, paper_id):
    """Student: Submit MCQ answers for auto-grading."""
    db = get_db()
    data = request.get_json(silent=True) or {}
    user_id = str(data.get("userId", "")).strip()
    if not user_id:
        return jsonify({"error": "userId required"}), 400

    try:
        series_oid = ObjectId(series_id)
        paper_oid = ObjectId(paper_id)
    except Exception:
        return jsonify({"error": "Invalid ID"}), 400

    paper = db.series_papers.find_one({"_id": paper_oid, "seriesId": series_oid})
    if not paper:
        return jsonify({"error": "Paper not found"}), 404

    answers = data.get("answers", {})
    time_spent_sec = int(data.get("timeSpentSec", 0))

    # Auto-grade using existing scoring engine
    questions = paper.get("questions", [])
    result = compute_result(questions, answers, paper.get("totalMarks", 100))

    now = datetime.utcnow()
    series = db.test_series.find_one({"_id": series_oid})

    attempt_doc = {
        "seriesId": series_oid,
        "paperId": paper_oid,
        "seriesName": series.get("name", "") if series else "",
        "paperName": paper.get("paperName", ""),
        "paperType": "mcq",
        "userId": user_id,
        "answers": answers,
        "scoredMarks": result.get("scoredMarks", 0),
        "totalMarks": result.get("totalMarks", 0),
        "score": result.get("scoredMarks", 0),
        "maxMarks": paper.get("totalMarks", 100),
        "percentage": result.get("percentage", 0),
        "passed": result.get("passed", False),
        "timeSpentSec": time_spent_sec,
        "questionReview": result.get("questionReview", []),
        "sectionWise": result.get("sectionWise", {}),
        "status": "submitted",
        "submittedAt": now,
        "tenantId": paper.get("tenantId", DEFAULT_TENANT_ID),
    }

    # Check existing attempt
    existing = db.series_attempts.find_one(
        {"seriesId": series_oid, "paperId": paper_oid, "userId": user_id}
    )
    if existing:
        db.series_attempts.update_one({"_id": existing["_id"]}, {"$set": attempt_doc})
        attempt_id = str(existing["_id"])
    else:
        inserted = db.series_attempts.insert_one(attempt_doc)
        attempt_id = str(inserted.inserted_id)

    return jsonify({
        "attemptId": attempt_id,
        "result": to_jsonable({
            "scoredMarks": result.get("scoredMarks", 0),
            "totalMarks": result.get("totalMarks", 0),
            "percentage": result.get("percentage", 0),
            "passed": result.get("passed", False),
            "sectionWise": result.get("sectionWise", {}),
        })
    })


# ────────────────────────────────────────────────────────────────
# Descriptive / Essay Submission
# ────────────────────────────────────────────────────────────────

@student_series_bp.route("/<series_id>/papers/<paper_id>/upload", methods=["POST"])
def upload_descriptive(series_id, paper_id):
    """Student: Upload a descriptive/essay submission file."""
    db = get_db()

    user_id = str(request.form.get("userId", "")).strip()
    if not user_id:
        return jsonify({"error": "userId required"}), 400

    try:
        series_oid = ObjectId(series_id)
        paper_oid = ObjectId(paper_id)
    except Exception:
        return jsonify({"error": "Invalid ID"}), 400

    paper = db.series_papers.find_one({"_id": paper_oid, "seriesId": series_oid})
    if not paper:
        return jsonify({"error": "Paper not found"}), 404

    paper_type = paper.get("paperType", "")
    if paper_type not in ("descriptive", "essay"):
        return jsonify({"error": "This paper does not accept file submissions"}), 400

    # Check if already submitted (cannot re-submit)
    existing = db.series_attempts.find_one(
        {"seriesId": series_oid, "paperId": paper_oid, "userId": user_id}
    )
    if existing and existing.get("status") in ("submitted", "evaluated", "published", "pending"):
        return jsonify({"error": "You have already submitted this paper. Contact admin to allow re-submission."}), 400

    upload = request.files.get("file")
    if not upload:
        return jsonify({"error": "No file uploaded"}), 400

    original_name = secure_filename(upload.filename or "submission")
    ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    if ext not in ALLOWED_SUBMISSION_EXTENSIONS:
        return jsonify({"error": f"Unsupported file type. Allowed: {', '.join(ALLOWED_SUBMISSION_EXTENSIONS)}"}), 400

    # Enforce file size limit from submission config
    sub_config = paper.get("submissionConfig", {})
    max_size_mb = int(sub_config.get("maxFileSizeMb", 10))
    upload.seek(0, 2)  # Seek to end
    file_size = upload.tell()
    upload.seek(0)
    if file_size > max_size_mb * 1024 * 1024:
        return jsonify({"error": f"File exceeds maximum allowed size of {max_size_mb} MB"}), 400

    # Check allowed formats from config
    allowed_formats = [f.lower() for f in sub_config.get("allowedFormats", list(ALLOWED_SUBMISSION_EXTENSIONS))]
    if ext not in allowed_formats:
        return jsonify({"error": f"This paper only accepts: {', '.join(allowed_formats)}"}), 400

    stored_name = f"{uuid.uuid4().hex}_{user_id}_{paper_id}.{ext}"
    path = SUBMISSIONS_DIR / stored_name
    upload.save(str(path))

    word_count = int(request.form.get("wordCount", 0)) or None
    page_count = int(request.form.get("pageCount", 0)) or None

    now = datetime.utcnow()
    series = db.test_series.find_one({"_id": series_oid})

    attempt_doc = {
        "seriesId": series_oid,
        "paperId": paper_oid,
        "seriesName": series.get("name", "") if series else "",
        "paperName": paper.get("paperName", ""),
        "paperType": paper_type,
        "userId": user_id,
        "filename": stored_name,
        "originalName": original_name,
        "fileSizeBytes": file_size,
        "wordCount": word_count,
        "pageCount": page_count,
        "status": "pending",  # Awaiting admin evaluation
        "submittedAt": now,
        "score": None,
        "maxMarks": paper.get("totalMarks", 100),
        "feedback": "",
        "tenantId": paper.get("tenantId", DEFAULT_TENANT_ID),
    }

    if existing:
        db.series_attempts.update_one({"_id": existing["_id"]}, {"$set": attempt_doc})
        attempt_id = str(existing["_id"])
    else:
        inserted = db.series_attempts.insert_one(attempt_doc)
        attempt_id = str(inserted.inserted_id)

    return jsonify({
        "attemptId": attempt_id,
        "message": "Submission received. Admin will evaluate and publish your result.",
        "submittedAt": now.isoformat() + "Z",
    }), 201


# ────────────────────────────────────────────────────────────────
# History & Results
# ────────────────────────────────────────────────────────────────

@student_series_bp.route("/history", methods=["GET"])
def student_series_history():
    """Student: All attempted series with aggregated scores."""
    db = get_db()
    user_id = request.args.get("userId", "").strip()
    if not user_id:
        return jsonify({"error": "userId required"}), 400

    attempts = list(db.series_attempts.find({"userId": user_id}).sort("submittedAt", -1))
    if not attempts:
        return jsonify({"history": []})

    # Group by seriesId
    series_ids = list(set(a.get("seriesId") for a in attempts if a.get("seriesId")))
    series_docs = {str(s["_id"]): s for s in db.test_series.find({"_id": {"$in": series_ids}})}
    papers_docs = {
        str(p["_id"]): p
        for p in db.series_papers.find({"seriesId": {"$in": series_ids}})
    }

    grouped = {}
    for attempt in attempts:
        sid = str(attempt.get("seriesId", ""))
        if sid not in grouped:
            grouped[sid] = []
        grouped[sid].append(attempt)

    history = []
    for sid, atts in grouped.items():
        s = series_docs.get(sid, {})
        total_scored = sum(
            (a.get("score") or a.get("scoredMarks") or 0)
            for a in atts if a.get("status") in ("submitted", "evaluated", "published")
        )
        total_max = sum(
            (a.get("maxMarks") or a.get("totalMarks") or 0)
            for a in atts
        )
        paper_items = []
        for a in atts:
            pid = str(a.get("paperId", ""))
            p = papers_docs.get(pid, {})
            paper_items.append({
                "attemptId": str(a["_id"]),
                "paperId": pid,
                "paperName": a.get("paperName") or p.get("paperName", ""),
                "paperType": a.get("paperType", "mcq"),
                "score": a.get("score") or a.get("scoredMarks"),
                "maxMarks": a.get("maxMarks") or a.get("totalMarks"),
                "percentage": a.get("percentage"),
                "status": a.get("status", ""),
                "feedback": a.get("feedback", ""),
                "submittedAt": a.get("submittedAt"),
                "publishedAt": a.get("publishedAt"),
            })

        history.append({
            "seriesId": sid,
            "seriesName": s.get("name", atts[0].get("seriesName", "")),
            "examType": s.get("examType", ""),
            "totalScored": total_scored,
            "totalMax": total_max,
            "percentage": round(total_scored / total_max * 100, 2) if total_max else None,
            "paperResults": paper_items,
            "lastAttemptAt": max((a.get("submittedAt") for a in atts if a.get("submittedAt")), default=None),
        })

    history.sort(key=lambda x: x["lastAttemptAt"] or datetime.min, reverse=True)
    return jsonify({"history": to_jsonable(history)})


@student_series_bp.route("/results/<attempt_id>", methods=["GET"])
def get_attempt_result(attempt_id):
    """Student: Get detailed result for a single paper attempt."""
    db = get_db()
    user_id = request.args.get("userId", "").strip()

    try:
        oid = ObjectId(attempt_id)
    except Exception:
        return jsonify({"error": "Invalid attempt ID"}), 400

    attempt = db.series_attempts.find_one({"_id": oid})
    if not attempt:
        return jsonify({"error": "Attempt not found"}), 404

    # Security: only the student or admin
    if user_id and attempt.get("userId") != user_id:
        return jsonify({"error": "Access denied"}), 403

    paper_type = attempt.get("paperType", "mcq")
    result = {
        "attemptId": str(attempt["_id"]),
        "seriesId": str(attempt.get("seriesId", "")),
        "paperId": str(attempt.get("paperId", "")),
        "seriesName": attempt.get("seriesName", ""),
        "paperName": attempt.get("paperName", ""),
        "paperType": paper_type,
        "status": attempt.get("status", ""),
        "submittedAt": attempt.get("submittedAt"),
        "score": attempt.get("score") or attempt.get("scoredMarks"),
        "maxMarks": attempt.get("maxMarks") or attempt.get("totalMarks"),
        "percentage": attempt.get("percentage"),
        "passed": attempt.get("passed"),
        "feedback": attempt.get("feedback", ""),
        "improvementSuggestions": attempt.get("improvementSuggestions", ""),
        "strengths": attempt.get("strengths", ""),
        "criteriaScores": attempt.get("criteriaScores", []),
        "annotatedFileUrl": attempt.get("annotatedFileUrl", ""),
        "evaluatedBy": attempt.get("evaluatedBy", ""),
        "evaluatedAt": attempt.get("evaluatedAt"),
        "publishedAt": attempt.get("publishedAt"),
    }

    # For MCQ: include question review
    if paper_type == "mcq":
        result["questionReview"] = attempt.get("questionReview", [])
        result["sectionWise"] = attempt.get("sectionWise", {})

    # For descriptive: result only shown if published
    if paper_type in ("descriptive", "essay"):
        if attempt.get("status") != "published":
            result["feedback"] = ""
            result["improvementSuggestions"] = ""
            result["strengths"] = ""
            result["criteriaScores"] = []
            result["score"] = None

    return jsonify({"result": to_jsonable(result)})
