import re
import uuid
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from config.db import get_db
from config.settings import settings
from utils.json import to_jsonable
from utils.validators import require_fields
from utils.security import rate_limit, audit_log

auth_bp = Blueprint("auth", __name__)

@auth_bp.post("/login")
@rate_limit(max_calls=settings.RATE_LIMIT_LOGIN_MAX, period_seconds=settings.RATE_LIMIT_LOGIN_PERIOD)
def login():
    """Login using userId (or naxUnid) + password + role."""
    payload = request.get_json(silent=True) or {}
    ok, msg = require_fields(payload, ["userId", "password", "role"])
    if not ok:
        return jsonify({"error": msg}), 400

    userId   = str(payload["userId"]).strip()
    password = str(payload["password"]).strip()
    role     = str(payload["role"]).strip()

    db = get_db()

    # Case-insensitive lookup for userId / naxUnid matching the selected role
    user = db.users.find_one({
        "$or": [
            {"userId": {"$regex": f"^{re.escape(userId)}$", "$options": "i"}},
            {"naxUnid": {"$regex": f"^{re.escape(userId)}$", "$options": "i"}},
        ],
        "role": role,
    })

    if not user:
        audit_log("LOGIN_FAILED", user_id=userId,
                  details={"reason": "user_not_found", "role": role}, severity="warning")
        return jsonify({"error": "Invalid User ID or role"}), 401
    if user.get("password") != password:
        audit_log("LOGIN_FAILED", user_id=userId,
                  details={"reason": "wrong_password", "role": role}, severity="warning")
        return jsonify({"error": "Invalid credentials. Please check your User ID and password."}), 401
    
    valid_until = user.get("validUntil")
    if role == "answerer" and valid_until:
        try:
            dt_valid = None
            if isinstance(valid_until, datetime):
                dt_valid = valid_until
            elif isinstance(valid_until, str):
                dt_valid = datetime.fromisoformat(valid_until.replace("Z", "").split(".")[0])
            
            if dt_valid and dt_valid < datetime.utcnow():
                db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"isActive": False, "statusReason": "validity_expired", "statusUpdatedAt": datetime.utcnow()}}
                )
                audit_log("LOGIN_FAILED", user_id=userId,
                          details={"reason": "validity_expired"}, severity="warning")
                return jsonify({"error": "Your account validity has expired. Please contact your administrator."}), 403
        except Exception:
            pass


    if role == "answerer" and not user.get("isActive", True):
        status_reason = user.get("statusReason", "")
        # Auto-unblock if blocked solely due to screenshot violation
        if status_reason in ("security_violation_screenshot", "security_violation_recording"):
            db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"isActive": True, "statusReason": "active"}}
            )
        elif status_reason == "validity_expired":
            error_msg = "Your account validity has expired. Please contact your administrator."
            audit_log("LOGIN_FAILED", user_id=userId, details={"reason": "account_blocked", "statusReason": status_reason}, severity="warning")
            return jsonify({"error": error_msg}), 403
        else:
            error_msg = "Your account is deactivated. Please contact your administrator to regain access."
            audit_log("LOGIN_FAILED", user_id=userId, details={"reason": "account_blocked", "statusReason": status_reason}, severity="warning")
            return jsonify({"error": error_msg}), 403


    db.users.update_one({"_id": user["_id"]}, {"$set": {"lastLoginAt": datetime.utcnow()}})

    # Issue a short-lived security session token for the watermark system
    session_id = str(uuid.uuid4())
    session_expires = datetime.utcnow() + timedelta(hours=settings.SESSION_TTL_HOURS)
    try:
        db.security_sessions.insert_one({
            "sessionId": session_id,
            "userId": userId,
            "createdAt": datetime.utcnow(),
            "expiresAt": session_expires,
            "active": True,
        })
    except Exception:
        pass  # Non-critical — watermark will fall back to local UUID

    audit_log("LOGIN_SUCCESS", user_id=userId, details={"role": role, "sessionId": session_id})

    res_user = {
        "id":        str(user["_id"]),
        "userId":    user.get("userId"),
        "name":      user.get("name"),
        "email":     user.get("email"),
        "role":      user.get("role"),
        "sessionId": session_id,
    }
    return jsonify({"user": to_jsonable(res_user)})


@auth_bp.post("/change-password")
def change_password():
    payload = request.get_json(silent=True) or {}
    ok, msg = require_fields(payload, ["userId", "oldPassword", "newPassword", "role"])
    if not ok:
        return jsonify({"error": msg}), 400

    userId       = str(payload["userId"]).strip()
    old_password = str(payload["oldPassword"]).strip()
    new_password = str(payload["newPassword"]).strip()
    role         = str(payload["role"]).strip()

    if old_password == new_password:
        return jsonify({"error": "New password cannot be same as old password"}), 400

    db = get_db()

    user = db.users.find_one({
        "$or": [
            {"userId": {"$regex": f"^{re.escape(userId)}$", "$options": "i"}},
            {"naxUnid": {"$regex": f"^{re.escape(userId)}$", "$options": "i"}},
        ],
        "role": role,
    })
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user.get("password") != old_password:
        return jsonify({"error": "Old password is incorrect"}), 401

    db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {
            "password": new_password,
            "passwordUpdatedAt": datetime.utcnow(),
        }}
    )
    return jsonify({"message": "Password updated successfully"})
