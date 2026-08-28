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

# All audit-log actions that count as a security event
SECURITY_ACTIONS = [
    "ACCOUNT_PERMANENTLY_BLOCKED_SCREENSHOT",
    "ACCOUNT_PERMANENTLY_BLOCKED_RECORDING",
    "VIOLATION_WARNING_SCREENSHOT",
    "VIOLATION_WARNING_RECORDING",
    "VIOLATION_WARNED_SCREENSHOT",
    "VIOLATION_WARNED_RECORDING",
    "FRONTEND_SCREEN_SHARE_DETECTED",
    "FRONTEND_PRINT_BLOCKED",
    "FRONTEND_KEYBOARD_SHORTCUT_BLOCKED",
]

# Actions that count specifically as screenshot-type violations
SCREENSHOT_ACTIONS = {
    "ACCOUNT_PERMANENTLY_BLOCKED_SCREENSHOT",
    "VIOLATION_WARNING_SCREENSHOT",
    "VIOLATION_WARNED_SCREENSHOT",
    "FRONTEND_PRINT_BLOCKED",
    "FRONTEND_KEYBOARD_SHORTCUT_BLOCKED",
}

# Actions that count specifically as recording-type violations
RECORDING_ACTIONS = {
    "ACCOUNT_PERMANENTLY_BLOCKED_RECORDING",
    "VIOLATION_WARNING_RECORDING",
    "VIOLATION_WARNED_RECORDING",
    "FRONTEND_SCREEN_SHARE_DETECTED",
}


@admin_violations_bp.get("")
@admin_violations_bp.get("/")
def get_violations():
    """
    Fetch all candidates who have recorded security violations or are suspended.
    Accurately calculates Times Violated from:
    1. security_violations collection (direct violation events written by /security/violation/block)
    2. audit_logs for frontend-reported events (screenshot key blocks, screen-share detection)
    """
    db = get_db()

    # --- Collect all user IDs with any security involvement ---

    # 1. Users marked suspended with a security reason
    suspended_users = list(db.users.find({
        "$or": [
            {"statusReason": {"$regex": "security_violation"}},
            {"blockedDueTo": {"$exists": True, "$ne": None}},
        ],
        "role": "answerer"
    }, {"password": 0}))

    # 2. Users who appear in security_violations collection (the authoritative source)
    violation_user_ids = db.security_violations.distinct("userId")

    # 3. Users who appear in audit_logs with security actions
    log_user_ids = db.audit_logs.distinct("userId", {"action": {"$in": SECURITY_ACTIONS}})

    # Merge all unique user IDs
    all_user_ids = set(violation_user_ids) | set(log_user_ids)
    for u in suspended_users:
        uid = u.get("userId")
        if uid:
            all_user_ids.add(uid)

    # Build a lookup map: userId -> user document
    user_map: dict = {}
    for u in suspended_users:
        uid = u.get("userId")
        if uid:
            user_map[uid] = u

    for uid in all_user_ids:
        if uid and uid not in user_map:
            user = db.users.find_one({"userId": uid, "role": "answerer"}, {"password": 0})
            if user:
                user_map[uid] = user

    out = []
    for uid, u in user_map.items():

        # === Accurate violation count from security_violations collection ===
        sv_count = db.security_violations.count_documents({"userId": uid})

        # === Supplement with audit_log events not already in security_violations ===
        # (e.g. frontend-reported events like SCREEN_SHARE_DETECTED that bypass the block endpoint)
        audit_screenshot_count = db.audit_logs.count_documents({
            "userId": uid,
            "action": {"$in": list(SCREENSHOT_ACTIONS)}
        })
        audit_recording_count = db.audit_logs.count_documents({
            "userId": uid,
            "action": {"$in": list(RECORDING_ACTIONS)}
        })

        # The security_violations collection already stores block/warn events for screenshot/recording.
        # Use it as primary source; audit log counts supplement frontend-only events.
        # To avoid double-counting block events already in security_violations:
        sv_screenshot_count = db.security_violations.count_documents({
            "userId": uid,
            "type": {"$in": ["screenshot"]}
        })
        sv_recording_count = db.security_violations.count_documents({
            "userId": uid,
            "type": {"$in": ["recording"]}
        })

        # Frontend-only events not tracked in security_violations
        extra_screenshot = max(0, audit_screenshot_count - sv_screenshot_count)
        extra_recording = max(0, audit_recording_count - sv_recording_count)

        total_violation_count = sv_count + extra_screenshot + extra_recording

        # === Find most recent incident timestamp ===
        # Check security_violations collection first (most accurate)
        last_sv = db.security_violations.find_one(
            {"userId": uid},
            sort=[("recordedAt", -1)]
        )

        # Also check audit_logs
        last_log = db.audit_logs.find_one(
            {"userId": uid, "action": {"$in": SECURITY_ACTIONS}},
            sort=[("timestamp", -1)]
        )

        # Pick the more recent of the two
        def ts_value(doc, field):
            if not doc:
                return None
            val = doc.get(field)
            if isinstance(val, datetime):
                return val
            return None

        sv_ts = ts_value(last_sv, "recordedAt")
        log_ts = ts_value(last_log, "timestamp")

        if sv_ts and log_ts:
            last_incident = max(sv_ts, log_ts)
        elif sv_ts:
            last_incident = sv_ts
        elif log_ts:
            last_incident = log_ts
        else:
            last_incident = u.get("statusUpdatedAt") or u.get("createdAt")

        # === Determine primary reason ===
        status_reason = u.get("statusReason", "")
        if sv_recording_count > 0 or extra_recording > 0 or "recording" in status_reason:
            primary_reason = "Screen Recording / Sharing"
        elif sv_screenshot_count > 0 or extra_screenshot > 0 or "screenshot" in status_reason:
            primary_reason = "Screenshot Attempt"
        elif "validity_expired" in status_reason:
            primary_reason = "Account Validity Expired"
        elif not u.get("isActive", True):
            primary_reason = "Security Violation"
        else:
            primary_reason = "Security Warning"

        # === Format timestamp ===
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
            "violationCount": total_violation_count,
            "screenshotCount": sv_screenshot_count + extra_screenshot,
            "recordingCount": sv_recording_count + extra_recording,
            "lastIncidentAt": last_incident_str,
            "blockedDueTo": u.get("blockedDueTo", ""),
            "attemptsCount": db.results.count_documents({"userId": uid}),
        })

    # Sort by most recent incident
    out.sort(key=lambda x: x.get("lastIncidentAt", ""), reverse=True)

    # Summary stats — accurate totals
    total_violations = sum(item["violationCount"] for item in out)
    screenshot_total = sum(item["screenshotCount"] for item in out)
    recording_total = sum(item["recordingCount"] for item in out)
    currently_blocked = sum(1 for item in out if not item["isActive"])

    return jsonify({
        "violations": to_jsonable(out),
        "stats": {
            "totalViolations": total_violations,
            "screenshotCount": screenshot_total,
            "recordingCount": recording_total,
            "currentlyBlocked": currently_blocked,
            "totalViolatedUsers": len(out),
        }
    })


@admin_violations_bp.get("/<user_id>/incidents")
def get_user_incidents(user_id: str):
    """
    Get all incident log details for a single student, combining:
    - security_violations collection (direct capture events)
    - audit_logs (all security actions)
    Deduplicates and sorts chronologically descending.
    """
    db = get_db()

    incidents = []

    # 1. Load from security_violations (authoritative source for block/warn events)
    sv_docs = list(db.security_violations.find(
        {"userId": user_id}
    ).sort("recordedAt", -1).limit(100))

    for sv in sv_docs:
        raw_ts = sv.get("recordedAt")
        ts_str = ""
        if isinstance(raw_ts, datetime):
            ts_str = raw_ts.isoformat() + "Z"
        elif raw_ts:
            ts_str = str(raw_ts)
            if not ts_str.endswith("Z"):
                ts_str += "Z"

        vtype = sv.get("type", "screenshot")
        action = f"SECURITY_VIOLATION_{vtype.upper()}"
        incidents.append({
            "id": str(sv["_id"]),
            "action": action,
            "severity": "critical",
            "timestamp": ts_str,
            "ip": sv.get("ip", "Unknown"),
            "userAgent": sv.get("userAgent", ""),
            "details": {
                "attemptNumber": sv.get("attemptNumber", 1),
                "sessionId": sv.get("sessionId", ""),
                "source": "security_violations",
            },
        })

    # 2. Load from audit_logs (supplements frontend-reported events)
    logs = list(db.audit_logs.find({
        "userId": user_id,
        "action": {"$in": SECURITY_ACTIONS}
    }).sort("timestamp", -1).limit(100))

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
            "details": {**log.get("details", {}), "source": "audit_log"},
        })

    # Deduplicate by ID then sort descending by timestamp
    seen = set()
    unique_incidents = []
    for inc in incidents:
        if inc["id"] not in seen:
            seen.add(inc["id"])
            unique_incidents.append(inc)

    unique_incidents.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

    return jsonify({"incidents": to_jsonable(unique_incidents[:100])})


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
