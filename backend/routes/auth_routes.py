import re
from datetime import datetime
from flask import Blueprint, jsonify, request
from config.db import get_db
from utils.json import to_jsonable
from utils.validators import require_fields

auth_bp = Blueprint("auth", __name__)

@auth_bp.post("/login")
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
        return jsonify({"error": "Invalid User ID or role"}), 401
    if user.get("password") != password:
        return jsonify({"error": "Invalid credentials. Please check your User ID and password."}), 401
    
    valid_until = user.get("validUntil")
    if role == "answerer" and valid_until and valid_until < datetime.utcnow():
        db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"isActive": False, "statusReason": "validity_expired", "statusUpdatedAt": datetime.utcnow()}}
        )
        return jsonify({"error": "Your account validity has expired. Please contact your administrator."}), 403

    if role == "answerer" and not user.get("isActive", True):
        return jsonify({"error": "Your account is inactive. Please contact your administrator."}), 403

    db.users.update_one({"_id": user["_id"]}, {"$set": {"lastLoginAt": datetime.utcnow()}})

    res_user = {
        "id":     str(user["_id"]),
        "userId": user.get("userId"),
        "name":   user.get("name"),
        "email":  user.get("email"),
        "role":   user.get("role"),
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
