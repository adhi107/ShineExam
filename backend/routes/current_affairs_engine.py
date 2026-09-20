"""
backend/routes/current_affairs_engine.py
────────────────────────────────────────
Enterprise Current Affairs Management & Learning System.
Features:
- Admin Dashboard metrics, article authoring (Draft/Scheduled/Published/Archived)
- 24+ Configurable categories, syllabus mapping (UPSC GS1-4, APPSC, TSPSC), priority levels
- Duplicate detection, source attribution
- Daily Current Affairs Quizzes with manual assignment integration
- Student Reader with bookmarks, private personal notes, revision filters & reading analytics
"""

from datetime import datetime
import hashlib
from pathlib import Path
import uuid
from bson import ObjectId
from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename

from config.db import get_db
from utils.json import to_jsonable
from utils.tenant import get_request_tenant_id, DEFAULT_TENANT_ID
from utils.validators import require_fields
from utils.audit import log_audit_event

ca_engine_bp = Blueprint("current_affairs_engine", __name__)

UPLOAD_ATTACHMENTS_DIR = Path(__file__).resolve().parents[1] / "uploads" / "attachments"
UPLOAD_ATTACHMENTS_DIR.mkdir(parents=True, exist_ok=True)


def _serialize(doc):
    if not doc:
        return None
    doc["id"] = str(doc.get("_id", ""))
    return doc


def _compute_article_hash(title: str, date: str) -> str:
    content = title.strip().lower() + "_" + str(date).strip()
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


DEFAULT_CATEGORIES = [
    "National", "International", "Polity & Governance", "Economy",
    "Environment & Ecology", "Science & Technology", "Defence", "Space",
    "Geography", "History & Culture", "Social Issues", "Government Schemes",
    "Reports & Indices", "Awards & Honours", "Sports", "Important Appointments",
    "International Relations", "Agriculture", "Banking & Finance", "Infrastructure",
    "Andhra Pradesh", "Telangana", "State Government", "Miscellaneous"
]


# ────────────────────────────────────────────────────────────────
# 1. Admin Dashboard Stats & Metrics
# ────────────────────────────────────────────────────────────────

@ca_engine_bp.route("/admin/dashboard", methods=["GET"])
def get_admin_ca_dashboard_stats():
    """Admin: Overview cards and engagement metrics."""
    db = get_db()
    tenant_id = get_request_tenant_id()
    query = {}
    if tenant_id and tenant_id != "all":
        query["$or"] = [
            {"tenantId": tenant_id},
            {"tenantId": {"$exists": False}},
            {"tenantId": None},
        ]

    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    month_str = datetime.utcnow().strftime("%Y-%m")

    today_count = db.current_affairs.count_documents({**query, "publishDate": today_str})
    month_count = db.current_affairs.count_documents({**query, "month": month_str, "status": "published"})
    draft_count = db.current_affairs.count_documents({**query, "status": "draft"})
    scheduled_count = db.current_affairs.count_documents({**query, "status": "scheduled"})
    total_articles = db.current_affairs.count_documents(query)
    total_bookmarks = db.current_affair_bookmarks.count_documents({})
    total_notes = db.current_affair_notes.count_documents({})
    total_quizzes = db.current_affair_quizzes.count_documents(query)

    # Category distribution
    cat_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    cat_stats = list(db.current_affairs.aggregate(cat_pipeline))

    return jsonify({
        "metrics": {
            "todayArticles": today_count,
            "publishedThisMonth": month_count,
            "drafts": draft_count,
            "scheduled": scheduled_count,
            "totalArticles": total_articles,
            "totalBookmarks": total_bookmarks,
            "totalNotes": total_notes,
            "totalQuizzes": total_quizzes,
        },
        "categoryStats": [{"category": c["_id"] or "General", "count": c["count"]} for c in cat_stats]
    })


# ────────────────────────────────────────────────────────────────
# 2. Daily Current Affairs CRUD & Workflow
# ────────────────────────────────────────────────────────────────

@ca_engine_bp.route("/articles", methods=["GET"])
def list_articles():
    """List current affairs with advanced filters."""
    db = get_db()
    tenant_id = get_request_tenant_id()
    query = {}
    if tenant_id and tenant_id != "all":
        query["$or"] = [
            {"tenantId": tenant_id},
            {"tenantId": {"$exists": False}},
            {"tenantId": None},
        ]

    category = request.args.get("category")
    status = request.args.get("status")
    exam = request.args.get("exam")
    stage = request.args.get("stage")
    priority = request.args.get("priority")
    date = request.args.get("date")
    month = request.args.get("month")
    is_important = request.args.get("isImportant")
    search = request.args.get("search", "").strip()

    if category: query["category"] = category
    if status: query["status"] = status
    if exam: query["applicableExams"] = exam
    if stage: query["examRelevance"] = stage
    if priority: query["priority"] = priority
    if date: query["publishDate"] = date
    if month: query["month"] = month
    if is_important is not None: query["isHighlyImportant"] = is_important.lower() in ("true", "1")
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"shortSummary": {"$regex": search, "$options": "i"}},
            {"detailedExplanation": {"$regex": search, "$options": "i"}},
            {"tags": {"$regex": search, "$options": "i"}},
            {"keywords": {"$regex": search, "$options": "i"}},
        ]

    page = max(1, int(request.args.get("page", 1)))
    limit = min(200, max(1, int(request.args.get("limit", 30))))
    skip = (page - 1) * limit

    total = db.current_affairs.count_documents(query)
    articles = list(db.current_affairs.find(query).sort("publishDate", -1).skip(skip).limit(limit))

    return jsonify({
        "total": total,
        "page": page,
        "limit": limit,
        "categories": DEFAULT_CATEGORIES,
        "articles": to_jsonable([_serialize(a) for a in articles])
    })


@ca_engine_bp.route("/articles/<article_id>", methods=["GET"])
def get_article(article_id):
    """Get single current affairs article."""
    db = get_db()
    try:
        oid = ObjectId(article_id)
    except Exception:
        return jsonify({"error": "Invalid article ID"}), 400

    doc = db.current_affairs.find_one({"_id": oid})
    if not doc:
        return jsonify({"error": "Article not found"}), 404

    # Increment view counter
    db.current_affairs.update_one({"_id": oid}, {"$inc": {"viewsCount": 1}})
    doc["viewsCount"] = doc.get("viewsCount", 0) + 1

    return jsonify({"article": to_jsonable(_serialize(doc))})


@ca_engine_bp.route("/upload-attachment", methods=["POST"])
def upload_ca_attachment():
    """Upload article attachment file (PDF, DOCX, XLSX, TXT, EPUB, Images) and return static URL."""
    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "No file uploaded"}), 400

    filename = secure_filename(file.filename)
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    allowed = {"pdf", "doc", "docx", "xls", "xlsx", "csv", "ppt", "pptx", "txt", "epub", "json", "png", "jpg", "jpeg", "webp"}
    if ext and ext not in allowed:
        return jsonify({"error": f"File type .{ext} is not supported"}), 400

    unique_name = f"{uuid.uuid4().hex}_{filename}"
    save_path = UPLOAD_ATTACHMENTS_DIR / unique_name
    file.save(save_path)
    file_size = save_path.stat().st_size

    file_url = f"/uploads/attachments/{unique_name}"
    return jsonify({
        "attachment": {
            "name": filename,
            "url": file_url,
            "size": file_size,
            "type": file.mimetype or "application/octet-stream"
        }
    }), 201


def _sanitize_attachments(attachments):
    """Strip out any giant base64 dataUrls before storing in MongoDB to prevent BSON DocumentTooLarge."""
    if not attachments or not isinstance(attachments, list):
        return []
    clean = []
    for att in attachments:
        if not isinstance(att, dict):
            continue
        item = {
            "name": str(att.get("name", "document")),
            "size": int(att.get("size", 0)),
            "type": str(att.get("type", "application/octet-stream")),
            "url": str(att.get("url", "")).strip(),
        }
        # Only keep dataUrl if url is missing and dataUrl length is small (< 50KB)
        raw_data = att.get("dataUrl")
        if not item["url"] and raw_data and len(raw_data) < 50000:
            item["dataUrl"] = raw_data
        clean.append(item)
    return clean


@ca_engine_bp.route("/articles", methods=["POST"])
def create_article():
    """Admin: Create or schedule a new current affairs article."""
    db = get_db()
    data = request.get_json(silent=True) or {}

    ok, msg = require_fields(data, ["title", "category", "shortSummary"])
    if not ok:
        return jsonify({"error": msg}), 400

    title = str(data["title"]).strip()
    pub_date = data.get("publishDate", datetime.utcnow().strftime("%Y-%m-%d"))
    tenant_id = get_request_tenant_id() or DEFAULT_TENANT_ID
    now = datetime.utcnow().isoformat()

    # Duplicate check
    a_hash = _compute_article_hash(title, pub_date)
    existing = db.current_affairs.find_one({"tenantId": tenant_id, "contentHash": a_hash})
    if existing:
        return jsonify({
            "error": "A current affairs article with this title and date already exists.",
            "existingId": str(existing["_id"])
        }), 409

    status = data.get("status", "published")  # draft | scheduled | published | archived

    doc = {
        "tenantId": tenant_id,
        "title": title,
        "shortSummary": str(data["shortSummary"]).strip(),
        "detailedExplanation": str(data.get("detailedExplanation", "")).strip(),
        "keyPoints": data.get("keyPoints", []),
        "importantFacts": data.get("importantFacts", []),
        "publishDate": pub_date,
        "month": data.get("month", pub_date[:7]),
        "scheduledAt": data.get("scheduledAt"),
        "category": str(data["category"]).strip(),
        "subcategory": str(data.get("subcategory", "")).strip(),
        "priority": str(data.get("priority", "Medium")).strip(), # High | Medium | Low
        "isHighlyImportant": bool(data.get("isHighlyImportant", False)),
        "examRelevance": data.get("examRelevance", ["Prelims", "Mains"]),  # Prelims | Mains | Interview
        "applicableExams": data.get("applicableExams", ["UPSC", "APPSC", "TSPSC"]),
        "relatedSyllabusTopics": data.get("relatedSyllabusTopics", []),
        "relatedSubjects": data.get("relatedSubjects", []),
        "targetAudience": str(data.get("targetAudience", "all")).strip(), # all | batches | exams | students
        "assignedBatches": data.get("assignedBatches", []),
        "assignedStudentIds": data.get("assignedStudentIds", []),
        "source": {
            "name": str(data.get("sourceName", "The Hindu / PIB")).strip(),
            "url": str(data.get("sourceUrl", "")).strip(),
            "publicationDate": data.get("sourceDate", pub_date),
            "isTrusted": True
        },
        "attachments": _sanitize_attachments(data.get("attachments", [])),
        "pdfUrl": str(data.get("pdfUrl", "")).strip(),
        "imageUrl": str(data.get("imageUrl", "")).strip(),
        "tags": data.get("tags", []),
        "keywords": data.get("keywords", []),
        "viewsCount": 0,
        "bookmarksCount": 0,
        "status": status,
        "contentHash": a_hash,
        "createdAt": now,
        "updatedAt": now,
    }

    res = db.current_affairs.insert_one(doc)
    doc["_id"] = res.inserted_id

    log_audit_event("create_current_affairs", {
        "articleId": str(res.inserted_id),
        "title": title,
        "category": doc["category"],
        "status": status
    })

    return jsonify({
        "message": f"Current affairs article successfully {status}.",
        "article": to_jsonable(_serialize(doc))
    }), 201


@ca_engine_bp.route("/articles/<article_id>", methods=["PUT"])
def update_article(article_id):
    """Admin: Update an existing article."""
    db = get_db()
    try:
        oid = ObjectId(article_id)
    except Exception:
        return jsonify({"error": "Invalid article ID"}), 400

    data = request.get_json(silent=True) or {}
    now = datetime.utcnow().isoformat()

    allowed = [
        "title", "shortSummary", "detailedExplanation", "keyPoints", "importantFacts",
        "publishDate", "month", "scheduledAt", "category", "subcategory", "priority",
        "isHighlyImportant", "examRelevance", "applicableExams", "relatedSyllabusTopics",
        "relatedSubjects", "targetAudience", "assignedBatches", "assignedStudentIds",
        "source", "attachments", "pdfUrl", "imageUrl", "tags",
        "keywords", "status"
    ]
    updates = {k: data[k] for k in allowed if k in data}
    if "attachments" in updates:
        updates["attachments"] = _sanitize_attachments(updates["attachments"])
    updates["updatedAt"] = now

    if "title" in updates or "publishDate" in updates:
        t = updates.get("title", data.get("title", ""))
        d = updates.get("publishDate", data.get("publishDate", ""))
        if t: updates["contentHash"] = _compute_article_hash(t, d)

    res = db.current_affairs.update_one({"_id": oid}, {"$set": updates})
    if res.matched_count == 0:
        return jsonify({"error": "Article not found"}), 404

    updated = db.current_affairs.find_one({"_id": oid})
    log_audit_event("update_current_affairs", {"articleId": article_id, "fields": list(updates.keys())})
    return jsonify({"message": "Article updated successfully", "article": to_jsonable(_serialize(updated))})


@ca_engine_bp.route("/articles/<article_id>", methods=["DELETE"])
def delete_article(article_id):
    """Admin: Delete article."""
    db = get_db()
    try:
        oid = ObjectId(article_id)
    except Exception:
        return jsonify({"error": "Invalid article ID"}), 400

    res = db.current_affairs.delete_one({"_id": oid})
    if res.deleted_count == 0:
        return jsonify({"error": "Article not found"}), 404

    log_audit_event("delete_current_affairs", {"articleId": article_id})
    return jsonify({"message": "Article deleted successfully"})


# ────────────────────────────────────────────────────────────────
# 3. Student Bookmarks & Private Notes
# ────────────────────────────────────────────────────────────────

@ca_engine_bp.route("/bookmarks", methods=["POST"])
def toggle_bookmark():
    """Student: Bookmark or unbookmark an article."""
    db = get_db()
    data = request.get_json(silent=True) or {}
    ok, msg = require_fields(data, ["userId", "articleId"])
    if not ok:
        return jsonify({"error": msg}), 400

    user_id = str(data["userId"]).strip()
    article_id = str(data["articleId"]).strip()
    try: a_oid = ObjectId(article_id)
    except Exception: return jsonify({"error": "Invalid articleId"}), 400

    existing = db.current_affair_bookmarks.find_one({"userId": user_id, "articleId": a_oid})
    if existing:
        db.current_affair_bookmarks.delete_one({"_id": existing["_id"]})
        db.current_affairs.update_one({"_id": a_oid}, {"$inc": {"bookmarksCount": -1}})
        return jsonify({"message": "Bookmark removed", "isBookmarked": False})
    else:
        now = datetime.utcnow().isoformat()
        article = db.current_affairs.find_one({"_id": a_oid})
        db.current_affair_bookmarks.insert_one({
            "userId": user_id,
            "articleId": a_oid,
            "articleTitle": article.get("title", "") if article else "",
            "category": article.get("category", "") if article else "",
            "publishDate": article.get("publishDate", "") if article else "",
            "createdAt": now
        })
        db.current_affairs.update_one({"_id": a_oid}, {"$inc": {"bookmarksCount": 1}})
        return jsonify({"message": "Bookmark saved", "isBookmarked": True})


@ca_engine_bp.route("/bookmarks", methods=["GET"])
def list_student_bookmarks():
    """Student: Retrieve personal bookmarked articles."""
    db = get_db()
    user_id = request.args.get("userId", "").strip()
    if not user_id:
        return jsonify({"error": "userId required"}), 400

    bookmarks = list(db.current_affair_bookmarks.find({"userId": user_id}).sort("createdAt", -1))
    return jsonify({"bookmarks": to_jsonable([_serialize(b) for b in bookmarks])})


@ca_engine_bp.route("/notes", methods=["POST"])
def save_personal_note():
    """Student: Create or update a private study note on a current affairs article."""
    db = get_db()
    data = request.get_json(silent=True) or {}
    ok, msg = require_fields(data, ["userId", "articleId", "noteText"])
    if not ok:
        return jsonify({"error": msg}), 400

    user_id = str(data["userId"]).strip()
    article_id = str(data["articleId"]).strip()
    note_text = str(data["noteText"]).strip()
    now = datetime.utcnow().isoformat()

    try: a_oid = ObjectId(article_id)
    except Exception: return jsonify({"error": "Invalid articleId"}), 400

    res = db.current_affair_notes.update_one(
        {"userId": user_id, "articleId": a_oid},
        {
            "$set": {
                "userId": user_id,
                "articleId": a_oid,
                "noteText": note_text,
                "updatedAt": now
            },
            "$setOnInsert": {"createdAt": now}
        },
        upsert=True
    )

    return jsonify({"message": "Personal study note saved successfully"})


@ca_engine_bp.route("/notes", methods=["GET"])
def get_personal_notes():
    """Student: Retrieve private notes."""
    db = get_db()
    user_id = request.args.get("userId", "").strip()
    article_id = request.args.get("articleId", "").strip()
    if not user_id:
        return jsonify({"error": "userId required"}), 400

    query = {"userId": user_id}
    if article_id:
        try: query["articleId"] = ObjectId(article_id)
        except Exception: pass

    notes = list(db.current_affair_notes.find(query).sort("updatedAt", -1))
    return jsonify({"notes": to_jsonable([_serialize(n) for n in notes])})


# ────────────────────────────────────────────────────────────────
# 4. Daily Current Affairs Quizzes
# ────────────────────────────────────────────────────────────────

@ca_engine_bp.route("/quizzes", methods=["POST"])
def create_daily_quiz():
    """Admin: Create a Daily Current Affairs Quiz."""
    db = get_db()
    data = request.get_json(silent=True) or {}
    ok, msg = require_fields(data, ["title", "quizDate", "questions"])
    if not ok:
        return jsonify({"error": msg}), 400

    tenant_id = get_request_tenant_id() or DEFAULT_TENANT_ID
    now = datetime.utcnow().isoformat()
    q_list = data.get("questions", [])

    doc = {
        "tenantId": tenant_id,
        "title": str(data["title"]).strip(),
        "quizDate": str(data["quizDate"]).strip(),
        "duration": int(data.get("duration", 20)),
        "totalMarks": float(data.get("totalMarks", len(q_list) * 2)),
        "negativeMarking": float(data.get("negativeMarking", 0.66)),
        "questionsCount": len(q_list),
        "questions": q_list,
        "applicableExams": data.get("applicableExams", ["UPSC", "APPSC", "TSPSC"]),
        "status": data.get("status", "published"),
        "createdAt": now,
        "updatedAt": now,
    }

    res = db.current_affair_quizzes.insert_one(doc)
    doc["_id"] = res.inserted_id

    log_audit_event("create_ca_quiz", {"quizId": str(res.inserted_id), "title": doc["title"]})
    return jsonify({"message": "Daily Current Affairs Quiz created", "quiz": to_jsonable(_serialize(doc))}), 201


@ca_engine_bp.route("/quizzes", methods=["GET"])
def list_quizzes():
    """List available daily current affairs quizzes."""
    db = get_db()
    tenant_id = get_request_tenant_id()
    query = {}
    if tenant_id and tenant_id != "all":
        query["$or"] = [
            {"tenantId": tenant_id},
            {"tenantId": {"$exists": False}},
            {"tenantId": None},
        ]

    date = request.args.get("date")
    if date: query["quizDate"] = date

    quizzes = list(db.current_affair_quizzes.find(query).sort("quizDate", -1).limit(30))
    return jsonify({"quizzes": to_jsonable([_serialize(q) for q in quizzes])})
