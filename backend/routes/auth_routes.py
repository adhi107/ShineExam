import re
import uuid
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from config.db import get_db
from config.settings import settings
from utils.json import to_jsonable
from utils.validators import require_fields
from utils.security import rate_limit, audit_log

from utils.tenant import (
    get_tenant_branding,
    ensure_default_organization,
    ensure_super_admin,
    DEFAULT_TENANT_ID,
)

auth_bp = Blueprint("auth", __name__)


@auth_bp.get("/tenant-branding")
def get_branding():
    """Retrieve branding for a given tenant ID or the default organization."""
    tenant_id = (
        request.args.get("tenantId", "").strip()
        or request.headers.get("X-Tenant-Id", "").strip()
        or DEFAULT_TENANT_ID
    )
    branding = get_tenant_branding(tenant_id)
    return jsonify({"branding": branding})


@auth_bp.post("/login")
@rate_limit(max_calls=settings.RATE_LIMIT_LOGIN_MAX, period_seconds=settings.RATE_LIMIT_LOGIN_PERIOD)
def login():
    """Unified login using userId (or naxUnid / email) + password with automatic role detection."""
    payload = request.get_json(silent=True) or {}
    ok, msg = require_fields(payload, ["userId", "password"])
    if not ok:
        return jsonify({"error": msg}), 400

    userId   = str(payload["userId"]).strip()
    password = str(payload["password"]).strip()

    db = get_db()
    ensure_default_organization(db)
    ensure_super_admin(db)

    # Normalize user input for flexible matching (e.g. "super admin" -> "superadmin")
    normalized_id = re.sub(r"[\s_-]+", "", userId)

    # Build search conditions for userId, naxUnid, email, or normalized form
    user_match_conditions = [
        {"userId": {"$regex": f"^{re.escape(userId)}$", "$options": "i"}},
        {"naxUnid": {"$regex": f"^{re.escape(userId)}$", "$options": "i"}},
        {"email": {"$regex": f"^{re.escape(userId)}$", "$options": "i"}},
    ]
    if normalized_id and normalized_id != userId:
        user_match_conditions.extend([
            {"userId": {"$regex": f"^{re.escape(normalized_id)}$", "$options": "i"}},
            {"name": {"$regex": f"^{re.escape(userId)}$", "$options": "i"}},
        ])
    if normalized_id.lower() in ("superadmin", "super_admin", "super-admin", "admin"):
        user_match_conditions.extend([
            {"userId": {"$regex": r"^super[\s_-]*admin$", "$options": "i"}},
        ])

    # Lookup user across all roles
    user = db.users.find_one({"$or": user_match_conditions})

    if not user:
        audit_log("LOGIN_FAILED", user_id=userId,
                  details={"reason": "user_not_found"}, severity="warning")
        return jsonify({"error": "Invalid User ID or password. Please check your credentials."}), 401

    if user.get("password") != password:
        audit_log("LOGIN_FAILED", user_id=userId,
                  details={"reason": "wrong_password"}, severity="warning")
        return jsonify({"error": "Invalid credentials. Please check your User ID and password."}), 401

    role = user.get("role", "answerer")
    
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
        if status_reason == "validity_expired":
            error_msg = "Your account validity has expired. Please contact your administrator."
        elif status_reason in ("security_violation_screenshot", "security_violation_recording"):
            error_msg = "Your account has been blocked due to security violations (screenshot/screen recording). Please contact the administrator to unblock your account."
        else:
            error_msg = "Your account is deactivated. Please contact your administrator to regain access."
        
        audit_log("LOGIN_FAILED", user_id=userId, details={"reason": "account_blocked", "statusReason": status_reason}, severity="warning")
        return jsonify({"error": error_msg, "blocked": True, "statusReason": status_reason}), 403

    # Check Organization Status for non-superadmin
    tenant_id = user.get("tenantId") or DEFAULT_TENANT_ID
    if role != "super_admin" and tenant_id != "global":
        org = db.organizations.find_one({"tenantId": tenant_id})
        if org and org.get("status") in ("inactive", "suspended"):
            return jsonify({
                "error": f"Your organization '{org.get('name', tenant_id)}' is currently inactive. Please contact the Super Administrator.",
                "blocked": True,
            }), 403

    db.users.update_one({"_id": user["_id"]}, {"$set": {"lastLoginAt": datetime.utcnow()}})

    # Fetch tenant branding object
    tenant_info = get_tenant_branding(tenant_id)

    # Issue a short-lived security session token for the watermark system
    session_id = str(uuid.uuid4())
    session_expires = datetime.utcnow() + timedelta(hours=settings.SESSION_TTL_HOURS)
    try:
        db.security_sessions.insert_one({
            "sessionId": session_id,
            "userId": userId,
            "tenantId": tenant_id,
            "createdAt": datetime.utcnow(),
            "expiresAt": session_expires,
            "active": True,
        })
    except Exception:
        pass  # Non-critical — watermark will fall back to local UUID

    audit_log("LOGIN_SUCCESS", user_id=userId, details={"role": role, "tenantId": tenant_id, "sessionId": session_id})

    res_user = {
        "id":        str(user["_id"]),
        "userId":    user.get("userId"),
        "name":      user.get("name"),
        "email":     user.get("email"),
        "role":      user.get("role"),
        "tenantId":  tenant_id,
        "tenant":    tenant_info,
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
