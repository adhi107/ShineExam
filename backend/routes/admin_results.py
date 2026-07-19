from flask import Blueprint, jsonify
from bson import ObjectId
from typing import Optional
from config.db import get_db
from utils.json import to_jsonable

admin_results_bp = Blueprint("admin_results", __name__)


@admin_results_bp.get("/overview")
def analytics_overview():
    db=get_db();results=list(db.results.find({}));exams={str(row["_id"]):row.get("name","Untitled Test") for row in db.exams.find({}, {"name":1})}
    bands=[{"label":"0–20%","min":0,"max":20,"count":0},{"label":"21–40%","min":20,"max":40,"count":0},{"label":"41–60%","min":40,"max":60,"count":0},{"label":"61–80%","min":60,"max":80,"count":0},{"label":"81–100%","min":80,"max":101,"count":0}]
    trend={}
    for row in results:
        percentage=float(row.get("percentage",0));
        for band in bands:
            if band["min"] <= percentage < band["max"]:band["count"]+=1;break
        submitted=row.get("submittedAt");day=submitted.strftime("%d %b") if submitted else "Unknown";trend.setdefault(day,{"attempts":0,"score":0});trend[day]["attempts"]+=1;trend[day]["score"]+=percentage
    trend_rows=[{"date":day,"attempts":data["attempts"],"avgScore":round(data["score"]/data["attempts"],1)} for day,data in list(trend.items())[-10:]]
    toppers=[]
    for row in sorted(results,key=lambda item:float(item.get("percentage",0)),reverse=True)[:10]:
        user=_find_user_with_profile(db,row.get("userId"));exam_id=str(row.get("examId"));toppers.append({"resultId":str(row["_id"]),"examId":exam_id,"testName":exams.get(exam_id,"Untitled Test"),"userId":row.get("userId"),"userName":user.get("name",row.get("userId")) if user else row.get("userId"),"percentage":float(row.get("percentage",0)),"marks":float(row.get("scoredMarks",0)),"timeSpentSec":int(row.get("timeSpentSec",0))})
    return jsonify({"scoreBands":bands,"trend":trend_rows,"toppers":toppers})


def _merge_registration_fields(user: dict, registration: Optional[dict]) -> dict:
    if not registration:
        return user

    merged = dict(user)
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
    cohort=list(db.results.find({"examId":exam_id},{"questionReview":1,"percentage":1,"userId":1}))
    topper=max(cohort,key=lambda row:float(row.get("percentage",0)),default=None)
    topper_times={str(item.get("questionId")):int(item.get("timeSpentSec",0) or 0) for item in (topper or {}).get("questionReview",[])}
    values={}
    for result in cohort:
        for item in result.get("questionReview",[]):
            seconds=int(item.get("timeSpentSec",0) or 0)
            if seconds>0:values.setdefault(str(item.get("questionId")),[]).append(seconds)
    enriched=[]
    for source in review or []:
        item=dict(source);qid=str(item.get("questionId"));times=values.get(qid,[]);item["avgTimeSec"]=round(sum(times)/len(times)) if times else 0;item["topperTimeSec"]=topper_times.get(qid,0);item["topperUserId"]=(topper or {}).get("userId","");enriched.append(item)
    return enriched


@admin_results_bp.route("/tests", methods=["GET"])
def get_tests_with_results():
    """Get all tests with their result statistics."""
    db = get_db()
    
    exams = list(db.exams.find({}, {"questions": 0}))
    tests_data = []
    
    for exam in exams:
        exam_id = exam["_id"]
        
        # Load all submitted attempts for this Shine Exam test.
        results = list(db.results.find({"examId": exam_id}))
        
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
        
        # Calculate admin analytics for average score and pass rate.
        total_percentage = sum(r.get("percentage", 0) for r in results)
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
    
    try:
        oid = ObjectId(exam_id)
    except Exception:
        return jsonify({"error": "Invalid exam id"}), 400
    
    # Confirm the selected Shine Exam test exists before loading students.
    exam = db.exams.find_one({"_id": oid})
    if not exam:
        return jsonify({"error": "Exam not found"}), 404
    
    # Load each candidate result submitted for this test.
    results = list(db.results.find({"examId": oid}))
    
    # Rank candidates by score to calculate test percentiles.
    sorted_results = sorted(results, key=lambda r: r.get("percentage", 0), reverse=True)
    percentile_map = {}
    for idx, result in enumerate(sorted_results):
        percentile = round(((len(sorted_results) - idx) / len(sorted_results)) * 100, 1) if sorted_results else 0
        percentile_map[str(result["_id"])] = percentile
    
    user_results = []
    for result in results:
        user = _find_user_with_profile(db, result.get("userId"))
        user_name = user.get("name", result.get("userId")) if user else result.get("userId")
        
        # Format the submitted time for the analytics UI.
        submitted_at = None
        if result.get("submittedAt"):
            # Keep submission timestamps consistent for browser parsing.
            submitted_at = result.get("submittedAt").isoformat() + 'Z' if not result.get("submittedAt").isoformat().endswith('Z') else result.get("submittedAt").isoformat()
        
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
    
    try:
        oid = ObjectId(result_id)
    except Exception:
        return jsonify({"error": "Invalid result id"}), 400
    
    result = db.results.find_one({"_id": oid})
    if not result:
        return jsonify({"error": "Result not found"}), 404
    
    user = _find_user_with_profile(db, result.get("userId"))
    user_name = user.get("name", result.get("userId")) if user else result.get("userId")
    
    # Calculate this candidate's percentile within the selected test cohort.
    exam_id = result.get("examId")
    all_results = list(db.results.find({"examId": exam_id}))
    sorted_results = sorted(all_results, key=lambda r: r.get("percentage", 0), reverse=True)
    percentile = 0
    for idx, r in enumerate(sorted_results):
        if str(r["_id"]) == str(result["_id"]):
            percentile = round(((len(sorted_results) - idx) / len(sorted_results)) * 100, 1) if sorted_results else 0
            break
    
    # Format the detailed report submission time for the analytics UI.
    submitted_at = None
    if result.get("submittedAt"):
        # Keep report timestamps consistent for browser parsing.
        submitted_at = result.get("submittedAt").isoformat() + 'Z' if not result.get("submittedAt").isoformat().endswith('Z') else result.get("submittedAt").isoformat()
    
    detailed = {
        "id": str(result["_id"]),
        "attemptId": str(result.get("attemptId", result["_id"])),
        "userId": result.get("userId"),
        "userName": user_name,
        "examName": (db.exams.find_one({"_id": result.get("examId")}) or {}).get("name", "Untitled Test"),
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
