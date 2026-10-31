import ast
import re
from pathlib import Path

ts_path = Path("backend/routes/test_series.py")
content = ts_path.read_text(encoding="utf-8")

# 1. Replace _serialize_submission
old_serialize_regex = re.compile(
    r'def _serialize_submission\(sub, user=None\):.*?'
    r'        "publishedAt": sub\.get\("publishedAt"\),\s*\n    \}',
    re.DOTALL
)

new_serialize = '''def _serialize_submission(sub, user=None):
    raw_status = sub.get("status", "pending")
    # For UI display: pending, evaluated, published
    display_status = "pending" if raw_status in ("submitted", "pending", "under_evaluation") else raw_status
    score = sub.get("score") if sub.get("score") is not None else sub.get("scoredMarks")
    max_marks = sub.get("maxMarks") or sub.get("totalMarks") or 100
    user_name = ""
    user_email = ""
    if user:
        user_name = user.get("name") or user.get("username") or str(user.get("userId", ""))
        user_email = user.get("email", "")
    if not user_name:
        user_name = str(sub.get("userId", ""))

    return {
        "id": str(sub["_id"]),
        "seriesId": str(sub.get("seriesId", "")),
        "paperId": str(sub.get("paperId", "")),
        "seriesName": sub.get("seriesName", ""),
        "paperName": sub.get("paperName", ""),
        "paperType": sub.get("paperType", "mcq"),
        "userId": str(sub.get("userId", "")),
        "userName": user_name,
        "userEmail": user_email,
        "submittedAt": sub.get("submittedAt"),
        "status": display_status,
        "rawStatus": raw_status,
        "filename": sub.get("filename", ""),
        "originalName": sub.get("originalName", ""),
        "wordCount": sub.get("wordCount"),
        "pageCount": sub.get("pageCount"),
        # Evaluation fields
        "score": score,
        "maxMarks": max_marks,
        "feedback": sub.get("feedback", ""),
        "improvementSuggestions": sub.get("improvementSuggestions", ""),
        "strengths": sub.get("strengths", ""),
        "evaluatedAt": sub.get("evaluatedAt"),
        "evaluatedBy": sub.get("evaluatedBy", ""),
        "publishedAt": sub.get("publishedAt"),
        "questionReview": sub.get("questionReview", []),
        "answers": sub.get("answers", []),
    }'''

assert old_serialize_regex.search(content) is not None, "Could not match old_serialize_regex in test_series.py"
content = old_serialize_regex.sub(new_serialize, content, count=1)

# 2. Replace list_submissions
old_list_regex = re.compile(
    r'@test_series_bp\.route\("/submissions", methods=\["GET"\]\)\s*\n'
    r'def list_submissions\(\):.*?'
    r'    return jsonify\(\{"submissions": to_jsonable\(result\)\}\)',
    re.DOTALL
)

new_list = '''@test_series_bp.route("/submissions", methods=["GET"])
def list_submissions():
    """Admin: List all test series submissions (MCQ, descriptive, essay) for evaluation."""
    db = get_db()
    tenant_id = get_request_tenant_id()
    tenant_filter = build_tenant_filter(tenant_id)

    status_filter = str(request.args.get("status", "")).strip()
    series_id = str(request.args.get("seriesId", "")).strip()
    paper_id = str(request.args.get("paperId", "")).strip()
    paper_type_param = str(request.args.get("paperType", "")).strip()

    q = {**tenant_filter}
    if status_filter:
        if status_filter == "pending":
            q["status"] = {"$in": ["pending", "submitted", "under_evaluation"]}
        elif status_filter == "evaluated":
            q["status"] = "evaluated"
        elif status_filter == "published":
            q["status"] = "published"
        elif status_filter != "all":
            q["status"] = status_filter
    if series_id:
        try:
            q["seriesId"] = ObjectId(series_id)
        except Exception:
            q["seriesId"] = series_id
    if paper_id:
        try:
            q["paperId"] = ObjectId(paper_id)
        except Exception:
            q["paperId"] = paper_id
    if paper_type_param and paper_type_param != "all":
        q["paperType"] = paper_type_param

    subs = list(db.series_attempts.find(q).sort("submittedAt", -1))

    user_ids = list(set(str(s.get("userId", "")) for s in subs if s.get("userId")))
    user_oids = [ObjectId(u) for u in user_ids if ObjectId.is_valid(u)]
    users_by_uid = {str(u.get("userId", "")): u for u in db.users.find({"userId": {"$in": user_ids}})}
    users_by_oid = {str(u["_id"]): u for u in db.users.find({"_id": {"$in": user_oids}})}

    def resolve_user(uid):
        return users_by_uid.get(uid) or users_by_oid.get(uid)

    result = [_serialize_submission(s, resolve_user(str(s.get("userId", "")))) for s in subs]
    return jsonify({"submissions": to_jsonable(result)})'''

assert old_list_regex.search(content) is not None, "Could not match old_list_regex in test_series.py"
content = old_list_regex.sub(new_list, content, count=1)

# 3. Enhance evaluate_submission to sync with db.results
old_eval_sync_target = '    db.series_attempts.update_one({"_id": oid}, {"$set": update})'
new_eval_sync = '''    db.series_attempts.update_one({"_id": oid}, {"$set": update})

    # Also update db.results if a result record exists for this attempt
    db.results.update_one(
        {"$or": [{"attemptId": str(oid)}, {"attemptId": oid}]},
        {"$set": {
            "score": score,
            "scoredMarks": score,
            "maxMarks": max_marks,
            "percentage": pct,
            "feedback": feedback,
            "evaluatedBy": evaluated_by,
            "evaluatedAt": now,
        }}
    )'''

assert old_eval_sync_target in content, "Could not match old_eval_sync_target in test_series.py"
content = content.replace(old_eval_sync_target, new_eval_sync, 1)

# Verify AST syntax
ast.parse(content)
ts_path.write_text(content, encoding="utf-8")
print("SUCCESS: test_series.py updated and verified syntax!")

