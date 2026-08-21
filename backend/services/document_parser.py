"""
Advanced document parser for government/banking exam question papers.
Supports: PDF (PyMuPDF + pdfplumber), DOCX, XLSX, CSV, TXT, JSON

Key features:
- Data Interpretation (DI) table detection and context grouping
- Passage/caselet-based question sets
- Multi-column PDF layout support (PyMuPDF reading order)
- Image/graph placeholder detection
- Banking exam section name normalisation (QA, GK, RC, etc.)
- Negative marks detection from instruction text
- Inline multi-option lines (A) 100  B) 200  C) 300  D) 400)
"""

import io
import re
import json
import csv
import math

# ── PDF libraries ──────────────────────────────────────────────────────────────
try:
    import fitz  # PyMuPDF
    _HAVE_FITZ = True
except ImportError:
    _HAVE_FITZ = False

try:
    import pdfplumber
    _HAVE_PLUMBER = True
except ImportError:
    _HAVE_PLUMBER = False

# Fallback
try:
    import PyPDF2
    _HAVE_PYPDF2 = True
except ImportError:
    _HAVE_PYPDF2 = False

# ── DOCX / XLSX ────────────────────────────────────────────────────────────────
try:
    import docx as python_docx
    _HAVE_DOCX = True
except ImportError:
    _HAVE_DOCX = False

try:
    import openpyxl
    _HAVE_OPENPYXL = True
except ImportError:
    _HAVE_OPENPYXL = False


# ──────────────────────────────────────────────────────────────────────────────
# PUBLIC ENTRY POINT
# ──────────────────────────────────────────────────────────────────────────────

from services.multimodal_parser import (
    DocumentIngestionService,
    ChartExtractionService,
    TableExtractionService,
    ValidationService,
    TestNormalizationService,
    MathContentParser
)
from services.question_group_detector import QuestionGroupDetectorService, ContextBlock

def parse_document_file(file_bytes: bytes, filename: str):
    """
    Multimodal document parser entry point.
    Parses PDF, DOCX, XLSX, CSV, TXT, JSON, and Images into unified exam structure.
    Integrates generic chart recognition, table grids, mathematical expressions,
    answer key ground truth, and independent validation.
    """
    valid, err, ext = DocumentIngestionService.validate_file(file_bytes, filename)
    if not valid:
        raise ValueError(err)

    if ext == 'json':
        sections, questions = _parse_json(file_bytes)
    elif ext in ('csv', 'xlsx', 'xls'):
        sections, questions = _parse_spreadsheet(file_bytes, ext)
    elif ext == 'docx':
        sections, questions = _parse_docx(file_bytes)
    elif ext == 'pdf':
        sections, questions = _parse_pdf(file_bytes)
    elif ext in ('png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'svg'):
        sections, questions = _parse_image_file(file_bytes, filename)
    else:
        text = file_bytes.decode('utf-8', errors='ignore')
        sections, questions = _parse_text(text)

    # Attach chart/table data, perform multimodal visual mapping, and validate IR questions
    context_visual_map = {}
    context_shared_map = {}

    def is_explicit_visual_direction(text: str) -> bool:
        if not text:
            return False
        return bool(re.search(
            r'\b(?:pie\s+chart|pie\s+graph|donut\s+chart|doughnut|bar\s+graph|bar\s+chart|line\s+graph|line\s+chart|clustered\s+bar|stacked\s+bar|histogram|scatter\s+plot|data\s+interpretation|graph|chart)\b',
            text,
            re.IGNORECASE
        ))

    from services.answer_validator import AnswerValidatorService

    for idx, q in enumerate(questions, start=1):
        ctx = q.get('context', '')
        ctx_type = q.get('contextType', '')
        img_ref = q.get('imageReference') or ''

        # Extract image reference from markdown if present in context
        if not img_ref and ctx:
            md_m = re.search(r'!\[.*?\]\((.*?)\)', ctx)
            if md_m:
                img_ref = md_m.group(1).strip()
                q['imageReference'] = img_ref

        # 1. Check if context contains table
        is_table = (ctx_type == 'table' or '|' in ctx or (q.get('sharedContent') and q['sharedContent'].get('type') == 'table'))
        if is_table:
            if not q.get('tableData'):
                q['tableData'] = TableExtractionService.parse_markdown_table(ctx)
            q['chartData'] = None
            q['contextType'] = 'table'
        else:
            # 2. Check if context contains visual chart/diagram
            is_real_visual = bool(
                img_ref or
                'data:image' in ctx or
                '![' in ctx or
                is_explicit_visual_direction(ctx)
            )
            if is_real_visual:
                if not q.get('chartData'):
                    q['chartData'] = ChartExtractionService.extract_chart_data(f"{ctx}\n{q.get('question', '')}")

                # Assign single shared visualId and sharedContextId for all questions in the set
                ctx_key = f"{ctx.strip()[:60]}_{img_ref[:30]}" if (ctx.strip() or img_ref) else f"q_{idx}"
                if ctx_key not in context_visual_map:
                    page_n = q.get('pageNumber', 1)
                    context_visual_map[ctx_key] = f"visual_p{page_n}_{len(context_visual_map) + 1}"
                    context_shared_map[ctx_key] = f"shared_ctx_p{page_n}_{len(context_shared_map) + 1}"

                q['visualId'] = context_visual_map[ctx_key]
                q['groupId'] = context_shared_map[ctx_key]

        # Mathematical & Option recalculation validation
        chart_or_tbl = q.get('chartData') or q.get('tableData')
        val_status, val_err = AnswerValidatorService.validate_answer(
            q.get('question', ''),
            q.get('options', []),
            q.get('correctAnswer', ''),
            chart_or_tbl
        )
        q['validationStatus'] = val_status
        q['validationError'] = val_err

    # Perform strict range scoping & semantic conflict validation across all questions
    from services.question_group_detector import QuestionGroupDetectorService
    questions = QuestionGroupDetectorService.validate_question_context_mapping(questions, [])

    # Run Global Validation Gate (14 pre-publication checks)
    from services.global_validation_gate import GlobalValidationGateService
    gate_res = GlobalValidationGateService.run_global_validation_gate(sections, questions)

    return TestNormalizationService.normalize_pipeline_output(sections, questions)



def _parse_image_file(file_bytes: bytes, filename: str):
    ext = (filename.rsplit('.', 1)[-1] if '.' in filename else 'png').lower()
    b64_str = base64.b64encode(file_bytes).decode('utf-8')
    data_uri = f"data:image/{ext};base64,{b64_str}"

    text = ""
    try:
        from PIL import Image
        import pytesseract
        try:
            import cv2
            import numpy as np
            nparr = np.frombuffer(file_bytes, np.uint8)
            img_cv = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img_cv is not None:
                gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                enhanced = clahe.apply(gray)
                pil_img = Image.fromarray(enhanced)
                text = pytesseract.image_to_string(pil_img, config='--psm 6').strip()
        except Exception:
            pass

        if not text or len(text) < 10:
            img = Image.open(io.BytesIO(file_bytes))
            ocr_text = pytesseract.image_to_string(img, config='--psm 3').strip()
            if ocr_text:
                text = ocr_text
    except Exception:
        pass

    if not text:
        text = f"Study the diagram / graph image below and answer the question:\n![Exam Diagram/Graph]({data_uri})\n1. Which option is correct?\nA) Option A\nB) Option B\nC) Option C\nD) Option D\nAnswer: A"
    else:
        text = f"![Exam Diagram/Graph]({data_uri})\n\n{text}"

    return _parse_text(text)



# ──────────────────────────────────────────────────────────────────────────────
# JSON PARSER
# ──────────────────────────────────────────────────────────────────────────────

def _parse_json(file_bytes: bytes):
    text = file_bytes.decode('utf-8', errors='ignore')
    data = json.loads(text)
    items = data if isinstance(data, list) else data.get('questions', [])

    sec_map = {}
    parsed_sections = []
    parsed_questions = []

    def get_sec_id(name):
        clean = _normalise_section(name or 'General')
        if clean not in sec_map:
            sid = f"sec_{len(sec_map) + 1}"
            sec_map[clean] = sid
            parsed_sections.append({'id': sid, 'name': clean})
        return sec_map[clean]

    for idx, item in enumerate(items, start=1):
        q_text = item.get('question') or item.get('q') or ''
        if not q_text.strip():
            continue

        options = item.get('options') or []
        if isinstance(options, str):
            options = [o.strip() for o in options.split(',') if o.strip()]

        correct_raw = (item.get('correctAnswer') or item.get('answer')
                       or item.get('ans') or '')
        options_clean = [str(o).strip() for o in options if str(o).strip()]
        mapped_ans = _map_answer(correct_raw, options_clean)

        q_type = item.get('type')
        if not q_type:
            if not options_clean:
                q_type = 'text'
            elif isinstance(mapped_ans, list) and len(mapped_ans) > 1:
                q_type = 'multiple'
            else:
                q_type = 'mcq'

        sec_name = item.get('section') or item.get('subject') or 'General'
        sec_id = get_sec_id(sec_name)
        marks = int(item.get('marks') or 1)
        neg_marks = float(item.get('negativeMarks') or item.get('negative_marks') or 0)

        parsed_questions.append({
            'id': f"parsed_{idx}",
            'type': q_type,
            'question': q_text.strip(),
            'context': str(item.get('context') or '').strip(),
            'contextType': str(item.get('contextType') or ''),
            'options': options_clean if q_type in ('mcq', 'multiple') else [],
            'correctAnswer': mapped_ans if options_clean else str(correct_raw).strip(),
            'section': sec_id,
            'marks': max(1, marks),
            'negativeMarks': neg_marks,
        })

    if not parsed_sections:
        parsed_sections = [{'id': 'sec_1', 'name': 'General'}]
    return parsed_sections, parsed_questions


# ──────────────────────────────────────────────────────────────────────────────
# SPREADSHEET PARSER (XLSX / CSV)
# ──────────────────────────────────────────────────────────────────────────────

def _parse_spreadsheet(file_bytes: bytes, ext: str):
    rows = []
    if ext == 'csv':
        content = file_bytes.decode('utf-8', errors='ignore')
        reader = csv.reader(io.StringIO(content))
        rows = list(reader)
    else:
        if not _HAVE_OPENPYXL:
            return [{'id': 'sec_1', 'name': 'General'}], []
        wb = openpyxl.load_workbook(filename=io.BytesIO(file_bytes), data_only=True)
        sheet = wb.active
        for r in sheet.iter_rows(values_only=True):
            rows.append([str(cell) if cell is not None else '' for cell in r])

    if not rows:
        return [{'id': 'sec_1', 'name': 'General'}], []

    # Find header row
    header_idx = -1
    headers = []
    for idx, row in enumerate(rows):
        row_str = [str(c).strip().lower() for c in row]
        if any(h in row_str for h in ['question', 'q_text', 'question text', 'q']):
            header_idx = idx
            headers = row_str
            break

    sec_map = {}
    parsed_sections = []
    parsed_questions = []

    def get_sec_id(name):
        clean = _normalise_section(name or 'General')
        if clean not in sec_map:
            sid = f"sec_{len(sec_map) + 1}"
            sec_map[clean] = sid
            parsed_sections.append({'id': sid, 'name': clean})
        return sec_map[clean]

    if header_idx != -1:
        col = {
            'q': next((i for i, h in enumerate(headers) if 'question' in h or h == 'q'), None),
            'opt_a': next((i for i, h in enumerate(headers) if h in ('a', 'option a', 'option 1', 'opt a', 'choice a')), None),
            'opt_b': next((i for i, h in enumerate(headers) if h in ('b', 'option b', 'option 2', 'opt b', 'choice b')), None),
            'opt_c': next((i for i, h in enumerate(headers) if h in ('c', 'option c', 'option 3', 'opt c', 'choice c')), None),
            'opt_d': next((i for i, h in enumerate(headers) if h in ('d', 'option d', 'option 4', 'opt d', 'choice d')), None),
            'opt_e': next((i for i, h in enumerate(headers) if h in ('e', 'option e', 'option 5', 'opt e', 'choice e')), None),
            'options': next((i for i, h in enumerate(headers) if 'options' in h), None),
            'ans': next((i for i, h in enumerate(headers) if 'answer' in h or 'ans' in h or 'correct' in h or 'key' in h), None),
            'sec': next((i for i, h in enumerate(headers) if 'section' in h or 'subject' in h or 'topic' in h), None),
            'marks': next((i for i, h in enumerate(headers) if 'mark' in h or 'point' in h or 'score' in h), None),
            'neg': next((i for i, h in enumerate(headers) if 'negative' in h or 'penalty' in h), None),
            'type': next((i for i, h in enumerate(headers) if h == 'type'), None),
            'context': next((i for i, h in enumerate(headers) if 'context' in h or 'passage' in h or 'paragraph' in h), None),
            'explanation': next((i for i, h in enumerate(headers) if 'explanation' in h or 'solution' in h), None),
        }

        q_count = 0
        for row in rows[header_idx + 1:]:
            if not row or not any(row):
                continue
            if col['q'] is None or col['q'] >= len(row):
                continue
            q_text = str(row[col['q']]).strip()
            if not q_text:
                continue

            options = []
            if col['options'] is not None and col['options'] < len(row):
                opt_str = str(row[col['options']]).strip()
                if opt_str:
                    options = [o.strip() for o in re.split(r'[\n,;|]', opt_str) if o.strip()]

            if not options:
                for opt_key in ['opt_a', 'opt_b', 'opt_c', 'opt_d', 'opt_e']:
                    idx_col = col[opt_key]
                    if idx_col is not None and idx_col < len(row):
                        val = str(row[idx_col]).strip()
                        if val:
                            options.append(val)

            ans_val = _cell(row, col['ans'])
            sec_val = _normalise_section(_cell(row, col['sec']) or 'General')
            ctx_val = _cell(row, col['context'])

            marks_val = 1
            raw_marks = _cell(row, col['marks'])
            if raw_marks:
                try:
                    marks_val = int(float(raw_marks))
                except ValueError:
                    pass

            neg_val = 0.0
            raw_neg = _cell(row, col['neg'])
            if raw_neg:
                try:
                    neg_val = abs(float(raw_neg))
                except ValueError:
                    pass

            type_val = _cell(row, col['type']) or ''

            q_count += 1
            sec_id = get_sec_id(sec_val)
            mapped_ans = _map_answer(ans_val, options)

            if not type_val:
                if not options:
                    type_val = 'text'
                elif isinstance(mapped_ans, list) and len(mapped_ans) > 1:
                    type_val = 'multiple'
                else:
                    type_val = 'mcq'

            parsed_questions.append({
                'id': f"parsed_{q_count}",
                'type': type_val,
                'question': q_text,
                'context': ctx_val,
                'contextType': 'passage' if ctx_val else '',
                'options': options if type_val in ('mcq', 'multiple') else [],
                'correctAnswer': mapped_ans if options else ans_val,
                'section': sec_id,
                'marks': max(1, marks_val),
                'negativeMarks': neg_val,
            })

        if not parsed_sections:
            parsed_sections = [{'id': 'sec_1', 'name': 'General'}]
        return parsed_sections, parsed_questions
    else:
        lines = []
        for r in rows:
            line = ' '.join([str(c).strip() for c in r if c is not None and str(c).strip()])
            if line:
                lines.append(line)
        return _parse_text('\n'.join(lines))


# ──────────────────────────────────────────────────────────────────────────────
# DOCX PARSER
# ──────────────────────────────────────────────────────────────────────────────

def _parse_docx(file_bytes: bytes):
    if not _HAVE_DOCX:
        text = file_bytes.decode('utf-8', errors='ignore')
        return _parse_text(text)

    doc = python_docx.Document(io.BytesIO(file_bytes))
    blocks = []  # list of (type, text)

    # Extract embedded images from docx parts into a relationship mapping
    rel_image_map = {}
    try:
        for rel_id, rel in doc.part.related_parts.items():
            if hasattr(rel, 'content_type') and "image" in rel.content_type:
                try:
                    img_bytes = rel.blob
                    if img_bytes and len(img_bytes) > 200:
                        ext = rel.content_type.split("/")[-1]
                        if ext == 'jpeg':
                            ext = 'jpg'
                        b64_str = base64.b64encode(img_bytes).decode('utf-8')
                        rel_image_map[rel_id] = f"data:image/{ext};base64,{b64_str}"
                except Exception:
                    pass
    except Exception:
        pass

    def find_image_rids_in_element(element):
        rids = []
        for blip in element.iter('{http://schemas.openxmlformats.org/drawingml/2006/main}blip'):
            rid = blip.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed') or \
                  blip.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}link')
            if rid and rid in rel_image_map and rid not in rids:
                rids.append(rid)
        for vml in element.iter('{urn:schemas-microsoft-com:vml}imagedata'):
            rid = vml.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            if rid and rid in rel_image_map and rid not in rids:
                rids.append(rid)
        return rids

    body = doc.element.body
    used_rids = set()

    for child in body:
        tag = child.tag.split('}')[-1]

        if tag == 'p':
            para_text = ''.join(run.text for run in child.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}r')
                                 if hasattr(run, 'text') and run.text)
            para_text = para_text.strip()
            if para_text:
                blocks.append(('text', para_text))

            rids = find_image_rids_in_element(child)
            for rid in rids:
                data_uri = rel_image_map[rid]
                blocks.append(('graph', data_uri))
                used_rids.add(rid)

        elif tag == 'tbl':
            table_lines = []
            for tr in child.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tr'):
                cells = []
                for tc in tr.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tc'):
                    cell_text = ' '.join(
                        ''.join(r.text for r in tc.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}r')
                                if hasattr(r, 'text') and r.text).split()
                    )
                    cells.append(cell_text)
                    rids = find_image_rids_in_element(tc)
                    for rid in rids:
                        used_rids.add(rid)
                if any(cells):
                    table_lines.append(' | '.join(cells))
            if table_lines:
                blocks.append(('table', '\n'.join(table_lines)))

    # Fallback: if there were images in rel_image_map not found in paragraph traversal
    remaining_rids = [rid for rid in rel_image_map if rid not in used_rids]
    if remaining_rids:
        for rid in remaining_rids:
            data_uri = rel_image_map[rid]
            blocks.append(('graph', data_uri))

    # Convert blocks to flat lines with markers
    lines = []
    for btype, btext in blocks:
        if btype == 'table':
            lines.append('[TABLE_START]')
            lines.extend(btext.split('\n'))
            lines.append('[TABLE_END]')
        elif btype == 'graph':
            lines.append(f'![Extracted Diagram/Graph]({btext})')
        else:
            lines.extend(btext.split('\n'))

    return _parse_text('\n'.join(lines))


# ──────────────────────────────────────────────────────────────────────────────
# PDF PARSER — PyMuPDF + pdfplumber hybrid
# ──────────────────────────────────────────────────────────────────────────────

def _parse_pdf(file_bytes: bytes):
    """
    Primary: PyMuPDF for text layout + pdfplumber for tables.
    Fallback: PyPDF2 then raw decode.
    """
    try:
        if _HAVE_FITZ and _HAVE_PLUMBER:
            return _parse_pdf_advanced(file_bytes)
        elif _HAVE_FITZ:
            return _parse_pdf_fitz_only(file_bytes)
        elif _HAVE_PYPDF2:
            return _parse_pdf_pypdf2(file_bytes)
        else:
            text = file_bytes.decode('utf-8', errors='ignore')
            return _parse_text(text)
    except Exception:
        text = file_bytes.decode('utf-8', errors='ignore')
        return _parse_text(text)


def _parse_pdf_advanced(file_bytes: bytes):
    """PyMuPDF + pdfplumber hybrid with page-order table preservation and image extraction."""
    fitz_doc = fitz.open(stream=file_bytes, filetype='pdf')
    plumber_doc = pdfplumber.open(io.BytesIO(file_bytes))

    all_lines = []

    for page_no in range(len(fitz_doc)):
        fitz_page = fitz_doc[page_no]
        plumber_page = plumber_doc.pages[page_no]
        page_items = []
        table_bboxes = []

        for table in _extract_pdf_tables(plumber_page):
            bbox = table.get('bbox')
            rows = table.get('rows') or []
            if not bbox or not rows:
                continue
            table_bboxes.append(bbox)
            table_text = _format_table_rows(rows)
            if table_text:
                page_items.append(('table', bbox[1], bbox[0], table_text))

        for block in fitz_page.get_text('blocks'):
            if block[6] != 0:
                continue
            if any(_rects_overlap((block[0], block[1], block[2], block[3]), bbox) for bbox in table_bboxes):
                continue
            btext = _clean_extracted_text(block[4])
            if btext:
                page_items.append(('text', block[1], block[0], btext))

        # Extract embedded image graphics (bar charts, graphs, figures)
        has_large_raster_img = False
        try:
            image_list = fitz_page.get_images(full=True)
            if image_list:
                for img_idx, img_info in enumerate(image_list):
                    xref = img_info[0]
                    try:
                        base_img = fitz_doc.extract_image(xref)
                        img_bytes = base_img.get("image")
                        img_ext = base_img.get("ext", "png")
                        if img_bytes and len(img_bytes) > 2000: # Standard chart image stream
                            b64_str = base64.b64encode(img_bytes).decode('utf-8')
                            data_uri = f"data:image/{img_ext};base64,{b64_str}"
                            has_large_raster_img = True
                            img_rects = fitz_page.get_image_rects(xref)
                            y_pos = img_rects[0].y0 if img_rects else (fitz_page.rect.height - 0.5)
                            x_pos = img_rects[0].x0 if img_rects else img_idx
                            page_items.append(('graph', y_pos, x_pos, data_uri))
                    except Exception:
                        pass
        except Exception:
            pass

        # GUARANTEED VECTOR/DRAWED CHART EXTRACTION:
        # Whenever page contains chart/graph/direction keywords or vector drawings without a raster image,
        # render the page pixmap right after the direction block.
        page_text_lower = fitz_page.get_text().lower()
        has_drawings = False
        try:
            has_drawings = len(fitz_page.get_drawings()) > 0
        except Exception:
            pass

        is_di_page = any(kw in page_text_lower for kw in ['graph', 'chart', 'diagram', 'figure', 'study', 'direction', 'bar', 'line', 'pie', 'table', 'horizontal', 'vertical', 'donut', 'dual-line'])
        if (is_di_page or has_drawings) and not has_large_raster_img:
            try:
                pix = fitz_page.get_pixmap(dpi=150)
                img_bytes = pix.tobytes("png")
                if img_bytes and len(img_bytes) > 500:
                    b64_str = base64.b64encode(img_bytes).decode('utf-8')
                    data_uri = f"data:image/png;base64,{b64_str}"
                    # Position after first direction text block if found
                    dir_y = 10.0
                    for item in page_items:
                        if item[0] == 'text' and any(k in item[3].lower() for k in ['direction', 'study', 'graph', 'chart', 'table', 'passage']):
                            dir_y = item[1] + 1.0
                            break
                    page_items.append(('graph', dir_y, 0, data_uri))
            except Exception:
                pass

        for item in sorted(page_items, key=lambda item: (round(item[1] / 12), item[2])):
            kind = item[0]
            text = item[3]
            if kind == 'table':
                all_lines.append('[TABLE_START]')
                all_lines.extend(text.splitlines())
                all_lines.append('[TABLE_END]')
            elif kind == 'graph':
                all_lines.append(f'![Page Diagram / Chart]({text})')
            else:
                all_lines.extend(text.splitlines())

    plumber_doc.close()
    fitz_doc.close()

    return _parse_text('\n'.join(all_lines))



def _parse_pdf_fitz_only(file_bytes: bytes):
    """PyMuPDF only (no pdfplumber)."""
    doc = fitz.open(stream=file_bytes, filetype='pdf')
    text_parts = []
    for page in doc:
        has_img = False
        try:
            image_list = page.get_images(full=True)
            if image_list:
                for img_info in image_list:
                    base_img = doc.extract_image(img_info[0])
                    img_bytes = base_img.get("image")
                    img_ext = base_img.get("ext", "png")
                    if img_bytes and len(img_bytes) > 300:
                        b64_str = base64.b64encode(img_bytes).decode('utf-8')
                        text_parts.append(f"![Diagram]({f'data:image/{img_ext};base64,{b64_str}'})")
                        has_img = True
        except Exception:
            pass

        page_text = page.get_text().lower()
        has_drawings = False
        try:
            has_drawings = len(page.get_drawings()) > 0
        except Exception:
            pass

        is_di_page = any(kw in page_text for kw in ['graph', 'chart', 'diagram', 'figure', 'study', 'direction', 'bar', 'line', 'pie', 'table', 'horizontal', 'vertical', 'donut', 'dual-line'])
        if is_di_page or has_drawings:
            try:
                pix = page.get_pixmap(dpi=150)
                img_bytes = pix.tobytes("png")
                if img_bytes and len(img_bytes) > 500:
                    b64_str = base64.b64encode(img_bytes).decode('utf-8')
                    text_parts.append(f"![Diagram]({f'data:image/png;base64,{b64_str}'})")
            except Exception:
                pass

        blocks = page.get_text('blocks')
        blocks = sorted(blocks, key=lambda b: (round(b[1] / 20), b[0]))
        for block in blocks:
            if block[6] == 0:
                t = block[4].strip()
                if t:
                    text_parts.append(t)
    doc.close()
    return _parse_text('\n'.join(text_parts))


def _extract_pdf_tables(page):
    """Return real pdfplumber table grids with coordinates."""
    tables = []
    try:
        for table in page.find_tables():
            rows = table.extract()
            if rows and _looks_like_real_table(rows):
                tables.append({'bbox': table.bbox, 'rows': rows})
    except Exception:
        tables = []

    return tables


def _looks_like_real_table(rows):
    cleaned = [[str(cell or '').strip() for cell in row] for row in rows if row]
    meaningful = [row for row in cleaned if sum(1 for cell in row if cell) >= 2]
    return len(meaningful) >= 2


def _format_table_rows(rows):
    lines = []
    for row in rows:
        cells = [_clean_extracted_text(str(c or '')) for c in row]
        while cells and not cells[-1]:
            cells.pop()
        if any(cells):
            lines.append(' | '.join(cells))
    return '\n'.join(lines)


def _rects_overlap(a, b):
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    x_overlap = max(0, min(ax1, bx1) - max(ax0, bx0))
    y_overlap = max(0, min(ay1, by1) - max(ay0, by0))
    if x_overlap <= 0 or y_overlap <= 0:
        return False
    a_area = max(1, (ax1 - ax0) * (ay1 - ay0))
    overlap_area = x_overlap * y_overlap
    return overlap_area / a_area > 0.35


def _clean_extracted_text(text: str) -> str:
    if not text:
        return ''
    # Replace PDF unicode font encoding artifacts (square glyphs) with Rupee symbol ₹
    text = re.sub(r'[■\ufffd]', '₹', text)
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()


def _parse_pdf_pypdf2(file_bytes: bytes):
    """Fallback: PyPDF2."""
    import PyPDF2
    reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
    text_parts = []
    for page in reader.pages:
        txt = page.extract_text()
        if txt:
            text_parts.append(txt)
    return _parse_text('\n'.join(text_parts))


# ──────────────────────────────────────────────────────────────────────────────
# ANSWER MAPPER
# ──────────────────────────────────────────────────────────────────────────────

def _map_answer(ans_raw, options: list):
    """
    Maps answer raw input to matching option string or list of strings.
    Handles: 'B', 'Option 2', 'C) text', 'A, C', '32', 'Paris', etc.
    """
    if ans_raw is None or ans_raw == '':
        return ''

    if isinstance(ans_raw, list):
        mapped_list = []
        for a in ans_raw:
            res = _map_answer(a, options)
            if isinstance(res, list):
                for item in res:
                    if item and item not in mapped_list:
                        mapped_list.append(item)
            elif res and res not in mapped_list:
                mapped_list.append(res)
        return mapped_list

    raw_clean = str(ans_raw).strip()
    # Strip answer prefixes: "✔ Answer: C) SE37.", "Ans: Option 3"
    raw_clean = re.sub(
        r'^(?:[\s✔✅\*\-\[\]✓\+\.\:]*)?(?:Correct\s+|Right\s+)?Ans(?:wer)?[\s\:\-\=]*',
        '', raw_clean, flags=re.IGNORECASE
    ).strip()
    raw_clean = raw_clean.rstrip('.').strip()

    # Strip question number prefix if present, e.g. "3 - D", "31. C", "3: B"
    m_prefix = re.match(r'^\d{1,3}\s*[\.\:\-\–\—\)]\s*(.+)$', raw_clean)
    if m_prefix:
        raw_clean = m_prefix.group(1).strip()

    raw_clean = raw_clean.strip('()[]{}').strip()

    if not raw_clean:
        return ''
    if not options:
        return raw_clean

    # Letter + option text: "C) SE37" or "C. SE37" or "Option C: SE37"
    m_let_text = re.match(r'^(?:Option|Opt)?\s*([A-Ha-h1-8])[\.\)\:\-]\s*(.*)$', raw_clean, re.IGNORECASE)
    if m_let_text:
        let = m_let_text.group(1).upper()
        idx = (int(let) - 1) if let.isdigit() else (ord(let) - ord('A'))
        if 0 <= idx < len(options):
            return options[idx]

    # Multi-answer: "A, B", "A and C", "A/C", "1, 3"
    if re.search(r'[\,;&/]|(?:\s+and\s+)', raw_clean, re.IGNORECASE):
        delimiters = r'[\,;&/]+|\s+and\s+'
        tokens = [t.strip() for t in re.split(delimiters, raw_clean, flags=re.IGNORECASE) if t.strip()]
        mapped_tokens = [_map_answer(t, options) for t in tokens]
        valid_mapped = []
        for m in mapped_tokens:
            if isinstance(m, list):
                for item in m:
                    if item and item not in valid_mapped:
                        valid_mapped.append(item)
            elif m and m not in valid_mapped:
                valid_mapped.append(m)
        if valid_mapped:
            return valid_mapped if len(valid_mapped) > 1 else valid_mapped[0]

    # Single letter: "A", "B", "C", ...
    if re.match(r'^[A-Ha-h]$', raw_clean):
        idx = ord(raw_clean.upper()) - ord('A')
        if 0 <= idx < len(options):
            return options[idx]

    # "Option A", "Option 1", "Opt B"
    m_opt = re.match(r'^(?:Option|Opt)?\s*([A-Ha-h1-9])$', raw_clean, re.IGNORECASE)
    if m_opt:
        val = m_opt.group(1).upper()
        if val.isdigit():
            idx = int(val) - 1
            if 0 <= idx < len(options):
                return options[idx]
        else:
            idx = ord(val) - ord('A')
            if 0 <= idx < len(options):
                return options[idx]

    # Number index 1..9
    if raw_clean.isdigit():
        idx = int(raw_clean) - 1
        if 0 <= idx < len(options):
            return options[idx]

    # Exact text match
    for opt in options:
        if opt.strip().lower() == raw_clean.lower():
            return opt

    # Partial text match
    for opt in options:
        if raw_clean.lower() in opt.lower() or opt.lower() in raw_clean.lower():
            return opt

    return ''


# ──────────────────────────────────────────────────────────────────────────────
# CORE TEXT PARSER — handles DI tables, passages, real exam paper patterns
# ──────────────────────────────────────────────────────────────────────────────

# Banking/SSC section name aliases
_SECTION_ALIASES = {
    'qa': 'Quantitative Aptitude',
    'quantitative aptitude': 'Quantitative Aptitude',
    'quant': 'Quantitative Aptitude',
    'mathematics': 'Quantitative Aptitude',
    'maths': 'Quantitative Aptitude',
    'math': 'Quantitative Aptitude',
    'di': 'Data Interpretation',
    'data interpretation': 'Data Interpretation',
    'data sufficiency': 'Data Sufficiency',
    'reasoning': 'Reasoning Ability',
    'reasoning ability': 'Reasoning Ability',
    'logical reasoning': 'Reasoning Ability',
    'verbal reasoning': 'Verbal Reasoning',
    'non verbal reasoning': 'Non-Verbal Reasoning',
    'english': 'English Language',
    'english language': 'English Language',
    'verbal ability': 'English Language',
    'comprehension': 'Reading Comprehension',
    'reading comprehension': 'Reading Comprehension',
    'rc': 'Reading Comprehension',
    'gk': 'General Awareness',
    'general awareness': 'General Awareness',
    'general knowledge': 'General Awareness',
    'current affairs': 'Current Affairs',
    'computer': 'Computer Awareness',
    'computer awareness': 'Computer Awareness',
    'computer knowledge': 'Computer Awareness',
    'banking awareness': 'Banking Awareness',
    'finance': 'Financial Awareness',
    'marketing': 'Marketing Aptitude',
    'professional knowledge': 'Professional Knowledge',
    'general science': 'General Science',
    'science': 'General Science',
    'history': 'History',
    'geography': 'Geography',
    'polity': 'Polity',
    'economics': 'Economics',
    'environment': 'Environment & Ecology',
}


def _normalise_section(name: str) -> str:
    cleaned = _clean_extracted_text(name)
    cleaned = re.sub(r'^(?:section|part)\s*[ivxlcdm0-9a-z]*\s*[\-:\.\)\u2013\u2014]?\s*', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\(\s*q?\d+\s*[\u2013\u2014\-]\s*\d+\s*\)', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\(\s*\d+\s+questions?\s*\)', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\b\d+\s+questions?\b', '', cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.strip(' -\u2013\u2014\u2012:|()[]')
    cleaned = re.sub(r'^[-\u2013\u2014\u2012:\.\s]+', '', cleaned).strip()
    key = cleaned.lower()
    return _SECTION_ALIASES.get(key, cleaned.title() if cleaned else 'General')


def _cell(row, col_idx):
    if col_idx is None or col_idx >= len(row):
        return ''
    return str(row[col_idx]).strip()


# Compiled patterns for speed
# Compiled patterns for speed
_RE_SEC_EXPLICIT = re.compile(
    r'^(?:Section|Subject|Topic|Part|Category)\s*(?:[IVXLCDM]+|[A-Z]|\d+)?\s*[\:\-\=\u2013\u2014]\s*(.+)$'
    r'|^\[([^\]]+)\]$'
    r'|^===\s*(.+)\s*===$',
    re.IGNORECASE
)
_RE_SEC_STANDALONE = re.compile(
    r'^(?:PART\s+[A-Z]+|SECTION\s+[A-Z0-9]+|(?:Quantitative\s+Aptitude|Reasoning|English|General\s+Awareness|Current\s+Affairs|Computer|Banking|Data\s+Interpretation|Reading\s+Comprehension|Verbal|Non.?Verbal|Mathematics|Polity|Economics|History|Geography|Science))',
    re.IGNORECASE
)
_RE_Q_START = re.compile(
    r'^(?:(?:Question|Qs?\.?)\s*(\d+)|\((\d+)\)|(\d+))\s*[\.\)\:\-]\s*(.*)$',
    re.IGNORECASE
)
_RE_OPT_LINE = re.compile(
    r'^(?:\*\s*)?(?:(?:([A-Ha-h1-8])(?:[\.\)]|[\:\-]\s+))|\(([A-Ha-h1-8])\)|(?:Option|Opt)\s+([A-Ha-h1-8])[\:\.\-]?\s*|\[\s*([A-Ha-h1-8x\*])\s*\])\s*(.*)$',
    re.IGNORECASE
)
_RE_ANS = re.compile(
    r'^(?:[\s\u2714\u2705\*\-\[\]\u2713\+\.\:]*)?(?:Correct\s+|Right\s+)?(?:Option|Opt)?\s*Ans(?:wer)?[\s\:\-\=]+(.*)$'
    r'|^Key[\s\:\-\=]+(.*)$'
    r'|^Solution[\s\:\-\=]+(.*)$'
    r'|^Explanation[\s\:\-\=]+(.*)$',
    re.IGNORECASE
)
# Matches answer format: "C. D" or "C. Branch D" or "(C) D" or "C) 80"
_RE_ANS_LETTER_VALUE = re.compile(
    r'^([A-Ea-e])[\.)\s]\s*(.*)$'
)
_RE_ANS_KEY_HEADER = re.compile(
    r'^(?:ANSWER\s*KEY|ANSWERS?\s*KEY|SOLUTION\s*KEY|ANSWER\s*SHEET|ANSWERS?\s*$|CORRECT\s+ANSWERS?\s*$)',
    re.IGNORECASE
)
_RE_Q_GROUP_HEADER = re.compile(
    r'(?:Questions?|Qs?\.?|Q)\s*(\d+)\s*(?:[\-\–\—\−\‒\―]|\b(?:to|through|thru|and)\b)\s*(\d+)\s*(?:are|refer|based|use|from)?',
    re.IGNORECASE
)
_RE_DIRECTIONS = re.compile(
    r'^(?:Directions|Read the following|Consider the|Study the following|Essay Paragraph|Directions\s*[\(\:\-]|Note\s*:|Refer\s+to)\b',
    re.IGNORECASE
)
_RE_TABLE_START = re.compile(r'^\[TABLE_START\]$')
_RE_TABLE_END = re.compile(r'^\[TABLE_END\]$')
_RE_GRAPH = re.compile(r'^\[GRAPH_IMAGE:\s*(.+)\]$')
_RE_INLINE_OPTS = re.compile(
    r'(?:^|\s{2,}|\t+)(?:([A-Ea-e])[\.\)]|\(([A-Ea-e])\))\s*([^\t\n]+?)(?=\s{2,}[A-Ea-e][\.\)]|\s*$)',
)
_RE_NEG_MARKS = re.compile(r'(?:negative\s+marks?\s*(?:of|:|-|=)\s*|penalty\s*(?:of|:)?\s*)-?\s*([\d\.]+)', re.IGNORECASE)
_RE_NEG_MARKS_INLINE = re.compile(r'[-\u2212]\s*([\d\.]+)\s*(?:for\s+)?incorrect', re.IGNORECASE)
_RE_NEG_MARKS_SCORING = re.compile(r'\+\s*[\d\.]+\s*correct\s*,?\s*[-\u2212]\s*([\d\.]+)', re.IGNORECASE)
_RE_MARKS_PER_Q = re.compile(r'(?:each\s+question\s+carries?\s*|marks?\s+per\s+question\s*(?:is|:|-|=)\s*)([\d\.]+)\s*marks?', re.IGNORECASE)


def _option_index(label):
    token = str(label or '').strip().upper()
    if not token:
        return -1
    if token.isdigit():
        return int(token) - 1
    return ord(token[0]) - ord('A')


def _is_valid_next_option(current_q, opt_label):
    if not current_q:
        return False
    opt_idx = _option_index(opt_label)
    if opt_idx < 0 or opt_idx > 8:
        return False
    curr_opts = current_q.get('options', [])
    current_count = len(curr_opts)
    if current_count == 0:
        return opt_idx == 0
    return opt_idx == current_count or opt_idx == current_count - 1


def _split_inline_options(text):
    """
    Split a line containing inline options into stem + option texts.
    Supports: A) one B) two, (A) one (B) two, A: one B: two, 1. one 2. two.
    """
    option_marker = r'(?:\(([A-Ha-h1-8])\)|(?<!\w)([A-Ha-h1-8])(?:[\.\)]|[\:\-]\s+))'
    matches = list(re.finditer(option_marker, text))
    if len(matches) < 2:
        return text.strip(), [], []

    # Check if first match is Option A/1
    first_label = matches[0].group(1) or matches[0].group(2)
    if _option_index(first_label) != 0:
        return text.strip(), [], []

    options = []
    starred = []
    stem = text[:matches[0].start()].strip()
    for idx, match in enumerate(matches):
        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        opt_text = text[start:end].strip()
        opt_text = re.sub(r'^(?:Option|Opt)\s+', '', opt_text, flags=re.IGNORECASE).strip()
        if not opt_text:
            continue
        is_starred = opt_text.endswith('*') or opt_text.startswith('*')
        opt_text = opt_text.strip('*').strip()
        if opt_text:
            options.append(opt_text)
            if is_starred:
                starred.append(opt_text)
    if len(options) < 2:
        return text.strip(), [], []
    return stem, options, starred


def _append_unique_options(current_q, options, starred=None):
    if not current_q:
        return
    starred = starred or []
    for opt_text in options:
        clean = str(opt_text or '').strip()
        if clean and clean not in current_q['options']:
            current_q['options'].append(clean)
    for opt_text in starred:
        clean = str(opt_text or '').strip()
        if clean and clean not in current_q['starred_options']:
            current_q['starred_options'].append(clean)


def _looks_like_true_false_question(q_text, raw_ans):
    combined = f'{q_text} {raw_ans}'.lower()
    return bool(re.search(r'\b(true|false|statement is|statements are)\b', combined))


def _context_type_for_direction(line):
    clean = str(line or '').lower()
    if re.search(r'\b(?:circular|round|square|linear|row|facing|seating|puzzle)\b', clean):
        return 'passage'
    if re.search(r'\b(?:bar|line|pie|donut|doughnut|clustered|stacked)\s+graphs?\b|\bcharts?\b|\bgraphs?\b', clean):
        return 'graph'
    if re.search(r'\b(?:data\s+table|tabular\s+data|given\s+table|following\s+table)\b', clean) or '|' in clean:
        return 'table'
    return 'passage'


def _store_answer_key_pair(answer_key_map, q_token, ans_token):
    try:
        q_num = int(str(q_token).strip())
    except (TypeError, ValueError):
        return
    ans = str(ans_token or '').strip()
    ans = re.sub(r'^(?:[\s✔✅\*\-\[\]✓\+\.\:]*)?(?:Correct\s+|Right\s+)?(?:Option|Opt)?\s*Ans(?:wer)?[\s\:\-\=]*', '', ans, flags=re.IGNORECASE).strip()
    ans = re.sub(r'^[\s✔✅\*✓\-\[\]\(\)]+', '', ans).strip()
    if re.fullmatch(r'[A-Ha-h](?:\s*[,/&]\s*[A-Ha-h])*', ans):
        letters = re.findall(r'[A-Ha-h]', ans)
        answer_key_map[q_num] = ','.join(letter.upper() for letter in letters)
    elif ans:
        answer_key_map[q_num] = ans


def _record_answer_key_line(line, answer_key_map, pending_q):
    clean = line.strip()
    if not clean or clean in ('[TABLE_START]', '[TABLE_END]'):
        return pending_q

    cells = [c.strip() for c in clean.split('|') if c.strip()]
    if len(cells) >= 2:
        filtered = [c for c in cells if c.lower() not in ('q', 'question', 'ans', 'answer', 'key')]
        for idx in range(0, len(filtered) - 1, 2):
            _store_answer_key_pair(answer_key_map, filtered[idx], filtered[idx + 1])
        return None

    compact_pairs = re.findall(r'(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[\.\:\)\-]?\s*([A-Ha-h](?:\s*[,/&]\s*[A-Ha-h])*)\b', clean, flags=re.IGNORECASE)
    if compact_pairs:
        for q_token, ans_token in compact_pairs:
            _store_answer_key_pair(answer_key_map, q_token, ans_token)
        return None

    single_answer = re.match(r'^(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[\.\:\)\-]\s*(.+)$', clean, flags=re.IGNORECASE)
    if single_answer:
        _store_answer_key_pair(answer_key_map, single_answer.group(1), single_answer.group(2))
        return None

    if clean.lower() in ('q', 'question', 'ans', 'answer', 'key'):
        return pending_q
    if re.fullmatch(r'\d{1,3}', clean):
        return int(clean)
    if pending_q is not None and re.fullmatch(r'[A-Ha-h](?:\s*[,/&]\s*[A-Ha-h])*', clean):
        _store_answer_key_pair(answer_key_map, pending_q, clean)
        return None
    return pending_q


def _parse_text(text: str):
    """
    Smart 5-layer parser for real government exam paper text.
    Handles DI tables, passages, graph placeholders, section headers,
    question groups, inline options, and answer keys.
    """
    from services.question_group_detector import QuestionGroupDetectorService

    raw_lines = [line.strip() for line in text.splitlines()]

    # ── Pass 1: separate answer key section ────────────────────────────────────
    answer_key_map = {}
    main_lines = []
    in_answer_key = False
    global_neg_marks = 0.0
    global_marks_per_q = 1
    pending_answer_key_q = None

    for line in raw_lines:
        if not line:
            if not in_answer_key:
                main_lines.append('')
            continue
        if _RE_ANS_KEY_HEADER.match(line):
            in_answer_key = True
            continue
        if in_answer_key:
            pending_answer_key_q = _record_answer_key_line(line, answer_key_map, pending_answer_key_q)
        else:
            # Detect global negative marks from instructions
            m_neg = _RE_NEG_MARKS.search(line) or _RE_NEG_MARKS_INLINE.search(line) or _RE_NEG_MARKS_SCORING.search(line)
            if m_neg:
                try:
                    global_neg_marks = abs(float(m_neg.group(1)))
                except ValueError:
                    pass
            m_mpq = _RE_MARKS_PER_Q.search(line)
            if m_mpq:
                try:
                    global_marks_per_q = int(float(m_mpq.group(1)))
                except ValueError:
                    pass
            main_lines.append(line)

    # ── Pass 2: group table/graph blocks ──────────────────────────────────────
    structured_lines = []  # list of (kind, text)
    in_table = False
    table_buf = []
    pipe_table_buf = []

    def flush_pipe_table():
        nonlocal pipe_table_buf
        if len(pipe_table_buf) >= 2:
            structured_lines.append(('table', '\n'.join(pipe_table_buf)))
        else:
            for pending_line in pipe_table_buf:
                structured_lines.append(('text', pending_line))
        pipe_table_buf = []

    for line in main_lines:
        if _RE_TABLE_START.match(line):
            flush_pipe_table()
            in_table = True
            table_buf = []
        elif _RE_TABLE_END.match(line):
            in_table = False
            if table_buf:
                structured_lines.append(('table', '\n'.join(table_buf)))
        elif _RE_GRAPH.match(line):
            flush_pipe_table()
            m_g = _RE_GRAPH.match(line)
            structured_lines.append(('graph', m_g.group(1).strip()))
        elif line.startswith('![') and '](' in line and line.endswith(')'):
            flush_pipe_table()
            md_url = re.search(r'!\[.*?\]\((.*?)\)', line)
            if md_url:
                structured_lines.append(('graph', md_url.group(1).strip()))
            else:
                structured_lines.append(('text', line))
        elif in_table:
            table_buf.append(line)
        else:
            cells = [cell.strip() for cell in line.split('|') if cell.strip()]
            if len(cells) >= 2 and not _RE_Q_START.match(line):
                pipe_table_buf.append(line)
            else:
                flush_pipe_table()
                structured_lines.append(('text', line))
    flush_pipe_table()

    # ── Pass 3: main parsing state machine with explicit context registration ──
    sec_map = {}
    parsed_sections = []
    parsed_questions = []

    def get_sec_id(name):
        clean = _normalise_section(name or 'General')
        if clean not in sec_map:
            sid = f"sec_{len(sec_map) + 1}"
            sec_map[clean] = sid
            parsed_sections.append({'id': sid, 'name': clean})
        return sec_map[clean]

    current_sec_name = 'General'
    current_q = None
    question_count = 0

    registered_contexts: List[ContextBlock] = []
    pending_context_lines: List[str] = []
    pending_context_type = ''
    pending_context_range: Optional[Tuple[int, int]] = None
    pending_context_img = ''
    pending_context_section = 'General'

    def flush_pending_context():
        nonlocal pending_context_lines, pending_context_type, pending_context_range, pending_context_img, pending_context_section
        if not pending_context_lines:
            return
        ctx_text = '\n'.join(pending_context_lines).strip()
        if not ctx_text:
            pending_context_lines = []
            return

        start_q = pending_context_range[0] if pending_context_range else None
        end_q = pending_context_range[1] if pending_context_range else None
        binding_mode = "explicit_range" if (start_q and end_q) else "unbound"
        ctx_id = f"shared_{start_q}_{end_q}" if (start_q and end_q) else f"ctx_{len(registered_contexts) + 1}"

        block = ContextBlock(
            context_id=ctx_id,
            type=pending_context_type or "directions",
            text=ctx_text,
            start_question=start_q,
            end_question=end_q,
            source_order=len(registered_contexts) + 1,
            binding_mode=binding_mode,
            section=pending_context_section,
            image_reference=pending_context_img,
            directions=ctx_text
        )
        registered_contexts.append(block)
        pending_context_lines = []
        pending_context_type = ''
        pending_context_range = None
        pending_context_img = ''

    def finalize_q():
        nonlocal current_q
        if not current_q:
            return
        q_text = current_q['question_lines'].strip()
        if not q_text:
            current_q = None
            return

        options = current_q['options']
        raw_ans = current_q['raw_answer']
        q_num = current_q['q_num']

        if not raw_ans and q_num in answer_key_map:
            raw_ans = answer_key_map[q_num]
        if not options and _looks_like_true_false_question(q_text, raw_ans):
            options = ['True', 'False']

        ans_letter = ''
        ans_value = raw_ans
        if raw_ans:
            m_lv = _RE_ANS_LETTER_VALUE.match(raw_ans.strip())
            if m_lv:
                ans_letter = m_lv.group(1).upper()
                ans_value = m_lv.group(2).strip() or raw_ans

        mapped_ans = ''
        if options:
            if current_q['starred_options']:
                starred = current_q['starred_options']
                mapped_ans = starred if len(starred) > 1 else starred[0]
            else:
                mapped_ans = _map_answer(raw_ans, options)
        elif ans_letter:
            mapped_ans = ans_value

        if not options:
            q_type = 'text'
            final_ans = ans_value if ans_value else raw_ans
        elif isinstance(mapped_ans, list) and len(mapped_ans) > 1:
            q_type = 'multiple'
            final_ans = mapped_ans
        else:
            q_type = 'mcq'
            final_ans = mapped_ans if mapped_ans else ''

        marks = current_q.get('marks', global_marks_per_q)
        neg = current_q.get('negativeMarks', global_neg_marks)
        
        ctx = current_q.get('context') or ''
        ctx_type = current_q.get('contextType') or ''
        grp_id = current_q.get('groupId')
        q_range = current_q.get('questionRange')
        img_ref = current_q.get('imageReference', '')

        # Strictly enforce range validity: if question is outside declared range, scrub context
        if q_range and isinstance(q_range, dict):
            start_q = q_range.get('start')
            end_q = q_range.get('end')
            if start_q and end_q and not (start_q <= q_num <= end_q):
                ctx = ''
                ctx_type = ''
                grp_id = None
                q_range = None
                img_ref = ''

        if not img_ref and ctx:
            md_m = re.search(r'!\[.*?\]\((.*?)\)', ctx)
            if md_m:
                img_ref = md_m.group(1).strip()
            elif 'data:image' in ctx:
                b64_m = re.search(r'data:image/[a-zA-Z0-9+\-.]+;base64,[A-Za-z0-9+/=\s]+', ctx)
                if b64_m:
                    img_ref = b64_m.group(0).strip()

        # Build clean structured shared content object ONLY if context applies to this question
        shared_content = None
        if ctx and q_range and (q_range['start'] <= q_num <= q_range['end']):
            ctx_lines = [l.strip() for l in ctx.split('\n') if l.strip()]
            shared_title = ctx_lines[0] if ctx_lines else f"Directions (Q{q_range.get('start')}-{q_range.get('end')})"
            shared_dirs = '\n'.join([l for l in ctx_lines if not l.startswith('![') and not l.startswith('data:image')])
            shared_content = {
                "id": grp_id or f"shared_{q_range.get('start')}_{q_range.get('end')}",
                "type": ctx_type or "graph",
                "title": shared_title,
                "directions": shared_dirs,
                "asset": {
                    "type": "image" if img_ref else (ctx_type or "text"),
                    "url": img_ref
                } if img_ref else None,
                "questionRange": q_range
            }

        sec_id = get_sec_id(current_q['section'])
        parsed_questions.append({
            'id': f"parsed_{len(parsed_questions) + 1}",
            'questionNumber': q_num,
            'q_num': q_num,
            'source_question_number': q_num,
            'type': q_type,
            'question': q_text,
            'questionText': q_text,
            'questionType': q_type,
            'context': ctx,
            'contextType': ctx_type,
            'groupId': grp_id,
            'sharedContentId': grp_id,
            'questionRange': q_range,
            'sharedContent': shared_content,
            'imageReference': img_ref,
            'visualId': current_q.get('visualId'),
            'options': options if q_type in ('mcq', 'multiple') else [],
            'correctAnswer': final_ans,
            'correct_option_id': ans_letter if ans_letter else (raw_ans.strip().upper() if raw_ans and raw_ans.strip().upper() in ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H') else ''),
            'section': sec_id,
            'marks': max(1, marks),
            'negativeMarks': neg,
        })
        current_q = None

    for kind, line in structured_lines:
        # ── Table block ──────────────────────────────────────────────────────
        if kind == 'table':
            finalize_q()
            pending_context_lines.append(line)
            pending_context_type = 'table'
            continue

        # ── Graph block ──────────────────────────────────────────────────────
        if kind == 'graph':
            img_target = line if line.startswith('http') or line.startswith('data:image') else line
            img_md = f'![Extracted Diagram/Graph]({img_target})' if (line.startswith('http') or line.startswith('data:image')) else f'[Graph/Figure: {line}]'

            # If inside an active standalone question that has no shared range, associate directly
            if current_q:
                current_q['imageReference'] = img_target
                current_q['contextType'] = 'graph'
                current_q['context'] = img_md
                current_q['visualId'] = f"visual_q{current_q['q_num']}"
                continue

            finalize_q()
            pending_context_lines.append(img_md)
            pending_context_type = 'graph'
            pending_context_img = img_target
            continue

        # ── Text processing ──────────────────────────────────────────────────
        if not line:
            continue

        # 1. Check for Question group / Shared range declaration (e.g. Directions (Q31-35), Questions 31-35:)
        detected_range = QuestionGroupDetectorService.detect_question_range(line)
        if detected_range:
            finalize_q()
            flush_pending_context()

            start_q, end_q = detected_range
            pending_context_range = (start_q, end_q)
            pending_context_type = _context_type_for_direction(line)
            pending_context_lines = [line]
            pending_context_section = current_sec_name

            m_sec_in_grp = _RE_SEC_STANDALONE.match(line)
            if m_sec_in_grp:
                sec_part = re.split(r'[\(\[]', line)[0].strip()
                if sec_part:
                    current_sec_name = sec_part
                    pending_context_section = sec_part
            continue

        # 2. Explicit section header
        m_sec = _RE_SEC_EXPLICIT.match(line)
        if m_sec:
            # If inside a pending shared group and the line mentions graph/table/passage/DI/questions, treat as subtitle
            range_in_line = QuestionGroupDetectorService.detect_question_range(line)
            if pending_context_range and (range_in_line or any(k in line.lower() for k in ['graph', 'table', 'passage', 'chart', 'directions', 'clustered', 'bar', 'line', 'pie', 'data', 'interpretation', 'part', 'figure'])):
                pending_context_lines.append(line)
                continue

            finalize_q()
            flush_pending_context()
            name = m_sec.group(1) or m_sec.group(2) or m_sec.group(3)
            if name and name.strip():
                current_sec_name = name.strip()
                pending_context_section = current_sec_name
            continue

        # 3. Standalone known section names
        if not current_q and _RE_SEC_STANDALONE.match(line) and len(line) < 80:
            if not _RE_OPT_LINE.match(line) and not _RE_Q_START.match(line):
                range_in_line = QuestionGroupDetectorService.detect_question_range(line)
                if pending_context_range and (range_in_line or any(k in line.lower() for k in ['graph', 'table', 'passage', 'chart', 'directions', 'part', 'data', 'figure'])):
                    pending_context_lines.append(line)
                    continue
                else:
                    finalize_q()
                    flush_pending_context()
                    current_sec_name = line.strip()
                    pending_context_section = current_sec_name
                    continue

        # 4. Continuation of directions / shared context before question begins
        if pending_context_lines and not current_q:
            if not _RE_Q_START.match(line) and not _RE_OPT_LINE.match(line) and not _RE_ANS.match(line):
                pending_context_lines.append(line)
                if not pending_context_type:
                    pending_context_type = _context_type_for_direction(line)
                continue

        # 5. Answer line
        m_ans = _RE_ANS.match(line)
        if m_ans and current_q:
            ans_val = m_ans.group(1) or m_ans.group(2) or m_ans.group(3) or m_ans.group(4) or ''
            current_q['raw_answer'] = ans_val.strip()
            continue

        # 6. Question start
        m_q = _RE_Q_START.match(line)
        if m_q:
            finalize_q()
            flush_pending_context()

            question_count += 1
            q_num = int(m_q.group(1) or m_q.group(2) or m_q.group(3))
            q_text = m_q.group(4).strip()
            original_q_text = q_text
            q_text, inline_question_options, inline_question_starred = _split_inline_options(q_text)
            if inline_question_options and not q_text:
                q_text = original_q_text
                inline_question_options = []
                inline_question_starred = []

            marks = global_marks_per_q
            m_marks = re.search(r'\[(\d+)\s*marks?\]|\((\d+)\s*marks?\)', q_text, re.IGNORECASE)
            if m_marks:
                marks = int(m_marks.group(1) or m_marks.group(2))
                q_text = re.sub(r'\[\d+\s*marks?\]|\(\d+\s*marks?\)', '', q_text, flags=re.IGNORECASE).strip()

            # Deterministic Context Lookup: Find matching registered context block for q_num
            matching_ctx: Optional[ContextBlock] = None
            for ctx_block in registered_contexts:
                if ctx_block.applies_to_question(q_num, current_sec_name):
                    matching_ctx = ctx_block
                    break

            ctx, ctx_type, grp_id, q_range, img_ref = '', '', None, None, ''
            if matching_ctx:
                ctx = matching_ctx.text
                ctx_type = matching_ctx.type
                grp_id = matching_ctx.context_id
                if matching_ctx.start_question and matching_ctx.end_question:
                    q_range = {'start': matching_ctx.start_question, 'end': matching_ctx.end_question}
                img_ref = matching_ctx.image_reference

            current_q = {
                'q_num': q_num,
                'question_lines': q_text,
                'options': [],
                'starred_options': [],
                'raw_answer': '',
                'section': current_sec_name,
                'marks': marks,
                'negativeMarks': global_neg_marks,
                'context': ctx,
                'contextType': ctx_type,
                'groupId': grp_id,
                'sharedContentId': grp_id,
                'questionRange': q_range,
                'imageReference': img_ref,
            }
            _append_unique_options(current_q, inline_question_options, inline_question_starred)
            continue
            continue

        # 7. Inline multi-option line
        inline_stem, inline_options, inline_starred = _split_inline_options(line)
        if inline_options and current_q:
            clean_options = []
            for opt_text in inline_options:
                ans_inline = re.search(
                    r'[\s✔✅\*✓]*(?:Correct\s+|Right\s+)?(?:Option|Opt)?\s*Ans(?:wer)?[\s\:\-\=]+(.*)$',
                    opt_text, re.IGNORECASE
                )
                if ans_inline:
                    current_q['raw_answer'] = ans_inline.group(1).strip()
                    opt_text = opt_text[:ans_inline.start()].strip()
                opt_text = opt_text.strip('*').strip()
                if opt_text:
                    clean_options.append(opt_text)
            _append_unique_options(current_q, clean_options, inline_starred)
            if inline_stem:
                current_q['question_lines'] += ' ' + inline_stem
            continue

        # 8. Single option line with strict sequential check
        m_opt = _RE_OPT_LINE.match(line)
        if m_opt and current_q:
            opt_label = m_opt.group(1) or m_opt.group(2) or m_opt.group(3) or m_opt.group(4) or ''
            if _is_valid_next_option(current_q, opt_label):
                opt_text = m_opt.group(5).strip()
                has_star = (line.startswith('*') or opt_text.endswith('*')
                            or bool(re.search(r'[✓✔✅]', line))
                            or (m_opt.group(4) and m_opt.group(4) in ('x', '*')))
                ans_inline = re.search(
                    r'[\s✔✅\*✓]*(?:Correct\s+|Right\s+)?(?:Option|Opt)?\s*Ans(?:wer)?[\s\:\-\=]+(.*)$',
                    opt_text, re.IGNORECASE
                )
                if ans_inline:
                    current_q['raw_answer'] = ans_inline.group(1).strip()
                    opt_text = opt_text[:ans_inline.start()].strip()
                opt_text = re.sub(r'[\s✓✔✅\*]+$', '', opt_text).strip().strip('*').strip()
                if opt_text:
                    current_q['options'].append(opt_text)
                    if has_star:
                        current_q['starred_options'].append(opt_text)
                continue

        # 9. Generic Directions or long paragraph without question markers → DI passage / directions
        if not current_q and (_RE_DIRECTIONS.match(line) or len(line.split()) > 25):
            inferred_type = _context_type_for_direction(line)
            pending_context_lines.append(line)
            if not pending_context_type:
                pending_context_type = inferred_type
            continue

        # 10. Continuation line
        if current_q:
            if not current_q['options'] and not current_q['raw_answer']:
                current_q['question_lines'] += ' ' + line
            elif current_q['options'] and not current_q['raw_answer']:
                current_q['options'][-1] += ' ' + line

    finalize_q()
    flush_pending_context()

    if not parsed_sections:
        parsed_sections = [{'id': 'sec_1', 'name': 'General'}]

    return parsed_sections, parsed_questions


def validate_parsed_test_data(sections: list, questions: list) -> dict:
    """
    Backend validation engine for parsed test papers.
    Validates:
    - Image Data URIs (ensures Base64 header and binary payload integrity)
    - Markdown Grid Tables (ensures column alignment across headers and rows)
    - Options & Question Integrity (non-empty prompt, options array >= 2 for MCQ)
    - Answer Mappings (ensures correctAnswer matches available options)
    - Section Mappings (ensures all questions map to a declared section)

    Returns:
    {
      "valid": bool,
      "qualityScore": int (0-100),
      "errors": list[str],
      "warnings": list[str],
      "totalQuestions": int,
      "validatedImages": int,
      "validatedTables": int
    }
    """
    errors = []
    warnings = []
    validated_images = 0
    validated_tables = 0
    total_q = len(questions)

    if not questions:
        return {
            "valid": False,
            "qualityScore": 0,
            "errors": ["No questions extracted from document."],
            "warnings": [],
            "totalQuestions": 0,
            "validatedImages": 0,
            "validatedTables": 0
        }

    for idx, q in enumerate(questions, start=1):
        q_text = (q.get('question') or '').strip()
        q_type = q.get('type', 'mcq')
        options = q.get('options', [])
        correct_ans = q.get('correctAnswer')
        context = (q.get('context') or '').strip()

        # 1. Question Prompt Validation
        if not q_text:
            errors.append(f"Question #{idx}: Question text is empty.")

        # 2. Options Validation
        if q_type in ('mcq', 'multiple'):
            if len(options) < 2:
                warnings.append(f"Question #{idx}: MCQ has fewer than 2 options ({len(options)} found).")

        # 3. Correct Answer Mapping Validation
        if q_type == 'mcq' and options and correct_ans:
            if isinstance(correct_ans, str) and correct_ans not in options:
                warnings.append(f"Question #{idx}: Correct answer '{correct_ans}' not explicitly matched in options list.")
        elif q_type == 'multiple' and options and correct_ans:
            if isinstance(correct_ans, list):
                for ans_item in correct_ans:
                    if ans_item not in options:
                        warnings.append(f"Question #{idx}: Multiple-choice answer component '{ans_item}' not in options list.")

        # 4. Context & Image Payload Integrity Validation
        if context:
            if 'data:image' in context:
                validated_images += 1
                b64_matches = re.findall(r'data:image/[a-zA-Z0-9\+\-\.]+;base64,([A-Za-z0-9+/=\s]+)', context)
                for b64_payload in b64_matches:
                    clean_b64 = b64_payload.strip()
                    if len(clean_b64) < 100:
                        errors.append(f"Question #{idx}: Extracted image base64 payload is truncated or corrupted.")
            if '|' in context:
                validated_tables += 1

    score = 100
    score -= len(errors) * 15
    score -= len(warnings) * 3
    quality_score = max(0, min(100, score))

    return {
        "valid": len(errors) == 0,
        "qualityScore": quality_score,
        "errors": errors,
        "warnings": warnings,
        "totalQuestions": total_q,
        "validatedImages": validated_images,
        "validatedTables": validated_tables
    }
