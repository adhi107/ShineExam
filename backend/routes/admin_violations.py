"""
backend/routes/admin_violations.py
───────────────────────────────────
Endpoints for Admin Violations Dashboard:
- List all candidates with security violations
- Aggregated violation counts (how many times violated)
- Detailed incident timeline per student
- One-click unblock/block capability
"""

from datetime import datetime
from bson import ObjectId
from flask import Blueprint, jsonify, request
from config.db import get_db
from utils.json import to_jsonable
from utils.security import audit_log

admin_violations_bp = Blueprint("admin_violations", __name__)


@admin_violations_bp.get("")
@admin_violations_bp.get("/")
def get_violations():
    """
    Fetch all candidates who have recorded security violations or are suspended.
    Aggregates:
    - Candidate Name, User ID, Email
    - Violation types (Screenshot, Screen Recording, Window Blur, etc.)
    - Violation count (total times triggered from audit_logs + DB)
    - Last incident timestamp
    - Current account status (Active vs Suspended)
    """
    db = get_db()

    # Find users who are marked with security violation or have audit log security actions
    violation_users = list(db.users.find({
        "$or": [
            {"statusReason": {"$regex": "security_violation"}},
            {"blockedDueTo": {"$exists": True, "$ne": None}},
            {"isActive": False},
        ],
        "role": "answerer"
    }, {"password": 0}))

    # Also find all userIds that have security violation actions in audit_logs
    security_actions = [
        "FRONTEND_PRINT_BLOCKED",
        "ACCOUNT_PERMANENTLY_BLOCKED_SCREENSHOT",
        "ACCOUNT_PERMANENTLY_BLOCKED_RECORDING",
        "FRONTEND_SCREEN_SHARE_DETECTED",
        "FRONTEND_TAB_HIDDEN",
    ]
    
    log_user_ids = db.audit_logs.distinct("userId", {"action": {"$in": security_actions}})
    for uid in log_user_ids:
        if uid and not any(u.get("userId") == uid for u in violation_users):
            user = db.users.find_one({"userId": uid, "role": "answerer"}, {"password": 0})
            if user:
                violation_users.append(user)

    out = []
    for u in violation_users:
        uid = u.get("userId", "")
        
        # Count total violation records in audit_logs for this user
        violation_logs = list(db.audit_logs.find({
            "userId": uid,
            "action": {"$in": security_actions}
        }).sort("timestamp", -1))
        
        violation_count = max(len(violation_logs), 1 if not u.get("isActive", True) else 0)
        
        last_log = violation_logs[0] if violation_logs else None
        last_incident = (
            last_log.get("timestamp")
            if last_log
            else u.get("statusUpdatedAt") or u.get("createdAt")
        )

        status_reason = u.get("statusReason", "")
        primary_reason = "Screenshot Attempt"
        if "recording" in status_reason or any("RECORDING" in l.get("action", "") or "SHARE" in l.get("action", "") for l in violation_logs):
            primary_reason = "Screen Recording / Sharing"
        elif "screenshot" in status_reason or any("PRINT" in l.get("action", "") or "SCREENSHOT" in l.get("action", "") for l in violation_logs):
            primary_reason = "Screenshot Attempt"
        elif "validity_expired" in status_reason:
            primary_reason = "Account Validity Expired"
        elif not u.get("isActive", True):
            primary_reason = "Security Violation"
        else:
            primary_reason = "Security Warning"

        last_incident_str = ""
        if isinstance(last_incident, datetime):
            last_incident_str = last_incident.isoformat() + "Z"
        elif last_incident:
            last_incident_str = str(last_incident)
            if not last_incident_str.endswith("Z") and not last_incident_str.endswith("+00:00"):
                last_incident_str += "Z"

        out.append({
            "id": str(u["_id"]),
            "userId": uid,
            "name": u.get("name") or uid,
            "email": u.get("email", ""),
            "isActive": u.get("isActive", True),
            "statusReason": status_reason,
            "primaryReason": primary_reason,
            "violationCount": violation_count,
            "lastIncidentAt": last_incident_str,
            "blockedDueTo": u.get("blockedDueTo", ""),
            "attemptsCount": db.results.count_documents({"userId": uid}),
        })

    # Sort by most recent incident
    out.sort(key=lambda x: x.get("lastIncidentAt", ""), reverse=True)

    # Calculate summary stats
    total_violations = sum(item["violationCount"] for item in out)
    screenshot_count = sum(1 for item in out if "Screenshot" in item["primaryReason"])
    recording_count = sum(1 for item in out if "Recording" in item["primaryReason"] or "Share" in item["primaryReason"])
    currently_blocked = sum(1 for item in out if not item["isActive"])

    return jsonify({
        "violations": to_jsonable(out),
        "stats": {
            "totalViolations": total_violations,
            "screenshotCount": screenshot_count,
            "recordingCount": recording_count,
            "currentlyBlocked": currently_blocked,
            "totalViolatedUsers": len(out),
        }
    })


@admin_violations_bp.get("/<user_id>/incidents")
def get_user_incidents(user_id: str):
    """
    Get all incident log details for a single student.
    """
    db = get_db()
    
    security_actions = [
        "FRONTEND_PRINT_BLOCKED",
        "ACCOUNT_PERMANENTLY_BLOCKED_SCREENSHOT",
        "ACCOUNT_PERMANENTLY_BLOCKED_RECORDING",
        "FRONTEND_SCREEN_SHARE_DETECTED",
        "FRONTEND_TAB_HIDDEN",
        "LOGIN_FAILED",
    ]
    
    logs = list(db.audit_logs.find({
        "userId": user_id,
        "action": {"$in": security_actions}
    }).sort("timestamp", -1).limit(50))

    incidents = []
    for log in logs:

        raw_ts = log.get("timestamp")
        ts_str = ""
        if isinstance(raw_ts, datetime):
            ts_str = raw_ts.isoformat() + "Z"
        elif raw_ts:
            ts_str = str(raw_ts)
            if not ts_str.endswith("Z") and not ts_str.endswith("+00:00"):
                ts_str += "Z"

        incidents.append({
            "id": str(log["_id"]),
            "action": log.get("action"),
            "severity": log.get("severity", "warning"),
            "timestamp": ts_str,
            "ip": log.get("ip", "Unknown"),
            "userAgent": log.get("userAgent", ""),
            "details": log.get("details", {}),
        })



    return jsonify({"incidents": to_jsonable(incidents)})


@admin_violations_bp.put("/<user_id>/unblock")
def unblock_violation_user(user_id: str):
    """
    Unblock a candidate directly from the Violations dashboard.
    """
    db = get_db()
    try:
        q = {"_id": ObjectId(user_id)}
    except Exception:
        q = {"userId": user_id}

    user = db.users.find_one(q)
    if not user:
        return jsonify({"error": "User not found"}), 404

    db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "isActive": True,
                "statusReason": "unblocked_by_admin",
                "blockedDueTo": None,
                "statusUpdatedAt": datetime.utcnow()
            }
        }
    )

    audit_log(
        action="ADMIN_UNBLOCKED_STUDENT_VIOLATION",
        user_id=user.get("userId"),
        details={"unblockedAt": datetime.utcnow().isoformat()},
        severity="info"
    )

    return jsonify({
        "message": f"Successfully unblocked {user.get('name') or user.get('userId')}",
        "userId": user.get("userId"),
        "isActive": True
    })
