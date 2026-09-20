"""
backend/services/ai_evaluator.py
────────────────────────────────
AI-Assisted Evaluation Advisory Service for Descriptive / Mains Answers.
IMPORTANT: AI evaluation provides suggested scores, identified dimensions,
structural analysis, and keyword coverage ONLY as an assistant to human examiners.
Final marks and publication always require explicit human examiner authority.
"""

import re
from typing import Dict, Any, List


# Standard evaluation rubrics for competitive exams (UPSC / State PSC Mains)
STANDARD_RUBRICS = [
    {"parameter": "Introduction", "weight": 0.15, "description": "Contextual definition, thesis statement, and relevance to question directive."},
    {"parameter": "Content & Core Analysis", "weight": 0.35, "description": "Multi-dimensional depth (social, economic, political, environmental, constitutional)."},
    {"parameter": "Examples, Data & Case Studies", "weight": 0.20, "description": "Use of committee reports, statistics, constitutional articles, and contemporary examples."},
    {"parameter": "Structure & Flow", "weight": 0.15, "description": "Logical sequencing, subheadings, bullet points, and diagrammatic representation where needed."},
    {"parameter": "Conclusion & Way Forward", "weight": 0.15, "description": "Constructive, balanced, futuristic, and actionable solution."},
]


def analyze_descriptive_submission(
    question_text: str,
    student_text: str,
    max_marks: float,
    model_answer: str = "",
    expected_keywords: List[str] = None,
    min_words: int = 150,
    max_words: int = 250
) -> Dict[str, Any]:
    """
    Perform advisory heuristic & NLP analysis on descriptive submission.
    Returns structured feedback and suggested rubric marks for human examiner review.
    """
    words = [w for w in re.split(r"\s+", student_text.strip()) if w]
    word_count = len(words)
    char_count = len(student_text.strip())

    # 1. Word Count Compliance
    word_status = "Optimal"
    word_penalty = 0.0
    if word_count < min_words:
        word_status = f"Below minimum limit ({word_count}/{min_words} words)"
        word_penalty = 0.10
    elif max_words and word_count > max_words + 30:
        word_status = f"Exceeded limit ({word_count}/{max_words} words)"
        word_penalty = 0.05

    # 2. Structural Analysis (Paragraphs, Headings, Intro, Conclusion)
    paragraphs = [p.strip() for p in student_text.split("\n\n") if p.strip()]
    has_intro = len(paragraphs) >= 2
    has_conclusion = len(paragraphs) >= 3 or bool(re.search(r"(conclusion|way forward|in sum|overall|hence|therefore)", student_text, re.I))

    # 3. Keyword & Directive Match
    keywords_found = []
    keywords_missing = []
    if expected_keywords:
        for kw in expected_keywords:
            if re.search(r"\b" + re.escape(kw) + r"\b", student_text, re.I):
                keywords_found.append(kw)
            else:
                keywords_missing.append(kw)

    # 4. Multi-dimensional Coverage Detection
    dimensions_detected = []
    dim_patterns = {
        "Constitutional / Legal": r"(article|constitution|supreme court|judgment|act|section|law|parliament)",
        "Economic / Financial": r"(gdp|inflation|fiscal|budget|investment|economy|revenue|trade|employment)",
        "Social / Ethical": r"(poverty|gender|equality|health|education|vulnerable|welfare|society|rights)",
        "Environmental / Tech": r"(climate|sustainability|biodiversity|pollution|digital|ai|technology|green)",
        "Global / International": r"(un|geopolitics|treaty|bilateral|global|foreign policy|wto)",
    }
    for dim_name, pattern in dim_patterns.items():
        if re.search(pattern, student_text, re.I):
            dimensions_detected.append(dim_name)

    # 5. Suggested Rubric Marks Calculation
    rubric_scores = []
    total_suggested_raw = 0.0

    for r in STANDARD_RUBRICS:
        param = r["parameter"]
        weight = r["weight"]
        param_max = max_marks * weight

        score_ratio = 0.65  # Base competency baseline

        if param == "Introduction":
            score_ratio = 0.75 if has_intro else 0.45
        elif param == "Content & Core Analysis":
            ratio = len(dimensions_detected) / max(1, len(dim_patterns))
            score_ratio = min(0.85, 0.45 + (ratio * 0.45))
        elif param == "Examples, Data & Case Studies":
            score_ratio = 0.70 if len(keywords_found) >= 2 else 0.50
        elif param == "Structure & Flow":
            score_ratio = 0.75 if len(paragraphs) >= 3 else 0.55
        elif param == "Conclusion & Way Forward":
            score_ratio = 0.80 if has_conclusion else 0.40

        score_ratio = max(0.2, score_ratio - word_penalty)
        awarded = round(param_max * score_ratio, 1)
        total_suggested_raw += awarded

        rubric_scores.append({
            "parameter": param,
            "maxMarks": round(param_max, 1),
            "suggestedMarks": awarded,
            "remarks": f"Advisory evaluation based on {param.lower()} signals."
        })

    suggested_total = min(max_marks, round(total_suggested_raw, 1))

    # Construct observations for the examiner
    strengths = []
    if len(dimensions_detected) >= 3:
        strengths.append(f"Broad multi-dimensional coverage: {', '.join(dimensions_detected)}.")
    if has_conclusion:
        strengths.append("Structured 'Way Forward' / Conclusion observed.")
    if word_status == "Optimal":
        strengths.append("Strict word limit adherence.")

    improvements = []
    if keywords_missing:
        improvements.append(f"Consider citing key concepts/reports: {', '.join(keywords_missing[:3])}.")
    if not has_intro:
        improvements.append("Strengthen opening thesis and contextual framing.")
    if len(dimensions_detected) < 2:
        improvements.append("Expand discussion across socioeconomic, environmental, or legal dimensions.")

    return {
        "wordCount": word_count,
        "charCount": char_count,
        "wordStatus": word_status,
        "suggestedTotalMarks": suggested_total,
        "maxMarks": max_marks,
        "dimensionsDetected": dimensions_detected,
        "keywordsFound": keywords_found,
        "keywordsMissing": keywords_missing,
        "strengths": strengths or ["Good foundational attempt"],
        "improvementAreas": improvements or ["Deepen analytical rigor with current data"],
        "suggestedRubrics": rubric_scores,
        "disclaimer": "AI suggestion provided as advisory guidance. Final evaluation and marks are solely determined by the human examiner."
    }
