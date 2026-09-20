"""
backend/routes/syllabus_management.py
──────────────────────────────────────
Hierarchical Syllabus Management Engine.
Syllabus hierarchy: Exam → Stage → Paper → Subject → Unit → Topic → Subtopic.
Allows tree exploration, topic CRUD, bulk import, and topic mapping for questions.
"""

from datetime import datetime
from bson import ObjectId
from flask import Blueprint, jsonify, request

from config.db import get_db
from utils.json import to_jsonable
from utils.tenant import get_request_tenant_id, DEFAULT_TENANT_ID
from utils.validators import require_fields

syllabus_bp = Blueprint("syllabus_management", __name__)


def _serialize_syllabus(doc):
    if not doc:
        return None
    doc["id"] = str(doc.get("_id", ""))
    return doc


@syllabus_bp.route("", methods=["GET"])
@syllabus_bp.route("/", methods=["GET"])
def get_syllabus_tree():
    """Retrieve syllabus tree filtered by examId, stage, paper, or subject."""
    db = get_db()
    tenant_id = get_request_tenant_id()
    query = {}
    if tenant_id and tenant_id != "all":
        query["$or"] = [
            {"tenantId": tenant_id},
            {"tenantId": {"$exists": False}},
            {"tenantId": None},
        ]

    exam_code = request.args.get("examCode")
    exam_id = request.args.get("examId")
    subject = request.args.get("subject")

    if exam_code:
        query["examCode"] = exam_code
    if exam_id:
        try:
            query["examId"] = ObjectId(exam_id)
        except Exception:
            pass
    if subject:
        query["subject"] = subject

    items = list(db.syllabus_hierarchy.find(query).sort([("stage", 1), ("paper", 1), ("order", 1)]))
    return jsonify({"syllabus": to_jsonable([_serialize_syllabus(item) for item in items])})


@syllabus_bp.route("/topics", methods=["GET"])
def get_flat_topics():
    """Returns flat list of topics and subtopics for question tagging."""
    db = get_db()
    tenant_id = get_request_tenant_id()
    query = {}
    if tenant_id and tenant_id != "all":
        query["$or"] = [
            {"tenantId": tenant_id},
            {"tenantId": {"$exists": False}},
            {"tenantId": None},
        ]

    subject = request.args.get("subject")
    if subject:
        query["subject"] = subject

    items = list(db.syllabus_hierarchy.find(query))
    topics = []
    for item in items:
        topics.append({
            "id": str(item["_id"]),
            "examCode": item.get("examCode", ""),
            "stage": item.get("stage", ""),
            "paper": item.get("paper", ""),
            "subject": item.get("subject", ""),
            "unit": item.get("unit", ""),
            "topic": item.get("topic", ""),
            "subtopics": item.get("subtopics", []),
            "weightage": item.get("weightage", 0),
        })

    return jsonify({"topics": to_jsonable(topics)})


@syllabus_bp.route("", methods=["POST"])
@syllabus_bp.route("/", methods=["POST"])
def add_syllabus_node():
    """Admin: Add a new syllabus topic/unit node."""
    db = get_db()
    data = request.get_json(silent=True) or {}

    ok, msg = require_fields(data, ["subject", "topic"])
    if not ok:
        return jsonify({"error": msg}), 400

    tenant_id = get_request_tenant_id() or DEFAULT_TENANT_ID
    now = datetime.utcnow().isoformat()

    doc = {
        "tenantId": tenant_id,
        "examCode": str(data.get("examCode", "GENERAL")).strip().upper(),
        "stage": str(data.get("stage", "Prelims")).strip(),
        "paper": str(data.get("paper", "General Studies")).strip(),
        "subject": str(data["subject"]).strip(),
        "unit": str(data.get("unit", "")).strip(),
        "topic": str(data["topic"]).strip(),
        "subtopics": data.get("subtopics", []),  # List of string subtopics
        "description": str(data.get("description", "")).strip(),
        "weightage": int(data.get("weightage", 1)),
        "order": int(data.get("order", 1)),
        "createdAt": now,
        "updatedAt": now,
    }

    res = db.syllabus_hierarchy.insert_one(doc)
    doc["_id"] = res.inserted_id

    return jsonify({"message": "Syllabus node created successfully", "node": to_jsonable(_serialize_syllabus(doc))}), 201


@syllabus_bp.route("/bulk", methods=["POST"])
def bulk_import_syllabus():
    """Admin: Bulk import syllabus tree for UPSC / State PSC examinations."""
    db = get_db()
    data = request.get_json(silent=True) or {}
    items = data.get("nodes", [])

    if not items or not isinstance(items, list):
        return jsonify({"error": "nodes list required"}), 400

    tenant_id = get_request_tenant_id() or DEFAULT_TENANT_ID
    now = datetime.utcnow().isoformat()
    inserted_count = 0

    for item in items:
        if not item.get("subject") or not item.get("topic"):
            continue
        doc = {
            "tenantId": tenant_id,
            "examCode": str(item.get("examCode", "GENERAL")).strip().upper(),
            "stage": str(item.get("stage", "Prelims")).strip(),
            "paper": str(item.get("paper", "General Studies")).strip(),
            "subject": str(item["subject"]).strip(),
            "unit": str(item.get("unit", "")).strip(),
            "topic": str(item["topic"]).strip(),
            "subtopics": item.get("subtopics", []),
            "description": str(item.get("description", "")).strip(),
            "weightage": int(item.get("weightage", 1)),
            "order": int(item.get("order", 1)),
            "createdAt": now,
            "updatedAt": now,
        }
        db.syllabus_hierarchy.insert_one(doc)
        inserted_count += 1

    return jsonify({"message": f"Successfully imported {inserted_count} syllabus topics"}), 201
