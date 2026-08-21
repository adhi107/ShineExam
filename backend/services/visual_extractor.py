"""
Visual Extractor Service for Exam Creation Engine.
Detects vector drawings, raster image streams, figures, diagrams, and tables.
Preserves original document visual assets as cropped snapshots.
"""

from typing import List, Dict, Any, Tuple
from .page_renderer import PageRendererService

try:
    import fitz  # PyMuPDF
    _HAVE_FITZ = True
except ImportError:
    _HAVE_FITZ = False

class VisualExtractorService:
    @staticmethod
    def extract_page_visuals(fitz_page, page_num: int = 1) -> List[Dict[str, Any]]:
        """
        Detects vector drawings, charts, and embedded raster image streams on a PyMuPDF page.
        Returns visual region records with bounding boxes and original cropped snapshot URIs.
        """
        visuals = []
        if not _HAVE_FITZ or fitz_page is None:
            return visuals

        page_rect = fitz_page.rect
        page_img_bytes, page_data_uri = PageRendererService.render_pdf_page_to_png(fitz_page)

        # 1. Embedded Image Streams
        try:
            image_list = fitz_page.get_images(full=True)
            for idx, img_info in enumerate(image_list):
                xref = img_info[0]
                try:
                    rects = fitz_page.get_image_rects(xref)
                    bbox = (rects[0].x0, rects[0].y0, rects[0].x1, rects[0].y1) if rects else (0, 0, page_rect.width, page_rect.height)
                except Exception:
                    bbox = (0, 0, page_rect.width, page_rect.height)

                cropped_uri = PageRendererService.crop_region_to_base64(page_img_bytes, bbox) if page_img_bytes else page_data_uri
                visuals.append({
                    "visualId": f"visual_p{page_num}_img_{xref}_{idx}",
                    "type": "image",
                    "bbox": list(bbox),
                    "url": cropped_uri or page_data_uri,
                    "page": page_num
                })
        except Exception:
            pass

        # 2. Vector Drawings (Graphs, Charts, Line plots)
        try:
            drawings = fitz_page.get_drawings()
            if drawings and len(drawings) >= 2:
                x0s = [d['rect'].x0 for d in drawings if hasattr(d['rect'], 'x0')]
                y0s = [d['rect'].y0 for d in drawings if hasattr(d['rect'], 'y0')]
                x1s = [d['rect'].x1 for d in drawings if hasattr(d['rect'], 'x1')]
                y1s = [d['rect'].y1 for d in drawings if hasattr(d['rect'], 'y1')]
                if x0s and y0s and x1s and y1s:
                    v_bbox = (min(x0s), min(y0s), max(x1s), max(y1s))
                    cropped_v_uri = PageRendererService.crop_region_to_base64(page_img_bytes, v_bbox) if page_img_bytes else page_data_uri
                    visuals.append({
                        "visualId": f"visual_p{page_num}_drawings",
                        "type": "vector_chart",
                        "bbox": list(v_bbox),
                        "url": cropped_v_uri or page_data_uri,
                        "page": page_num,
                        "drawingCount": len(drawings)
                    })
        except Exception:
            pass

        return visuals
