"""
backend/routes/manual_assignments.py
────────────────────────────────────
Strict Manual Test Assignment Engine.
Enforces the core competitive-exam business rule:
Tests NEVER automatically appear merely because a student is enrolled in a course.
All tests must be explicitly and manually assigned by an authorized administrator.
"""

from datetime import datetime
from bson import ObjectId
from flask import Blueprint, jsonify, request

from config.db import get_db
from utils.json import to_jsonable
from utils.tenant import get_request_tenant_id, DEFAULT_TENANT_ID
from utils.validators import require_fields
from utils.audit import log_audit_event

manual_assign_bp = Blueprint("manual_assignments", __name__)


def _serialize_assignment(doc):
    if not doc:
        return None
    doc["id"] = str(doc.get("_id", ""))
    return doc


@manual_assign_bp.route("", methods=["GET"])
@manual_assign_bp.route("/", methods=["GET"])
def list_assignments():
    """Admin: List test assignments with filters (examId, userId, batchId, status)."""
    db = get_db()
    tenant_id = get_request_tenant_id()
    query = {}
    if tenant_id and tenant_id != "all":
        query["$or"] = [
            {"tenantId": tenant_id},
            {"tenantId": {"$exists": False}},
            {"tenantId": None},
        ]

    user_id = request.args.get("userId")
    series_id = request.args.get("seriesId")
    status = request.args.get("status")
    batch_id = request.args.get("batchId")

    if user_id:
        query["userId"] = user_id
    if series_id:
        try: query["seriesId"] = ObjectId(series_id)
        except Exception: pass
    if status:
        query["status"] = status
    if batch_id:
        query["batchId"] = batch_id

    page = max(1, int(request.args.get("page", 1)))
    limit = min(200, max(1, int(request.args.get("limit", 50))))
    skip = (page - 1) * limit

    total = db.series_assignments.count_documents(query)
    assignments = list(db.series_assignments.find(query).sort("assignedAt", -1).skip(skip).limit(limit))

    return jsonify({
        "total": total,
        "page": page,
        "limit": limit,
        "assignments": to_jsonable([_serialize_assignment(a) for a in assignments])
    })


@manual_assign_bp.route("/assign", methods=["POST"])
def assign_test_manually():
    """
    Admin: Explicitly assign a test / test series to individual students, batches, or courses.
    """
    db = get_db()
    data = request.get_json(silent=True) or {}

    ok, msg = require_fields(data, ["seriesId", "userIds"])
    if not ok:
        return jsonify({"error": msg}), 400

    series_id = data["seriesId"]
    user_ids = data["userIds"]
    if not isinstance(user_ids, list) or len(user_ids) == 0:
        return jsonify({"error": "userIds must be a non-empty list of student IDs"}), 400

    try:
        s_oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid seriesId"}), 400

    series = db.test_series.find_one({"_id": s_oid})
    if not series:
        return jsonify({"error": "Test series not found"}), 404

    tenant_id = get_request_tenant_id() or DEFAULT_TENANT_ID
    now = datetime.utcnow().isoformat()
    due_date = data.get("validUntil") or series.get("validUntil")
    optional_subject = data.get("optionalSubject", "")
    batch_id = data.get("batchId", "")

    assigned_count = 0
    for uid in user_ids:
        uid_str = str(uid).strip()
        if not uid_str:
            continue

        # Look up user profile to attach name & courseStream for faster dashboard rendering
        u = db.users.find_one({"$or": [{"userId": uid_str}, {"naxUnid": uid_str}]})
        student_name = u.get("name", uid_str) if u else uid_str
        stream = u.get("courseStream", "") if u else ""

        doc = {
            "tenantId": tenant_id,
            "seriesId": s_oid,
            "seriesName": series.get("name", ""),
            "examType": series.get("examType", "other"),
            "userId": uid_str,
            "studentName": student_name,
            "courseStream": stream,
            "batchId": batch_id,
            "optionalSubject": optional_subject,
            "assignedBy": data.get("assignedBy", "Admin"),
            "assignedAt": now,
            "validUntil": due_date,
            "attemptLimit": int(data.get("attemptLimit", 1)),
            "status": "Assigned",  # Assigned | In Progress | Submitted | Evaluated | Expired | Cancelled
            "updatedAt": now,
        }

        db.series_assignments.update_one(
            {"seriesId": s_oid, "userId": uid_str},
            {"$set": doc},
            upsert=True
        )
        assigned_count += 1

    # Update assignment count on series
    count = db.series_assignments.count_documents({"seriesId": s_oid})
    db.test_series.update_one({"_id": s_oid}, {"$set": {"assignmentCount": count, "updatedAt": now}})

    log_audit_event("manual_test_assignment", {
        "seriesId": series_id,
        "assignedCount": assigned_count,
        "userIds": user_ids[:10]
    })

    return jsonify({
        "message": f"Successfully assigned test series to {assigned_count} candidates.",
        "assignedCount": assigned_count
    }), 201


@manual_assign_bp.route("/unassign", methods=["POST"])
def unassign_test():
    """Admin: Revoke assignment from students."""
    db = get_db()
    data = request.get_json(silent=True) or {}
    ok, msg = require_fields(data, ["seriesId", "userIds"])
    if not ok:
        return jsonify({"error": msg}), 400

    try:
        s_oid = ObjectId(data["seriesId"])
    except Exception:
        return jsonify({"error": "Invalid seriesId"}), 400

    user_ids = [str(u).strip() for u in data["userIds"] if str(u).strip()]
    res = db.series_assignments.delete_many({"seriesId": s_oid, "userId": {"$in": user_ids}})

    count = db.series_assignments.count_documents({"seriesId": s_oid})
    db.test_series.update_one({"_id": s_oid}, {"$set": {"assignmentCount": count, "updatedAt": datetime.utcnow().isoformat()}})

    log_audit_event("revoke_test_assignment", {"seriesId": data["seriesId"], "unassignedCount": res.deleted_count})
    return jsonify({"message": f"Revoked assignment for {res.deleted_count} students."})
