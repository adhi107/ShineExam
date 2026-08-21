"""
Canonical Intermediate Representation (IR) Models for Exam Creation Engine.
Enforces standard data contracts across document ingestion, visual detection,
grouping, ordering, answer validation, and final test serialization.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Union

@dataclass
class VisualAssetIR:
    visual_asset_id: str
    visual_asset_type: str  # clustered_bar, stacked_bar, bar, line, multi_line, pie, donut, table, diagram, figure, etc.
    visual_asset_path: str  # base64 data URI or HTTP storage URL
    source_page: int
    bounding_box: List[float] = field(default_factory=lambda: [0.0, 0.0, 500.0, 300.0])
    display_mode: str = "before_question"
    extracted_data: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class SharedContextIR:
    shared_context_id: str
    set_order: int
    directions: str
    visual_asset_id: Optional[str] = None
    visual_asset_type: Optional[str] = None
    source_page: int = 1
    extracted_data: Dict[str, Any] = field(default_factory=dict)
    question_ids: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class QuestionIR:
    question_id: str
    global_order: int
    section: str
    local_number: int
    question_type: str  # mcq, msq, text, ordering
    directions: str
    shared_context_id: Optional[str] = None
    shared_context_text: Optional[str] = None
    visual_asset_id: Optional[str] = None
    visual_asset_type: Optional[str] = None
    visual_asset_path: Optional[str] = None
    visual_source_page: int = 1
    question_text: str = ""
    options: List[str] = field(default_factory=list)
    correct_answer: Union[str, List[str]] = ""
    explanation: str = ""
    marks: int = 1
    negative_marks: float = 0.0
    source_question_number: Optional[int] = None
    section_question_index: int = 1
    global_sequence: int = 1
    source_page: int = 1
    source_order: int = 1
    chart_data: Optional[Dict[str, Any]] = None
    table_data: Optional[Dict[str, Any]] = None
    validation_status: str = "passed"
    validation_error: str = ""
    mapping_status: str = "SUCCESS"
    mapping_confidence: str = "HIGH"

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        return d

    def to_normalized_question(self) -> Dict[str, Any]:
        """Convert IR object to normalized JSON payload expected by backend API & frontend UI."""
        img_ref = self.visual_asset_path or ""
        v_refs = []
        if self.visual_asset_id or img_ref or self.chart_data or self.table_data:
            v_type = self.visual_asset_type or (
                'table' if self.table_data else (
                    self.chart_data.get('visual_type', 'bar_chart') if isinstance(self.chart_data, dict) else 'bar_chart'
                )
            )
            v_refs = [{
                "visualId": self.visual_asset_id or f"visual_{self.question_id}",
                "documentId": "doc_1",
                "pageNumber": self.source_page,
                "documentOrder": self.global_order,
                "boundingBox": [0, 0, 500, 300],
                "type": v_type,
                "visualType": v_type,
                "url": img_ref,
                "assetUrl": img_ref,
                "image": {
                    "storageUrl": img_ref,
                    "thumbnailUrl": img_ref,
                    "width": 1200,
                    "height": 800
                },
                "displayMode": "before_question",
                "structuredData": self.chart_data or self.table_data or {}
            }]

        # Construct stable option objects (A, B, C, D, E) and correct_option_id
        options_detail = []
        correct_option_id = ""
        letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

        for idx, opt_text in enumerate(self.options):
            let = letters[idx] if idx < len(letters) else f"OPT_{idx+1}"
            options_detail.append({"id": let, "text": opt_text})
            if self.correct_answer:
                if isinstance(self.correct_answer, str) and (self.correct_answer == opt_text or self.correct_answer == let or self.correct_answer.startswith(let)):
                    correct_option_id = let

        q_num_final = self.source_question_number or self.local_number or self.global_order
        return {
            "id": self.question_id,
            "question_id": self.question_id,
            "questionNumber": q_num_final,
            "source_question_number": q_num_final,
            "section_question_index": self.section_question_index or 1,
            "global_sequence": self.global_sequence or self.global_order,
            "sequence": self.global_sequence or self.global_order,
            "source_order": self.source_order,
            "type": self.question_type or 'mcq',
            "question": self.question_text,
            "questionText": self.question_text,
            "questionType": self.question_type or 'mcq',
            "context": self.shared_context_text or self.directions or "",
            "contextType": self.visual_asset_type or ('table' if self.table_data else ('graph' if self.chart_data else '')),
            "groupId": self.shared_context_id or (f"group_{self.visual_asset_id}" if self.visual_asset_id else ""),
            "sharedContentId": self.shared_context_id or (f"group_{self.visual_asset_id}" if self.visual_asset_id else ""),
            "context_id": self.shared_context_id or (f"group_{self.visual_asset_id}" if self.visual_asset_id else ""),
            "questionRange": None,
            "sharedContent": None,
            "options": self.options,
            "options_detail": options_detail,
            "correctAnswer": self.correct_answer or "",
            "correct_option_id": correct_option_id or (self.correct_answer if isinstance(self.correct_answer, str) else ""),
            "explanation": self.explanation or "",
            "section": self.section or "General",
            "marks": self.marks,
            "negativeMarks": self.negative_marks,
            "sourceType": "chart" if self.chart_data else ("table" if self.table_data else "text"),
            "sourceReference": {"page": self.source_page},
            "pageNumber": self.source_page,
            "region": {"x": 0, "y": 0, "width": 500, "height": 300},
            "visualId": self.visual_asset_id or (v_refs[0]["visualId"] if v_refs else ""),
            "visual_id": self.visual_asset_id or (v_refs[0]["visualId"] if v_refs else ""),
            "visualIds": [self.visual_asset_id] if self.visual_asset_id else ([v_refs[0]["visualId"]] if v_refs else []),
            "imageReference": img_ref,
            "visual_asset": img_ref,
            "visualReferences": v_refs,
            "visuals": v_refs,
            "chartData": self.chart_data,
            "tableData": self.table_data,
            "visual_data": self.chart_data or self.table_data,
            "mappingStatus": self.mapping_status,
            "mappingConfidence": self.mapping_confidence,
            "validationStatus": self.validation_status,
            "validationError": self.validation_error
        }
