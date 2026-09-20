"""
backend/routes/descriptive_evaluation.py
────────────────────────────────────────
Descriptive & Mains Evaluation Management Engine.
Handles examiner review queues, rubric-based grading (Introduction, Content, Examples,
Structure, Conclusion), AI advisory suggestions, recheck workflows, and audit trails.
"""

from datetime import datetime
from bson import ObjectId
from flask import Blueprint, jsonify, request

from config.db import get_db
from utils.json import to_jsonable
from utils.tenant import get_request_tenant_id, DEFAULT_TENANT_ID
from utils.validators import require_fields
from utils.audit import log_audit_event
from services.ai_evaluator import analyze_descriptive_submission

descriptive_eval_bp = Blueprint("descriptive_evaluation", __name__)


def _serialize_submission(doc):
    if not doc:
        return None
    doc["id"] = str(doc.get("_id", ""))
    return doc


@descriptive_eval_bp.route("/queue", methods=["GET"])
def list_evaluation_queue():
    """Examiner: List pending answer sheet submissions for evaluation."""
    db = get_db()
    tenant_id = get_request_tenant_id()
    query = {"status": {"$in": ["submitted", "under_evaluation", "evaluated"]}}
    if tenant_id and tenant_id != "all":
        query["$or"] = [
            {"tenantId": tenant_id},
            {"tenantId": {"$exists": False}},
            {"tenantId": None},
        ]

    series_id = request.args.get("seriesId")
    paper_id = request.args.get("paperId")
    status = request.args.get("status")

    if series_id:
        try: query["seriesId"] = ObjectId(series_id)
        except Exception: pass
    if paper_id:
        try: query["paperId"] = ObjectId(paper_id)
        except Exception: pass
    if status:
        query["status"] = status

    submissions = list(db.series_attempts.find(query).sort("submittedAt", -1))
    return jsonify({"queue": to_jsonable([_serialize_submission(s) for s in submissions])})


@descriptive_eval_bp.route("/<attempt_id>/ai-analyze", methods=["POST"])
def get_ai_evaluation_suggestion(attempt_id):
    """Examiner: Generate advisory AI assessment suggestion for a descriptive submission."""
    db = get_db()
    try:
        oid = ObjectId(attempt_id)
    except Exception:
        return jsonify({"error": "Invalid attempt ID"}), 400

    attempt = db.series_attempts.find_one({"_id": oid})
    if not attempt:
        return jsonify({"error": "Submission attempt not found"}), 404

    # Extract paper instructions/max marks
    paper = db.series_papers.find_one({"_id": attempt.get("paperId")})
    max_marks = float(paper.get("totalMarks", 100)) if paper else 100.0

    student_text = attempt.get("submittedText") or ""
    if not student_text and attempt.get("ocrExtractedText"):
        student_text = attempt.get("ocrExtractedText")

    if not student_text:
        # If student uploaded a handwritten document without raw text, provide template structure
        student_text = f"Submission for {attempt.get('paperName', 'Mains Paper')}. Candidate uploaded {attempt.get('pageCount', 1)} handwritten pages."

    q_text = paper.get("paperName", "UPSC / State PSC Mains Paper") if paper else "Descriptive Paper"
    cfg = paper.get("submissionConfig", {}) if paper else {}
    min_w = cfg.get("minWordCount", 150) or 150
    max_w = cfg.get("maxWordCount", 250) or 250

    analysis = analyze_descriptive_submission(
        question_text=q_text,
        student_text=student_text,
        max_marks=max_marks,
        min_words=min_w,
        max_words=max_w
    )

    return jsonify({"aiAnalysis": analysis})


@descriptive_eval_bp.route("/<attempt_id>/grade", methods=["POST"])
def submit_grade(attempt_id):
    """Examiner: Submit official evaluation with rubric scores and feedback."""
    db = get_db()
    try:
        oid = ObjectId(attempt_id)
    except Exception:
        return jsonify({"error": "Invalid attempt ID"}), 400

    data = request.get_json(silent=True) or {}
    ok, msg = require_fields(data, ["score", "feedback"])
    if not ok:
        return jsonify({"error": msg}), 400

    attempt = db.series_attempts.find_one({"_id": oid})
    if not attempt:
        return jsonify({"error": "Attempt not found"}), 404

    score = float(data["score"])
    feedback = str(data["feedback"]).strip()
    improvement_suggestions = str(data.get("improvementSuggestions", "")).strip()
    strengths = str(data.get("strengths", "")).strip()
    criteria_scores = data.get("criteriaScores", [])
    annotated_file_url = str(data.get("annotatedFileUrl", "")).strip()
    publish_now = bool(data.get("publishNow", False))
    examiner_name = str(data.get("examinerName", "Official Examiner")).strip()
    now = datetime.utcnow().isoformat()

    paper = db.series_papers.find_one({"_id": attempt.get("paperId")})
    max_marks = float(paper.get("totalMarks", 100)) if paper else 100.0
    pct = round((score / max_marks) * 100, 2) if max_marks > 0 else 0.0

    update_fields = {
        "score": score,
        "scoredMarks": score,
        "maxMarks": max_marks,
        "percentage": pct,
        "feedback": feedback,
        "improvementSuggestions": improvement_suggestions,
        "strengths": strengths,
        "criteriaScores": criteria_scores,
        "annotatedFileUrl": annotated_file_url,
        "evaluatedBy": examiner_name,
        "evaluatedAt": now,
        "status": "published" if publish_now else "evaluated",
        "updatedAt": now,
    }
    if publish_now:
        update_fields["publishedAt"] = now

    db.series_attempts.update_one({"_id": oid}, {"$set": update_fields})

    log_audit_event("grade_descriptive_paper", {
        "attemptId": attempt_id,
        "userId": attempt.get("userId"),
        "score": score,
        "published": publish_now
    })

    return jsonify({
        "message": "Evaluation recorded successfully" + (" and published to student" if publish_now else ""),
        "attempt": to_jsonable(_serialize_submission(db.series_attempts.find_one({"_id": oid})))
    })


@descriptive_eval_bp.route("/<attempt_id>/publish", methods=["POST"])
def publish_evaluation(attempt_id):
    """Admin: Publish evaluated score to student portal."""
    db = get_db()
    try:
        oid = ObjectId(attempt_id)
    except Exception:
        return jsonify({"error": "Invalid attempt ID"}), 400

    now = datetime.utcnow().isoformat()
    res = db.series_attempts.update_one(
        {"_id": oid},
        {"$set": {"status": "published", "publishedAt": now, "updatedAt": now}}
    )
    if res.matched_count == 0:
        return jsonify({"error": "Attempt not found"}), 404

    return jsonify({"message": "Result published to student dashboard"})
