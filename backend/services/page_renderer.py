"""
Page Renderer Service for Exam Creation Engine.
Renders document pages (PDF, DOCX, Images) to high-resolution images
for visual asset extraction, cropping, and OCR analysis.
"""

import io
import base64
from typing import Tuple, Optional

try:
    import fitz  # PyMuPDF
    _HAVE_FITZ = True
except ImportError:
    _HAVE_FITZ = False

try:
    from PIL import Image
    _HAVE_PIL = True
except ImportError:
    _HAVE_PIL = False

class PageRendererService:
    @staticmethod
    def render_pdf_page_to_png(fitz_page, dpi: int = 200) -> Tuple[bytes, str]:
        """Renders PyMuPDF page object to PNG bytes and base64 data URI."""
        if not _HAVE_FITZ or fitz_page is None:
            return b"", ""
        try:
            pix = fitz_page.get_pixmap(dpi=dpi)
            img_bytes = pix.tobytes("png")
            b64_str = base64.b64encode(img_bytes).decode('utf-8')
            return img_bytes, f"data:image/png;base64,{b64_str}"
        except Exception:
            return b"", ""

    @staticmethod
    def crop_region_to_base64(page_img_bytes: bytes, bbox: Tuple[float, float, float, float]) -> str:
        """Crops a specific bounding box region from page image bytes."""
        if not _HAVE_PIL or not page_img_bytes:
            return ""
        try:
            img = Image.open(io.BytesIO(page_img_bytes))
            x0, y0, x1, y1 = [max(0, int(v)) for v in bbox]
            if x1 <= x0 or y1 <= y0:
                return ""
            cropped = img.crop((x0, y0, min(img.width, x1), min(img.height, y1)))
            buf = io.BytesIO()
            cropped.save(buf, format="PNG")
            b64_str = base64.b64encode(buf.getvalue()).decode('utf-8')
            return f"data:image/png;base64,{b64_str}"
        except Exception:
            return ""
