"""
Chart Detector & Classification Service for Exam Creation Engine.
Classifies visual assets and text blocks into 15 supported visual categories:
- bar, clustered_bar, stacked_bar, horizontal_bar
- line, multiple_line
- pie, donut
- area, scatter, table
- diagram, flowchart, seating_arrangement, other_visual
"""

import re
from typing import Dict, Any, List, Optional

class ChartDetectorService:
    CLASSIFICATION_PATTERNS = [
        ('clustered_bar', [r'clustered\s+bar', r'deposits.*withdrawals', r'branch-wise', r'branch\s+[a-e]']),
        ('stacked_bar', [r'stacked\s+bar', r'total\s+and\s+part', r'stacked']),
        ('horizontal_bar', [r'horizontal\s+bar']),
        ('bar', [r'bar\s+graph', r'bar\s+chart', r'histogram']),
        ('multiple_line', [r'multi.*line', r'dual\s+line', r'line\s+graph.*trend', r'growth\s+rate']),
        ('line', [r'line\s+graph', r'line\s+chart', r'trend']),
        ('donut', [r'donut', r'doughnut']),
        ('pie', [r'pie\s+chart', r'pie\s+graph', r'share', r'percentage\s+distribution', r'sector']),
        ('area', [r'area\s+chart', r'area\s+graph']),
        ('scatter', [r'scatter', r'dot\s+plot']),
        ('table', [r'\|', r'table', r'matrix', r'tabular']),
        ('seating_arrangement', [r'circular\s+table', r'facing\s+center', r'seated\ placed', r'linear\s+row', r'north\s+south']),
        ('flowchart', [r'flow\s*chart', r'process\s+diagram', r'state\s+diagram']),
        ('diagram', [r'venn\s+diagram', r'syllogism\s+diagram', r'circuit', r'ray\s+diagram', r'figure']),
    ]

    @classmethod
    def classify_visual(cls, text_context: str, visual_metadata: Optional[Dict[str, Any]] = None) -> str:
        """Classifies text context and visual cues into canonical visual type."""
        clean_text = (text_context or "").lower()

        for visual_type, patterns in cls.CLASSIFICATION_PATTERNS:
            if any(re.search(pat, clean_text) for pat in patterns):
                return visual_type

        if visual_metadata and visual_metadata.get('type'):
            vtype = visual_metadata.get('type')
            if vtype in ('image', 'vector_chart'):
                return 'clustered_bar' if 'bar' in clean_text else 'diagram'

        return 'other_visual'
