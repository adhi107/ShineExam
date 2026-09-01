from flask import Blueprint, jsonify
from bson import ObjectId
from typing import Optional
from config.db import get_db
from utils.json import to_jsonable
from utils.tenant import get_request_tenant_id, build_tenant_filter

admin_results_bp = Blueprint("admin_results", __name__)


def _merge_registration_fields(user: Optional[dict], registration: Optional[dict]) -> Optional[dict]:
    if not user and not registration:
        return None
    merged = dict(user) if user else {}
    if not registration:
        return merged

    field_map = {
        "naxUnid": "naxUnid",
        "studentName": "name",
        "studentId": "studentId",
        "email": "email",
        "collegeEmail": "collegeEmail",
        "mobile": "mobile",
        "gender": "gender",
        "courseStream": "courseStream",
        "cgpa": "cgpa",
        "sapCertification": "sapCertification",
        "collegeName": "collegeName",
    }

    for reg_key, user_key in field_map.items():
        if merged.get(user_key) in (None, ""):
            merged[user_key] = registration.get(reg_key)

    if merged.get("collegeRollNumber") in (None, "") and registration.get("studentId"):
        merged["collegeRollNumber"] = registration.get("studentId")

    return merged


def _find_user_with_profile(db, user_identifier: str) -> Optional[dict]:
    if not user_identifier:
        return None

    normalized = str(user_identifier).strip()
    normalized_email = normalized.lower()

    user = db.users.find_one({
        "$or": [
            {"userId": normalized},
            {"naxUnid": normalized},
            {"studentId": normalized},
            {"email": normalized_email},
        ]
    })

    registration = db.student_registrations.find_one({
        "$or": [
            {"naxUnid": normalized},
            {"studentId": normalized},
            {"email": normalized_email},
        ]
    })

    if user:
        return _merge_registration_fields(user, registration)

    if registration:
        synthetic_user = {
            "userId": normalized,
            "naxUnid": registration.get("naxUnid"),
            "studentId": registration.get("studentId"),
            "email": registration.get("email"),
            "name": registration.get("studentName"),
        }
        return _merge_registration_fields(synthetic_user, registration)

    return None


def _question_time_benchmarks(db, exam_id, review):
    exam_match = [{"examId": exam_id}, {"examId": str(exam_id)}]
    if isinstance(exam_id, str) and ObjectId.is_valid(exam_id):
        exam_match.append({"examId": ObjectId(exam_id)})
    cohort = list(db.results.find({"$or": exam_match}, {"questionReview": 1, "percentage": 1, "userId": 1}))
    topper = max(cohort, key=lambda row: float(row.get("percentage", 0)), default=None)
    topper_times = {str(item.get("questionId")): int(item.get("timeSpentSec", 0) or 0) for item in (topper or {}).get("questionReview", [])}
    values = {}
    for result in cohort:
        for item in result.get("questionReview", []):
            seconds = int(item.get("timeSpentSec", 0) or 0)
            if seconds > 0:
                values.setdefault(str(item.get("questionId")), []).append(seconds)
    enriched = []
    for source in review or []:
        item = dict(source)
        qid = str(item.get("questionId"))
        times = values.get(qid, [])
        item["avgTimeSec"] = round(sum(times) / len(times)) if times else 0
        item["topperTimeSec"] = topper_times.get(qid, 0)
        item["topperUserId"] = (topper or {}).get("userId", "")
        enriched.append(item)
    return enriched


@admin_results_bp.get("/overview")
def analytics_overview():
    db = get_db()
    tenant_id = get_request_tenant_id()
    tenant_filter = build_tenant_filter(tenant_id)
    
    tenant_exams = list(db.exams.find(tenant_filter, {"name": 1}))
    tenant_exam_ids = [e["_id"] for e in tenant_exams]
    tenant_exam_str_ids = [str(e["_id"]) for e in tenant_exams]
    exams = {str(row["_id"]): row.get("name", "Untitled Test") for row in tenant_exams}

    if tenant_id and tenant_id not in ("all", "global"):
        results_filter = {
            "$or": [
                {"tenantId": tenant_id},
                {"examId": {"$in": tenant_exam_ids + tenant_exam_str_ids}}
            ]
        }
    else:
        results_filter = {}

    results = list(db.results.find(results_filter))
    bands = [
        {"label": "0–20%", "min": 0, "max": 20, "count": 0},
        {"label": "21–40%", "min": 20, "max": 40, "count": 0},
        {"label": "41–60%", "min": 40, "max": 60, "count": 0},
        {"label": "61–80%", "min": 60, "max": 80, "count": 0},
        {"label": "81–100%", "min": 80, "max": 101, "count": 0},
    ]
    trend = {}
    for row in results:
        percentage = float(row.get("percentage", 0))
        for band in bands:
            if band["min"] <= percentage < band["max"]:
                band["count"] += 1
                break
        submitted = row.get("submittedAt")
        day = submitted.strftime("%d %b") if submitted and hasattr(submitted, "strftime") else "Unknown"
        trend.setdefault(day, {"attempts": 0, "score": 0})
        trend[day]["attempts"] += 1
        trend[day]["score"] += percentage

    trend_rows = [
        {"date": day, "attempts": data["attempts"], "avgScore": round(data["score"] / data["attempts"], 1)}
        for day, data in list(trend.items())[-10:]
    ]

    toppers = []
    for row in sorted(results, key=lambda item: float(item.get("percentage", 0)), reverse=True)[:10]:
        user = _find_user_with_profile(db, row.get("userId"))
        exam_id = str(row.get("examId"))
        toppers.append({
            "resultId": str(row["_id"]),
            "examId": exam_id,
            "testName": exams.get(exam_id, (db.exams.find_one({"_id": row.get("examId")}) or {}).get("name", "Untitled Test")),
            "userId": row.get("userId"),
            "userName": user.get("name", row.get("userId")) if user else row.get("userId"),
            "percentage": float(row.get("percentage", 0)),
            "marks": float(row.get("scoredMarks", 0)),
            "timeSpentSec": int(row.get("timeSpentSec", 0)),
        })

    return jsonify({"scoreBands": bands, "trend": trend_rows, "toppers": toppers})


@admin_results_bp.route("/tests", methods=["GET"])
def get_tests_with_results():
    """Get all tests with their result statistics for the active tenant."""
    db = get_db()
    tenant_id = get_request_tenant_id()
    tenant_filter = build_tenant_filter(tenant_id)
    
    exams = list(db.exams.find(tenant_filter, {"questions": 0}))
    tests_data = []
    
    for exam in exams:
        exam_id = exam["_id"]
        
        # Match both ObjectId and string examId formats
        results = list(db.results.find({"$or": [{"examId": exam_id}, {"examId": str(exam_id)}]}))
        
        total_attempts = len(results)
        if total_attempts == 0:
            tests_data.append({
                "id": str(exam_id),
                "name": exam.get("name", "Untitled Test"),
                "duration": int(exam.get("duration", 0)),
                "questions": int(exam.get("questionCount", 0)),
                "totalAttempts": 0,
                "avgScore": 0,
                "passRate": 0,
            })
            continue
        
        total_percentage = sum(float(r.get("percentage", 0)) for r in results)
        avg_score = total_percentage / total_attempts if total_attempts > 0 else 0
        
        passed_count = sum(1 for r in results if r.get("passed", False))
        pass_rate = (passed_count / total_attempts * 100) if total_attempts > 0 else 0
        
        tests_data.append({
            "id": str(exam_id),
            "name": exam.get("name", "Untitled Test"),
            "duration": int(exam.get("duration", 0)),
            "questions": int(exam.get("questionCount", 0)),
            "totalAttempts": total_attempts,
            "avgScore": round(avg_score, 2),
            "passRate": round(pass_rate, 2),
        })
    
    return jsonify({"tests": to_jsonable(tests_data)})


@admin_results_bp.route("/tests/<exam_id>/users", methods=["GET"])
def get_test_user_results(exam_id: str):
    """Get all user results for a specific test."""
    db = get_db()
    
    exam_match = [{"_id": exam_id}]
    if ObjectId.is_valid(exam_id):
        exam_match.append({"_id": ObjectId(exam_id)})
    
    exam = db.exams.find_one({"$or": exam_match})
    if not exam:
        return jsonify({"error": "Exam not found"}), 404
    
    # Match both ObjectId and str examId in results
    res_exam_match = [{"examId": exam["_id"]}, {"examId": str(exam["_id"])}, {"examId": exam_id}]
    results = list(db.results.find({"$or": res_exam_match}))
    
    sorted_results = sorted(results, key=lambda r: float(r.get("percentage", 0)), reverse=True)
    percentile_map = {}
    for idx, result in enumerate(sorted_results):
        percentile = round(((len(sorted_results) - idx) / len(sorted_results)) * 100, 1) if sorted_results else 0
        percentile_map[str(result["_id"])] = percentile
    
    user_results = []
    for result in results:
        user = _find_user_with_profile(db, result.get("userId"))
        user_name = user.get("name", result.get("userId")) if user else result.get("userId")
        
        submitted_at = None
        if result.get("submittedAt"):
            if hasattr(result.get("submittedAt"), "isoformat"):
                submitted_at = result.get("submittedAt").isoformat()
                if not submitted_at.endswith('Z'):
                    submitted_at += 'Z'
            else:
                submitted_at = str(result.get("submittedAt"))
        
        user_results.append({
            "id": str(result["_id"]),
            "userId": result.get("userId"),
            "userName": user_name,
            "percentage": float(result.get("percentage", 0)),
            "scoredMarks": float(result.get("scoredMarks", 0)),
            "totalMarks": float(result.get("totalMarks", 0)),
            "passed": bool(result.get("passed", False)),
            "submittedAt": submitted_at,
            "timeSpentSec": int(result.get("timeSpentSec", 0)),
            "percentile": percentile_map.get(str(result["_id"]), 0),
        })
    
    return jsonify({"results": to_jsonable(user_results)})


@admin_results_bp.route("/<result_id>", methods=["GET"])
def get_detailed_result(result_id: str):
    """Get detailed result including question-by-question breakdown."""
    db = get_db()
    
    res_match = [{"_id": result_id}]
    if ObjectId.is_valid(result_id):
        res_match.append({"_id": ObjectId(result_id)})
    
    result = db.results.find_one({"$or": res_match})
    if not result:
        return jsonify({"error": "Result not found"}), 404
    
    user = _find_user_with_profile(db, result.get("userId"))
    user_name = user.get("name", result.get("userId")) if user else result.get("userId")
    
    exam_id = result.get("examId")
    exam_match = [{"examId": exam_id}, {"examId": str(exam_id)}]
    if isinstance(exam_id, str) and ObjectId.is_valid(exam_id):
        exam_match.append({"examId": ObjectId(exam_id)})
    
    all_results = list(db.results.find({"$or": exam_match}))
    sorted_results = sorted(all_results, key=lambda r: float(r.get("percentage", 0)), reverse=True)
    percentile = 0
    for idx, r in enumerate(sorted_results):
        if str(r["_id"]) == str(result["_id"]):
            percentile = round(((len(sorted_results) - idx) / len(sorted_results)) * 100, 1) if sorted_results else 0
            break
    
    submitted_at = None
    if result.get("submittedAt"):
        if hasattr(result.get("submittedAt"), "isoformat"):
            submitted_at = result.get("submittedAt").isoformat()
            if not submitted_at.endswith('Z'):
                submitted_at += 'Z'
        else:
            submitted_at = str(result.get("submittedAt"))
    
    exam_doc = db.exams.find_one({"$or": [{"_id": exam_id}, {"_id": ObjectId(exam_id) if isinstance(exam_id, str) and ObjectId.is_valid(exam_id) else None}]})
    
    detailed = {
        "id": str(result["_id"]),
        "attemptId": str(result.get("attemptId", result["_id"])),
        "userId": result.get("userId"),
        "userName": user_name,
        "examName": exam_doc.get("name", "Untitled Test") if exam_doc else "Untitled Test",
        "totalMarks": float(result.get("totalMarks", 0)),
        "scoredMarks": float(result.get("scoredMarks", 0)),
        "percentage": float(result.get("percentage", 0)),
        "passed": bool(result.get("passed", False)),
        "percentile": percentile,
        "submittedAt": submitted_at,
        "timeSpentSec": int(result.get("timeSpentSec", 0)),
        "sectionWise": result.get("sectionWise", {}),
        "questionReview": _question_time_benchmarks(db, exam_id, result.get("questionReview", [])),
    }
    
    return jsonify({"result": to_jsonable(detailed)})
