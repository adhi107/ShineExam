"""
backend/routes/security_routes.py
──────────────────────────────────
Security-related API endpoints for the Shine Exam portal.

Endpoints:
  POST /security/session     — Issue a short-lived session token (for watermark ID)
  POST /security/audit       — Receive frontend security events for audit logging
  GET  /security/session/validate — Check if a session token is still valid

These endpoints complement the frontend security module: the session token is
used as the unique watermark ID, tying screenshots back to specific sessions.
"""

import uuid
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from config.db import get_db
from config.settings import settings
from utils.security import rate_limit, audit_log

security_bp = Blueprint("security", __name__)


# ─────────────────────────────────────────────────────────────
# POST /security/session
# ─────────────────────────────────────────────────────────────
@security_bp.post("/session")
@rate_limit(max_calls=20, period_seconds=60)
def create_session():
    """
    Issue a short-lived session token tied to a userId.

    Request body: { "userId": "john.doe" }

    Response: { "sessionId": "<uuid>", "expiresAt": "<ISO datetime>" }

    The sessionId is embedded in the DynamicWatermark so every screenshot
    can be traced back to a specific user session and point in time.
    """
    payload = request.get_json(silent=True) or {}
    user_id = str(payload.get("userId", "")).strip()

    if not user_id:
        return jsonify({"error": "userId is required"}), 400

    session_id = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(hours=settings.SESSION_TTL_HOURS)

    try:
        db = get_db()
        db.security_sessions.insert_one({
            "sessionId": session_id,
            "userId": user_id,
            "createdAt": datetime.utcnow(),
            "expiresAt": expires_at,
            "active": True,
        })

        # Audit log the session creation
        audit_log(
            action="SESSION_CREATED",
            user_id=user_id,
            details={"sessionId": session_id},
        )
    except Exception:
        # If DB is down, return a locally-generated UUID so the watermark still works
        pass

    return jsonify({
        "sessionId": session_id,
        "expiresAt": expires_at.isoformat() + "Z",
    })


# ─────────────────────────────────────────────────────────────
# GET /security/session/validate
# ─────────────────────────────────────────────────────────────
@security_bp.get("/session/validate")
def validate_session():
    """
    Check whether a session token is still valid.

    Query params: ?sessionId=<uuid>&userId=<userId>

    Response: { "valid": true/false, "expiresAt": "<ISO datetime>" }
    """
    session_id = request.args.get("sessionId", "").strip()
    user_id = request.args.get("userId", "").strip()

    if not session_id or not user_id:
        return jsonify({"valid": False, "reason": "Missing parameters"}), 400

    try:
        db = get_db()
        session = db.security_sessions.find_one({
            "sessionId": session_id,
            "userId": user_id,
            "active": True,
            "expiresAt": {"$gt": datetime.utcnow()},
        })

        if session:
            return jsonify({
                "valid": True,
                "expiresAt": session["expiresAt"].isoformat() + "Z",
            })
        else:
            return jsonify({"valid": False, "reason": "Session expired or not found"})

    except Exception:
        # If DB unavailable, don't block the user
        return jsonify({"valid": True, "reason": "Validation service temporarily unavailable"})


# ─────────────────────────────────────────────────────────────
# POST /security/audit
# ─────────────────────────────────────────────────────────────
@security_bp.post("/audit")
@rate_limit(max_calls=60, period_seconds=60)
def record_audit_event():
    """
    Receive security events from the frontend for audit logging.

    Request body:
    {
        "userId": "john.doe",
        "sessionId": "<uuid>",
        "event": "SCREEN_SHARE_DETECTED" | "TAB_HIDDEN" | "COPY_ATTEMPT" | ...,
        "context": { ... }   // optional additional data
    }

    Response: { "logged": true }

    This allows the backend to maintain a server-side record of security
    events that occurred on the frontend, even if the user clears local storage.
    """
    payload = request.get_json(silent=True) or {}
    user_id = str(payload.get("userId", "")).strip()
    session_id = str(payload.get("sessionId", "")).strip()
    event = str(payload.get("event", "UNKNOWN_EVENT")).strip()
    context = payload.get("context", {})

    # Basic validation — don't trust client-provided event names blindly
    allowed_events = {
        "SCREEN_SHARE_DETECTED",
        "SCREEN_SHARE_STOPPED",
        "TAB_HIDDEN",
        "TAB_VISIBLE",
        "COPY_BLOCKED",
        "PRINT_BLOCKED",
        "CONTEXT_MENU_BLOCKED",
        "DRAG_BLOCKED",
        "KEYBOARD_SHORTCUT_BLOCKED",
        "PAGE_UNLOAD",
        "WATERMARK_RENDERED",
    }

    if event not in allowed_events:
        # Log unknown events with warning severity but don't error
        event = f"UNKNOWN:{event[:50]}"

    audit_log(
        action=f"FRONTEND_{event}",
        user_id=user_id,
        details={"sessionId": session_id, "context": context},
        severity="warning" if "SHARE" in event or "COPY" in event else "info",
    )

    return jsonify({"logged": True})


# ─────────────────────────────────────────────────────────────
# POST /security/session/invalidate
# ─────────────────────────────────────────────────────────────
@security_bp.post("/session/invalidate")
@rate_limit(max_calls=20, period_seconds=60)
def invalidate_session():
    """
    Invalidate a session token on logout.

    Request body: { "userId": "john.doe", "sessionId": "<uuid>" }
    """
    payload = request.get_json(silent=True) or {}
    user_id = str(payload.get("userId", "")).strip()
    session_id = str(payload.get("sessionId", "")).strip()

    if not user_id or not session_id:
        return jsonify({"error": "userId and sessionId required"}), 400

    try:
        db = get_db()
        db.security_sessions.update_one(
            {"sessionId": session_id, "userId": user_id},
            {"$set": {"active": False, "invalidatedAt": datetime.utcnow()}},
        )
        audit_log(
            action="SESSION_INVALIDATED",
            user_id=user_id,
            details={"sessionId": session_id},
        )
    except Exception:
        pass

    return jsonify({"invalidated": True})


# ─────────────────────────────────────────────────────────────
# POST /security/violation/block
# ─────────────────────────────────────────────────────────────
@security_bp.post("/violation/block")
def block_user_on_violation():
    """
    Handle a screenshot / screen recording violation.
    If screenshotAllowedAttempts > 1, issue a warning for the first N-1 attempts.
    On the Nth attempt, permanently block the account.
    """
    payload = request.get_json(silent=True) or {}
    user_id = str(payload.get("userId", "")).strip()
    reason = str(payload.get("reason", "screenshot")).strip()
    session_id = str(payload.get("sessionId", "")).strip()

    if not user_id:
        return jsonify({"error": "userId required"}), 400

    db = get_db()

    # Read configured threshold
    settings = db.system_settings.find_one({"type": "security_config"}) or {}
    allowed_attempts = max(1, int(settings.get("screenshotAllowedAttempts", 1)))
    strict_lock = bool(settings.get("strictScreenshotLock", True))

    status_reason = "security_violation_screenshot" if reason == "screenshot" else "security_violation_recording"

    # Count previous violations of this type for this user
    previous_violations = db.security_violations.count_documents({
        "userId": user_id,
        "type": {"$in": ["screenshot", "recording"]},
    })

    # Record this violation event regardless
    db.security_violations.insert_one({
        "userId": user_id,
        "type": reason,
        "sessionId": session_id,
        "attemptNumber": previous_violations + 1,
        "recordedAt": datetime.utcnow(),
    })

    current_attempt = previous_violations + 1

    # If strict lock is disabled, just warn — never block
    if not strict_lock:
        audit_log(
            action=f"VIOLATION_WARNED_{reason.upper()}",
            user_id=user_id,
            details={"sessionId": session_id, "attempt": current_attempt, "mode": "warning_only"},
            severity="warning"
        )
        return jsonify({
            "blocked": False,
            "warned": True,
            "attempt": current_attempt,
            "allowedAttempts": allowed_attempts,
            "remainingAttempts": max(0, allowed_attempts - current_attempt),
            "message": f"Screenshot attempt {current_attempt} recorded. Strict lock is disabled."
        })

    # Check if threshold is exceeded
    if current_attempt < allowed_attempts:
        remaining = allowed_attempts - current_attempt
        audit_log(
            action=f"VIOLATION_WARNING_{reason.upper()}",
            user_id=user_id,
            details={"sessionId": session_id, "attempt": current_attempt, "remaining": remaining},
            severity="warning"
        )
        return jsonify({
            "blocked": False,
            "warned": True,
            "attempt": current_attempt,
            "allowedAttempts": allowed_attempts,
            "remainingAttempts": remaining,
            "message": f"Warning {current_attempt} of {allowed_attempts - 1}. Account will be blocked on attempt {allowed_attempts}."
        })

    # Threshold reached — permanently block the account
    db.users.update_many(
        {"$or": [{"userId": user_id}, {"naxUnid": user_id}]},
        {"$set": {
            "isActive": False,
            "statusReason": status_reason,
            "statusUpdatedAt": datetime.utcnow(),
            "blockedDueTo": f"Permanent security suspension: {current_attempt} unauthorized screenshot/screen capture attempts."
        }}
    )

    # Invalidate active security sessions
    db.security_sessions.update_many(
        {"userId": user_id},
        {"$set": {"active": False, "invalidatedAt": datetime.utcnow()}}
    )

    # Immediately terminate any in-progress exam attempts
    db.attempts.update_many(
        {"userId": user_id, "status": {"$ne": "submitted"}},
        {"$set": {
            "status": "terminated_security_violation",
            "terminatedAt": datetime.utcnow(),
            "terminationReason": f"Attempt {current_attempt}: Screenshot / screen capture violation detected during exam"
        }}
    )

    audit_log(
        action=f"ACCOUNT_PERMANENTLY_BLOCKED_{reason.upper()}",
        user_id=user_id,
        details={"sessionId": session_id, "reason": reason, "statusReason": status_reason, "attempt": current_attempt},
        severity="critical"
    )

    return jsonify({
        "blocked": True,
        "userId": user_id,
        "reason": status_reason,
        "attempt": current_attempt,
        "message": "Account has been permanently blocked due to repeated security violations. Please contact your administrator to unblock."
    })

