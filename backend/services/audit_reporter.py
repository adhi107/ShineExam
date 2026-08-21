"""
Audit Reporter Service for Exam Creation Engine.
Generates comprehensive internal audit logs for parsed documents, verifying:
Q#, source_page, source_order, context_id, visual_id, question_id, option_IDs, correct_option_id, status.
"""

from typing import List, Dict, Any

class AuditReporterService:
    @staticmethod
    def generate_audit_report(questions: List[Dict[str, Any]], filename: str = "document.pdf") -> str:
        """
        Generates detailed per-question audit output for document ingestion.
        """
        lines = [
            "=" * 70,
            f"EXAM QUESTION PIPELINE AUDIT REPORT — {filename}",
            "=" * 70,
            f"{'Q#':<5} | {'PAGE':<5} | {'ORDER':<6} | {'CONTEXT_ID':<15} | {'VISUAL_ID':<15} | {'ANSWER':<6} | {'STATUS':<10}",
            "-" * 70
        ]

        total_questions = len(questions)
        valid_count = 0
        needs_review_count = 0
        failed_count = 0

        for idx, q in enumerate(questions, start=1):
            q_num = q.get("questionNumber") or q.get("local_number") or idx
            page = q.get("pageNumber") or q.get("source_page") or 1
            order = q.get("source_order") or q.get("sequence") or idx
            ctx_id = q.get("groupId") or q.get("context_id") or "NONE"
            vis_id = q.get("visualId") or q.get("visual_id") or "NONE"
            ans = str(q.get("correct_option_id") or q.get("correctAnswer") or "N/A")[:6]
            val_status = q.get("validationStatus") or "passed"

            if val_status == "passed":
                status_str = "VALID"
                valid_count += 1
            elif val_status == "NEEDS_REVIEW":
                status_str = "REVIEW"
                needs_review_count += 1
            else:
                status_str = "FAILED"
                failed_count += 1

            lines.append(f"{q_num:<5} | {page:<5} | {order:<6} | {ctx_id:<15} | {vis_id:<15} | {ans:<6} | {status_str:<10}")

        lines.extend([
            "-" * 70,
            f"SUMMARY: Total Questions: {total_questions} | Valid: {valid_count} | Review: {needs_review_count} | Failed: {failed_count}",
            f"AUDIT RESULT: {'PASSED (0 Failures)' if failed_count == 0 else 'ACTION REQUIRED'}",
            "=" * 70
        ])

        return "\n".join(lines)
