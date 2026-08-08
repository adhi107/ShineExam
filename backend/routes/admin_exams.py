from flask import Blueprint, jsonify, request
from datetime import datetime, time
from bson import ObjectId

from config.db import get_db
from utils.json import to_jsonable
from utils.validators import require_fields
from services.document_parser import parse_document_file

admin_exams_bp = Blueprint("admin_exams", __name__)


def _parse_validity_date(value, end_of_day=False):
    if value in (None, ""):
        return None
    try:
        raw = str(value).strip().replace("Z", "+00:00")
        parsed = datetime.fromisoformat(raw)
        if len(raw) == 10:
            parsed = datetime.combine(parsed.date(), time.max if end_of_day else time.min)
        return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
    except (TypeError, ValueError):
        raise ValueError("Validity dates must use YYYY-MM-DD format")

@admin_exams_bp.route("", methods=["GET"])
@admin_exams_bp.route("/", methods=["GET"])
def list_exams():
    db = get_db()
    exams = list(db.exams.find({}, {"questions": 0}))
    assignments = list(db.exam_assignments.find({}, {"examId": 1, "userId": 1}))
    users = list(db.users.find({}, {"userId": 1, "collegeName": 1}))

    user_college_by_id = {
        str(user.get("userId") or ""): str(user.get("collegeName") or "").strip()
        for user in users
        if user.get("userId")
    }
    assignment_summary = {}
    for assignment in assignments:
        exam_key = str(assignment.get("examId") or "")
        user_id = str(assignment.get("userId") or "").strip()
        if not exam_key or not user_id:
            continue
        summary = assignment_summary.setdefault(exam_key, {"userIds": set(), "colleges": set()})
        summary["userIds"].add(user_id)
        college_name = user_college_by_id.get(user_id, "")
        if college_name:
            summary["colleges"].add(college_name)

    out = []
    now = datetime.utcnow()
    for e in exams:
        exam_key = str(e["_id"])
        summary = assignment_summary.get(exam_key, {"userIds": set(), "colleges": set()})
        available_from = e.get("availableFrom") or e.get("createdAt")
        valid_until = e.get("validUntil")
        stored_status = e.get("status", "draft")
        effective_status = "expired" if valid_until and valid_until < now else "upcoming" if available_from and available_from > now else stored_status
        out.append({
            "id": exam_key,
            "name": e.get("name"),
            "duration": int(e.get("duration", 0)),
            "questions": int(e.get("questionCount", 0)),
            "sections": e.get("sections", []),
            "passingPercentage": int(e.get("passingPercentage", 40)),
            "createdAt": e.get("createdAt").isoformat() if e.get("createdAt") else None,
            "updatedAt": e.get("updatedAt").isoformat() if e.get("updatedAt") else None,
            "status": effective_status,
            "availableFrom": available_from,
            "validUntil": valid_until,
            "categoryId": e.get("categoryId"),
            "categoryName": e.get("categoryName"),
            "subcategoryId": e.get("subcategoryId"),
            "subcategoryName": e.get("subcategoryName"),
            "stage": e.get("stage"),
            "assignmentCount": len(summary["userIds"]),
            "assignedColleges": sorted(summary["colleges"]),
        })
    out.sort(key=lambda x: x.get("createdAt") or "", reverse=True)
    return jsonify({"tests": to_jsonable(out)})


@admin_exams_bp.route("", methods=["POST"])
@admin_exams_bp.route("/", methods=["POST"])
def create_exam():
    """Create exam + questions.

    Payload:
    {
      "testName": "...",
      "duration": 60,
      "passingPercentage": 40,
      "sections": ["General"],
      "questions": [...]
    }
    """
    payload = request.get_json(silent=True) or {}
    ok, msg = require_fields(payload, ["testName", "duration", "sections", "questions"])
    if not ok:
        return jsonify({"error": msg}), 400

    db = get_db()

    category_id = str(payload.get("categoryId") or "").strip()
    subcategory_id = str(payload.get("subcategoryId") or "").strip()
    stage = str(payload.get("stage") or "").strip()
    if not category_id or not subcategory_id or not stage:
        return jsonify({"error": "Category, subcategory and stage are required"}), 400
    try:
        category = db.exam_categories.find_one({"_id": ObjectId(category_id), "isActive": {"$ne": False}})
    except Exception:
        category = None
    subcategory = next((item for item in (category or {}).get("subcategories", []) if item.get("id") == subcategory_id and item.get("isActive", True)), None)
    if not category or not subcategory or stage not in subcategory.get("stages", []):
        return jsonify({"error": "Select a valid category, subcategory and stage"}), 400

    testName = str(payload["testName"]).strip()
    duration = int(payload["duration"])
    passing_percentage = int(payload.get("passingPercentage", 40))
    if not (1 <= passing_percentage <= 100):
        return jsonify({"error": "passingPercentage must be between 1 and 100"}), 400

    sections_input = payload.get("sections") or []
    questions = payload.get("questions") or []

    sections = []
    for s in sections_input:
        if isinstance(s, dict):
            sections.append(s.get("name", ""))
        else:
            sections.append(str(s))
    sections = [s for s in sections if s]

    if not isinstance(sections, list) or len(sections) == 0:
        return jsonify({"error": "sections must be a non-empty list"}), 400
    if not isinstance(questions, list) or len(questions) == 0:
        return jsonify({"error": "questions must be a non-empty list"}), 400

    now = datetime.utcnow()
    try:
        available_from = _parse_validity_date(payload.get("availableFrom")) or now
        valid_until = _parse_validity_date(payload.get("validUntil"), end_of_day=True)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    if valid_until and valid_until < available_from:
        return jsonify({"error": "Valid until date must be on or after the start date"}), 400

    exam_doc = {
        "name": testName,
        "duration": duration,
        "passingPercentage": passing_percentage,
        "sections": sections,
        "status": "active",
        "questionCount": len(questions),
        "createdAt": now,
        "updatedAt": now,
        "availableFrom": available_from,
        "validUntil": valid_until,
        "categoryId": category_id,
        "categoryName": category.get("name"),
        "subcategoryId": subcategory_id,
        "subcategoryName": subcategory.get("name"),
        "stage": stage,
    }

    exam_res = db.exams.insert_one(exam_doc)
    exam_id = exam_res.inserted_id

    q_docs = []
    for q in questions:
        if not q.get("type") or not q.get("question") or not q.get("section"):
            continue
        q_docs.append({
            "examId": exam_id,
            "qid": str(q.get("id") or ""),
            "type": q.get("type"),
            "question": q.get("question"),
            "options": q.get("options", []),
            "correctAnswer": q.get("correctAnswer"),
            "section": q.get("section"),
            "marks": int(q.get("marks", 0)),
            "createdAt": now,
        })

    if len(q_docs) == 0:
        db.exams.delete_one({"_id": exam_id})
        return jsonify({"error": "No valid questions provided"}), 400

    db.questions.insert_many(q_docs)

    return jsonify({
        "test": to_jsonable({
            "id": str(exam_id),
            "name": exam_doc["name"],
            "duration": exam_doc["duration"],
            "passingPercentage": exam_doc["passingPercentage"],
            "questions": exam_doc["questionCount"],
            "sections": exam_doc["sections"],
            "createdAt": exam_doc["createdAt"].isoformat(),
            "status": exam_doc["status"],
            "availableFrom": exam_doc["availableFrom"],
            "validUntil": exam_doc["validUntil"],
            "categoryId": exam_doc["categoryId"],
            "subcategoryId": exam_doc["subcategoryId"],
            "stage": exam_doc["stage"],
        })
    }), 201


@admin_exams_bp.route("/parse-document", methods=["POST"], strict_slashes=False)
def parse_document_route():

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if not file or not file.filename:
        return jsonify({"error": "Selected file is empty"}), 400

    filename = file.filename
    try:
        file_bytes = file.read()
        if not file_bytes:
            return jsonify({"error": "Uploaded file is empty"}), 400

        sections, questions = parse_document_file(file_bytes, filename)
        if not questions:
            return jsonify({"error": "No questions could be parsed from the document. Please check the document structure."}), 400

        # Summarise context types for frontend info panel
        di_count = sum(1 for q in questions if q.get("contextType") == "table")
        passage_count = sum(1 for q in questions if q.get("contextType") == "passage")
        graph_count = sum(1 for q in questions if q.get("contextType") == "graph")

        return jsonify({
            "success": True,
            "filename": filename,
            "sections": sections,
            "questions": questions,
            "totalParsed": len(questions),
            "stats": {
                "dataInterpretation": di_count,
                "passageBased": passage_count,
                "graphBased": graph_count,
                "plainMCQ": len(questions) - di_count - passage_count - graph_count,
            }
        })
    except Exception as e:
        import traceback
        return jsonify({"error": f"Failed to parse document: {str(e)}", "trace": traceback.format_exc()}), 500


@admin_exams_bp.route("/<exam_id>", methods=["GET"])
@admin_exams_bp.route("/<exam_id>/", methods=["GET"])
def get_exam(exam_id: str):
    db = get_db()
    try:
        oid = ObjectId(exam_id)
    except Exception:
        return jsonify({"error": "Invalid exam id"}), 400

    exam = db.exams.find_one({"_id": oid})
    if not exam:
        return jsonify({"error": "Exam not found"}), 404

    qs = list(db.questions.find({"examId": oid}))

    out_questions = []
    for q in qs:
        out_questions.append({
            "id": str(q.get("qid") or q.get("_id")),
            "_id": str(q.get("_id")),
            "type": q.get("type"),
            "question": q.get("question"),
            "options": q.get("options", []),
            "correctAnswer": q.get("correctAnswer"),
            "section": q.get("section"),
            "marks": int(q.get("marks", 0)),
        })

    return jsonify({
        "test": to_jsonable({
            "id": str(exam["_id"]),
            "testName": exam.get("name"),
            "duration": int(exam.get("duration", 0)),
            "passingPercentage": int(exam.get("passingPercentage", 40)),
            "sections": exam.get("sections", []),
            "status": exam.get("status", "draft"),
            "questions": out_questions,
            "createdAt": exam.get("createdAt"),
            "updatedAt": exam.get("updatedAt"),
            "availableFrom": exam.get("availableFrom") or exam.get("createdAt"),
            "validUntil": exam.get("validUntil"),
            "categoryId": exam.get("categoryId"),
            "categoryName": exam.get("categoryName"),
            "subcategoryId": exam.get("subcategoryId"),
            "subcategoryName": exam.get("subcategoryName"),
            "stage": exam.get("stage"),
        })
    })


@admin_exams_bp.route("/<exam_id>", methods=["PUT"])
@admin_exams_bp.route("/<exam_id>/", methods=["PUT"])
def update_exam(exam_id: str):
    payload = request.get_json(silent=True) or {}
    ok, msg = require_fields(payload, ["testName", "duration", "sections", "questions"])
    if not ok:
        return jsonify({"error": msg}), 400

    db = get_db()
    try:
        oid = ObjectId(exam_id)
    except Exception:
        return jsonify({"error": "Invalid exam id"}), 400

    exam = db.exams.find_one({"_id": oid})
    if not exam:
        return jsonify({"error": "Exam not found"}), 404

    category_id = str(payload.get("categoryId") or "").strip()
    subcategory_id = str(payload.get("subcategoryId") or "").strip()
    stage = str(payload.get("stage") or "").strip()
    if not category_id or not subcategory_id or not stage:
        return jsonify({"error": "Category, subcategory and stage are required"}), 400
    try:
        category = db.exam_categories.find_one({"_id": ObjectId(category_id), "isActive": {"$ne": False}})
    except Exception:
        category = None
    subcategory = next((item for item in (category or {}).get("subcategories", []) if item.get("id") == subcategory_id and item.get("isActive", True)), None)
    if not category or not subcategory or stage not in subcategory.get("stages", []):
        return jsonify({"error": "Select a valid category, subcategory and stage"}), 400

    passing_percentage = int(payload.get("passingPercentage", 40))
    if not (1 <= passing_percentage <= 100):
        return jsonify({"error": "passingPercentage must be between 1 and 100"}), 400

    now = datetime.utcnow()
    try:
        available_from = _parse_validity_date(payload.get("availableFrom")) or exam.get("availableFrom") or exam.get("createdAt") or now
        valid_until = _parse_validity_date(payload.get("validUntil"), end_of_day=True)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    if valid_until and valid_until < available_from:
        return jsonify({"error": "Valid until date must be on or after the start date"}), 400
    sections_input = payload.get("sections") or []

    sections = []
    for s in sections_input:
        if isinstance(s, dict):
            sections.append(s.get("name", ""))
        else:
            sections.append(str(s))
    sections = [s for s in sections if s]

    update = {
        "name": str(payload["testName"]).strip(),
        "duration": int(payload["duration"]),
        "passingPercentage": passing_percentage,
        "sections": sections,
        "questionCount": len(payload.get("questions") or []),
        "updatedAt": now,
        "availableFrom": available_from,
        "validUntil": valid_until,
        "categoryId": category_id,
        "categoryName": category.get("name"),
        "subcategoryId": subcategory_id,
        "subcategoryName": subcategory.get("name"),
        "stage": stage,
    }

    db.exams.update_one({"_id": oid}, {"$set": update})

    db.questions.delete_many({"examId": oid})
    q_docs = []
    for q in payload.get("questions") or []:
        q_docs.append({
            "examId": oid,
            "qid": str(q.get("id") or ""),
            "type": q.get("type"),
            "question": q.get("question"),
            "options": q.get("options", []),
            "correctAnswer": q.get("correctAnswer"),
            "section": q.get("section"),
            "marks": int(q.get("marks", 0)),
            "createdAt": now,
        })

    if len(q_docs) > 0:
        db.questions.insert_many(q_docs)

    return jsonify({"message": "Updated"})


@admin_exams_bp.route("/<exam_id>", methods=["DELETE"])
@admin_exams_bp.route("/<exam_id>/", methods=["DELETE"])
def delete_exam(exam_id: str):
    db = get_db()
    try:
        oid = ObjectId(exam_id)
    except Exception:
        return jsonify({"error": "Invalid exam id"}), 400

    exam = db.exams.find_one({"_id": oid})
    if not exam:
        return jsonify({"error": "Exam not found"}), 404

    db.exams.delete_one({"_id": oid})
    db.questions.delete_many({"examId": oid})
    db.exam_assignments.delete_many({"examId": oid})
    db.attempts.delete_many({"examId": oid})
    db.results.delete_many({"examId": oid})
    return jsonify({"message": "Deleted"})


@admin_exams_bp.route("/<exam_id>/publish", methods=["POST"])
@admin_exams_bp.route("/<exam_id>/publish/", methods=["POST"])
def publish_exam(exam_id: str):
    db = get_db()
    try:
        oid = ObjectId(exam_id)
    except Exception:
        return jsonify({"error": "Invalid exam id"}), 400

    res = db.exams.update_one({"_id": oid}, {"$set": {"status": "active", "updatedAt": datetime.utcnow()}})
    if res.matched_count == 0:
        return jsonify({"error": "Exam not found"}), 404
    return jsonify({"message": "Published"})


@admin_exams_bp.route("/<exam_id>/assign", methods=["POST"])
@admin_exams_bp.route("/<exam_id>/assign/", methods=["POST"])
def assign_exam(exam_id: str):
    payload = request.get_json(silent=True) or {}
    ok, msg = require_fields(payload, ["userIds"])
    if not ok:
        return jsonify({"error": msg}), 400

    userIds = payload.get("userIds")
    if not isinstance(userIds, list) or len(userIds) == 0:
        return jsonify({"error": "userIds must be a non-empty list"}), 400

    db = get_db()
    try:
        oid = ObjectId(exam_id)
    except Exception:
        return jsonify({"error": "Invalid exam id"}), 400

    exam = db.exams.find_one({"_id": oid})
    if not exam:
        return jsonify({"error": "Exam not found"}), 404

    now = datetime.utcnow()
    upserts = 0
    for uid in userIds:
        uid = str(uid).strip()
        if not uid:
            continue
        db.exam_assignments.update_one(
            {"examId": oid, "userId": uid},
            {"$setOnInsert": {"createdAt": now}, "$set": {"status": "assigned", "updatedAt": now}},
            upsert=True,
        )
        upserts += 1

    return jsonify({"message": "Assigned", "assigned": upserts})

