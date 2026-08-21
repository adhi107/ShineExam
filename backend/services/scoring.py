from typing import Any, Dict, List


def _normalize_answer(ans):
    if isinstance(ans, list):
        return sorted([str(a).strip() for a in ans])
    if ans is None:
        return ""
    return str(ans).strip()


def _normalize_sequence(ans):
    if not isinstance(ans, list):
        return []
    return [str(a).strip() for a in ans]


def _is_multiple_choice(q: Dict[str, Any]) -> bool:
    return isinstance(q.get("correctAnswer"), list)


def compute_result(
    questions: List[Dict[str, Any]],
    answers: List[Dict[str, Any]],
    passing_percent: float = 80.0,
) -> Dict[str, Any]:
    """Compute score + section breakdown + per-question review.

    questions: list of question docs (must include id/_id, section, marks, correctAnswer)
    answers: list of {questionId, answer, marked}
    """

    q_by_id: Dict[str, Dict[str, Any]] = {}
    for q in questions:
        ids = [q.get("id"), q.get("questionId"), q.get("qid"), q.get("_id")]
        for raw_id in ids:
            if raw_id is not None:
                q_by_id[str(raw_id)] = q

    total_marks = 0
    scored_marks = 0.0

    section_totals: Dict[str, int] = {}
    section_scored: Dict[str, float] = {}

    review: List[Dict[str, Any]] = []

    counted_questions = set()
    for qid, q in q_by_id.items():
        canonical_qid = str(q.get("id") or q.get("questionId") or q.get("qid") or q.get("_id"))
        if canonical_qid in counted_questions:
            continue
        counted_questions.add(canonical_qid)

        marks = float(q.get("marks", 0))
        section = q.get("section", "General")
        total_marks += marks
        section_totals[section] = section_totals.get(section, 0) + marks

    answers_by_qid: Dict[str, Dict[str, Any]] = {}
    for a in answers:
        qid = str(a.get("questionId"))
        if qid:
            answers_by_qid[qid] = a

    seen_questions = set()
    for qid, q in q_by_id.items():
        canonical_qid = str(q.get("id") or q.get("questionId") or q.get("qid") or q.get("_id"))
        if canonical_qid in seen_questions:
            continue
        seen_questions.add(canonical_qid)

        answer_doc = answers_by_qid.get(canonical_qid, {})
        correct = q.get("correctAnswer")
        user_ans = answer_doc.get("answer")

        is_correct = False
        qtype = q.get("type")
        if qtype == "ordering":
            is_correct = _normalize_sequence(user_ans) == _normalize_sequence(correct)
        elif qtype == "text":
            is_correct = _normalize_answer(user_ans).lower() == _normalize_answer(correct).lower()
        elif _is_multiple_choice(q):
            is_correct = _normalize_answer(user_ans) == _normalize_answer(correct)
        else:
            is_correct = _normalize_answer(user_ans) == _normalize_answer(correct)

        marks = float(q.get("marks", 0))
        negative_marks = float(q.get("negativeMarks", 0) or 0)
        section = q.get("section", "General")
        attempted = user_ans not in (None, "", [])

        if is_correct:
            scored_marks += marks
            section_scored[section] = section_scored.get(section, 0) + marks
        elif attempted and negative_marks > 0:
            scored_marks -= negative_marks
            section_scored[section] = section_scored.get(section, 0) - negative_marks
        else:
            section_scored.setdefault(section, section_scored.get(section, 0))

        review.append(
            {
                "questionId": canonical_qid,
                "question": q.get("question"),
                "context": q.get("context", ""),
                "contextType": q.get("contextType", ""),
                "type": qtype,
                "section": section,
                "marks": marks if is_correct else (-negative_marks if attempted else 0),
                "negativeMarks": negative_marks,
                "options": q.get("options", []),
                "correctAnswer": correct,
                "userAnswer": user_ans,
                "isCorrect": is_correct,
                "marked": bool(answer_doc.get("marked", False)),
            }
        )

    percentage = 0.0
    if total_marks > 0:
        percentage = round((scored_marks / total_marks) * 100.0, 2)

    passed = percentage >= float(passing_percent)

    section_breakdown = []
    for section, tmarks in section_totals.items():
        smarks = section_scored.get(section, 0)
        spct = 0.0
        if tmarks > 0:
            spct = round((smarks / tmarks) * 100.0, 2)
        section_breakdown.append(
            {
                "section": section,
                "totalMarks": tmarks,
                "scoredMarks": smarks,
                "percentage": spct,
            }
        )

    # Keep Shine Exam question review output in the original test order.
    section_breakdown.sort(key=lambda x: x["section"])

    return {
        "totalMarks": total_marks,
        "scoredMarks": scored_marks,
        "percentage": percentage,
        "passed": passed,
        "passingPercent": float(passing_percent),
        "sectionBreakdown": section_breakdown,
        "review": review,
    }
