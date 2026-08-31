from flask import Blueprint, jsonify
from datetime import datetime
from config.db import get_db
from utils.tenant import (
    get_request_tenant_id,
    build_tenant_filter,
    get_tenant_branding,
)

admin_dashboard_bp = Blueprint("admin_dashboard", __name__)

@admin_dashboard_bp.route("/dashboard-stats", methods=["GET"])
def dashboard_stats():
    db = get_db()
    now = datetime.utcnow()
    tenant_id = get_request_tenant_id()
    filter_q = build_tenant_filter(tenant_id)
    db.users.update_many(
        {**filter_q, "role": "answerer", "validUntil": {"$lt": now}, "isActive": {"$ne": False}},
        {"$set": {"isActive": False, "statusReason": "validity_expired", "statusUpdatedAt": now}},
    )
    student_query = {**filter_q, "role": "answerer"}
    total_users = db.users.count_documents(student_query)
    active_users = db.users.count_documents({**student_query, "isActive": {"$ne": False}})
    blocked_users = db.users.count_documents({**student_query, "isActive": False})
    total_tests = db.exams.count_documents(filter_q)
    active_tests = db.exams.count_documents({**filter_q, "status": "active", "$and": [
        {"$or": [{"availableFrom": {"$exists": False}}, {"availableFrom": None}, {"availableFrom": {"$lte": now}}]},
        {"$or": [{"validUntil": {"$exists": False}}, {"validUntil": None}, {"validUntil": {"$gte": now}}]},
    ]})
    total_attempts = db.attempts.count_documents(filter_q)
    completed_attempts = db.results.count_documents(filter_q)
    result_rows = list(db.results.find(filter_q, {"percentage": 1, "passed": 1, "submittedAt": 1, "userId": 1, "examId": 1}).sort("submittedAt", -1).limit(8))
    stats_pipeline = [
        {"$match": filter_q},
        {
            "$group": {
                "_id": None,
                "avgScore": {"$avg": "$percentage"},
                "totalCount": {"$sum": 1},
                "passedCount": {
                    "$sum": {"$cond": [{"$eq": ["$passed", True]}, 1, 0]}
                }
            }
        }
    ]
    stats_res = list(db.results.aggregate(stats_pipeline))
    if stats_res:
        st = stats_res[0]
        average_score = round(float(st.get("avgScore") or 0), 1)
        total_st = st.get("totalCount") or 0
        pass_rate = round((st.get("passedCount") or 0) / total_st * 100, 1) if total_st > 0 else 0
    else:
        average_score = 0
        pass_rate = 0

    exam_ids = [row.get("examId") for row in result_rows if row.get("examId")]
    exams = {exam["_id"]: exam.get("name", "Untitled Test") for exam in db.exams.find({"_id": {"$in": exam_ids}})}
    recent_attempts = [{
        "id": str(row["_id"]), "userId": row.get("userId"),
        "testName": exams.get(row.get("examId"), "Untitled Test"),
        "percentage": float(row.get("percentage", 0)), "passed": bool(row.get("passed")),
        "submittedAt": row.get("submittedAt").isoformat() if hasattr(row.get("submittedAt"), "isoformat") else (str(row.get("submittedAt")) if row.get("submittedAt") else ""),
    } for row in result_rows]

    tenant_branding = get_tenant_branding(tenant_id)

    return jsonify({
        "tenant": tenant_branding,
        "totalUsers": total_users,
        "activeUsers": active_users,
        "blockedUsers": blocked_users,
        "totalTests": total_tests,
        "activeTests": active_tests,
        "totalAttempts": total_attempts,
        "completedAttempts": completed_attempts,
        "averageScore": average_score,
        "passRate": pass_rate,
        "recentAttempts": recent_attempts,
    })
