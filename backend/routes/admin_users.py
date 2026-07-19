#admin_users.py
from flask import Blueprint, jsonify, request
from datetime import datetime, time
from bson import ObjectId
from typing import Optional
from config.db import get_db
from utils.json import to_jsonable
from utils.validators import require_fields

admin_users_bp = Blueprint("admin_users", __name__)


def _parse_valid_until(value):
    if value in (None, ""):
        return None
    try:
        parsed = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
        if len(str(value).strip()) == 10:
            parsed = datetime.combine(parsed.date(), time.max)
        return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
    except (TypeError, ValueError):
        raise ValueError("Validity date must use YYYY-MM-DD format")


def _merge_registration_fields(user: dict, registration: Optional[dict]) -> dict:
    if not registration:
        return user

    merged = dict(user)
    field_map = {
        "naxUnid": "naxUnid",
        "studentName": "name",
        "studentId": "studentId",
        "email": "email",
        "collegeEmail": "collegeEmail",
        "mobile": "mobile",
        "gender": "gender",
        "courseStream": "courseStream",
        "cgpa": "cgpa",
        "sapCertification": "sapCertification",
        "collegeName": "collegeName",
    }

    for reg_key, user_key in field_map.items():
        if merged.get(user_key) in (None, ""):
            merged[user_key] = registration.get(reg_key)

    if merged.get("collegeRollNumber") in (None, "") and registration.get("studentId"):
        merged["collegeRollNumber"] = registration.get("studentId")

    return merged

# =========================
# LIST USERS
# =========================
@admin_users_bp.route("", methods=["GET"])
@admin_users_bp.route("/", methods=["GET"])
def list_users():
    db = get_db()
    now = datetime.utcnow()
    db.users.update_many(
        {"role": "answerer", "validUntil": {"$lt": now}, "isActive": {"$ne": False}},
        {"$set": {"isActive": False, "statusReason": "validity_expired", "statusUpdatedAt": now}},
    )
    users = list(db.users.find({"role": "answerer"}, {"password": 0}))
    out = []
    for u in users:
        out.append({
            "id": str(u["_id"]), "name": u.get("name") or u.get("userId"),
            "email": u.get("email", ""), "userId": u.get("userId"),
            "createdAt": u.get("createdAt"), "lastLoginAt": u.get("lastLoginAt"),
            "isActive": u.get("isActive", True),
            "validUntil": u.get("validUntil"),
            "isExpired": bool(u.get("validUntil") and u.get("validUntil") < now),
            "attempts": db.results.count_documents({"userId": u.get("userId")}),
        })
    return jsonify({"users": to_jsonable(out)})

# =========================
# CREATE USER
# =========================
@admin_users_bp.route("", methods=["POST"])
@admin_users_bp.route("/", methods=["POST"])
def create_user():
    payload = request.get_json(silent=True) or {}
    ok, msg = require_fields(payload, ["name", "email", "userId", "password"])
    if not ok:
        return jsonify({"error": msg}), 400
    
    db = get_db()
    userId = str(payload["userId"]).strip()
    if db.users.find_one({"userId": userId}):
        return jsonify({"error": "userId already exists"}), 409
    
    try:
        valid_until = _parse_valid_until(payload.get("validUntil"))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    doc = {
        "name": payload["name"].strip(),
        "email": payload["email"].strip().lower(),
        "userId": userId,
        "password": str(payload["password"]).strip(),  # plain text (as requested)
        "role": "answerer",
        "createdAt": datetime.utcnow(),
        "lastLoginAt": None,
        "isActive": True,
        "validUntil": valid_until,
    }
    res = db.users.insert_one(doc)
    return jsonify({
        "user": to_jsonable({
            "id": str(res.inserted_id),
            "name": doc["name"],
            "email": doc["email"],
            "userId": doc["userId"],
            "role": doc["role"],
            "createdAt": doc["createdAt"],
            "isActive": doc["isActive"], 
            "validUntil": doc["validUntil"],
        })
    }), 201

# =========================
# ADMIN CHANGE USER PASSWORD (NEW)
# =========================
@admin_users_bp.route("/<user_id>/change-password", methods=["PUT", "PATCH"])
@admin_users_bp.route("/<user_id>/change-password/", methods=["PUT", "PATCH"])
def admin_change_user_password(user_id: str):
    """
    Admin endpoint to change any user's password.
    Payload:
    {
      "newPassword": "..."
    }
    """
    payload = request.get_json(silent=True) or {}
    ok, msg = require_fields(payload, ["newPassword"])
    if not ok:
        return jsonify({"error": msg}), 400
    
    new_password = str(payload["newPassword"]).strip()
    
    if not new_password or len(new_password) < 4:
        return jsonify({"error": "Password must be at least 4 characters"}), 400
    
    db = get_db()
    
    # Try to find user by ObjectId first, then by userId
    try:
        user = db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = db.users.find_one({"userId": user_id})
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    # Update password
    db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password": new_password,
                "passwordUpdatedAt": datetime.utcnow()
            }
        }
    )
    
    return jsonify({
        "message": "Password updated successfully",
        "userId": user.get("userId")
    })


# =========================
# TOGGLE USER ACTIVE STATUS
# =========================
@admin_users_bp.route("/<user_id>/status", methods=["PUT", "PATCH"])
@admin_users_bp.route("/<user_id>/status/", methods=["PUT", "PATCH"])
def update_user_status(user_id: str):
    """
    Payload:
    {
        "isActive": true/false
    }
    """
    payload = request.get_json(silent=True) or {}

    if "isActive" not in payload:
        return jsonify({"error": "isActive field required"}), 400

    db = get_db()

    # Find by ObjectId first, then fallback to userId
    try:
        q = {"_id": ObjectId(user_id)}
    except Exception:
        q = {"userId": user_id}

    user = db.users.find_one(q)
    if not user:
        return jsonify({"error": "User not found"}), 404

    status_updates = {
        "isActive": bool(payload["isActive"]),
        "statusUpdatedAt": datetime.utcnow()
    }
    if status_updates["isActive"] and user.get("validUntil") and user.get("validUntil") < datetime.utcnow():
        status_updates["validUntil"] = None
        status_updates["statusReason"] = "manually_unblocked"
    elif not status_updates["isActive"]:
        status_updates["statusReason"] = "manually_blocked"

    db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": status_updates
        }
    )

    return jsonify({
        "message": "User status updated",
        "userId": user.get("userId"),
        "isActive": bool(payload["isActive"])
    })

# =========================
# DELETE USER
# =========================
@admin_users_bp.route("/<user_id>", methods=["DELETE"])
@admin_users_bp.route("/<user_id>/", methods=["DELETE"])
def delete_user(user_id: str):
    db = get_db()
    try:
        q = {"_id": ObjectId(user_id)}
    except Exception:
        q = {"userId": user_id}
    
    user = db.users.find_one(q)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    db.users.delete_one({"_id": user["_id"]})
    db.exam_assignments.delete_many({"userId": user.get("userId")})
    db.attempts.delete_many({"userId": user.get("userId")})
    
    return jsonify({"message": "Deleted"})


@admin_users_bp.route("/<user_id>", methods=["PUT", "PATCH"])
@admin_users_bp.route("/<user_id>/", methods=["PUT", "PATCH"])
def update_user(user_id: str):
    payload = request.get_json(silent=True) or {}
    db = get_db()
    try:
        q = {"_id": ObjectId(user_id)}
    except Exception:
        q = {"userId": user_id}

    user = db.users.find_one(q)
    if not user:
        return jsonify({"error": "User not found"}), 404

    allowed = ["name", "email"]
    updates = {k: payload[k] for k in allowed if k in payload}
    if "validUntil" in payload:
        try:
            updates["validUntil"] = _parse_valid_until(payload.get("validUntil"))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
    updates["updatedAt"] = datetime.utcnow()

    db.users.update_one({"_id": user["_id"]}, {"$set": updates})

    updated = db.users.find_one({"_id": user["_id"]}, {"password": 0})
    return jsonify({"user": to_jsonable({
        "id": str(updated["_id"]),
        **{k: updated.get(k) for k in ["name", "email", "userId", "createdAt", "lastLoginAt", "isActive", "validUntil"]}
    })})
