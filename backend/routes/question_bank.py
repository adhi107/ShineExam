"""
backend/routes/question_bank.py
────────────────────────────────
Enterprise Question Bank Engine.
Supports 12+ question types, full review lifecycle, multilingual questions,
PYQ/Current Affairs tagging, hierarchical topic mapping, and bulk import.
"""

from datetime import datetime
import hashlib
from bson import ObjectId
from flask import Blueprint, jsonify, request

from config.db import get_db
from utils.json import to_jsonable
from utils.tenant import get_request_tenant_id, DEFAULT_TENANT_ID
from utils.validators import require_fields
from utils.audit import log_audit_event

question_bank_bp = Blueprint("question_bank", __name__)


def _compute_question_hash(question_text: str, options: list) -> str:
    """Compute content hash for duplicate detection."""
    content = question_text.strip().lower() + "".join([str(o).strip().lower() for o in options])
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _serialize_question(doc):
    if not doc:
        return None
    doc["id"] = str(doc.get("_id", ""))
    return doc


@question_bank_bp.route("", methods=["GET"])
@question_bank_bp.route("/", methods=["GET"])
def list_questions():
    """List questions with advanced filters (subject, topic, stage, questionType, status, isPYQ, etc.)."""
    db = get_db()
    tenant_id = get_request_tenant_id()
    query = {}
    if tenant_id and tenant_id != "all":
        query["$or"] = [
            {"tenantId": tenant_id},
            {"tenantId": {"$exists": False}},
            {"tenantId": None},
        ]

    # Filters
    subject = request.args.get("subject")
    topic = request.args.get("topic")
    exam_type = request.args.get("examType")
    stage = request.args.get("stage")
    question_type = request.args.get("questionType")
    status = request.args.get("status")
    difficulty = request.args.get("difficulty")
    is_pyq = request.args.get("isPYQ")
    is_current_affairs = request.args.get("isCurrentAffairs")
    search = request.args.get("search", "").strip()

    if subject:
        query["subject"] = subject
    if topic:
        query["topic"] = topic
    if exam_type:
        query["examType"] = exam_type
    if stage:
        query["stage"] = stage
    if question_type:
        query["questionType"] = question_type
    if status:
        query["status"] = status
    if difficulty:
        query["difficulty"] = difficulty
    if is_pyq is not None:
        query["isPYQ"] = is_pyq.lower() in ("true", "1")
    if is_current_affairs is not None:
        query["isCurrentAffairs"] = is_current_affairs.lower() in ("true", "1")
    if search:
        query["$or"] = [
            {"questionText": {"$regex": search, "$options": "i"}},
            {"translations.telugu.questionText": {"$regex": search, "$options": "i"}},
            {"translations.hindi.questionText": {"$regex": search, "$options": "i"}},
            {"tags": {"$regex": search, "$options": "i"}},
        ]

    page = max(1, int(request.args.get("page", 1)))
    limit = min(200, max(1, int(request.args.get("limit", 50))))
    skip = (page - 1) * limit

    total = db.question_bank.count_documents(query)
    questions = list(db.question_bank.find(query).sort("createdAt", -1).skip(skip).limit(limit))

    return jsonify({
        "total": total,
        "page": page,
        "limit": limit,
        "questions": to_jsonable([_serialize_question(q) for q in questions])
    })


@question_bank_bp.route("/<question_id>", methods=["GET"])
def get_question(question_id):
    """Get single question detail."""
    db = get_db()
    try:
        oid = ObjectId(question_id)
    except Exception:
        return jsonify({"error": "Invalid question ID"}), 400

    q = db.question_bank.find_one({"_id": oid})
    if not q:
        return jsonify({"error": "Question not found"}), 404

    return jsonify({"question": to_jsonable(_serialize_question(q))})


@question_bank_bp.route("", methods=["POST"])
@question_bank_bp.route("/", methods=["POST"])
def create_question():
    """Admin/Faculty: Add a new question to the Question Bank."""
    db = get_db()
    data = request.get_json(silent=True) or {}

    ok, msg = require_fields(data, ["questionText", "subject", "questionType"])
    if not ok:
        return jsonify({"error": msg}), 400

    tenant_id = get_request_tenant_id() or DEFAULT_TENANT_ID
    now = datetime.utcnow().isoformat()

    q_text = str(data["questionText"]).strip()
    options = data.get("options", [])
    q_hash = _compute_question_hash(q_text, options)

    # Check duplicate
    existing = db.question_bank.find_one({"tenantId": tenant_id, "contentHash": q_hash})
    if existing:
        return jsonify({
            "error": "Duplicate question detected in question bank.",
            "existingId": str(existing["_id"])
        }), 409

    doc = {
        "tenantId": tenant_id,
        "questionText": q_text,
        "questionType": str(data["questionType"]).strip(),  # single_mcq, multi_mcq, assertion_reason, match_following, statement_based, comprehension, map_based, numerical, descriptive_10m, descriptive_15m, descriptive_20m, essay
        "subject": str(data["subject"]).strip(),
        "topic": str(data.get("topic", "General")).strip(),
        "subtopic": str(data.get("subtopic", "")).strip(),
        "examType": str(data.get("examType", "upsc_prelims")).strip(),
        "stage": str(data.get("stage", "Prelims")).strip(),
        "paper": str(data.get("paper", "General Studies")).strip(),
        "difficulty": str(data.get("difficulty", "medium")).strip(), # easy, medium, hard, advanced
        "positiveMarks": float(data.get("positiveMarks", 2.0)),
        "negativeMarks": float(data.get("negativeMarks", 0.66)),
        "options": options,
        "correctOption": data.get("correctOption"), # index or value or list
        "explanation": str(data.get("explanation", "")).strip(),
        "sourceReference": str(data.get("sourceReference", "")).strip(),
        "isPYQ": bool(data.get("isPYQ", False)),
        "pyqYear": data.get("pyqYear"),
        "pyqExam": str(data.get("pyqExam", "")).strip(),
        "isCurrentAffairs": bool(data.get("isCurrentAffairs", False)),
        "currentAffairsMonth": data.get("currentAffairsMonth"),
        "translations": data.get("translations", {}), # {"telugu": {...}, "hindi": {...}}
        "status": data.get("status", "approved"),      # draft, review, approved, published, archived
        "reviewComments": str(data.get("reviewComments", "")).strip(),
        "tags": data.get("tags", []),
        "contentHash": q_hash,
        "version": 1,
        "createdAt": now,
        "updatedAt": now,
    }

    res = db.question_bank.insert_one(doc)
    doc["_id"] = res.inserted_id

    log_audit_event("create_question", {"questionId": str(res.inserted_id), "subject": doc["subject"], "type": doc["questionType"]})
    return jsonify({"message": "Question created successfully", "question": to_jsonable(_serialize_question(doc))}), 201


@question_bank_bp.route("/<question_id>", methods=["PUT"])
def update_question(question_id):
    """Admin: Update an existing question."""
    db = get_db()
    try:
        oid = ObjectId(question_id)
    except Exception:
        return jsonify({"error": "Invalid question ID"}), 400

    data = request.get_json(silent=True) or {}
    now = datetime.utcnow().isoformat()

    allowed = [
        "questionText", "questionType", "subject", "topic", "subtopic",
        "examType", "stage", "paper", "difficulty", "positiveMarks", "negativeMarks",
        "options", "correctOption", "explanation", "sourceReference", "isPYQ",
        "pyqYear", "pyqExam", "isCurrentAffairs", "currentAffairsMonth", "translations",
        "status", "reviewComments", "tags"
    ]
    updates = {k: data[k] for k in allowed if k in data}
    updates["updatedAt"] = now

    if "questionText" in updates or "options" in updates:
        q_text = updates.get("questionText", "")
        options = updates.get("options", [])
        if q_text:
            updates["contentHash"] = _compute_question_hash(q_text, options)

    res = db.question_bank.update_one({"_id": oid}, {"$set": updates, "$inc": {"version": 1}})
    if res.matched_count == 0:
        return jsonify({"error": "Question not found"}), 404

    updated = db.question_bank.find_one({"_id": oid})
    log_audit_event("update_question", {"questionId": question_id, "updatedFields": list(updates.keys())})
    return jsonify({"message": "Question updated successfully", "question": to_jsonable(_serialize_question(updated))})


@question_bank_bp.route("/<question_id>", methods=["DELETE"])
def delete_question(question_id):
    """Admin: Delete question."""
    db = get_db()
    try:
        oid = ObjectId(question_id)
    except Exception:
        return jsonify({"error": "Invalid question ID"}), 400

    res = db.question_bank.delete_one({"_id": oid})
    if res.deleted_count == 0:
        return jsonify({"error": "Question not found"}), 404

    log_audit_event("delete_question", {"questionId": question_id})
    return jsonify({"message": "Question removed from Question Bank"})


@question_bank_bp.route("/bulk", methods=["POST"])
def bulk_upload_questions():
    """Admin: Bulk import questions from array."""
    db = get_db()
    data = request.get_json(silent=True) or {}
    questions = data.get("questions", [])

    if not questions or not isinstance(questions, list):
        return jsonify({"error": "questions array required"}), 400

    tenant_id = get_request_tenant_id() or DEFAULT_TENANT_ID
    now = datetime.utcnow().isoformat()
    inserted = 0
    duplicates = 0

    for q in questions:
        q_text = str(q.get("questionText", "")).strip()
        if not q_text:
            continue
        options = q.get("options", [])
        q_hash = _compute_question_hash(q_text, options)

        if db.question_bank.find_one({"tenantId": tenant_id, "contentHash": q_hash}):
            duplicates += 1
            continue

        doc = {
            "tenantId": tenant_id,
            "questionText": q_text,
            "questionType": str(q.get("questionType", "single_mcq")).strip(),
            "subject": str(q.get("subject", "General Studies")).strip(),
            "topic": str(q.get("topic", "General")).strip(),
            "subtopic": str(q.get("subtopic", "")).strip(),
            "examType": str(q.get("examType", "upsc_prelims")).strip(),
            "stage": str(q.get("stage", "Prelims")).strip(),
            "paper": str(q.get("paper", "General Studies")).strip(),
            "difficulty": str(q.get("difficulty", "medium")).strip(),
            "positiveMarks": float(q.get("positiveMarks", 2.0)),
            "negativeMarks": float(q.get("negativeMarks", 0.66)),
            "options": options,
            "correctOption": q.get("correctOption"),
            "explanation": str(q.get("explanation", "")).strip(),
            "sourceReference": str(q.get("sourceReference", "")).strip(),
            "isPYQ": bool(q.get("isPYQ", False)),
            "pyqYear": q.get("pyqYear"),
            "isCurrentAffairs": bool(q.get("isCurrentAffairs", False)),
            "translations": q.get("translations", {}),
            "status": q.get("status", "approved"),
            "tags": q.get("tags", []),
            "contentHash": q_hash,
            "version": 1,
            "createdAt": now,
            "updatedAt": now,
        }
        db.question_bank.insert_one(doc)
        inserted += 1

    return jsonify({
        "message": f"Bulk import completed. Inserted: {inserted}, Duplicates skipped: {duplicates}",
        "inserted": inserted,
        "duplicates": duplicates
    }), 201
