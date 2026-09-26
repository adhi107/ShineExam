"""
backend/routes/test_series.py
──────────────────────────────
Admin-facing API routes for managing Test Series (UPSC, Groups, Daily Tests).
Handles series CRUD, paper management, descriptive submission evaluation,
assignment to students/courses, and results aggregation.
"""

from datetime import datetime
from pathlib import Path
import uuid

from bson import ObjectId
from flask import Blueprint, jsonify, request, send_file
from werkzeug.utils import secure_filename

from config.db import get_db
from utils.json import to_jsonable
from utils.validators import require_fields
from utils.tenant import get_request_tenant_id, build_tenant_filter, DEFAULT_TENANT_ID

test_series_bp = Blueprint("test_series", __name__)

SUBMISSIONS_DIR = Path(__file__).resolve().parents[1] / "uploads" / "series_submissions"
SUBMISSIONS_DIR.mkdir(parents=True, exist_ok=True)

UPLOAD_ATTACHMENTS_DIR = Path(__file__).resolve().parents[1] / "uploads" / "attachments"
UPLOAD_ATTACHMENTS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_SUBMISSION_EXTENSIONS = {"pdf", "doc", "docx", "jpg", "jpeg", "png"}


def _sanitize_documents(docs):
    """Strip out any giant base64 dataUrls before storing in MongoDB."""
    if not docs or not isinstance(docs, list):
        return []
    clean = []
    for d in docs:
        if not isinstance(d, dict):
            continue
        item = {
            "name": str(d.get("name", "document")),
            "size": int(d.get("size", 0)),
            "type": str(d.get("type", "application/octet-stream")),
            "url": str(d.get("url", "")).strip(),
        }
        raw_data = d.get("dataUrl")
        if not item["url"] and raw_data and len(raw_data) < 50000:
            item["dataUrl"] = raw_data
        clean.append(item)
    return clean


@test_series_bp.route("/upload-attachment", methods=["POST"])
def upload_paper_attachment():
    """Upload paper question document/handout and return static URL."""
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "No file uploaded"}), 400

    filename = secure_filename(file.filename)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    allowed = {"pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "txt", "epub", "json", "png", "jpg", "jpeg", "webp"}
    if ext and ext not in allowed:
        return jsonify({"error": f"File type .{ext} is not supported"}), 400

    unique_name = f"{uuid.uuid4().hex}_{filename}"
    save_path = UPLOAD_ATTACHMENTS_DIR / unique_name
    file.save(save_path)
    file_size = save_path.stat().st_size

    file_url = f"/uploads/attachments/{unique_name}"
    return jsonify({
        "attachment": {
            "name": filename,
            "url": file_url,
            "size": file_size,
            "type": file.mimetype or "application/octet-stream"
        }
    }), 201


EXAM_TYPES = [
    "upsc_prelims",
    "upsc_mains",
    "upsc_essay",
    "tspsc_group1",
    "tspsc_group2",
    "appsc_group1",
    "appsc_group2",
    "tnpsc",
    "ssc_cgl",
    "ssc_chsl",
    "banking_po",
    "banking_clerk",
    "daily_test",
    "mock_test",
    "other",
]


# ────────────────────────────────────────────────────────────────
# Serializers
# ────────────────────────────────────────────────────────────────

def _serialize_series(series, paper_count=0, attempt_stats=None):
    return {
        "id": str(series["_id"]),
        "name": series.get("name", ""),
        "description": series.get("description", ""),
        "examType": series.get("examType", "other"),
        "status": series.get("status", "draft"),
        "availableFrom": series.get("availableFrom"),
        "validUntil": series.get("validUntil"),
        "courseTypes": series.get("courseTypes", []),
        "totalMarks": series.get("totalMarks", 0),
        "passingPercentage": series.get("passingPercentage", 33),
        "paperCount": paper_count,
        "assignmentCount": series.get("assignmentCount", 0),
        "createdAt": series.get("createdAt"),
        "updatedAt": series.get("updatedAt"),
        "tenantId": series.get("tenantId", DEFAULT_TENANT_ID),
        "attemptStats": attempt_stats or {},
    }


def _serialize_paper(paper):
    return {
        "id": str(paper["_id"]),
        "seriesId": str(paper.get("seriesId", "")),
        "paperNumber": paper.get("paperNumber", 1),
        "paperName": paper.get("paperName", ""),
        "paperType": paper.get("paperType", "mcq"),  # mcq | descriptive | essay
        "duration": int(paper.get("duration", 60)),
        "totalMarks": int(paper.get("totalMarks", 100)),
        "passingMarks": int(paper.get("passingMarks", 33)),
        "questionCount": int(paper.get("questionCount", 0)),
        "negativeMarkingScheme": paper.get("negativeMarkingScheme", "none"),
        # Optional subject and exam classification
        "isOptional": bool(paper.get("isOptional", False)),
        "optionalSubject": paper.get("optionalSubject", ""),
        "subjectCategory": paper.get("subjectCategory", "General Studies"),
        "paperStage": paper.get("paperStage", "Mains"),
        "assignedUserIds": paper.get("assignedUserIds", []),
        # Descriptive/Essay config
        "submissionConfig": paper.get("submissionConfig", {
            "maxWordCount": None,
            "maxPageCount": None,
            "maxFileSizeMb": 10,
            "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"],
            "instructions": "",
        }),
        "questions": paper.get("questions", []),
        "questionDocuments": paper.get("questionDocuments", []),
        "questionFileUrl": paper.get("questionFileUrl", ""),
        "status": paper.get("status", "draft"),
        "createdAt": paper.get("createdAt"),
        "updatedAt": paper.get("updatedAt"),
    }


def _serialize_submission(sub, user=None):
    return {
        "id": str(sub["_id"]),
        "seriesId": str(sub.get("seriesId", "")),
        "paperId": str(sub.get("paperId", "")),
        "seriesName": sub.get("seriesName", ""),
        "paperName": sub.get("paperName", ""),
        "userId": sub.get("userId", ""),
        "userName": user.get("name", sub.get("userId", "")) if user else sub.get("userId", ""),
        "userEmail": user.get("email", "") if user else "",
        "submittedAt": sub.get("submittedAt"),
        "status": sub.get("status", "pending"),  # pending | evaluated | published
        "filename": sub.get("filename", ""),
        "originalName": sub.get("originalName", ""),
        "wordCount": sub.get("wordCount"),
        "pageCount": sub.get("pageCount"),
        # Evaluation fields
        "score": sub.get("score"),
        "maxMarks": sub.get("maxMarks"),
        "feedback": sub.get("feedback", ""),
        "evaluatedAt": sub.get("evaluatedAt"),
        "evaluatedBy": sub.get("evaluatedBy", ""),
        "publishedAt": sub.get("publishedAt"),
    }


# ────────────────────────────────────────────────────────────────
# Series CRUD
# ────────────────────────────────────────────────────────────────

@test_series_bp.route("", methods=["GET"])
@test_series_bp.route("/", methods=["GET"])
def list_series():
    """List all test series for admin with paper counts and attempt stats."""
    db = get_db()
    tenant_id = get_request_tenant_id()
    filter_q = build_tenant_filter(tenant_id)

    exam_type = request.args.get("examType", "")
    status = request.args.get("status", "")
    if exam_type:
        filter_q["examType"] = exam_type
    if status:
        filter_q["status"] = status

    series_list = list(db.test_series.find(filter_q).sort("createdAt", -1))
    result = []
    for s in series_list:
        paper_count = db.series_papers.count_documents({"seriesId": s["_id"]})
        result.append(_serialize_series(s, paper_count))
    return jsonify({"series": to_jsonable(result)})


@test_series_bp.route("", methods=["POST"])
@test_series_bp.route("/", methods=["POST"])
def create_series():
    """Create a new test series."""
    db = get_db()
    tenant_id = get_request_tenant_id()
    data = request.get_json(silent=True) or {}

    ok, msg = require_fields(data, ["name", "examType"])
    if not ok:
        return jsonify({"error": msg}), 400

    now = datetime.utcnow()
    doc = {
        "tenantId": tenant_id,
        "name": str(data["name"]).strip(),
        "description": str(data.get("description", "")).strip(),
        "examType": str(data["examType"]).strip(),
        "status": data.get("status", "draft"),
        "courseTypes": data.get("courseTypes", []),
        "totalMarks": int(data.get("totalMarks", 0)),
        "passingPercentage": int(data.get("passingPercentage", 33)),
        "availableFrom": _parse_date(data.get("availableFrom")),
        "validUntil": _parse_date(data.get("validUntil")),
        "assignmentCount": 0,
        "createdAt": now,
        "updatedAt": now,
    }
    result = db.test_series.insert_one(doc)
    doc["_id"] = result.inserted_id
    return jsonify({"series": to_jsonable(_serialize_series(doc))}), 201


@test_series_bp.route("/<series_id>", methods=["GET"])
def get_series(series_id):
    """Get a single test series with its papers."""
    db = get_db()
    try:
        oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid series ID"}), 400

    s = db.test_series.find_one({"_id": oid})
    if not s:
        return jsonify({"error": "Series not found"}), 404

    papers = list(db.series_papers.find({"seriesId": oid}).sort("paperNumber", 1))
    serialized = _serialize_series(s, len(papers))
    serialized["papers"] = to_jsonable([_serialize_paper(p) for p in papers])
    return jsonify({"series": to_jsonable(serialized)})


@test_series_bp.route("/<series_id>", methods=["PUT"])
def update_series(series_id):
    """Update test series metadata."""
    db = get_db()
    try:
        oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid series ID"}), 400

    data = request.get_json(silent=True) or {}
    now = datetime.utcnow()

    update_fields = {"updatedAt": now}
    for field in ["name", "description", "examType", "status", "courseTypes",
                  "totalMarks", "passingPercentage"]:
        if field in data:
            update_fields[field] = data[field]
    for date_field in ["availableFrom", "validUntil"]:
        if date_field in data:
            update_fields[date_field] = _parse_date(data[date_field])

    db.test_series.update_one({"_id": oid}, {"$set": update_fields})
    s = db.test_series.find_one({"_id": oid})
    paper_count = db.series_papers.count_documents({"seriesId": oid})
    return jsonify({"series": to_jsonable(_serialize_series(s, paper_count))})


@test_series_bp.route("/<series_id>", methods=["DELETE"])
def delete_series(series_id):
    """Delete a test series and all its papers, assignments."""
    db = get_db()
    try:
        oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid series ID"}), 400

    db.test_series.delete_one({"_id": oid})
    paper_ids = [p["_id"] for p in db.series_papers.find({"seriesId": oid}, {"_id": 1})]
    db.series_papers.delete_many({"seriesId": oid})
    if paper_ids:
        db.series_attempts.delete_many({"paperId": {"$in": paper_ids}})
        db.series_evaluations.delete_many({"paperId": {"$in": paper_ids}})
    db.series_assignments.delete_many({"seriesId": oid})
    return jsonify({"message": "Series deleted"})


# ────────────────────────────────────────────────────────────────
# Paper Management
# ────────────────────────────────────────────────────────────────

@test_series_bp.route("/<series_id>/papers", methods=["GET"])
def list_papers(series_id):
    """List all papers in a series."""
    db = get_db()
    try:
        oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid series ID"}), 400

    papers = list(db.series_papers.find({"seriesId": oid}).sort("paperNumber", 1))
    return jsonify({"papers": to_jsonable([_serialize_paper(p) for p in papers])})


@test_series_bp.route("/<series_id>/papers", methods=["POST"])
def add_paper(series_id):
    """Add a new paper to a series."""
    db = get_db()
    try:
        oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid series ID"}), 400

    data = request.get_json(silent=True) or {}
    ok, msg = require_fields(data, ["paperName", "paperType"])
    if not ok:
        return jsonify({"error": msg}), 400

    # Auto-number if not provided
    max_number = db.series_papers.find_one(
        {"seriesId": oid},
        sort=[("paperNumber", -1)]
    )
    next_number = (max_number.get("paperNumber", 0) + 1) if max_number else 1

    now = datetime.utcnow()
    paper_type = str(data["paperType"]).strip()  # mcq | descriptive | essay

    submission_config = data.get("submissionConfig", {})
    if paper_type in ("descriptive", "essay"):
        submission_config = {
            "maxWordCount": submission_config.get("maxWordCount") or None,
            "maxPageCount": submission_config.get("maxPageCount") or None,
            "maxFileSizeMb": int(submission_config.get("maxFileSizeMb", 10)),
            "allowedFormats": submission_config.get("allowedFormats", ["pdf", "jpg", "jpeg", "png", "docx"]),
            "instructions": submission_config.get("instructions", ""),
        }
    else:
        submission_config = {}

    questions = data.get("questions", [])

    doc = {
        "seriesId": oid,
        "paperNumber": int(data.get("paperNumber", next_number)),
        "paperName": str(data["paperName"]).strip(),
        "paperType": paper_type,
        "duration": int(data.get("duration", 60)),
        "totalMarks": int(data.get("totalMarks", 100)),
        "passingMarks": int(data.get("passingMarks", 33)),
        "negativeMarkingScheme": data.get("negativeMarkingScheme", "none"),
        # Optional subject & exam classification
        "isOptional": bool(data.get("isOptional", False)),
        "optionalSubject": str(data.get("optionalSubject", "")).strip(),
        "subjectCategory": str(data.get("subjectCategory", "General Studies")).strip(),
        "paperStage": str(data.get("paperStage", "Mains")).strip(),
        "assignedUserIds": list(data.get("assignedUserIds", [])),
        "submissionConfig": submission_config,
        "questions": questions,
        "questionDocuments": _sanitize_documents(data.get("questionDocuments", [])),
        "questionFileUrl": str(data.get("questionFileUrl", "")).strip(),
        "questionCount": len(questions),
        "status": data.get("status", "draft"),
        "createdAt": now,
        "updatedAt": now,
    }
    result = db.series_papers.insert_one(doc)
    doc["_id"] = result.inserted_id

    # Recalculate total marks on series
    _recalculate_series_marks(db, oid)
    return jsonify({"paper": to_jsonable(_serialize_paper(doc))}), 201


@test_series_bp.route("/<series_id>/papers/<paper_id>", methods=["GET"])
def get_paper(series_id, paper_id):
    """Get paper details including questions."""
    db = get_db()
    try:
        paper_oid = ObjectId(paper_id)
        series_oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid ID"}), 400

    paper = db.series_papers.find_one({"_id": paper_oid, "seriesId": series_oid})
    if not paper:
        return jsonify({"error": "Paper not found"}), 404
    return jsonify({"paper": to_jsonable(_serialize_paper(paper))})


@test_series_bp.route("/<series_id>/papers/<paper_id>", methods=["PUT"])
def update_paper(series_id, paper_id):
    """Update a paper."""
    db = get_db()
    try:
        paper_oid = ObjectId(paper_id)
        series_oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid ID"}), 400

    data = request.get_json(silent=True) or {}
    now = datetime.utcnow()
    update_fields = {"updatedAt": now}

    for field in ["paperName", "paperNumber", "duration", "totalMarks",
                  "passingMarks", "negativeMarkingScheme", "submissionConfig",
                  "isOptional", "optionalSubject", "subjectCategory", "paperStage", "assignedUserIds", "status",
                  "questionFileUrl"]:
        if field in data:
            update_fields[field] = data[field]

    if "questionDocuments" in data:
        update_fields["questionDocuments"] = _sanitize_documents(data["questionDocuments"])

    if "questions" in data:
        update_fields["questions"] = data["questions"]
        update_fields["questionCount"] = len(data["questions"])

    db.series_papers.update_one({"_id": paper_oid, "seriesId": series_oid}, {"$set": update_fields})
    paper = db.series_papers.find_one({"_id": paper_oid})
    _recalculate_series_marks(db, series_oid)
    return jsonify({"paper": to_jsonable(_serialize_paper(paper))})


@test_series_bp.route("/<series_id>/papers/<paper_id>", methods=["DELETE"])
def delete_paper(series_id, paper_id):
    """Delete a paper and its attempts."""
    db = get_db()
    try:
        paper_oid = ObjectId(paper_id)
        series_oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid ID"}), 400

    db.series_papers.delete_one({"_id": paper_oid, "seriesId": series_oid})
    db.series_attempts.delete_many({"paperId": paper_oid})
    db.series_evaluations.delete_many({"paperId": paper_oid})
    _recalculate_series_marks(db, series_oid)
    return jsonify({"message": "Paper deleted"})


@test_series_bp.route("/<series_id>/generate-preset", methods=["POST"])
def generate_preset(series_id):
    """Admin: Generate standard multi-paper syllabus presets (UPSC Mains, TSPSC Group-1, APPSC Group-1, etc.)."""
    db = get_db()
    try:
        oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid series ID"}), 400

    data = request.get_json(silent=True) or {}
    preset_type = data.get("presetType", "upsc_mains")
    now = datetime.utcnow()

    presets = {
        "upsc_mains": [
            {"paperNumber": 1, "paperName": "Essay Paper", "paperType": "essay", "duration": 180, "totalMarks": 250, "passingMarks": 75, "isOptional": False, "optionalSubject": "", "subjectCategory": "Essay", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 1200, "maxPageCount": 12, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Write two essays choosing one topic from each Section A & Section B."}},
            {"paperNumber": 2, "paperName": "General Studies - I (Indian Heritage, Culture, History & Geography)", "paperType": "descriptive", "duration": 180, "totalMarks": 250, "passingMarks": 75, "isOptional": False, "optionalSubject": "", "subjectCategory": "General Studies", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 2000, "maxPageCount": 20, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Answer all 20 questions in the designated word limit."}},
            {"paperNumber": 3, "paperName": "General Studies - II (Governance, Constitution, Polity, Social Justice & IR)", "paperType": "descriptive", "duration": 180, "totalMarks": 250, "passingMarks": 75, "isOptional": False, "optionalSubject": "", "subjectCategory": "General Studies", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 2000, "maxPageCount": 20, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Answer all 20 questions in the designated word limit."}},
            {"paperNumber": 4, "paperName": "General Studies - III (Technology, Economic Development, Bio-diversity & Security)", "paperType": "descriptive", "duration": 180, "totalMarks": 250, "passingMarks": 75, "isOptional": False, "optionalSubject": "", "subjectCategory": "General Studies", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 2000, "maxPageCount": 20, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Answer all 20 questions in the designated word limit."}},
            {"paperNumber": 5, "paperName": "General Studies - IV (Ethics, Integrity and Aptitude)", "paperType": "descriptive", "duration": 180, "totalMarks": 250, "passingMarks": 75, "isOptional": False, "optionalSubject": "", "subjectCategory": "General Studies", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 2000, "maxPageCount": 20, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Section A theoretical questions and Section B case studies."}},
            {"paperNumber": 6, "paperName": "Public Administration — Paper I", "paperType": "descriptive", "duration": 180, "totalMarks": 250, "passingMarks": 75, "isOptional": True, "optionalSubject": "Public Administration", "subjectCategory": "Optional Subject", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 2000, "maxPageCount": 20, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Administrative Theory and concepts."}},
            {"paperNumber": 7, "paperName": "Public Administration — Paper II", "paperType": "descriptive", "duration": 180, "totalMarks": 250, "passingMarks": 75, "isOptional": True, "optionalSubject": "Public Administration", "subjectCategory": "Optional Subject", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 2000, "maxPageCount": 20, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Indian Administration and current issues."}},
            {"paperNumber": 8, "paperName": "Geography — Paper I", "paperType": "descriptive", "duration": 180, "totalMarks": 250, "passingMarks": 75, "isOptional": True, "optionalSubject": "Geography", "subjectCategory": "Optional Subject", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 2000, "maxPageCount": 20, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Physical and Human Geography."}},
            {"paperNumber": 9, "paperName": "Geography — Paper II", "paperType": "descriptive", "duration": 180, "totalMarks": 250, "passingMarks": 75, "isOptional": True, "optionalSubject": "Geography", "subjectCategory": "Optional Subject", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 2000, "maxPageCount": 20, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Geography of India."}},
            {"paperNumber": 10, "paperName": "Political Science & IR — Paper I", "paperType": "descriptive", "duration": 180, "totalMarks": 250, "passingMarks": 75, "isOptional": True, "optionalSubject": "Political Science & IR", "subjectCategory": "Optional Subject", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 2000, "maxPageCount": 20, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Political Theory and Indian Politics."}},
            {"paperNumber": 11, "paperName": "Political Science & IR — Paper II", "paperType": "descriptive", "duration": 180, "totalMarks": 250, "passingMarks": 75, "isOptional": True, "optionalSubject": "Political Science & IR", "subjectCategory": "Optional Subject", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 2000, "maxPageCount": 20, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Comparative Politics and International Relations."}},
            {"paperNumber": 12, "paperName": "Sociology — Paper I", "paperType": "descriptive", "duration": 180, "totalMarks": 250, "passingMarks": 75, "isOptional": True, "optionalSubject": "Sociology", "subjectCategory": "Optional Subject", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 2000, "maxPageCount": 20, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Fundamentals of Sociology."}},
            {"paperNumber": 13, "paperName": "Sociology — Paper II", "paperType": "descriptive", "duration": 180, "totalMarks": 250, "passingMarks": 75, "isOptional": True, "optionalSubject": "Sociology", "subjectCategory": "Optional Subject", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 2000, "maxPageCount": 20, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Indian Society: Structure and Change."}},
        ],
        "tspsc_group1": [
            {"paperNumber": 1, "paperName": "General Essay", "paperType": "essay", "duration": 180, "totalMarks": 150, "passingMarks": 50, "isOptional": False, "optionalSubject": "", "subjectCategory": "Essay", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 1000, "maxPageCount": 10, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Write three essays from the specified sections."}},
            {"paperNumber": 2, "paperName": "History, Culture and Geography", "paperType": "descriptive", "duration": 180, "totalMarks": 150, "passingMarks": 50, "isOptional": False, "optionalSubject": "", "subjectCategory": "General Studies", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 1800, "maxPageCount": 15, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "History and Culture of India and Telangana, Geography."}},
            {"paperNumber": 3, "paperName": "Indian Society, Constitution and Governance", "paperType": "descriptive", "duration": 180, "totalMarks": 150, "passingMarks": 50, "isOptional": False, "optionalSubject": "", "subjectCategory": "General Studies", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 1800, "maxPageCount": 15, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Indian Society, Constitution and Governance."}},
            {"paperNumber": 4, "paperName": "Economy and Development", "paperType": "descriptive", "duration": 180, "totalMarks": 150, "passingMarks": 50, "isOptional": False, "optionalSubject": "", "subjectCategory": "General Studies", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 1800, "maxPageCount": 15, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Indian Economy and Telangana Economy."}},
            {"paperNumber": 5, "paperName": "Science & Technology and Data Interpretation", "paperType": "descriptive", "duration": 180, "totalMarks": 150, "passingMarks": 50, "isOptional": False, "optionalSubject": "", "subjectCategory": "General Studies", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 1800, "maxPageCount": 15, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Role of S&T, Space, Defence and Data Interpretation."}},
            {"paperNumber": 6, "paperName": "Telangana Movement and State Formation", "paperType": "descriptive", "duration": 180, "totalMarks": 150, "passingMarks": 50, "isOptional": False, "optionalSubject": "", "subjectCategory": "General Studies", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 1800, "maxPageCount": 15, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Idea of Telangana, Mobilisational Phase and Statehood."}},
        ],
        "appsc_group1": [
            {"paperNumber": 1, "paperName": "General Essay", "paperType": "essay", "duration": 180, "totalMarks": 150, "passingMarks": 50, "isOptional": False, "optionalSubject": "", "subjectCategory": "Essay", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 1000, "maxPageCount": 10, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Write three essays on contemporary themes."}},
            {"paperNumber": 2, "paperName": "History and Cultural Heritage of India and AP", "paperType": "descriptive", "duration": 180, "totalMarks": 150, "passingMarks": 50, "isOptional": False, "optionalSubject": "", "subjectCategory": "General Studies", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 1800, "maxPageCount": 15, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "History of India and Andhra Pradesh."}},
            {"paperNumber": 3, "paperName": "Indian Polity, Constitution, Governance, Law and Ethics", "paperType": "descriptive", "duration": 180, "totalMarks": 150, "passingMarks": 50, "isOptional": False, "optionalSubject": "", "subjectCategory": "General Studies", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 1800, "maxPageCount": 15, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Polity, Constitution, Public Administration and Ethics."}},
            {"paperNumber": 4, "paperName": "Economy and Development of India and Andhra Pradesh", "paperType": "descriptive", "duration": 180, "totalMarks": 150, "passingMarks": 50, "isOptional": False, "optionalSubject": "", "subjectCategory": "General Studies", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 1800, "maxPageCount": 15, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "National and AP State Economy & Agriculture."}},
            {"paperNumber": 5, "paperName": "Science & Technology", "paperType": "descriptive", "duration": 180, "totalMarks": 150, "passingMarks": 50, "isOptional": False, "optionalSubject": "", "subjectCategory": "General Studies", "paperStage": "Mains", "submissionConfig": {"maxWordCount": 1800, "maxPageCount": 15, "maxFileSizeMb": 20, "allowedFormats": ["pdf", "jpg", "jpeg", "png", "docx"], "instructions": "Scientific developments, Energy, Environment and IT."}},
        ]
    }

    paper_defs = presets.get(preset_type, presets["upsc_mains"])
    created_papers = []
    for pdef in paper_defs:
        doc = {
            "seriesId": oid,
            "paperNumber": pdef["paperNumber"],
            "paperName": pdef["paperName"],
            "paperType": pdef["paperType"],
            "duration": pdef["duration"],
            "totalMarks": pdef["totalMarks"],
            "passingMarks": pdef["passingMarks"],
            "negativeMarkingScheme": "none",
            "isOptional": pdef.get("isOptional", False),
            "optionalSubject": pdef.get("optionalSubject", ""),
            "subjectCategory": pdef.get("subjectCategory", "General Studies"),
            "paperStage": pdef.get("paperStage", "Mains"),
            "assignedUserIds": [],
            "submissionConfig": pdef.get("submissionConfig", {}),
            "questions": [],
            "questionCount": 0,
            "status": "active",
            "createdAt": now,
            "updatedAt": now,
        }
        res = db.series_papers.insert_one(doc)
        doc["_id"] = res.inserted_id
        created_papers.append(_serialize_paper(doc))

    _recalculate_series_marks(db, oid)
    return jsonify({"generated": len(created_papers), "papers": to_jsonable(created_papers)})


@test_series_bp.route("/<series_id>/papers/<paper_id>/assign", methods=["POST"])
def assign_paper_students(series_id, paper_id):
    """Assign specific students to a specific paper."""
    db = get_db()
    try:
        p_oid = ObjectId(paper_id)
        s_oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid ID"}), 400

    data = request.get_json(silent=True) or {}
    user_ids = data.get("userIds", [])
    db.series_papers.update_one({"_id": p_oid, "seriesId": s_oid}, {"$set": {"assignedUserIds": user_ids, "updatedAt": datetime.utcnow()}})
    return jsonify({"success": True, "assignedCount": len(user_ids)})


@test_series_bp.route("/<series_id>/papers/<paper_id>/assigned-students", methods=["GET"])
def get_paper_assigned_students(series_id, paper_id):
    """Get students assigned to a specific paper."""
    db = get_db()
    try:
        p_oid = ObjectId(paper_id)
        s_oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid ID"}), 400

    paper = db.series_papers.find_one({"_id": p_oid, "seriesId": s_oid})
    if not paper:
        return jsonify({"error": "Paper not found"}), 404

    assigned_uids = paper.get("assignedUserIds", [])
    users = {
        u["userId"]: u
        for u in db.users.find({"userId": {"$in": assigned_uids}})
    }
    result = [
        {
            "userId": uid,
            "name": users.get(uid, {}).get("name", uid),
            "email": users.get(uid, {}).get("email", ""),
            "courseStream": users.get(uid, {}).get("courseStream", "")
        }
        for uid in assigned_uids
    ]
    return jsonify({"students": to_jsonable(result)})


# ────────────────────────────────────────────────────────────────
# Assignment
# ────────────────────────────────────────────────────────────────

@test_series_bp.route("/<series_id>/assign", methods=["POST"])
def assign_series(series_id):
    """Assign a series to specific students or course-enrolled students."""
    db = get_db()
    try:
        oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid series ID"}), 400

    data = request.get_json(silent=True) or {}
    user_ids = data.get("userIds", [])      # explicit student user IDs
    course_ids = data.get("courseIds", [])   # assign all enrolled students
    batches = data.get("batches", [])        # batch names

    now = datetime.utcnow()
    assigned_count = 0
    already_assigned = set(
        a["userId"] for a in db.series_assignments.find({"seriesId": oid}, {"userId": 1})
    )

    new_ids = set()

    # Explicit user IDs
    for uid in user_ids:
        new_ids.add(str(uid).strip())

    # Course-enrolled students
    for cid in course_ids:
        try:
            coid = ObjectId(cid)
        except Exception:
            continue
        enrolled = db.course_assignments.distinct("userId", {"courseId": coid})
        new_ids.update(str(u) for u in enrolled)

    # Batch-based
    if batches:
        clean_batches = [str(b).strip() for b in batches if str(b).strip()]
        batch_users = list(db.users.find(
            {"role": "answerer", "$or": [
                {"batch": {"$in": clean_batches}},
                {"batches": {"$in": clean_batches}},
                {"courseStream": {"$in": clean_batches}}
            ]},
            {"userId": 1, "naxUnid": 1}
        ))
        for bu in batch_users:
            if bu.get("userId"):
                new_ids.add(str(bu["userId"]).strip())
            if bu.get("naxUnid"):
                new_ids.add(str(bu["naxUnid"]).strip())

    to_insert = [uid for uid in new_ids if uid not in already_assigned]
    if to_insert:
        db.series_assignments.insert_many([
            {"seriesId": oid, "userId": uid, "assignedAt": now}
            for uid in to_insert
        ])
        assigned_count = len(to_insert)
        db.test_series.update_one(
            {"_id": oid},
            {
                "$inc": {"assignmentCount": assigned_count},
                "$addToSet": {"assignedStudentIds": {"$each": list(new_ids)}}
            }
        )

    return jsonify({"assigned": assigned_count, "alreadyAssigned": len(already_assigned)})


@test_series_bp.route("/<series_id>/assign", methods=["DELETE"])
def unassign_series(series_id):
    """Remove specific user assignments from a series."""
    db = get_db()
    try:
        oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid series ID"}), 400

    data = request.get_json(silent=True) or {}
    user_ids = data.get("userIds", [])
    if not user_ids:
        return jsonify({"error": "userIds required"}), 400

    result = db.series_assignments.delete_many(
        {"seriesId": oid, "userId": {"$in": user_ids}}
    )
    db.test_series.update_one(
        {"_id": oid},
        {"$inc": {"assignmentCount": -result.deleted_count}}
    )
    return jsonify({"removed": result.deleted_count})


@test_series_bp.route("/<series_id>/assigned-students", methods=["GET"])
def get_assigned_students(series_id):
    """List students assigned to a series."""
    db = get_db()
    try:
        oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid series ID"}), 400

    assignments = list(db.series_assignments.find({"seriesId": oid}))
    user_ids = [a["userId"] for a in assignments]
    users = {
        u["userId"]: u
        for u in db.users.find({"userId": {"$in": user_ids}})
    }
    result = []
    for a in assignments:
        u = users.get(a["userId"], {})
        result.append({
            "userId": a["userId"],
            "name": u.get("name", a["userId"]),
            "email": u.get("email", ""),
            "courseStream": u.get("courseStream", ""),
            "assignedAt": a.get("assignedAt"),
        })
    return jsonify({"students": to_jsonable(result)})


# ────────────────────────────────────────────────────────────────
# Submissions / Evaluation Queue
# ────────────────────────────────────────────────────────────────

@test_series_bp.route("/submissions", methods=["GET"])
def list_submissions():
    """Admin: List all descriptive/essay submissions for evaluation."""
    db = get_db()
    tenant_id = get_request_tenant_id()
    tenant_filter = build_tenant_filter(tenant_id)

    status_filter = request.args.get("status", "")
    series_id = request.args.get("seriesId", "")
    paper_id = request.args.get("paperId", "")

    q = {**tenant_filter}
    if status_filter:
        q["status"] = status_filter
    if series_id:
        try:
            q["seriesId"] = ObjectId(series_id)
        except Exception:
            pass
    if paper_id:
        try:
            q["paperId"] = ObjectId(paper_id)
        except Exception:
            pass

    subs = list(db.series_attempts.find(
        {**q, "paperType": {"$in": ["descriptive", "essay"]}}
    ).sort("submittedAt", -1))

    user_ids = list(set(s.get("userId", "") for s in subs))
    users = {u["userId"]: u for u in db.users.find({"userId": {"$in": user_ids}})}

    result = [_serialize_submission(s, users.get(s.get("userId", ""))) for s in subs]
    return jsonify({"submissions": to_jsonable(result)})


@test_series_bp.route("/submissions/<attempt_id>/download", methods=["GET"])
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
    return send_file(str(file_path), download_name=original_name, as_attachment=True)


@test_series_bp.route("/submissions/<attempt_id>/evaluate", methods=["POST"])
def evaluate_submission(attempt_id):
    """Admin: Score a descriptive submission and optionally publish the result."""
    db = get_db()
    try:
        oid = ObjectId(attempt_id)
    except Exception:
        return jsonify({"error": "Invalid attempt ID"}), 400

    attempt = db.series_attempts.find_one({"_id": oid})
    if not attempt:
        return jsonify({"error": "Submission not found"}), 404

    data = request.get_json(silent=True) or {}
    ok, msg = require_fields(data, ["score", "maxMarks"])
    if not ok:
        return jsonify({"error": msg}), 400

    score = float(data["score"])
    max_marks = float(data["maxMarks"])
    feedback = str(data.get("feedback", "")).strip()
    improvement_suggestions = str(data.get("improvementSuggestions", "")).strip()
    strengths = str(data.get("strengths", "")).strip()
    criteria_scores = data.get("criteriaScores") or []
    annotated_file_url = str(data.get("annotatedFileUrl", "")).strip()
    publish = bool(data.get("publish", False))
    evaluated_by = str(data.get("evaluatedBy", "admin")).strip()

    now = datetime.utcnow()
    pct = round((score / max_marks) * 100, 2) if max_marks > 0 else 0.0
    update = {
        "score": score,
        "scoredMarks": score,
        "maxMarks": max_marks,
        "percentage": pct,
        "feedback": feedback,
        "improvementSuggestions": improvement_suggestions,
        "strengths": strengths,
        "criteriaScores": criteria_scores,
        "annotatedFileUrl": annotated_file_url,
        "evaluatedBy": evaluated_by,
        "evaluatedAt": now,
        "status": "published" if publish else "evaluated",
    }
    if publish:
        update["publishedAt"] = now

    db.series_attempts.update_one({"_id": oid}, {"$set": update})

    # Upsert into evaluations collection for quick querying
    db.series_evaluations.update_one(
        {"attemptId": oid},
        {"$set": {
            "attemptId": oid,
            "seriesId": attempt.get("seriesId"),
            "paperId": attempt.get("paperId"),
            "userId": attempt.get("userId"),
            "score": score,
            "maxMarks": max_marks,
            "percentage": pct,
            "feedback": feedback,
            "improvementSuggestions": improvement_suggestions,
            "strengths": strengths,
            "criteriaScores": criteria_scores,
            "annotatedFileUrl": annotated_file_url,
            "evaluatedBy": evaluated_by,
            "evaluatedAt": now,
            "published": publish,
            "publishedAt": now if publish else None,
            "tenantId": attempt.get("tenantId", DEFAULT_TENANT_ID),
        }},
        upsert=True
    )

    updated = db.series_attempts.find_one({"_id": oid})
    return jsonify({"submission": to_jsonable(_serialize_submission(updated))})


@test_series_bp.route("/submissions/<attempt_id>/publish", methods=["POST"])
def publish_result(attempt_id):
    """Admin: Publish an already-evaluated result to make it visible to the student."""
    db = get_db()
    try:
        oid = ObjectId(attempt_id)
    except Exception:
        return jsonify({"error": "Invalid attempt ID"}), 400

    now = datetime.utcnow()
    db.series_attempts.update_one(
        {"_id": oid},
        {"$set": {"status": "published", "publishedAt": now}}
    )
    db.series_evaluations.update_one(
        {"attemptId": oid},
        {"$set": {"published": True, "publishedAt": now}}
    )
    return jsonify({"message": "Result published"})


# ────────────────────────────────────────────────────────────────
# Results Overview (Admin)
# ────────────────────────────────────────────────────────────────

@test_series_bp.route("/results", methods=["GET"])
def series_results_overview():
    """Admin: Aggregate results for a series — leaderboard + per-student per-paper scores."""
    db = get_db()
    series_id = request.args.get("seriesId", "")
    if not series_id:
        return jsonify({"error": "seriesId required"}), 400

    try:
        series_oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid series ID"}), 400

    series = db.test_series.find_one({"_id": series_oid})
    if not series:
        return jsonify({"error": "Series not found"}), 404

    papers = list(db.series_papers.find({"seriesId": series_oid}).sort("paperNumber", 1))
    paper_map = {str(p["_id"]): p for p in papers}

    # All attempts for this series
    attempts = list(db.series_attempts.find({"seriesId": series_oid}))

    # Build student scorecard: userId -> {paperId -> score}
    student_scores = {}
    for attempt in attempts:
        uid = attempt.get("userId", "")
        pid = str(attempt.get("paperId", ""))
        score = attempt.get("score") or attempt.get("scoredMarks")
        max_m = attempt.get("maxMarks") or attempt.get("totalMarks")
        if uid not in student_scores:
            student_scores[uid] = {}
        student_scores[uid][pid] = {
            "score": score,
            "maxMarks": max_m,
            "status": attempt.get("status", "pending"),
            "paperName": paper_map.get(pid, {}).get("paperName", ""),
            "paperType": attempt.get("paperType", ""),
        }

    # Fetch user profiles
    user_ids = list(student_scores.keys())
    users = {u["userId"]: u for u in db.users.find({"userId": {"$in": user_ids}})}

    leaderboard = []
    for uid, paper_scores in student_scores.items():
        total_scored = sum(
            v["score"] for v in paper_scores.values() if v.get("score") is not None
        )
        total_max = sum(
            v["maxMarks"] for v in paper_scores.values() if v.get("maxMarks") is not None
        )
        u = users.get(uid, {})
        leaderboard.append({
            "userId": uid,
            "name": u.get("name", uid),
            "email": u.get("email", ""),
            "totalScored": total_scored,
            "totalMax": total_max,
            "percentage": round(total_scored / total_max * 100, 2) if total_max else 0,
            "paperScores": paper_scores,
        })

    leaderboard.sort(key=lambda x: x["totalScored"], reverse=True)
    for i, row in enumerate(leaderboard):
        row["rank"] = i + 1

    return jsonify({
        "series": to_jsonable(_serialize_series(series, len(papers))),
        "papers": to_jsonable([_serialize_paper(p) for p in papers]),
        "leaderboard": to_jsonable(leaderboard),
    })


# ────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────

def _parse_date(value):
    if not value:
        return None
    try:
        raw = str(value).strip().replace("Z", "+00:00")
        parsed = datetime.fromisoformat(raw)
        return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
    except (TypeError, ValueError):
        return None


def _recalculate_series_marks(db, series_oid):
    """Recompute the totalMarks on a series from its papers."""
    papers = list(db.series_papers.find({"seriesId": series_oid}, {"totalMarks": 1}))
    total = sum(int(p.get("totalMarks", 0)) for p in papers)
    db.test_series.update_one(
        {"_id": series_oid},
        {"$set": {"totalMarks": total, "updatedAt": datetime.utcnow()}}
    )
