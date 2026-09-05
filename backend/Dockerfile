FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1

# Install system dependencies for document conversion (LibreOffice), 
# PDF/Image processing (Poppler, OpenCV), OCR (Tesseract), and fonts.
RUN apt-get update && apt-get install -y \
    gcc \
    libreoffice \
    fonts-liberation \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    fontconfig \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    --no-install-recommends \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

# Install all Python dependencies from requirements.txt
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5001

CMD ["gunicorn", "-b", "0.0.0.0:5001", "--workers", "4", "--threads", "4", "--timeout", "120", "app:app"]
