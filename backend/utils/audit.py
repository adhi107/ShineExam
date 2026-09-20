"""
backend/utils/audit.py
──────────────────────
Centralized audit event logging helper for administrator and candidate actions.
"""

from datetime import datetime
from flask import request, has_request_context
from config.db import get_db
from utils.tenant import get_request_tenant_id, DEFAULT_TENANT_ID


def log_audit_event(action: str, details: dict = None, severity: str = "info", category: str = "admin", user_id: str = None):
    """
    Log an audit event to the db.audit_logs collection.
    Automatically captures request context (IP, user agent, tenant) if available.
    """
    try:
        db = get_db()
        now = datetime.utcnow().isoformat()
        tenant_id = get_request_tenant_id() or DEFAULT_TENANT_ID
        ip_addr = "127.0.0.1"
        req_path = ""
        uid = user_id or "system_admin"

        if has_request_context():
            ip_addr = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()
            req_path = request.path
            if not user_id:
                uid = request.headers.get("X-User-Id") or request.args.get("userId") or "admin"

        doc = {
            "tenantId": tenant_id,
            "action": action.upper(),
            "category": category,
            "severity": severity,
            "userId": uid,
            "ip": ip_addr,
            "path": req_path,
            "details": details or {},
            "timestamp": now,
            "createdAt": now,
        }
        db.audit_logs.insert_one(doc)
    except Exception as e:
        # Never crash the primary request if logging encounters a transient DB issue
        print(f"[Audit Log Warning] Failed to insert audit log: {e}")
