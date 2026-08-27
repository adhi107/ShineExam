"""
backend/utils/security.py
─────────────────────────
Reusable security utilities for the Shine Exam Flask backend.

Contents:
  1. require_auth(f)       — decorator: validates X-User-Id + X-User-Role headers
  2. require_role(*roles)  — decorator: RBAC, must be used after require_auth
  3. rate_limit(...)       — decorator: simple in-memory IP-based rate limiter
  4. audit_log(...)        — writes to MongoDB audit_logs collection
  5. add_security_headers  — adds standard HTTP security headers to a response

IMPORTANT SECURITY NOTES:
  • Passwords are stored and compared in plain text in this codebase. This is a
    CRITICAL vulnerability. Migrate to bcrypt/argon2 before production.
  • The auth headers (X-User-Id, X-User-Role) are not cryptographically signed.
    For production, replace with signed JWTs.
  • The in-memory rate limiter is per-process. In multi-worker deployments,
    use Redis-backed rate limiting (e.g., flask-limiter + Redis).
"""

import os
import threading
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from functools import wraps

from flask import request, jsonify, g
from config.db import get_db


# ─────────────────────────────────────────────────────────────
# 1.  AUTHENTICATION DECORATOR
# ─────────────────────────────────────────────────────────────

def require_auth(f):
    """
    Validate the X-User-Id and X-User-Role request headers against the DB.
    Sets g.current_user on success so downstream handlers can access user data.

    Usage:
        @some_blueprint.get("/sensitive")
        @require_auth
        def sensitive_endpoint():
            user = g.current_user  # full MongoDB user document
            ...
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = request.headers.get("X-User-Id", "").strip()
        user_role = request.headers.get("X-User-Role", "").strip()

        if not user_id or not user_role:
            return jsonify({"error": "Authentication required"}), 401

        try:
            db = get_db()
            user = db.users.find_one({"userId": user_id, "role": user_role})
        except Exception:
            return jsonify({"error": "Authentication service unavailable"}), 503

        if not user:
            return jsonify({"error": "Invalid credentials or insufficient permissions"}), 401

        if not user.get("isActive", True):
            return jsonify({"error": "Account is inactive"}), 403

        # Make user available to the route handler
        g.current_user = user
        return f(*args, **kwargs)

    return decorated


# ─────────────────────────────────────────────────────────────
# 2.  ROLE-BASED ACCESS CONTROL DECORATOR
# ─────────────────────────────────────────────────────────────

def require_role(*roles):
    """
    Restrict endpoint to users with specific roles.
    Must be applied AFTER @require_auth (g.current_user must be set).

    Usage:
        @bp.get("/admin-only")
        @require_auth
        @require_role("admin")
        def admin_only():
            ...
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            current_user = getattr(g, "current_user", None)
            if not current_user:
                return jsonify({"error": "Authentication required"}), 401
            if current_user.get("role") not in roles:
                return jsonify({"error": "Insufficient permissions"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


# ─────────────────────────────────────────────────────────────
# 3.  IN-MEMORY RATE LIMITER
# ─────────────────────────────────────────────────────────────

_rate_limit_store: dict = defaultdict(list)
_rate_limit_lock = threading.Lock()


def rate_limit(max_calls: int = 10, period_seconds: int = 60):
    """
    Simple sliding-window rate limiter keyed by client IP.

    Usage:
        @auth_bp.post("/login")
        @rate_limit(max_calls=10, period_seconds=60)
        def login():
            ...

    NOTE: In-memory only — resets when the process restarts.
          Use flask-limiter + Redis for production multi-worker deployments.
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            client_ip = (
                request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
                or request.remote_addr
                or "unknown"
            )
            key = f"{f.__name__}:{client_ip}"
            now = time.monotonic()

            with _rate_limit_lock:
                # Drop timestamps outside the sliding window
                _rate_limit_store[key] = [
                    t for t in _rate_limit_store[key]
                    if now - t < period_seconds
                ]

                if len(_rate_limit_store[key]) >= max_calls:
                    return jsonify({
                        "error": "Too many requests. Please try again later.",
                        "retryAfterSeconds": period_seconds,
                    }), 429

                _rate_limit_store[key].append(now)

            return f(*args, **kwargs)
        return decorated
    return decorator


# ─────────────────────────────────────────────────────────────
# 4.  AUDIT LOGGER
# ─────────────────────────────────────────────────────────────

def audit_log(
    action: str,
    user_id: str = "",
    details: dict | None = None,
    severity: str = "info",
) -> None:
    """
    Write an audit log entry to the MongoDB `audit_logs` collection.

    Args:
        action   : Short string identifying the event (e.g. "LOGIN_SUCCESS")
        user_id  : The userId performing the action
        details  : Optional dict with additional context
        severity : "info" | "warning" | "critical"

    Usage:
        audit_log("EXAM_SUBMIT", user_id="john.doe", details={"examId": "abc123"})
        audit_log("LOGIN_FAILED", user_id="john.doe", severity="warning")
    """
    try:
        db = get_db()
        log_entry = {
            "action": action,
            "userId": user_id,
            "severity": severity,
            "details": details or {},
            "ip": (
                request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
                or request.remote_addr
                or "unknown"
            ) if request else "system",
            "userAgent": request.headers.get("User-Agent", "") if request else "",
            "timestamp": datetime.utcnow(),
        }
        db.audit_logs.insert_one(log_entry)
    except Exception:
        # Never let audit logging break the main request
        pass


# ─────────────────────────────────────────────────────────────
# 5.  SECURITY RESPONSE HEADERS
# ─────────────────────────────────────────────────────────────

def add_security_headers(response):
    """
    Add standard HTTP security headers to a Flask response.
    Call this from an after_request hook or per-response.

    Usage (in a blueprint or app):
        @app.after_request
        def security_headers(response):
            return add_security_headers(response)
    """
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    response.headers["Pragma"] = "no-cache"
    # Content Security Policy — adjust as needed for your CDN / assets
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: blob:; "
        "connect-src 'self';"
    )
    return response
