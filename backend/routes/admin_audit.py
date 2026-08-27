"""
backend/routes/admin_audit.py
──────────────────────────────
Audit Logs management endpoints:
- View all system, auth, and security audit logs
- Filter by action category, severity, user, IP, date range
- Export audit logs to CSV
- Summary metrics
"""

import io
import csv
from datetime import datetime
from flask import Blueprint, jsonify, request, send_file
from config.db import get_db
from utils.json import to_jsonable

admin_audit_bp = Blueprint("admin_audit", __name__)


@admin_audit_bp.get("")
@admin_audit_bp.get("/")
def get_audit_logs():
    """
    Fetch paginated and filtered audit logs.
    Query parameters:
    - search (matches userId, ip, action)
    - severity (info, warning, critical)
    - category (all, auth, security, exam, admin)
    - startDate (YYYY-MM-DD)
    - endDate (YYYY-MM-DD)
    - page, limit
    """
    db = get_db()

    search = (request.args.get("search") or "").strip()
    severity = (request.args.get("severity") or "all").strip().lower()
    category = (request.args.get("category") or "all").strip().lower()
    start_date = (request.args.get("startDate") or "").strip()
    end_date = (request.args.get("endDate") or "").strip()
    page = max(1, int(request.args.get("page", 1)))
    limit = min(200, max(10, int(request.args.get("limit", 50))))

    query = {}

    if severity != "all":
        query["severity"] = severity

    if category == "auth":
        query["action"] = {"$regex": "LOGIN|LOGOUT|SESSION|PASSWORD"}
    elif category == "security":
        query["action"] = {"$regex": "BLOCKED|SECURITY|PRINT|SCREEN|TAB|COPY"}
    elif category == "exam":
        query["action"] = {"$regex": "EXAM|ATTEMPT|SUBMIT"}
    elif category == "admin":
        query["action"] = {"$regex": "ADMIN|USER_CREATED|TEST_CREATED"}

    if search:
        query["$or"] = [
            {"userId": {"$regex": search, "$options": "i"}},
            {"action": {"$regex": search, "$options": "i"}},
            {"ip": {"$regex": search, "$options": "i"}},
        ]

    if start_date or end_date:
        try:
            dt_start = datetime.fromisoformat(start_date) if start_date else None
            dt_end_raw = datetime.fromisoformat(end_date) if end_date else None
            dt_end = datetime(dt_end_raw.year, dt_end_raw.month, dt_end_raw.day, 23, 59, 59) if dt_end_raw else None

            date_subqueries = []
            
            dt_cond = {}
            if dt_start:
                dt_cond["$gte"] = dt_start
            if dt_end:
                dt_cond["$lte"] = dt_end
            if dt_cond:
                date_subqueries.append({"timestamp": dt_cond})

            str_cond = {}
            if start_date:
                str_cond["$gte"] = start_date + "T00:00:00"
            if end_date:
                str_cond["$lte"] = end_date + "T23:59:59"
            if str_cond:
                date_subqueries.append({"timestamp": str_cond})

            if len(date_subqueries) == 1:
                query.update(date_subqueries[0])
            elif len(date_subqueries) > 1:
                if "$or" in query:
                    query["$and"] = [{"$or": query.pop("$or")}, {"$or": date_subqueries}]
                else:
                    query["$or"] = date_subqueries
        except Exception:
            pass

    total = db.audit_logs.count_documents(query)

    logs_cursor = db.audit_logs.find(query).sort("timestamp", -1).skip((page - 1) * limit).limit(limit)
    
    logs = []
    for doc in logs_cursor:
        logs.append({
            "id": str(doc["_id"]),
            "action": doc.get("action", "UNKNOWN"),
            "userId": doc.get("userId", "system"),
            "severity": doc.get("severity", "info"),
            "ip": doc.get("ip", "Unknown"),
            "userAgent": doc.get("userAgent", ""),
            "details": doc.get("details", {}),
            "timestamp": doc.get("timestamp").isoformat() if isinstance(doc.get("timestamp"), datetime) else str(doc.get("timestamp")),
        })

    # Aggregated Stats
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    total_logs = db.audit_logs.count_documents({})
    logins_today = db.audit_logs.count_documents({
        "action": {"$in": ["LOGIN_SUCCESS", "FRONTEND_LOGIN_SUCCESS"]},
        "timestamp": {"$gte": today_start}
    })
    security_alerts = db.audit_logs.count_documents({
        "action": {"$regex": "BLOCKED|SECURITY|PRINT|SHARE"}
    })
    critical_events = db.audit_logs.count_documents({"severity": "critical"})

    return jsonify({
        "logs": to_jsonable(logs),
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": (total + limit - 1) // limit if limit else 1,
        },
        "stats": {
            "totalLogs": total_logs,
            "loginsToday": logins_today,
            "securityAlerts": security_alerts,
            "criticalEvents": critical_events,
        }
    })


@admin_audit_bp.get("/export")
def export_audit_logs():
    """
    Export filtered audit logs as a downloadable CSV file.
    """
    db = get_db()
    logs_cursor = db.audit_logs.find({}).sort("timestamp", -1).limit(5000)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp (UTC)", "Event / Action", "User ID", "Severity", "IP Address", "User Agent", "Details Context"])

    for doc in logs_cursor:
        ts = doc.get("timestamp").strftime("%Y-%m-%d %H:%M:%S") if isinstance(doc.get("timestamp"), datetime) else str(doc.get("timestamp"))
        writer.writerow([
            ts,
            doc.get("action", ""),
            doc.get("userId", ""),
            doc.get("severity", "info").upper(),
            doc.get("ip", ""),
            doc.get("userAgent", ""),
            str(doc.get("details", {})),
        ])

    output.seek(0)
    mem_file = io.BytesIO(output.getvalue().encode("utf-8-sig"))
    filename = f"Shine_Exam_Audit_Logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"

    return send_file(
        mem_file,
        mimetype="text/csv",
        as_attachment=True,
        download_name=filename,
    )
