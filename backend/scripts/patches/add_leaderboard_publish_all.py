"""
Patch: Add missing /leaderboard and /publish-all endpoints to test_series.py
"""

path = r'd:\Adhi\Shine\Shine-Exam\backend\routes\test_series.py'

new_routes = b'''

@test_series_bp.route("/<series_id>/leaderboard", methods=["GET"])
def series_leaderboard(series_id):
    """Admin: Get leaderboard for a series (alias for results overview)."""
    db = get_db()
    try:
        series_oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid series ID"}), 400

    series = db.test_series.find_one({"_id": series_oid})
    if not series:
        return jsonify({"error": "Series not found"}), 404

    papers = list(db.series_papers.find({"seriesId": series_oid}).sort("paperNumber", 1))
    paper_map = {str(p["_id"]): p for p in papers}
    attempts = list(db.series_attempts.find({"seriesId": series_oid}))

    student_scores = {}
    for attempt in attempts:
        uid = attempt.get("userId", "")
        pid = str(attempt.get("paperId", ""))
        score = attempt.get("score") if attempt.get("score") is not None else attempt.get("scoredMarks")
        max_m = attempt.get("maxMarks") or attempt.get("totalMarks")
        if uid not in student_scores:
            student_scores[uid] = {}
        student_scores[uid][pid] = {
            "score": score,
            "maxMarks": max_m,
            "status": attempt.get("status", "pending"),
            "paperName": paper_map.get(pid, {}).get("paperName", ""),
            "paperType": attempt.get("paperType", ""),
        }

    user_ids = list(student_scores.keys())
    users = {u["userId"]: u for u in db.users.find({"userId": {"$in": user_ids}})}

    leaderboard = []
    for uid, paper_scores in student_scores.items():
        total_scored = sum(
            v["score"] for v in paper_scores.values() if v.get("score") is not None
        )
        total_max = sum(
            v["maxMarks"] for v in paper_scores.values() if v.get("maxMarks") is not None
        )
        u = users.get(uid, {})
        leaderboard.append({
            "userId": uid,
            "name": u.get("name", uid),
            "email": u.get("email", ""),
            "totalScored": total_scored,
            "totalMax": total_max,
            "percentage": round(total_scored / total_max * 100, 2) if total_max else 0,
            "paperScores": paper_scores,
        })

    leaderboard.sort(key=lambda x: x["totalScored"], reverse=True)
    for i, row in enumerate(leaderboard):
        row["rank"] = i + 1

    return jsonify({"leaderboard": to_jsonable(leaderboard)})


@test_series_bp.route("/<series_id>/publish-all", methods=["POST"])
def publish_all_results(series_id):
    """Admin: Publish all evaluated (but not yet published) results for a series."""
    db = get_db()
    try:
        series_oid = ObjectId(series_id)
    except Exception:
        return jsonify({"error": "Invalid series ID"}), 400

    now = datetime.utcnow()
    result = db.series_attempts.update_many(
        {"seriesId": series_oid, "status": "evaluated"},
        {"$set": {"status": "published", "publishedAt": now}}
    )
    db.series_evaluations.update_many(
        {"seriesId": series_oid, "published": {"$ne": True}},
        {"$set": {"published": True, "publishedAt": now}}
    )
    return jsonify({
        "message": f"Published {result.modified_count} result(s) for this series.",
        "published": result.modified_count,
    })

'''

with open(path, 'rb') as f:
    content = f.read()

# Insert before the Helpers section
helpers_marker = b'# \xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\r\n# Helpers'

idx = content.find(helpers_marker)
if idx >= 0:
    new_content = content[:idx] + new_routes + content[idx:]
    with open(path, 'wb') as f:
        f.write(new_content)
    print("SUCCESS: Added /leaderboard and /publish-all endpoints")
else:
    # Fallback: append before last function
    helpers_simple = b'# Helpers\r\n'
    idx2 = content.rfind(helpers_simple)
    if idx2 >= 0:
        new_content = content[:idx2] + new_routes + content[idx2:]
        with open(path, 'wb') as f:
            f.write(new_content)
        print("SUCCESS (fallback): Added /leaderboard and /publish-all endpoints")
    else:
        # Just append at end
        with open(path, 'ab') as f:
            f.write(new_routes)
        print("SUCCESS (append): Added /leaderboard and /publish-all endpoints")

