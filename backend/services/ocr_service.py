"""
OCR Service for Exam Creation Engine.
Provides fallback text and layout extraction for scanned documents and image-only question papers.
"""

import io
from typing import Optional

try:
    from PIL import Image
    _HAVE_PIL = True
except ImportError:
    _HAVE_PIL = False

try:
    import pytesseract
    _HAVE_TESSERACT = True
except Exception:
    _HAVE_TESSERACT = False

class OCRService:
    @staticmethod
    def extract_text_from_image_bytes(image_bytes: bytes) -> str:
        """Extracts text from raw image bytes via Pytesseract OCR."""
        if not _HAVE_PIL or not _HAVE_TESSERACT or not image_bytes:
            return ""
        try:
            img = Image.open(io.BytesIO(image_bytes))
            return pytesseract.image_to_string(img)
        except Exception:
            return ""

    @staticmethod
    def extract_text_from_pil_image(img) -> str:
        """Extracts text from a PIL Image instance."""
        if not _HAVE_TESSERACT or img is None:
            return ""
        try:
            return pytesseract.image_to_string(img)
        except Exception:
            return ""
