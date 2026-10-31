import sys
import re

print("Starting server-ready test series patch...")

# =====================================================================
# 1. Patch backend/routes/test_series.py
# =====================================================================
test_series_path = r"d:\Adhi\Shine\Shine-Exam\backend\routes\test_series.py"
with open(test_series_path, "r", encoding="utf-8") as f:
    ts_code = f.read()

# 1a. Patch _serialize_submission to guarantee non-null strings
old_serialize = """def _serialize_submission(sub, user=None):
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
    }"""

new_serialize = """def _serialize_submission(sub, user=None):
    raw_status = str(sub.get("status") or "pending")
    display_status = "pending" if raw_status in ("submitted", "pending", "under_evaluation") else raw_status
    score = sub.get("score") if sub.get("score") is not None else sub.get("scoredMarks")
    max_marks = sub.get("maxMarks") or sub.get("totalMarks") or 100
    user_name = ""
    user_email = ""
    if user:
        user_name = user.get("name") or user.get("username") or str(user.get("userId") or "")
        user_email = user.get("email") or ""
    if not user_name:
        user_name = str(sub.get("userId") or "Student")

    return {
        "id": str(sub.get("_id") or ""),
        "seriesId": str(sub.get("seriesId") or ""),
        "paperId": str(sub.get("paperId") or ""),
        "seriesName": str(sub.get("seriesName") or "Test Series"),
        "paperName": str(sub.get("paperName") or "Paper"),
        "paperType": str(sub.get("paperType") or "mcq"),
        "userId": str(sub.get("userId") or ""),
        "userName": str(user_name),
        "userEmail": str(user_email),
        "submittedAt": sub.get("submittedAt"),
        "status": display_status,
        "rawStatus": raw_status,
        "filename": str(sub.get("filename") or ""),
        "originalName": str(sub.get("originalName") or ""),
        "wordCount": sub.get("wordCount"),
        "pageCount": sub.get("pageCount"),
        # Evaluation fields
        "score": score,
        "maxMarks": max_marks,
        "feedback": str(sub.get("feedback") or ""),
        "improvementSuggestions": str(sub.get("improvementSuggestions") or ""),
        "strengths": str(sub.get("strengths") or ""),
        "evaluatedAt": sub.get("evaluatedAt"),
        "evaluatedBy": str(sub.get("evaluatedBy") or ""),
        "publishedAt": sub.get("publishedAt"),
        "questionReview": sub.get("questionReview") or [],
        "answers": sub.get("answers") or [],
    }"""

if old_serialize in ts_code:
    ts_code = ts_code.replace(old_serialize, new_serialize)
    print("1a. Patched _serialize_submission")
else:
    print("WARNING: old_serialize not found in ts_code")

# 1b. Patch add_paper to assign tenantId from series
old_add_paper_doc = '''        "status": data.get("status", "draft"),
        "createdAt": now,
        "updatedAt": now,
    }
    result = db.series_papers.insert_one(doc)'''

new_add_paper_doc = '''        "status": data.get("status", "draft"),
        "tenantId": (db.test_series.find_one({"_id": oid}) or {}).get("tenantId", DEFAULT_TENANT_ID),
        "createdAt": now,
        "updatedAt": now,
    }
    result = db.series_papers.insert_one(doc)'''

if old_add_paper_doc in ts_code:
    ts_code = ts_code.replace(old_add_paper_doc, new_add_paper_doc)
    print("1b. Patched add_paper tenantId")
else:
    print("WARNING: old_add_paper_doc not found")

# 1c. Patch list_submissions
pattern_list_sub = r'@test_series_bp\.route\("/submissions", methods=\["GET"\]\)\s*def list_submissions\(\):[\s\S]*?subs = list\(db\.series_attempts\.find\(q\)\.sort\("submittedAt", -1\)\)'

new_list_sub = '''@test_series_bp.route("/submissions", methods=["GET"])
def list_submissions():
    """Admin: List all test series submissions (MCQ, descriptive, essay) for evaluation."""
    db = get_db()
    tenant_id = get_request_tenant_id()

    status_filter = str(request.args.get("status", "")).strip()
    series_id = str(request.args.get("seriesId", "")).strip()
    paper_id = str(request.args.get("paperId", "")).strip()
    paper_type_param = str(request.args.get("paperType", "")).strip()

    # Identify test series owned by or accessible to this tenant
    series_filter = build_tenant_filter(tenant_id)
    tenant_series = list(db.test_series.find(series_filter, {"_id": 1, "name": 1, "tenantId": 1}))
    allowed_series_ids = []
    series_title_map = {}
    for s in tenant_series:
        allowed_series_ids.append(s["_id"])
        allowed_series_ids.append(str(s["_id"]))
        series_title_map[str(s["_id"])] = s.get("name", "")

    # Build query conditions
    conditions = []

    # Tenant condition: match attempt's tenantId OR match any series owned by this tenant
    if tenant_id and tenant_id != "all":
        tenant_match_list = [
            {"tenantId": tenant_id},
            {"seriesId": {"$in": allowed_series_ids}},
        ]
        if tenant_id == DEFAULT_TENANT_ID:
            tenant_match_list.extend([
                {"tenantId": {"$exists": False}},
                {"tenantId": None},
                {"tenantId": ""},
            ])
        conditions.append({"$or": tenant_match_list})

    if status_filter:
        if status_filter == "pending":
            conditions.append({"status": {"$in": ["pending", "submitted", "under_evaluation"]}})
        elif status_filter == "evaluated":
            conditions.append({"status": "evaluated"})
        elif status_filter == "published":
            conditions.append({"status": "published"})
        elif status_filter != "all":
            conditions.append({"status": status_filter})

    if series_id:
        s_matches = [series_id]
        if ObjectId.is_valid(series_id):
            s_matches.append(ObjectId(series_id))
        conditions.append({"seriesId": {"$in": s_matches}})

    if paper_id:
        p_matches = [paper_id]
        if ObjectId.is_valid(paper_id):
            p_matches.append(ObjectId(paper_id))
        conditions.append({"paperId": {"$in": p_matches}})

    if paper_type_param and paper_type_param != "all":
        conditions.append({"paperType": paper_type_param})

    if len(conditions) == 0:
        q = {}
    elif len(conditions) == 1:
        q = conditions[0]
    else:
        q = {"$and": conditions}

    subs = list(db.series_attempts.find(q).sort("submittedAt", -1))

    # Also check if any completed series attempts exist in db.results that should be synced
    seen_attempt_ids = {str(s["_id"]) for s in subs}
    results_filter = {"isSeries": True}
    if allowed_series_ids:
        results_filter["seriesId"] = {"$in": allowed_series_ids}
    elif tenant_id and tenant_id != "all":
        results_filter["tenantId"] = tenant_id

    for r in db.results.find(results_filter).sort("submittedAt", -1):
        r_att_id = str(r.get("attemptId") or r.get("_id"))
        if r_att_id not in seen_attempt_ids:
            s_oid = r.get("seriesId")
            try:
                s_obj_id = ObjectId(s_oid) if ObjectId.is_valid(str(s_oid)) else s_oid
            except Exception:
                s_obj_id = s_oid
            p_oid = r.get("paperId")
            try:
                p_obj_id = ObjectId(p_oid) if ObjectId.is_valid(str(p_oid)) else p_oid
            except Exception:
                p_obj_id = p_oid

            synced_doc = {
                "_id": ObjectId(r_att_id) if ObjectId.is_valid(r_att_id) else r.get("_id"),
                "seriesId": s_obj_id,
                "paperId": p_obj_id,
                "seriesName": str(r.get("seriesName") or series_title_map.get(str(s_oid), "Test Series")),
                "paperName": str(r.get("paperName") or "Paper"),
                "paperType": "mcq",
                "userId": str(r.get("userId") or ""),
                "tenantId": r.get("tenantId", tenant_id),
                "status": "submitted",
                "submittedAt": r.get("submittedAt"),
                "scoredMarks": r.get("scoredMarks", 0),
                "totalMarks": r.get("totalMarks", 0),
                "score": r.get("scoredMarks", 0),
                "maxMarks": r.get("totalMarks", 0),
                "percentage": r.get("percentage", 0),
                "passed": r.get("passed", False),
                "questionReview": r.get("questionReview", []),
                "sectionWise": r.get("sectionWise", {}),
            }
            try:
                db.series_attempts.update_one({"_id": synced_doc["_id"]}, {"$set": synced_doc}, upsert=True)
            except Exception:
                pass
            subs.append(synced_doc)
            seen_attempt_ids.add(r_att_id)'''

if re.search(pattern_list_sub, ts_code):
    ts_code = re.sub(pattern_list_sub, new_list_sub, ts_code, count=1)
    print("1c. Patched list_submissions in test_series.py")
else:
    print("WARNING: pattern_list_sub not matched in test_series.py")

with open(test_series_path, "w", encoding="utf-8") as f:
    f.write(ts_code)


# =====================================================================
# 2. Patch backend/routes/student_test_series.py
# =====================================================================
student_ts_path = r"d:\Adhi\Shine\Shine-Exam\backend\routes\student_test_series.py"
with open(student_ts_path, "r", encoding="utf-8") as f:
    sts_code = f.read()

# 2a. In start_mcq_paper, create or get an in_progress attempt
old_start = '''    # Check if already submitted
    existing = _attempt_status_for_paper(db, user_id, paper_oid)
    if existing and existing.get("status") == "submitted":
        return jsonify({"error": "You have already submitted this paper"}), 400

    series = db.test_series.find_one({"_id": series_oid})
    return jsonify({'''

new_start = '''    # Check if already submitted
    existing = _attempt_status_for_paper(db, user_id, paper_oid)
    if existing and existing.get("status") == "submitted":
        return jsonify({"error": "You have already submitted this paper"}), 400

    series = db.test_series.find_one({"_id": series_oid})
    series_tenant_id = (series.get("tenantId") if series else None) or paper.get("tenantId") or DEFAULT_TENANT_ID

    now = datetime.utcnow()
    if not existing:
        new_att = {
            "seriesId": series_oid,
            "paperId": paper_oid,
            "seriesName": series.get("name", "") if series else "",
            "paperName": paper.get("paperName", ""),
            "paperType": "mcq",
            "userId": user_id,
            "tenantId": series_tenant_id,
            "status": "in_progress",
            "answers": {},
            "startedAt": now,
            "submittedAt": None,
            "score": None,
            "totalMarks": paper.get("totalMarks", 100),
            "maxMarks": paper.get("totalMarks", 100),
        }
        res = db.series_attempts.insert_one(new_att)
        existing = {"_id": res.inserted_id, "answers": {}}

    return jsonify({'''

if old_start in sts_code:
    sts_code = sts_code.replace(old_start, new_start)
    print("2a. Patched start_mcq_paper to guarantee in_progress attempt")
else:
    print("WARNING: old_start not found in student_test_series.py")

# 2b. In submit_mcq_paper and upload_descriptive, inherit series' tenantId
sts_code = sts_code.replace(
    '"tenantId": paper.get("tenantId", DEFAULT_TENANT_ID),',
    '"tenantId": (series.get("tenantId") if series else None) or paper.get("tenantId") or DEFAULT_TENANT_ID,'
)
print("2b. Patched tenantId in student_test_series.py")

with open(student_ts_path, "w", encoding="utf-8") as f:
    f.write(sts_code)


# =====================================================================
# 3. Patch backend/routes/answerer.py
# =====================================================================
answerer_path = r"d:\Adhi\Shine\Shine-Exam\backend\routes\answerer.py"
with open(answerer_path, "r", encoding="utf-8") as f:
    ans_code = f.read()

# In submit_attempt, ensure series_attempts is always upserted with all fields
old_series_att_update = '''        # Update attempt record and link with evaluation queue
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
            )'''

new_series_att_update = '''        # Update attempt record and link with evaluation queue
        if is_series:
            resolved_series_id = (series_paper.get("seriesId") if series_paper else None) or attempt.get("seriesId")
            resolved_paper_id = (series_paper.get("_id") if series_paper else None) or attempt.get("paperId")
            series_att_update = {
                "seriesId": resolved_series_id,
                "paperId": resolved_paper_id,
                "userId": str(attempt.get("userId", user_id)),
                "tenantId": (series_doc.get("tenantId") if series_doc else None) or res_tenant_id,
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
            # Upsert into series_attempts by attempt _id or by seriesId+paperId+userId
            res_up = db.series_attempts.update_one(
                {"_id": attempt["_id"]},
                {"$set": series_att_update},
                upsert=True
            )
            if resolved_series_id and resolved_paper_id:
                db.series_attempts.update_one(
                    {"seriesId": resolved_series_id, "paperId": resolved_paper_id, "userId": str(attempt.get("userId", user_id))},
                    {"$set": series_att_update},
                    upsert=True
                )'''

if old_series_att_update in ans_code:
    ans_code = ans_code.replace(old_series_att_update, new_series_att_update)
    print("3a. Patched submit_attempt in answerer.py to guarantee series_attempts upsert")
else:
    print("WARNING: old_series_att_update not found in answerer.py")

with open(answerer_path, "w", encoding="utf-8") as f:
    f.write(ans_code)


# =====================================================================
# 4. Patch frontend/src/components/TestSeries/AdminTestSeriesDashboard.tsx
# =====================================================================
dash_path = r"d:\Adhi\Shine\Shine-Exam\frontend\src\components\TestSeries\AdminTestSeriesDashboard.tsx"
with open(dash_path, "r", encoding="utf-8") as f:
    dash_code = f.read()

old_filter = """  const filtered = useMemo(() =>
    submissions.filter(s =>
      s.userName.toLowerCase().includes(search.toLowerCase()) ||
      s.userId.toLowerCase().includes(search.toLowerCase()) ||
      s.seriesName.toLowerCase().includes(search.toLowerCase()) ||
      s.paperName.toLowerCase().includes(search.toLowerCase())
    ), [submissions, search]);"""

new_filter = """  const filtered = useMemo(() =>
    submissions.filter(s =>
      (s.userName || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.userId || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.seriesName || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.paperName || "").toLowerCase().includes(search.toLowerCase())
    ), [submissions, search]);"""

if old_filter in dash_code:
    dash_code = dash_code.replace(old_filter, new_filter)
    print("4. Patched AdminTestSeriesDashboard.tsx filtered search to be null-safe")
else:
    print("WARNING: old_filter not found in AdminTestSeriesDashboard.tsx")

with open(dash_path, "w", encoding="utf-8") as f:
    f.write(dash_code)

print("\nAll patches applied successfully!")
