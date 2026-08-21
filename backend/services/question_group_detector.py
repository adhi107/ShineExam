import re
import unicodedata
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field

@dataclass
class ContextBlock:
    context_id: str
    type: str  # 'graph', 'table', 'passage', 'directions'
    text: str
    start_question: Optional[int] = None
    end_question: Optional[int] = None
    source_order: int = 0
    page: int = 1
    bbox: Optional[List[float]] = None
    assets: List[Dict[str, Any]] = field(default_factory=list)
    binding_mode: str = "explicit_range"  # 'explicit_range', 'section', 'unbound'
    section: Optional[str] = None
    image_reference: str = ""
    directions: str = ""
    extracted_data: Dict[str, Any] = field(default_factory=dict)
    visual_id: Optional[str] = None

    def contains_question(self, question_number: int) -> bool:
        if self.binding_mode == "explicit_range":
            if self.start_question is not None and self.end_question is not None:
                return self.start_question <= question_number <= self.end_question
            return False
        return False

    def applies_to_question(self, question_number: int, section_name: Optional[str] = None) -> bool:
        """
        Determines whether this shared context block applies to a given question number.
        Strictly enforces start_question <= question_number <= end_question.
        """
        if self.binding_mode == "explicit_range":
            if self.start_question is not None and self.end_question is not None:
                return self.start_question <= question_number <= self.end_question
            return False
        elif self.binding_mode == "section":
            return bool(self.section and section_name and self.section.strip().lower() == section_name.strip().lower())
        return False


class QuestionGroupDetectorService:
    @staticmethod
    def normalize_dashes(text: str) -> str:
        """Normalizes all unicode dash/hyphen variants to ASCII hyphen."""
        if not text:
            return ""
        # Unicode normalization (NFKC)
        norm = unicodedata.normalize('NFKC', text)
        # Normalize various unicode dashes/hyphens/minus signs
        norm = re.sub(r'[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]', '-', norm)
        return norm

    # Comprehensive direction & range patterns covering all variations
    DIRECTION_PATTERNS = [
        # Directions (Q31-35), Directions (Q. 31-35), Directions (Questions 31 to 35), Directions (31-35), Directions: Q31 to 35, Directions (Q31 to Q35)
        r'^(?:Directions|Instruction|Notice|Note)\s*[\(\:\-]?\s*(?:(?:for\s+)?(?:questions?|qs?\.?|q\.?)\s*)?(\d{1,4})\s*(?:-|(?:\s+(?:to|through|thru|and|-)\s+)|\b(?:to|through|thru|and)\b)\s*(?:(?:questions?|qs?\.?|q\.?)\s*)?(\d{1,4})\s*[\)\:\.\-]?',
        # Questions 31 to 35, Questions 31-35, Q31-35, Q.31 to 35, For questions 31 to 35, Questions 31 through 35, Read the following for questions 36-40
        r'^(?:(?:for|read|study|consider|based\s+on|following|passage)\s+)?(?:questions?|qs?\.?|q\.?)\s*(\d{1,4})\s*(?:-|(?:\s+(?:to|through|thru|and|-)\s+)|\b(?:to|through|thru|and)\b)\s*(?:(?:questions?|qs?\.?|q\.?)\s*)?(\d{1,4})\s*[\)\:\.\-]?',
        # Refer to the following data / Study the following graph / Read passage for questions 31-35 / Q31-35
        r'^(?:refer|study|read|consider|based\s+on|following\s+data|passage|graph|chart|table).*?\b(?:questions?|qs?\.?|q\.?)\s*(\d{1,4})\s*(?:-|(?:\s+(?:to|through|thru|and|-)\s+)|\b(?:to|through|thru|and)\b)\s*(?:(?:questions?|qs?\.?|q\.?)\s*)?(\d{1,4})',
        # Passage 1 (Q36-40) / Part A (Q1-5)
        r'^(?:Passage|Part|Section)\s*\d*\s*[\(\[]\s*(?:(?:questions?|qs?\.?|q\.?)\s*)?(\d{1,4})\s*(?:-|(?:\s+(?:to|through|thru|and|-)\s+)|\b(?:to|through|thru|and)\b)\s*(?:(?:questions?|qs?\.?|q\.?)\s*)?(\d{1,4})\s*[\)\]]',
        # Standalone range at line start like (Q31-35), (31-35), [Q31-35], [36-40]
        r'^[\(\[]\s*(?:Q(?:uestions?|s)?\.?\s*)?(\d{1,4})\s*-\s*(?:Q(?:uestions?|s)?\.?\s*)?(\d{1,4})\s*[\)\]]',
        # Direct Q31-35 or Q31 to Q35 at line start
        r'^\bQ\.?\s*(\d{1,4})\s*(?:-|(?:\s+(?:to|through|thru|and|-)\s+)|\b(?:to|through|thru|and)\b)\s*Q?\.?\s*(\d{1,4})\b',
        # 36 to 40 or 36-40 at line start if line is short
        r'^(\d{1,4})\s*(?:-|(?:\s+(?:to|through|thru)\s+)|\b(?:to|through|thru)\b)\s*(\d{1,4})\b'
    ]

    @classmethod
    def detect_question_range(cls, text: str) -> Optional[Tuple[int, int]]:
        """Extracts start and end question numbers from direction header text if present."""
        if not text:
            return None
        norm_text = cls.normalize_dashes(text.strip())
        for pat in cls.DIRECTION_PATTERNS:
            m = re.search(pat, norm_text, re.IGNORECASE)
            if m:
                try:
                    q_start = int(m.group(1))
                    q_end = int(m.group(2))
                    if 0 < q_start <= q_end <= 1000:
                        return (q_start, q_end)
                except (ValueError, IndexError):
                    pass
        return None

    @classmethod
    def is_direction_header(cls, text: str) -> bool:
        """Determines if a text line is a direction/shared context header."""
        if not text:
            return False
        clean = cls.normalize_dashes(text.strip())
        if re.match(r'^(?:Directions|Read the following|Consider the|Study the|PART\s+[A-Z]|Refer\s+to)', clean, re.IGNORECASE):
            return True
        return cls.detect_question_range(clean) is not None

    @classmethod
    def validate_question_context_mapping(cls, questions: List[Dict[str, Any]], context_blocks: List[ContextBlock]) -> List[Dict[str, Any]]:
        """
        Validates question-to-context and question-to-visual mappings.
        Enforces start_question <= q_num <= end_question and semantic entity matching.
        Removes mismatched visuals/contexts when out-of-range or semantically conflicting.
        """
        from services.multimodal_parser import SemanticVisualMappingService

        for q in questions:
            q_num = q.get('source_question_number') or q.get('questionNumber') or q.get('local_number') or q.get('q_num') or 0
            q_ctx = q.get('context', '')
            q_chart = q.get('chartData')

            # 1. Range Validation against Authoritative Source Question Number
            q_range = cls.detect_question_range(q_ctx)
            if q_range and q_num > 0:
                start_q, end_q = q_range
                if not (start_q <= q_num <= end_q):
                    # Question is outside direction header range -> remove leaked context & visual
                    q['context'] = ""
                    q['contextType'] = ""
                    q['groupId'] = ""
                    q['sharedContentId'] = None
                    q['questionRange'] = None
                    q['sharedContent'] = None
                    q['context_id'] = None
                    q['visualId'] = None
                    q['visual_id'] = None
                    q['chartData'] = None
                    q['imageReference'] = ""
                    q['visualReferences'] = []
                    q['mappingStatus'] = "FAILED"
                    q['validationStatus'] = "NEEDS_REVIEW"
                    q['mappingConfidence'] = "LOW"
                    q['validationError'] = f"CONTEXT_QUESTION_NUMBER_MISMATCH: Question number {q_num} is outside context range Q{start_q}-Q{end_q}."
                    continue

            # 2. Semantic Entity Match Validation
            if q_chart and isinstance(q_chart, dict) and q_chart.get('series'):
                match_ok, err_msg = SemanticVisualMappingService.validate_semantic_match(q.get('question', ''), q_ctx, q_chart)
                if not match_ok:
                    q['mappingStatus'] = "FAILED"
                    q['mappingConfidence'] = "LOW"
                    q['validationStatus'] = "NEEDS_REVIEW"
                    q['validationError'] = err_msg or "Question entity conflict with chart categories."
                else:
                    q['mappingStatus'] = "SUCCESS"
                    q['mappingConfidence'] = "HIGH"
                    q['validationStatus'] = "passed"
                    q['validationError'] = ""

        return questions
