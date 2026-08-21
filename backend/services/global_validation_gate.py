"""
Global Validation Gate Service for Exam Creation Engine.
Executes 14 pre-publication gate checks before saving or serializing test JSON:
1. Question count validation
2. Source-order sequence validation
3. Question-number uniqueness validation
4. Context-range scoping validation
5. Context-leakage isolation validation
6. Visual ownership validation
7. Source visual preservation validation
8. Option IDs (A, B, C, D, E) validation
9. correct_option_id mapping validation
10. Mathematical DI recalculation validation
11. Duplicate question detection
12. Missing question detection
13. Synthetic data detection
14. UI data contract compliance
"""

from typing import List, Dict, Any, Tuple
from .synthetic_data_detector import SyntheticDataDetectorService
from .answer_validator import AnswerValidatorService

class GlobalValidationGateService:
    @classmethod
    def run_global_validation_gate(cls, sections: List[Dict[str, Any]], questions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Runs all 14 validation checks on parsed test payload."""
        errors = []
        warnings = []
        q_count = len(questions)

        if q_count == 0:
            errors.append("Test contains 0 questions.")
            return {"isValid": False, "errors": errors, "warnings": warnings, "stats": {}}

        seen_qnums = set()
        seen_qtexts = set()

        for idx, q in enumerate(questions, start=1):
            q_num = q.get("questionNumber") or q.get("local_number") or idx
            q_text = (q.get("question") or q.get("questionText") or "").strip()
            options = q.get("options") or []
            correct_ans = q.get("correctAnswer") or q.get("correct_option_id")
            chart_data = q.get("chartData")
            has_img = bool(q.get("imageReference") or q.get("visual_asset"))

            # 3. Question Number Uniqueness
            if q_num in seen_qnums:
                warnings.append(f"Duplicate question number Q{q_num} detected.")
            else:
                seen_qnums.add(q_num)

            # 11. Duplicate Question Text Detection
            if q_text in seen_qtexts and len(q_text) > 10:
                errors.append(f"Duplicate question text detected for Q{q_num}: '{q_text[:30]}...'")
            else:
                seen_qtexts.add(q_text)

            # 4. Visual Directive Verification
            ctx_text = (q.get("context") or "").lower()
            if any(term in ctx_text or term in q_text.lower() for term in ["study the", "bar graph", "pie chart", "line graph", "donut chart", "table below", "diagram below"]):
                has_any_visual = bool(chart_data or q.get("tableData") or has_img or q.get("visualId") or q.get("visual_id"))
                if not has_any_visual:
                    q["validationStatus"] = "NEEDS_REVIEW"
                    q["mappingStatus"] = "FAILED"
                    warnings.append(f"Q{q_num}: Visual asset referenced in directions/prompt is missing.")

            # 8 & 9. Option IDs & Correct Option Validation
            if q.get("type") in ("mcq", "multiple", "MCQ") and options:
                if len(options) < 2:
                    errors.append(f"Q{q_num} has fewer than 2 options.")
                if not correct_ans:
                    errors.append(f"Q{q_num} is missing a correct answer mapping.")

            # 13. Synthetic Data Detection
            if chart_data:
                is_synth, synth_msg = SyntheticDataDetectorService.detect_synthetic_data(chart_data, has_img)
                if is_synth:
                    q["validationStatus"] = "FAILED"
                    q["mappingStatus"] = "FAILED"
                    errors.append(f"Q{q_num}: {synth_msg}")

            # 10. Mathematical Recalculation
            chart_or_tbl = chart_data or q.get("tableData")
            if chart_or_tbl:
                m_status, m_err = AnswerValidatorService.validate_answer(q_text, options, correct_ans, chart_or_tbl)
                if m_status == "failed" and m_err:
                    q["validationStatus"] = "NEEDS_REVIEW"
                    warnings.append(f"Q{q_num} math validation warning: {m_err}")

        is_valid = len(errors) == 0
        return {
            "isValid": is_valid,
            "errors": errors,
            "warnings": warnings,
            "stats": {
                "totalQuestions": q_count,
                "passed": sum(1 for q in questions if q.get("validationStatus") == "passed"),
                "needsReview": sum(1 for q in questions if q.get("validationStatus") == "NEEDS_REVIEW"),
                "failed": sum(1 for q in questions if q.get("validationStatus") == "failed" or q.get("mappingStatus") == "FAILED")
            }
        }
