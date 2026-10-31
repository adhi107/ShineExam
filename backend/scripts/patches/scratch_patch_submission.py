import ast
import re
from pathlib import Path

answerer_path = Path("backend/routes/answerer.py")
content = answerer_path.read_text(encoding="utf-8")

# 1. Update save_attempt
old_save_regex = re.compile(
    r'@answerer_bp\.route\("/attempts/<attempt_id>/save", methods=\["PUT", "POST"\]\)\s*\n'
    r'@answerer_bp\.route\("/attempts/save", methods=\["PUT", "POST"\]\)\s*\n'
    r'def save_attempt\(attempt_id: str = None\):.*?'
    r'    db\.attempts\.update_one\(\{"_id": oid\}, \{"\$set": update\}\)\s*\n'
    r'    return jsonify\(\{"message": "Saved", "attemptId": str\(oid\)\}\)',
    re.DOTALL
)

new_save = '''@answerer_bp.route("/attempts/<attempt_id>/save", methods=["PUT", "POST"])
@answerer_bp.route("/attempts/save", methods=["PUT", "POST"])
def save_attempt(attempt_id: str = None):
    """Save answers and progress while test is in progress (supports regular and series papers)."""
    payload = request.get_json(silent=True) or {}
    db = get_db()
    
    attempt = None
    is_series = False
    if attempt_id and attempt_id != "current":
        try:
            attempt = db.attempts.find_one({"_id": ObjectId(attempt_id)})
            if not attempt:
                attempt = db.series_attempts.find_one({"_id": ObjectId(attempt_id)})
                if attempt:
                    is_series = True
        except Exception:
            pass

    if not attempt:
        exam_id_val = payload.get("examId") or payload.get("paperId")
        user_id_val = payload.get("userId")
        if exam_id_val and user_id_val:
            try:
                e_oid = ObjectId(exam_id_val)
            except Exception:
                e_oid = exam_id_val
            attempt = db.attempts.find_one({"examId": e_oid, "userId": user_id_val, "status": "in_progress"})
            if not attempt:
                attempt = db.series_attempts.find_one({
                    "$or": [{"paperId": e_oid}, {"paperId": str(e_oid)}],
                    "userId": user_id_val,
                    "status": "in_progress"
                })
                if attempt:
                    is_series = True

    if not attempt:
        return jsonify({"error": "Active in-progress attempt not found"}), 404

    oid = attempt["_id"]
    update = {
        "answers": payload.get("answers") or [],
        "updatedAt": datetime.utcnow(),
    }
    if payload.get("timeSpentSec") is not None:
        update["timeSpentSec"] = int(payload.get("timeSpentSec") or 0)
    if payload.get("currentQuestionIndex") is not None:
        update["currentQuestionIndex"] = max(0, int(payload.get("currentQuestionIndex") or 0))
    if payload.get("currentSection") is not None:
        update["currentSection"] = str(payload.get("currentSection") or "").strip()
    if isinstance(payload.get("questionTimes"), dict):
        update["questionTimes"] = {str(key): max(0, int(value or 0)) for key, value in payload.get("questionTimes", {}).items()}

    if is_series:
        db.series_attempts.update_one({"_id": oid}, {"$set": update})
    else:
        res = db.attempts.update_one({"_id": oid}, {"$set": update})
        if res.matched_count == 0:
            db.series_attempts.update_one({"_id": oid}, {"$set": update})
    return jsonify({"message": "Saved", "attemptId": str(oid)})'''

assert old_save_regex.search(content) is not None, "Could not match old_save_regex in answerer.py"
content = old_save_regex.sub(new_save, content, count=1)

# 2. Update submit_attempt and submit_attempt_generic
old_submit_regex = re.compile(
    r'@answerer_bp\.route\("/attempts/<attempt_id>/submit", methods=\["POST"\]\)\s*\n'
    r'def submit_attempt\(attempt_id\):.*?'
    r'@answerer_bp\.get\("/results/<attempt_id>"\)',
    re.DOTALL
)

new_submit = '''@answerer_bp.route("/attempts/<attempt_id>/submit", methods=["POST"])
def submit_attempt(attempt_id):
    payload = request.get_json(silent=True) or {}
    answers = payload.get("answers", [])
    time_spent = int(payload.get("timeSpentSec", 0))
    user_id = str(payload.get("userId", "")).strip()

    db = get_db()

    attempt = None
    is_series = False
    if ObjectId.is_valid(str(attempt_id)):
        attempt = db.attempts.find_one({"_id": ObjectId(str(attempt_id))})
        if not attempt:
            attempt = db.series_attempts.find_one({"_id": ObjectId(str(attempt_id))})
            if attempt:
                is_series = True
    if not attempt:
        attempt = db.attempts.find_one({"_id": attempt_id})
        if not attempt:
            attempt = db.series_attempts.find_one({"_id": attempt_id})
            if attempt:
                is_series = True
    if not attempt:
        attempt = db.attempts.find_one({"_id": str(attempt_id)})
        if not attempt:
            attempt = db.series_attempts.find_one({"_id": str(attempt_id)})
            if attempt:
                is_series = True
    if not attempt:
        return jsonify({"error": "Attempt not found"}), 404

    question_times = payload.get("questionTimes") if isinstance(payload.get("questionTimes"), dict) else (attempt.get("questionTimes") or {})

    # If attempt is already submitted, return the stored result doc if available
    if attempt.get("status") == "submitted":
        existing_result = db.results.find_one({"$or": [{"attemptId": str(attempt["_id"])}, {"attemptId": str(attempt_id)}]})
        if existing_result:
            json_res = to_jsonable(existing_result)
            return jsonify({"result": json_res, **json_res}), 200
        return jsonify({"error": "Attempt already submitted"}), 409

    try:
        exam_id = attempt.get("examId") or attempt.get("paperId")
        exam = None
        series_paper = None
        series_doc = None

        if ObjectId.is_valid(str(exam_id)):
            exam = db.exams.find_one({"_id": ObjectId(str(exam_id))})
            if not exam:
                series_paper = db.series_papers.find_one({"_id": ObjectId(str(exam_id))})
        if not exam and not series_paper:
            exam = db.exams.find_one({"_id": exam_id})
            if not exam:
                series_paper = db.series_papers.find_one({"_id": exam_id})
        if not exam and not series_paper:
            exam = db.exams.find_one({"_id": str(exam_id)})
            if not exam:
                series_paper = db.series_papers.find_one({"_id": str(exam_id)})

        if series_paper:
            is_series = True
            series_id_val = series_paper.get("seriesId")
            if series_id_val:
                try:
                    series_doc = db.test_series.find_one({"_id": ObjectId(str(series_id_val))})
                except Exception:
                    series_doc = db.test_series.find_one({"_id": series_id_val})

            passing_percentage = float(series_paper.get("passingMarks") or 33)
            exam = {
                "_id": series_paper["_id"],
                "name": f"{series_doc.get('name', '')} — {series_paper.get('paperName', '')}" if series_doc else series_paper.get("paperName", "Test Series Paper"),
                "duration": series_paper.get("duration", 60),
                "passingPercentage": passing_percentage,
                "totalMarks": float(series_paper.get("totalMarks") or 100),
                "tenantId": series_paper.get("tenantId", DEFAULT_TENANT_ID),
                "negativeMarkingScheme": series_paper.get("negativeMarkingScheme", "none"),
            }
            questions = list(series_paper.get("questions", []))
        elif exam:
            passing_percentage = float(exam.get("passingPercentage", 40))
            q_match = [{"examId": exam_id}, {"examId": str(exam_id)}]
            if ObjectId.is_valid(str(exam_id)):
                q_match.append({"examId": ObjectId(str(exam_id))})
            questions = list(db.questions.find({"$or": q_match}))
        else:
            return jsonify({"error": "Exam not found"}), 404

        computed = compute_result(questions, answers, passing_percentage)
        # Ensure question times are properly recorded
        total_q_time = sum(int(v or 0) for v in question_times.values())
        if total_q_time == 0 and time_spent > 0:
            review_items = computed.get("review", [])
            answered_items = [it for it in review_items if it.get("userAnswer") and (len(it["userAnswer"]) > 0 if isinstance(it["userAnswer"], list) else bool(it["userAnswer"]))]
            targets = answered_items if answered_items else review_items
            if targets:
                avg_per_q = max(1, round(time_spent / len(targets)))
                for it in targets:
                    question_times[str(it["questionId"])] = avg_per_q

        q_map = {}
        for q in questions:
            for qkey in (q.get("qid"), q.get("id"), q.get("_id"), q.get("question_id")):
                if qkey is not None:
                    q_map[str(qkey)] = q

        question_review = [
            {
                "questionId": str(item["questionId"]),
                "question": item.get("question") or (q_map.get(str(item["questionId"])) or {}).get("question", ""),
                "context": item.get("context", "") or (q_map.get(str(item["questionId"])) or {}).get("context", ""),
                "contextType": item.get("contextType", "") or (q_map.get(str(item["questionId"])) or {}).get("contextType", ""),
                "type": item.get("type") or (q_map.get(str(item["questionId"])) or {}).get("type", "single"),
                "options": item.get("options") or (q_map.get(str(item["questionId"])) or {}).get("options", []),
                "isCorrect": item["isCorrect"],
                "userAnswer": item["userAnswer"],
                "correctAnswer": item["correctAnswer"] or (q_map.get(str(item["questionId"])) or {}).get("correctAnswer"),
                "marks": item["marks"],
                "section": item["section"],
                "timeSpentSec": max(0, int(question_times.get(str(item["questionId"]), 0) or 0)),
            }
            for item in computed.get("review", [])
        ]

        section_wise = {
            item["section"]: {
                "total": item["totalMarks"],
                "scored": item["scoredMarks"],
                "percentage": item.get("percentage", 0),
            }
            for item in computed.get("sectionBreakdown", [])
        }

        res_tenant_id = (
            attempt.get("tenantId")
            or (exam.get("tenantId") if exam else None)
            or DEFAULT_TENANT_ID
        )

        now_utc = datetime.utcnow()
        result_doc = {
            "attemptId": str(attempt["_id"]),
            "examId": str(exam["_id"]),
            "userId": str(attempt.get("userId", user_id)),
            "tenantId": str(res_tenant_id),
            "totalMarks": computed.get("totalMarks", 0),
            "scoredMarks": computed.get("scoredMarks", 0),
            "percentage": computed.get("percentage", 0),
            "passed": computed.get("passed", False),
            "percentile": 0,
            "sectionWise": section_wise,
            "questionReview": question_review,
            "submittedAt": now_utc,
            "timeSpentSec": time_spent,
            "questionTimes": question_times,
            "isSeries": is_series,
        }
        if is_series and series_paper:
            result_doc["paperId"] = str(series_paper["_id"])
            result_doc["seriesId"] = str(series_paper.get("seriesId", ""))
            result_doc["paperName"] = series_paper.get("paperName", "")
            result_doc["seriesName"] = series_doc.get("name", "") if series_doc else ""

        # Store or update the completed test result in MongoDB results collection
        db.results.update_one(
            {"attemptId": str(attempt["_id"])},
            {"$set": result_doc},
            upsert=True
        )

        # Update attempt record and link with evaluation queue
        if is_series:
            series_att_update = {
                "status": "submitted",
                "questionTimes": question_times,
                "timeSpentSec": time_spent,
                "submittedAt": now_utc,
                "scoredMarks": computed.get("scoredMarks", 0),
                "totalMarks": computed.get("totalMarks", 0) or exam.get("totalMarks", 100),
                "score": computed.get("scoredMarks", 0),
                "maxMarks": computed.get("totalMarks", 0) or exam.get("totalMarks", 100),
                "percentage": computed.get("percentage", 0),
                "passed": computed.get("passed", False),
                "questionReview": question_review,
                "sectionWise": section_wise,
                "answers": answers,
                "paperType": series_paper.get("paperType", "mcq") if series_paper else attempt.get("paperType", "mcq"),
                "seriesName": series_doc.get("name", "") if series_doc else attempt.get("seriesName", ""),
                "paperName": series_paper.get("paperName", "") if series_paper else attempt.get("paperName", ""),
            }
            db.series_attempts.update_one(
                {"_id": attempt["_id"]},
                {"$set": series_att_update}
            )
            # Upsert into series_evaluations collection for Admin Review workflow
            db.series_evaluations.update_one(
                {"attemptId": attempt["_id"]},
                {"$set": {
                    "attemptId": attempt["_id"],
                    "seriesId": attempt.get("seriesId") or (series_paper.get("seriesId") if series_paper else None),
                    "paperId": attempt.get("paperId") or (series_paper.get("_id") if series_paper else None),
                    "userId": str(attempt.get("userId", user_id)),
                    "score": computed.get("scoredMarks", 0),
                    "maxMarks": computed.get("totalMarks", 0) or exam.get("totalMarks", 100),
                    "percentage": computed.get("percentage", 0),
                    "feedback": "",
                    "evaluatedBy": "auto_scoring",
                    "evaluatedAt": now_utc,
                    "published": False,
                    "tenantId": res_tenant_id,
                }},
                upsert=True
            )
        else:
            db.attempts.update_one(
                {"_id": attempt["_id"]},
                {"$set": {"status": "submitted", "questionTimes": question_times, "timeSpentSec": time_spent, "submittedAt": now_utc}}
            )

        # Audit log the exam submission
        audit_log(
            "EXAM_SUBMITTED",
            user_id=str(result_doc.get("userId", user_id)),
            details={
                "attemptId": str(attempt["_id"]),
                "examId": str(exam["_id"]),
                "percentage": computed.get("percentage", 0),
                "passed": computed.get("passed", False),
                "isSeries": is_series,
            },
        )

        response_data = {
            "attemptId": str(result_doc["attemptId"]),
            "examId": str(result_doc["examId"]),
            "userId": str(result_doc["userId"]),
            "totalMarks": result_doc["totalMarks"],
            "scoredMarks": result_doc["scoredMarks"],
            "percentage": result_doc["percentage"],
            "passed": result_doc["passed"],
            "percentile": result_doc["percentile"],
            "sectionWise": result_doc["sectionWise"],
            "questionReview": question_review,
            "timeSpentSec": time_spent,
            "submittedAt": result_doc["submittedAt"].isoformat() + "Z",
            "isSeries": is_series,
        }

        return jsonify({"result": response_data, **response_data})
    except Exception as ex:
        import traceback
        print("[SUBMIT_ATTEMPT_ERROR]", traceback.format_exc())
        return jsonify({"error": f"Failed to calculate exam result: {str(ex)}"}), 500


@answerer_bp.route("/attempts/submit", methods=["POST"])
def submit_attempt_generic():
    payload = request.get_json(silent=True) or {}
    user_id = str(payload.get("userId") or "").strip()
    exam_id_str = str(payload.get("examId") or payload.get("paperId") or "").strip()

    db = get_db()
    if not user_id or not exam_id_str:
        return jsonify({"error": "userId and examId are required"}), 400

    exam_matches = [exam_id_str]
    if ObjectId.is_valid(exam_id_str):
        exam_matches.append(ObjectId(exam_id_str))

    attempt = db.attempts.find_one({
        "examId": {"$in": exam_matches},
        "userId": user_id,
        "status": "in_progress"
    })
    if not attempt:
        attempt = db.series_attempts.find_one({
            "paperId": {"$in": exam_matches},
            "userId": user_id,
            "status": "in_progress"
        })
    if not attempt:
        attempt = db.attempts.find_one({
            "examId": {"$in": exam_matches},
            "userId": user_id,
        }, sort=[("startedAt", -1)])
    if not attempt:
        attempt = db.series_attempts.find_one({
            "paperId": {"$in": exam_matches},
            "userId": user_id,
        }, sort=[("startedAt", -1)])

    if not attempt or attempt.get("status") == "submitted":
        now = datetime.utcnow()
        exam_val = ObjectId(exam_id_str) if ObjectId.is_valid(exam_id_str) else exam_id_str
        is_sp = db.series_papers.find_one({"_id": exam_val}) if ObjectId.is_valid(exam_id_str) else None
        if not is_sp:
            is_sp = db.series_papers.find_one({"_id": exam_id_str})

        if is_sp:
            s_doc = db.test_series.find_one({"_id": is_sp.get("seriesId")})
            att_doc = {
                "seriesId": is_sp.get("seriesId"),
                "paperId": is_sp["_id"],
                "seriesName": s_doc.get("name", "") if s_doc else "",
                "paperName": is_sp.get("paperName", ""),
                "paperType": is_sp.get("paperType", "mcq"),
                "userId": user_id,
                "tenantId": is_sp.get("tenantId", DEFAULT_TENANT_ID),
                "status": "in_progress",
                "answers": payload.get("answers", []),
                "startedAt": now,
                "updatedAt": now,
                "submittedAt": None,
                "timeSpentSec": int(payload.get("timeSpentSec", 0)),
                "currentQuestionIndex": 0,
                "currentSection": "",
                "questionTimes": payload.get("questionTimes") or {},
            }
            res = db.series_attempts.insert_one(att_doc)
            attempt_id = str(res.inserted_id)
        else:
            attempt_doc = {
                "examId": exam_val,
                "userId": user_id,
                "status": "in_progress",
                "answers": payload.get("answers", []),
                "startedAt": now,
                "updatedAt": now,
                "submittedAt": None,
                "timeSpentSec": int(payload.get("timeSpentSec", 0)),
                "currentQuestionIndex": 0,
                "currentSection": "",
                "questionTimes": payload.get("questionTimes") or {},
            }
            res = db.attempts.insert_one(attempt_doc)
            attempt_id = str(res.inserted_id)
    else:
        attempt_id = str(attempt["_id"])

    return submit_attempt(attempt_id)


@answerer_bp.get("/results/<attempt_id>")'''

assert old_submit_regex.search(content) is not None, "Could not match old_submit_regex in answerer.py"
content = old_submit_regex.sub(new_submit, content, count=1)

# Verify AST syntax
ast.parse(content)
answerer_path.write_text(content, encoding="utf-8")
print("SUCCESS: answerer.py updated and verified syntax!")

