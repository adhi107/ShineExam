"""
backend/routes/exam_configurations.py
──────────────────────────────────────
Configurable Examination Engine.
Supports defining dynamic examination frameworks (UPSC, APPSC, TSPSC/TGPSC, SSC, etc.)
without hardcoding any rules into the application.
"""

from datetime import datetime
from bson import ObjectId
from flask import Blueprint, jsonify, request

from config.db import get_db
from utils.json import to_jsonable
from utils.tenant import get_request_tenant_id, DEFAULT_TENANT_ID
from utils.validators import require_fields
from utils.audit import log_audit_event

exam_config_bp = Blueprint("exam_configurations", __name__)


def _serialize_exam_config(doc):
    if not doc:
        return None
    doc["id"] = str(doc.get("_id", ""))
    return doc


@exam_config_bp.route("", methods=["GET"])
@exam_config_bp.route("/", methods=["GET"])
def list_exam_configurations():
    """List all configurable exams for tenant."""
    db = get_db()
    tenant_id = get_request_tenant_id()
    query = {}
    if tenant_id and tenant_id != "all":
        query["$or"] = [
            {"tenantId": tenant_id},
            {"tenantId": {"$exists": False}},
            {"tenantId": None},
        ]

    category = request.args.get("category")
    authority = request.args.get("authority")
    status = request.args.get("status")

    if category:
        query["category"] = category
    if authority:
        query["authority"] = authority
    if status:
        query["status"] = status

    exams = list(db.exam_configurations.find(query).sort("createdAt", -1))
    return jsonify({"exams": to_jsonable([_serialize_exam_config(e) for e in exams])})


@exam_config_bp.route("/<exam_id>", methods=["GET"])
def get_exam_configuration(exam_id):
    """Get single exam configuration with all its stages and papers."""
    db = get_db()
    try:
        oid = ObjectId(exam_id)
    except Exception:
        return jsonify({"error": "Invalid exam ID"}), 400

    exam = db.exam_configurations.find_one({"_id": oid})
    if not exam:
        return jsonify({"error": "Exam configuration not found"}), 404

    stages = list(db.exam_stages.find({"examId": oid}).sort("stageOrder", 1))
    exam_dict = _serialize_exam_config(exam)
    exam_dict["stages"] = [_serialize_exam_config(s) for s in stages]

    return jsonify({"exam": to_jsonable(exam_dict)})


@exam_config_bp.route("", methods=["POST"])
@exam_config_bp.route("/", methods=["POST"])
def create_exam_configuration():
    """Admin: Create new dynamic exam configuration."""
    db = get_db()
    data = request.get_json(silent=True) or {}

    ok, msg = require_fields(data, ["name", "authority", "category"])
    if not ok:
        return jsonify({"error": msg}), 400

    tenant_id = get_request_tenant_id() or DEFAULT_TENANT_ID
    now = datetime.utcnow().isoformat()

    doc = {
        "tenantId": tenant_id,
        "name": str(data["name"]).strip(),
        "code": str(data.get("code", "")).strip().upper() or str(data["name"]).strip()[:6].upper(),
        "authority": str(data["authority"]).strip(),  # UPSC, APPSC, TSPSC, SSC, State PSC, etc.
        "category": str(data["category"]).strip(),    # Civil Services, Group-I, Group-II, Engineering, etc.
        "year": data.get("year", datetime.utcnow().year),
        "notificationRef": str(data.get("notificationRef", "")).strip(),
        "description": str(data.get("description", "")).strip(),
        "supportedLanguages": data.get("supportedLanguages", ["English", "Telugu", "Hindi"]),
        "defaultLanguage": data.get("defaultLanguage", "English"),
        "status": data.get("status", "draft"),  # draft | active | archived
        "stagesCount": 0,
        "papersCount": 0,
        "qualifyingCriteria": data.get("qualifyingCriteria", {}),
        "negativeMarkingRules": data.get("negativeMarkingRules", {}),
        "securityConfig": data.get("securityConfig", {
            "fullScreenRequired": True,
            "tabSwitchLimit": 3,
            "copyPasteBlocked": True,
            "deviceTracking": True
        }),
        "createdAt": now,
        "updatedAt": now,
    }

    result = db.exam_configurations.insert_one(doc)
    doc["_id"] = result.inserted_id

    log_audit_event("create_exam_configuration", {"examId": str(result.inserted_id), "name": doc["name"]})
    return jsonify({"message": "Exam configuration created successfully", "exam": to_jsonable(_serialize_exam_config(doc))}), 201


@exam_config_bp.route("/<exam_id>", methods=["PUT"])
def update_exam_configuration(exam_id):
    """Admin: Update an existing exam configuration."""
    db = get_db()
    try:
        oid = ObjectId(exam_id)
    except Exception:
        return jsonify({"error": "Invalid exam ID"}), 400

    data = request.get_json(silent=True) or {}
    now = datetime.utcnow().isoformat()

    allowed = [
        "name", "code", "authority", "category", "year", "notificationRef",
        "description", "supportedLanguages", "defaultLanguage", "status",
        "qualifyingCriteria", "negativeMarkingRules", "securityConfig"
    ]
    updates = {k: data[k] for k in allowed if k in data}
    updates["updatedAt"] = now

    res = db.exam_configurations.update_one({"_id": oid}, {"$set": updates})
    if res.matched_count == 0:
        return jsonify({"error": "Exam configuration not found"}), 404

    updated = db.exam_configurations.find_one({"_id": oid})
    log_audit_event("update_exam_configuration", {"examId": exam_id, "updates": list(updates.keys())})
    return jsonify({"message": "Exam updated successfully", "exam": to_jsonable(_serialize_exam_config(updated))})


# ────────────────────────────────────────────────────────────────
# Exam Stages & Stage Papers
# ────────────────────────────────────────────────────────────────

@exam_config_bp.route("/<exam_id>/stages", methods=["POST"])
def add_exam_stage(exam_id):
    """Admin: Add stage to exam (Preliminary, Mains, Interview, Daily, Mock)."""
    db = get_db()
    try:
        oid = ObjectId(exam_id)
    except Exception:
        return jsonify({"error": "Invalid exam ID"}), 400

    exam = db.exam_configurations.find_one({"_id": oid})
    if not exam:
        return jsonify({"error": "Exam not found"}), 404

    data = request.get_json(silent=True) or {}
    ok, msg = require_fields(data, ["stageName", "stageType"])
    if not ok:
        return jsonify({"error": msg}), 400

    now = datetime.utcnow().isoformat()
    stage_doc = {
        "examId": oid,
        "stageName": str(data["stageName"]).strip(),  # e.g. "Preliminary Examination", "Mains Written Examination"
        "stageType": str(data["stageType"]).strip(),  # preliminary | mains | interview | sectional | daily | mock
        "stageOrder": int(data.get("stageOrder", 1)),
        "isQualifying": bool(data.get("isQualifying", False)),
        "qualifyingPercentage": float(data.get("qualifyingPercentage", 33.0)),
        "negativeMarkingScheme": str(data.get("negativeMarkingScheme", "third")), # none, quarter, third, half
        "papers": data.get("papers", []),  # Paper definitions inside this stage
        "createdAt": now,
        "updatedAt": now,
    }

    result = db.exam_stages.insert_one(stage_doc)
    stage_doc["_id"] = result.inserted_id

    # Update stages count in exam_configurations
    count = db.exam_stages.count_documents({"examId": oid})
    db.exam_configurations.update_one({"_id": oid}, {"$set": {"stagesCount": count, "updatedAt": now}})

    return jsonify({"message": "Exam stage added successfully", "stage": to_jsonable(_serialize_exam_config(stage_doc))}), 201


@exam_config_bp.route("/<exam_id>/stages/<stage_id>", methods=["DELETE"])
def delete_exam_stage(exam_id, stage_id):
    """Admin: Remove a stage from an exam."""
    db = get_db()
    try:
        e_oid = ObjectId(exam_id)
        s_oid = ObjectId(stage_id)
    except Exception:
        return jsonify({"error": "Invalid ID"}), 400

    res = db.exam_stages.delete_one({"_id": s_oid, "examId": e_oid})
    if res.deleted_count == 0:
        return jsonify({"error": "Stage not found"}), 404

    count = db.exam_stages.count_documents({"examId": e_oid})
    db.exam_configurations.update_one({"_id": e_oid}, {"$set": {"stagesCount": count, "updatedAt": datetime.utcnow().isoformat()}})

    return jsonify({"message": "Stage deleted successfully"})
