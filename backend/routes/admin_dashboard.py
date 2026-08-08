from flask import Blueprint, jsonify
from datetime import datetime
from config.db import get_db

admin_dashboard_bp = Blueprint("admin_dashboard", __name__)

@admin_dashboard_bp.route("/dashboard-stats", methods=["GET"])
def dashboard_stats():
    db = get_db()
    now = datetime.utcnow()
    db.users.update_many(
        {"role": "answerer", "validUntil": {"$lt": now}, "isActive": {"$ne": False}},
        {"$set": {"isActive": False, "statusReason": "validity_expired", "statusUpdatedAt": now}},
    )
    student_query = {"role": "answerer"}
    total_users = db.users.count_documents(student_query)
    active_users = db.users.count_documents({**student_query, "isActive": {"$ne": False}})
    blocked_users = db.users.count_documents({**student_query, "isActive": False})
    total_tests = db.exams.count_documents({})
    active_tests = db.exams.count_documents({"status": "active", "$and": [
        {"$or": [{"availableFrom": {"$exists": False}}, {"availableFrom": None}, {"availableFrom": {"$lte": now}}]},
        {"$or": [{"validUntil": {"$exists": False}}, {"validUntil": None}, {"validUntil": {"$gte": now}}]},
    ]})
    total_attempts = db.attempts.count_documents({})
    completed_attempts = db.results.count_documents({})
    result_rows = list(db.results.find({}, {"percentage": 1, "passed": 1, "submittedAt": 1, "userId": 1, "examId": 1}).sort("submittedAt", -1).limit(8))
    all_scores = list(db.results.find({}, {"percentage": 1, "passed": 1}))
    average_score = round(sum(float(row.get("percentage", 0)) for row in all_scores) / len(all_scores), 1) if all_scores else 0
    pass_rate = round(sum(1 for row in all_scores if row.get("passed")) / len(all_scores) * 100, 1) if all_scores else 0

    exam_ids = [row.get("examId") for row in result_rows if row.get("examId")]
    exams = {exam["_id"]: exam.get("name", "Untitled Test") for exam in db.exams.find({"_id": {"$in": exam_ids}})}
    recent_attempts = [{
        "id": str(row["_id"]), "userId": row.get("userId"),
        "testName": exams.get(row.get("examId"), "Untitled Test"),
        "percentage": float(row.get("percentage", 0)), "passed": bool(row.get("passed")),
        "submittedAt": row.get("submittedAt").isoformat() if hasattr(row.get("submittedAt"), "isoformat") else (str(row.get("submittedAt")) if row.get("submittedAt") else ""),
    } for row in result_rows]

    return jsonify({
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
