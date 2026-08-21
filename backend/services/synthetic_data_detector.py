"""
Synthetic Data Detector Service for Exam Creation Engine.
Detects and rejects unvalidated generic/fallback visual data (Branch A-E, default values/percentages)
in production question payloads.
"""

from typing import Dict, Any, Tuple

class SyntheticDataDetectorService:
    SUSPICIOUS_CATEGORIES = {
        ('branch a', 'branch b', 'branch c', 'branch d', 'branch e'),
        ('category a', 'category b', 'category c', 'category d', 'category e')
    }

    SUSPICIOUS_SERIES_VALUES = [
        [800.0, 950.0, 720.0, 720.0, 890.0],
        [620.0, 710.0, 580.0, 640.0, 730.0],
        [100.0, 200.0, 150.0, 300.0, 250.0],
        [20.0, 25.0, 15.0, 30.0, 10.0]
    ]

    @classmethod
    def detect_synthetic_data(cls, chart_data: Dict[str, Any], has_original_image: bool = False) -> Tuple[bool, str]:
        """
        Scans chart_data dictionary to check if it contains generic fallback data without source image verification.
        Returns (is_synthetic: bool, reason: str).
        """
        if not chart_data or not isinstance(chart_data, dict):
            return False, ""

        # If question has an original document image asset verified, structured fallback for rendering is acceptable
        if has_original_image or chart_data.get("imageReference") or chart_data.get("assetUrl"):
            return False, ""

        categories = tuple(str(c).strip().lower() for c in (chart_data.get("categories") or chart_data.get("x_categories") or []))
        if categories in cls.SUSPICIOUS_CATEGORIES:
            return True, f"Unvalidated synthetic category sequence detected: {list(categories)}"

        series = chart_data.get("series") or []
        for s in series:
            if isinstance(s, dict):
                vals = [float(v) for v in s.get("values", [])]
                if vals in cls.SUSPICIOUS_SERIES_VALUES:
                    return True, f"Unvalidated synthetic series values detected: {vals}"

        return False, ""
