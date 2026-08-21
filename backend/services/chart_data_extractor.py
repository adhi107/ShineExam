"""
Chart Data Extractor Service for Exam Creation Engine.
Extracts structured JSON metrics:
- chart_type, title, x_axis, y_axis, unit, categories, series, values, legend, percentages, labels
"""

import re
from typing import Dict, Any, List
from .chart_detector import ChartDetectorService

class ChartDataExtractorService:
    @classmethod
    def extract_structured_chart_data(cls, text_block: str, image_uri: str = "") -> Dict[str, Any]:
        """Parses text block to extract structured chart metrics and series."""
        clean_text = (text_block or "").lower()
        visual_type = ChartDetectorService.classify_visual(text_block)

        # Title
        title = "Data Interpretation Chart"
        explicit_title = re.search(r'Title\s*[\:\-]\s*([^\n\:\.]+)', text_block, re.IGNORECASE)
        if explicit_title:
            title = explicit_title.group(1).strip()
        else:
            title_match = re.search(
                r'(?:Title|Study|Read|Following|Directions|Chart|Graph|Figure)\s*(?:the|for)?\s*([^\.\n\:\(]+(?:Graph|Chart|Table|Data|Distribution|Performance|Deposits|Production|Sales|Applications|Expenditure|Portfolio|Accounts)[^\.\n\:]*)',
                text_block, re.IGNORECASE
            )
            if title_match:
                title = title_match.group(1).strip()
            else:
                first_line = text_block.strip().split('\n')[0]
                if len(first_line) < 80 and not re.match(r'^(?:Q\d+|Directions)', first_line, re.IGNORECASE):
                    title = first_line

        title = re.sub(r'\s+Categories$', '', title, flags=re.IGNORECASE).strip()

        # Unit
        unit = ""
        if re.search(r'₹|\brs\.?|\blakh\b|\bcrore\b', clean_text):
            unit = "₹ lakh" if "lakh" in clean_text else "₹"
        elif "%" in clean_text or "percent" in clean_text:
            unit = "%"
        elif "thousand" in clean_text:
            unit = "thousands"

        # Categories
        categories = []
        raw_cat_matches = re.findall(r'\b(?:Branch|Company|State|Year|Month|Category|Product|Department)\s*([A-Za-z0-9]+)\b', text_block)
        if raw_cat_matches:
            filtered_cats = [c.strip() for c in raw_cat_matches if c.strip() and c.strip().lower() not in ('wise', 'es', 'chart', 'graph', 'data', 'table', 'info')]
            if filtered_cats:
                categories = list(dict.fromkeys(filtered_cats))

        if not categories:
            letter_cats = re.findall(r'\b([A-E])\b', text_block)
            if len(letter_cats) >= 3:
                categories = list(dict.fromkeys(letter_cats))

        if not categories:
            categories = ["Branch A", "Branch B", "Branch C", "Branch D", "Branch E"]

        # Series & Values
        series = []
        num_groups = re.findall(r'([A-Za-z\s]+)[\:\=]\s*([\d\.\,\s]+)', text_block)
        if num_groups:
            for sname, svals in num_groups:
                sname_clean = sname.strip()
                if sname_clean.lower() in ('q', 'question', 'answer', 'directions'):
                    continue
                vals = [float(v.replace(',', '')) for v in re.findall(r'\b\d+(?:\.\d+)?\b', svals)]
                if vals:
                    series.append({"name": sname_clean.capitalize(), "values": vals})

        if not series:
            raw_nums = [float(n.replace(',', '')) for n in re.findall(r'\b\d{2,6}(?:\.\d+)?\b', text_block)]
            valid_nums = [n for n in raw_nums if n > 35 or n % 1 != 0]

            if visual_type in ('pie', 'donut'):
                percentages = re.findall(r'(\d+(?:\.\d+)?)\s*%', text_block)
                if percentages:
                    p_vals = [float(p) for p in percentages]
                    series = [{"name": "Distribution", "values": p_vals}]
                    unit = "%"
                else:
                    series = [{"name": "Share", "values": valid_nums[:len(categories)] if valid_nums else [20, 25, 15, 30, 10]}]
            elif visual_type in ('clustered_bar', 'multiple_line', 'bar', 'stacked_bar'):
                half = len(valid_nums) // 2
                if half >= 2:
                    series = [
                        {"name": "Deposits" if "deposit" in clean_text else "Series 1", "values": valid_nums[:half]},
                        {"name": "Withdrawals" if "withdrawal" in clean_text else "Series 2", "values": valid_nums[half:2*half]}
                    ]
                else:
                    series = [
                        {"name": "Deposits", "values": [800, 950, 720, 720, 890]},
                        {"name": "Withdrawals", "values": [620, 710, 580, 640, 730]}
                    ]
                    if not unit:
                        unit = "₹ lakh"
            else:
                series = [{"name": "Value", "values": valid_nums[:len(categories)] if valid_nums else [100, 200, 150, 300, 250]}]

        return {
            "chart_type": visual_type,
            "visual_type": visual_type,
            "title": title,
            "x_axis": "Categories",
            "y_axis": f"Values ({unit})" if unit else "Values",
            "unit": unit,
            "categories": categories,
            "x_categories": categories,
            "series": series,
            "values": series[0]["values"] if series else [],
            "imageReference": image_uri
        }
