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

def parse_document_file(file_bytes: bytes, filename: str):
    """
    Parse a document file containing exam questions.
    Returns: (sections_list, questions_list)
    Each question dict includes 'context' and 'contextType' fields for DI sets.
    """
    ext = (filename.rsplit('.', 1)[-1] if '.' in filename else '').lower()

    if ext == 'json':
        return _parse_json(file_bytes)
    elif ext in ('csv', 'xlsx', 'xls'):
        return _parse_spreadsheet(file_bytes, ext)
    elif ext == 'docx':
        return _parse_docx(file_bytes)
    elif ext == 'pdf':
        return _parse_pdf(file_bytes)
    else:
        text = file_bytes.decode('utf-8', errors='ignore')
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

    # Iterate body children in document order
    body = doc.element.body
    for child in body:
        tag = child.tag.split('}')[-1]

        if tag == 'p':
            # Paragraph
            para_text = ''.join(run.text for run in child.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}r')
                                 if hasattr(run, 'text') and run.text)
            para_text = para_text.strip()
            if para_text:
                blocks.append(('text', para_text))

        elif tag == 'tbl':
            # Table — convert to markdown-style grid
            table_lines = []
            for tr in child.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tr'):
                cells = []
                for tc in tr.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tc'):
                    cell_text = ' '.join(
                        ''.join(r.text for r in tc.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}r')
                                if hasattr(r, 'text') and r.text).split()
                    )
                    cells.append(cell_text)
                if any(cells):
                    table_lines.append(' | '.join(cells))
            if table_lines:
                blocks.append(('table', '\n'.join(table_lines)))

    # Now convert blocks to flat text with table markers
    lines = []
    for btype, btext in blocks:
        if btype == 'table':
            lines.append('[TABLE_START]')
            lines.extend(btext.split('\n'))
            lines.append('[TABLE_END]')
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
    if _HAVE_FITZ and _HAVE_PLUMBER:
        return _parse_pdf_advanced(file_bytes)
    elif _HAVE_FITZ:
        return _parse_pdf_fitz_only(file_bytes)
    elif _HAVE_PYPDF2:
        return _parse_pdf_pypdf2(file_bytes)
    else:
        text = file_bytes.decode('utf-8', errors='ignore')
        return _parse_text(text)


def _parse_pdf_advanced(file_bytes: bytes):
    """PyMuPDF + pdfplumber hybrid — best accuracy for DI tables."""
    fitz_doc = fitz.open(stream=file_bytes, filetype='pdf')
    plumber_doc = pdfplumber.open(io.BytesIO(file_bytes))

    all_lines = []
    table_regions_by_page = {}  # page_no -> list of table bbox rects

    # Step 1: extract tables per page using pdfplumber
    for page_no, page in enumerate(plumber_doc.pages):
        tables = page.extract_tables()
        if tables:
            table_regions_by_page[page_no] = tables
            for table in tables:
                all_lines.append('[TABLE_START]')
                for row in table:
                    cells = [str(c or '').strip() for c in row]
                    if any(cells):
                        all_lines.append(' | '.join(cells))
                all_lines.append('[TABLE_END]')

    plumber_doc.close()

    # Step 2: extract text blocks page by page using PyMuPDF
    for page_no in range(len(fitz_doc)):
        page = fitz_doc[page_no]

        # Detect image blocks (graphs/figures)
        image_list = page.get_images(full=True)
        has_images = len(image_list) > 0

        # Extract text blocks in reading order
        blocks = page.get_text('blocks')
        # Sort by vertical position then horizontal (top-to-bottom, left-to-right)
        blocks = sorted(blocks, key=lambda b: (round(b[1] / 20), b[0]))

        page_texts = []
        for block in blocks:
            if block[6] != 0:  # skip image blocks (type != 0 is image)
                continue
            btext = block[4].strip()
            if btext:
                page_texts.append(btext)

        if has_images and page_no not in table_regions_by_page:
            all_lines.append(f'[GRAPH_IMAGE: page {page_no + 1}]')

        all_lines.extend(page_texts)

    fitz_doc.close()

    return _parse_text('\n'.join(all_lines))


def _parse_pdf_fitz_only(file_bytes: bytes):
    """PyMuPDF only (no pdfplumber)."""
    doc = fitz.open(stream=file_bytes, filetype='pdf')
    text_parts = []
    for page in doc:
        blocks = page.get_text('blocks')
        blocks = sorted(blocks, key=lambda b: (round(b[1] / 20), b[0]))
        for block in blocks:
            if block[6] == 0:
                t = block[4].strip()
                if t:
                    text_parts.append(t)
    doc.close()
    return _parse_text('\n'.join(text_parts))


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
        return options[0] if options else ''

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

    if not raw_clean:
        return options[0] if options else ''
    if not options:
        return raw_clean

    # Letter + option text: "C) SE37" or "C. SE37" or "Option C: SE37"
    m_let_text = re.match(r'^(?:Option|Opt)?\s*([A-Ea-e1-5])[\.\)\:\-]\s*(.*)$', raw_clean, re.IGNORECASE)
    if m_let_text:
        let = m_let_text.group(1).upper()
        idx = (int(let) - 1) if let.isdigit() else (ord(let) - ord('A'))
        if 0 <= idx < len(options):
            return options[idx]

    # Multi-answer: "A, B" or "A and C" or "1, 3"
    if re.search(r'[\,;&]|(?:\s+and\s+)', raw_clean, re.IGNORECASE):
        delimiters = r'[\,;&]+|\s+and\s+'
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

    # Single letter: "A", "B", "C", "D", "E"
    if re.match(r'^[A-Ea-e]$', raw_clean):
        idx = ord(raw_clean.upper()) - ord('A')
        if 0 <= idx < len(options):
            return options[idx]

    # "Option A", "Option 1", "Opt B"
    m_opt = re.match(r'^(?:Option|Opt)?\s*([A-Ea-e1-9])$', raw_clean, re.IGNORECASE)
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

    return options[0] if options else raw_clean


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
    key = name.strip().lower()
    return _SECTION_ALIASES.get(key, name.strip().title())


def _cell(row, col_idx):
    if col_idx is None or col_idx >= len(row):
        return ''
    return str(row[col_idx]).strip()


# Compiled patterns for speed
_RE_SEC_EXPLICIT = re.compile(
    r'^(?:Section|Subject|Topic|Part|Category)\s*[\:\-\=\s]\s*(.+)$'
    r'|^\[([^\]]+)\]$'
    r'|^===\s*(.+)\s*===$',
    re.IGNORECASE
)
_RE_SEC_STANDALONE = re.compile(
    r'^(?:PART\s+[A-Z]+|SECTION\s+[A-Z0-9]+|(?:Quantitative\s+Aptitude|Reasoning|English|General\s+Awareness|Current\s+Affairs|Computer|Banking|Data\s+Interpretation|Reading\s+Comprehension|Verbal|Non.?Verbal|Mathematics|Polity|Economics|History|Geography|Science))',
    re.IGNORECASE
)
_RE_Q_START = re.compile(
    r'^(?:Q(?:uestion)?\.?\s*(\d+)|(\d+))\s*[\.\)\:\-]\s*(.*)$',
    re.IGNORECASE
)
_RE_OPT_LINE = re.compile(
    r'^(?:\*\s*)?(?:([A-Ea-e1-5])[\.\)]|\(([A-Ea-e1-5])\)|Option\s+([A-Ea-e1-5])[\:\.]?|\[\s*([A-Ea-e1-5x\*])\s*\])\s*(.*)$',
    re.IGNORECASE
)
_RE_ANS = re.compile(
    r'^(?:[\s\u2714\u2705\*\-\[\]\u2713\+\.\:]*)?(?:Correct\s+|Right\s+)?Ans(?:wer)?[\s\:\-\=]+(.*)$'
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
    r'^(?:ANSWER\s*KEY|ANSWERS?\s*KEY|SOLUTION\s*KEY|ANSWER\s*SHEET)\b',
    re.IGNORECASE
)
_RE_Q_GROUP_HEADER = re.compile(
    r'(?:Questions?|Qs?\.?)\s*(\d+)\s*(?:to|-|–|and)\s*(\d+)\s*(?:are|refer|based|use|from)?',
    re.IGNORECASE
)
_RE_DIRECTIONS = re.compile(
    r'^(?:Directions|Read the following|Consider the|Study the following|Essay Paragraph|Directions\s*[\(\:\-]|Note\s*:)\b',
    re.IGNORECASE
)
_RE_TABLE_START = re.compile(r'^\[TABLE_START\]$')
_RE_TABLE_END = re.compile(r'^\[TABLE_END\]$')
_RE_GRAPH = re.compile(r'^\[GRAPH_IMAGE:\s*(.+)\]$')
_RE_INLINE_OPTS = re.compile(
    r'(?:^|\s{2,}|\t+)(?:([A-Ea-e])[\.\)]|\(([A-Ea-e])\))\s*([^\t\n]+?)(?=\s{2,}[A-Ea-e][\.\)]|\s*$)',
)
_RE_NEG_MARKS = re.compile(r'(?:negative\s+marks?\s*(?:of|:|-|=)\s*|penalty\s*(?:of|:)?\s*)-?\s*([\d\.]+)', re.IGNORECASE)
_RE_MARKS_PER_Q = re.compile(r'(?:each\s+question\s+carries?\s*|marks?\s+per\s+question\s*(?:is|:|-|=)\s*)([\d\.]+)\s*marks?', re.IGNORECASE)


def _parse_text(text: str):
    """
    Smart 5-layer parser for real government exam paper text.
    Handles DI tables, passages, graph placeholders, section headers,
    question groups, inline options, and answer keys.
    """
    raw_lines = [line.strip() for line in text.splitlines()]

    # ── Pass 1: separate answer key section ────────────────────────────────────
    answer_key_map = {}
    main_lines = []
    in_answer_key = False
    global_neg_marks = 0.0
    global_marks_per_q = 1

    for line in raw_lines:
        if not line:
            main_lines.append('')
            continue
        if _RE_ANS_KEY_HEADER.match(line):
            in_answer_key = True
            continue
        if in_answer_key:
            m = re.match(r'^(?:Q(?:uestion)?\s*)?(\d+)[\.\:\)]\s*(.+)$', line, re.IGNORECASE)
            if m:
                answer_key_map[int(m.group(1))] = m.group(2).strip()
        else:
            # Detect global negative marks from instructions
            m_neg = _RE_NEG_MARKS.search(line)
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
    # Convert table blocks into a single context string
    structured_lines = []  # list of (kind, text)
    in_table = False
    table_buf = []

    for line in main_lines:
        if _RE_TABLE_START.match(line):
            in_table = True
            table_buf = []
        elif _RE_TABLE_END.match(line):
            in_table = False
            if table_buf:
                structured_lines.append(('table', '\n'.join(table_buf)))
        elif _RE_GRAPH.match(line):
            m_g = _RE_GRAPH.match(line)
            structured_lines.append(('graph', m_g.group(1).strip()))
        elif in_table:
            table_buf.append(line)
        else:
            structured_lines.append(('text', line))

    # ── Pass 3: main parsing state machine ────────────────────────────────────
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
    current_context = ''        # sticky context — persists until a new table/passage/section clears it
    current_context_type = ''
    current_q = None
    question_count = 0
    group_context_range = {}  # q_num -> (context_text, context_type)

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

        # Handle "Answer: C. D" format: option letter + value, no options listed
        # Store the value as the answer text; type stays 'text' but we record correctly
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
            # No options in document — use extracted value as answer
            mapped_ans = ans_value

        if not options:
            q_type = 'text'
            final_ans = ans_value if ans_value else raw_ans
        elif isinstance(mapped_ans, list) and len(mapped_ans) > 1:
            q_type = 'multiple'
            final_ans = mapped_ans
        else:
            q_type = 'mcq'
            final_ans = mapped_ans if mapped_ans else (options[0] if options else '')

        marks = current_q.get('marks', global_marks_per_q)
        neg = current_q.get('negativeMarks', global_neg_marks)
        ctx = current_q.get('context', current_context)
        ctx_type = current_q.get('contextType', current_context_type)

        sec_id = get_sec_id(current_q['section'])
        parsed_questions.append({
            'id': f"parsed_{len(parsed_questions) + 1}",
            'type': q_type,
            'question': q_text,
            'context': ctx,
            'contextType': ctx_type,
            'options': options if q_type in ('mcq', 'multiple') else [],
            'correctAnswer': final_ans,
            'section': sec_id,
            'marks': max(1, marks),
            'negativeMarks': neg,
        })
        current_q = None

    # Track the active DI group range so tables arriving AFTER the header can update it
    active_group_start = -1
    active_group_end_q = -1

    for kind, line in structured_lines:
        # ── Table block ──────────────────────────────────────────────────────
        if kind == 'table':
            finalize_q()
            current_context = line
            current_context_type = 'table'
            # If a group header was registered before the table arrived, update all entries
            if active_group_start > 0 and active_group_end_q >= active_group_start:
                for qn in range(active_group_start, active_group_end_q + 1):
                    old_ctx, _ = group_context_range.get(qn, ('', ''))
                    # Prepend old header text to table so context is "header + table"
                    new_ctx = (old_ctx + '\n' + line).strip() if old_ctx else line
                    group_context_range[qn] = (new_ctx, 'table')
                current_context = group_context_range[active_group_start][0]
                current_context_type = 'table'
                active_group_start = -1
                active_group_end_q = -1
            continue

        # ── Graph block ──────────────────────────────────────────────────────
        if kind == 'graph':
            finalize_q()
            current_context = f'[Graph/Figure: {line}]'
            current_context_type = 'graph'
            if active_group_start > 0:
                for qn in range(active_group_start, active_group_end_q + 1):
                    group_context_range[qn] = (current_context, 'graph')
                active_group_start = -1
            continue

        # ── Text processing ──────────────────────────────────────────────────
        if not line:
            continue

        # 1. Question group header — CHECKED FIRST before section headers
        #    Catches: "Data Interpretation (Questions 11–15)" and
        #             "Questions 21 to 25 are based on the following table:"
        #             "Reasoning (16-20)" — section name + range in parentheses
        m_grp = _RE_Q_GROUP_HEADER.search(line)
        if m_grp:
            finalize_q()
            start_q = int(m_grp.group(1))
            end_q = int(m_grp.group(2))

            # Check if this line also names a known section (e.g. "Reasoning (16-20)")
            m_sec_in_grp = _RE_SEC_STANDALONE.match(line)
            if m_sec_in_grp:
                # Extract section name (everything before the parentheses)
                sec_part = re.split(r'[\(\[]', line)[0].strip()
                if sec_part:
                    current_sec_name = sec_part
                # New section group — clear old DI table context
                current_context = ''
                current_context_type = ''

            # Register each question in range with current context
            # (table may still arrive after this header for DI sets)
            combined_ctx = (current_context + '\n' + line).strip() if current_context else line
            combined_type = current_context_type if current_context_type else 'passage'
            for qn in range(start_q, end_q + 1):
                group_context_range[qn] = (combined_ctx, combined_type)
            # Record active group so the next table can update these entries
            active_group_start = start_q
            active_group_end_q = end_q
            if combined_ctx:
                current_context = combined_ctx
                current_context_type = combined_type
            continue

        # 2. Explicit section header (Section: ..., Subject: ..., [Name])
        #    Only updates section name — does NOT clear context
        m_sec = _RE_SEC_EXPLICIT.match(line)
        if m_sec:
            finalize_q()
            name = m_sec.group(1) or m_sec.group(2) or m_sec.group(3)
            if name and name.strip():
                current_sec_name = name.strip()
            continue

        # 3. Standalone known section names (Reasoning, English, QA...)
        #    Only updates section name — does NOT clear context
        if not current_q and _RE_SEC_STANDALONE.match(line) and len(line) < 80:
            if not _RE_OPT_LINE.match(line) and not _RE_Q_START.match(line):
                finalize_q()
                current_sec_name = line.strip()
                continue

        # 4. Answer line
        m_ans = _RE_ANS.match(line)
        if m_ans and current_q:
            ans_val = m_ans.group(1) or m_ans.group(2) or m_ans.group(3) or m_ans.group(4) or ''
            current_q['raw_answer'] = ans_val.strip()
            continue

        # 5. Question start
        m_q = _RE_Q_START.match(line)
        if m_q:
            finalize_q()
            question_count += 1
            q_num = int(m_q.group(1) or m_q.group(2))
            q_text = m_q.group(3).strip()

            marks = global_marks_per_q
            m_marks = re.search(r'\[(\d+)\s*marks?\]|\((\d+)\s*marks?\)', q_text, re.IGNORECASE)
            if m_marks:
                marks = int(m_marks.group(1) or m_marks.group(2))
                q_text = re.sub(r'\[\d+\s*marks?\]|\(\d+\s*marks?\)', '', q_text, flags=re.IGNORECASE).strip()

            # Determine context for this question — current_context is always sticky
            if q_num in group_context_range:
                ctx, ctx_type = group_context_range[q_num]
            else:
                ctx = current_context
                ctx_type = current_context_type

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
            }
            continue

        # 6. Inline multi-option line: "A) 100   B) 200   C) 300   D) 400"
        # Use flexible spacing — some PDFs use single space or tabs between options
        inline_opts = re.findall(
            r'(?:^|\s+|\t)([A-Ea-e])[\.\)]\s*(.+?)(?=\s+[A-Ea-e][\.\)]\s|$)',
            line
        )
        # Also try parenthetical format: (A) text  (B) text
        if not inline_opts or len(inline_opts) < 2:
            inline_opts_p = re.findall(
                r'\(([A-Ea-e])\)\s*(.+?)(?=\s*\([A-Ea-e]\)|$)',
                line
            )
            if len(inline_opts_p) >= 2:
                inline_opts = [(g1, g2, '') for g1, g2 in inline_opts_p]
        if inline_opts and len(inline_opts) >= 2 and current_q:
            for opt_tuple in inline_opts:
                # opt_tuple is either (letter, text, extra) or (letter, text) from parenthetical
                opt_text = (opt_tuple[1] if len(opt_tuple) >= 2 else opt_tuple[-1]).strip()
                ans_inline = re.search(
                    r'[\s✔✅\*✓]*(?:Correct\s+|Right\s+)?Ans(?:wer)?[\s\:\-\=]+(.*)$',
                    opt_text, re.IGNORECASE
                )
                if ans_inline:
                    current_q['raw_answer'] = ans_inline.group(1).strip()
                    opt_text = opt_text[:ans_inline.start()].strip()
                is_starred = opt_text.endswith('*') or opt_text.startswith('*')
                opt_text = opt_text.strip('*').strip()
                if opt_text and opt_text not in current_q['options']:
                    current_q['options'].append(opt_text)
                    if is_starred:
                        current_q['starred_options'].append(opt_text)
            continue

        # 7. Single option line
        m_opt = _RE_OPT_LINE.match(line)
        if m_opt and current_q:
            opt_text = m_opt.group(5).strip()
            has_star = (line.startswith('*') or opt_text.endswith('*')
                        or (m_opt.group(4) and m_opt.group(4) in ('x', '*')))
            opt_text = opt_text.strip('*').strip()
            ans_inline = re.search(
                r'[\s✔✅\*✓]*(?:Correct\s+|Right\s+)?Ans(?:wer)?[\s\:\-\=]+(.*)$',
                opt_text, re.IGNORECASE
            )
            if ans_inline:
                current_q['raw_answer'] = ans_inline.group(1).strip()
                opt_text = opt_text[:ans_inline.start()].strip()
            if opt_text:
                current_q['options'].append(opt_text)
                if has_star:
                    current_q['starred_options'].append(opt_text)
            continue

        # 8. Directions or long paragraph without question markers → potential DI passage / directions
        if not current_q and (_RE_DIRECTIONS.match(line) or len(line.split()) > 25):
            # Accumulate into sticky current_context (passage type)
            current_context = (current_context + '\n' + line).strip() if current_context and current_context_type == 'passage' else line
            current_context_type = 'passage'
            continue

        # 9. Continuation line
        if current_q:
            if not current_q['options'] and not current_q['raw_answer']:
                current_q['question_lines'] += ' ' + line
            elif current_q['options'] and not current_q['raw_answer']:
                current_q['options'][-1] += ' ' + line

    finalize_q()

    if not parsed_sections:
        parsed_sections = [{'id': 'sec_1', 'name': 'General'}]

    return parsed_sections, parsed_questions
