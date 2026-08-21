"""
Answer Validator Service for Exam Creation Engine.
Validates question answers by recalculating numerical DI answers against extracted chart/table data
and matching calculated values against option choices.
"""

import re
from typing import Dict, Any, List, Tuple

class AnswerValidatorService:
    @classmethod
    def validate_answer(cls, question_text: str, options: List[str], current_answer: Any, chart_or_table_data: Dict[str, Any]) -> Tuple[str, str]:
        """
        Validates answer mathematically if question is numerical DI.
        Returns tuple of (validation_status: 'passed'|'failed', validation_error: str).
        """
        if not options:
            return "passed", ""

        # If numerical DI question (e.g. Total deposits in branches B and D = ?)
        if chart_or_table_data and isinstance(chart_or_table_data, dict) and "series" in chart_or_table_data:
            series = chart_or_table_data.get("series", [])
            categories = chart_or_table_data.get("categories", ["A", "B", "C", "D", "E"])

            # Check for addition pattern e.g., "branches B and D"
            cat_matches = re.findall(r'\b([A-E])\b', question_text)
            if len(cat_matches) >= 2 and series:
                target_cats = set(cat_matches)
                total = 0.0
                matched_count = 0
                for cat_idx, cat_name in enumerate(categories):
                    cat_letter = cat_name.split()[-1] if ' ' in cat_name else cat_name
                    if cat_letter in target_cats or cat_name in target_cats:
                        for s in series:
                            vals = s.get("values", [])
                            if cat_idx < len(vals):
                                total += float(vals[cat_idx])
                                matched_count += 1

                if matched_count > 0:
                    # Check if total matches an option
                    str_total = str(int(total)) if total.is_integer() else str(total)
                    matching_option = next((opt for opt in options if str_total in opt), None)
                    if matching_option and current_answer and matching_option != current_answer and current_answer not in matching_option:
                        return "failed", f"Mathematical recalculation ({str_total}) indicates correct option is '{matching_option}' rather than '{current_answer}'."

        # Validate that selected answer exists in available options
        if current_answer and options:
            if isinstance(current_answer, list):
                invalid = [a for a in current_answer if a not in options]
                if invalid:
                    return "failed", f"Selected answer choices {invalid} do not exist in options."
            elif isinstance(current_answer, str) and current_answer.strip():
                if current_answer not in options and not any(current_answer in opt for opt in options):
                    return "failed", f"Selected answer '{current_answer}' does not match available options."

        return "passed", ""
