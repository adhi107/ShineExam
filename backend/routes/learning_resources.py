from datetime import datetime
from pathlib import Path
import uuid

from bson import ObjectId
from flask import Blueprint, jsonify, request, send_file
from werkzeug.utils import secure_filename

from config.db import get_db
from utils.json import to_jsonable

admin_documents_bp = Blueprint("admin_documents", __name__)
admin_announcements_bp = Blueprint("admin_announcements", __name__)
answerer_resources_bp = Blueprint("answerer_resources", __name__)
UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads" / "documents"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {"pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "png", "jpg", "jpeg"}
ANNOUNCEMENT_DIR = Path(__file__).resolve().parents[1] / "uploads" / "announcements"
ANNOUNCEMENT_DIR.mkdir(parents=True, exist_ok=True)


def _document_json(doc, assigned_count=0, assigned_user_ids=None):
    return {"id": str(doc["_id"]), "title": doc.get("title"), "description": doc.get("description", ""), "originalName": doc.get("originalName"), "mimeType": doc.get("mimeType"), "size": int(doc.get("size", 0)), "createdAt": doc.get("createdAt"), "assignedCount": assigned_count, "assignedUserIds": assigned_user_ids or []}


@admin_documents_bp.route("", methods=["GET", "POST"])
@admin_documents_bp.route("/", methods=["GET", "POST"])
def documents_collection():
    db = get_db()
    if request.method == "GET":
        rows = list(db.documents.find({}).sort("createdAt", -1))
        result = []
        for row in rows:
            user_ids = db.document_assignments.distinct("userId", {"documentId": row["_id"]})
            result.append(_document_json(row, len(user_ids), user_ids))
        return jsonify({"documents": to_jsonable(result)})
    upload = request.files.get("file")
    title = str(request.form.get("title") or "").strip()
    if not upload or not title:
        return jsonify({"error": "Title and file are required"}), 400
    original = secure_filename(upload.filename or "document")
    extension = original.rsplit(".", 1)[-1].lower() if "." in original else ""
    if extension not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Unsupported document type"}), 400
    stored_name = f"{uuid.uuid4().hex}.{extension}"
    path = UPLOAD_DIR / stored_name
    upload.save(path)
    doc = {"title": title, "description": str(request.form.get("description") or "").strip(), "filename": stored_name, "originalName": original, "mimeType": upload.mimetype, "size": path.stat().st_size, "createdAt": datetime.utcnow()}
    doc["_id"] = db.documents.insert_one(doc).inserted_id
    return jsonify({"document": to_jsonable(_document_json(doc))}), 201


@admin_documents_bp.delete("/<document_id>")
def delete_document(document_id):
    db = get_db()
    try: oid = ObjectId(document_id)
    except Exception: return jsonify({"error": "Invalid document id"}), 400
    doc = db.documents.find_one({"_id": oid})
    if not doc: return jsonify({"error": "Document not found"}), 404
    path = UPLOAD_DIR / doc.get("filename", "")
    if path.is_file(): path.unlink()
    db.documents.delete_one({"_id": oid});db.document_assignments.delete_many({"documentId": oid})
    return jsonify({"message": "Document deleted"})


@admin_documents_bp.post("/<document_id>/assign")
def assign_document(document_id):
    db = get_db();payload=request.get_json(silent=True) or {};user_ids=payload.get("userIds") or []
    try: oid=ObjectId(document_id)
    except Exception: return jsonify({"error":"Invalid document id"}),400
    if not db.documents.find_one({"_id":oid}): return jsonify({"error":"Document not found"}),404
    valid={row["userId"] for row in db.users.find({"role":"answerer","userId":{"$in":[str(value) for value in user_ids]}},{"userId":1})}
    db.document_assignments.delete_many({"documentId":oid})
    now=datetime.utcnow()
    if valid: db.document_assignments.insert_many([{"documentId":oid,"userId":uid,"createdAt":now} for uid in valid])
    return jsonify({"message":"Document assigned","assigned":len(valid)})


@answerer_resources_bp.get("/documents")
def candidate_documents():
    user_id=str(request.args.get("userId") or "").strip();db=get_db()
    assignments=list(db.document_assignments.find({"userId":user_id}));ids=[row["documentId"] for row in assignments]
    rows=list(db.documents.find({"_id":{"$in":ids}}).sort("createdAt",-1)) if ids else []
    return jsonify({"documents":to_jsonable([_document_json(row) for row in rows])})


@answerer_resources_bp.get("/documents/<document_id>/download")
def download_document(document_id):
    user_id=str(request.args.get("userId") or "").strip();db=get_db()
    try: oid=ObjectId(document_id)
    except Exception: return jsonify({"error":"Invalid document id"}),400
    if not db.document_assignments.find_one({"documentId":oid,"userId":user_id}): return jsonify({"error":"Document not assigned"}),403
    doc=db.documents.find_one({"_id":oid})
    if not doc:return jsonify({"error":"Document not found"}),404
    path=UPLOAD_DIR/doc.get("filename","")
    if not path.is_file():return jsonify({"error":"Document file is missing"}),404
    return send_file(path,as_attachment=True,download_name=doc.get("originalName") or path.name,mimetype=doc.get("mimeType"))


@answerer_resources_bp.get("/documents/<document_id>/view")
def view_document(document_id):
    user_id=str(request.args.get("userId") or "").strip();db=get_db()
    try:oid=ObjectId(document_id)
    except Exception:return jsonify({"error":"Invalid document id"}),400
    if not db.document_assignments.find_one({"documentId":oid,"userId":user_id}):return jsonify({"error":"Document not assigned"}),403
    doc=db.documents.find_one({"_id":oid})
    if not doc:return jsonify({"error":"Document not found"}),404
    path=UPLOAD_DIR/doc.get("filename","")
    if not path.is_file():return jsonify({"error":"Document file is missing"}),404
    return send_file(path,as_attachment=False,download_name=doc.get("originalName") or path.name,mimetype=doc.get("mimeType"))


@answerer_resources_bp.get("/bookmarks")
def list_bookmarks():
    user_id=str(request.args.get("userId") or "").strip();rows=list(get_db().bookmarks.find({"userId":user_id}).sort("createdAt",-1))
    return jsonify({"bookmarks":to_jsonable([{"id":str(row["_id"]),"type":row.get("type"),"testId":row.get("testId"),"questionId":row.get("questionId"),"title":row.get("title"),"question":row.get("question"),"createdAt":row.get("createdAt")} for row in rows])})


@answerer_resources_bp.post("/bookmarks/toggle")
def toggle_bookmark():
    payload=request.get_json(silent=True) or {};user_id=str(payload.get("userId") or "").strip();kind=str(payload.get("type") or "").strip();test_id=str(payload.get("testId") or "").strip();question_id=str(payload.get("questionId") or "").strip()
    if not user_id or kind not in {"test","question"} or not test_id:return jsonify({"error":"Invalid bookmark"}),400
    query={"userId":user_id,"type":kind,"testId":test_id}
    if kind=="question":
        if not question_id:return jsonify({"error":"questionId is required"}),400
        query["questionId"]=question_id
    db=get_db();existing=db.bookmarks.find_one(query)
    if existing:
        db.bookmarks.delete_one({"_id":existing["_id"]});return jsonify({"bookmarked":False})
    doc={**query,"title":str(payload.get("title") or "Saved test"),"question":str(payload.get("question") or ""),"createdAt":datetime.utcnow()};db.bookmarks.insert_one(doc)
    return jsonify({"bookmarked":True}),201


def _announcement_json(row, user_ids=None):
    return {"id":str(row["_id"]),"title":row.get("title", ""),"message":row.get("message", ""),"linkUrl":row.get("linkUrl", ""),"imageName":row.get("imageName", ""),"imageUrl":f"/answerer/announcements/{row['_id']}/image" if row.get("imageName") else "","publishAt":row.get("publishAt"),"expiresAt":row.get("expiresAt"),"createdAt":row.get("createdAt"),"assignedUserIds":user_ids or [],"assignedCount":len(user_ids or [])}


def _parse_announcement_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
    except (TypeError, ValueError):
        return None


def _candidate_test_update_json(exam):
    available_from = exam.get("availableFrom") or exam.get("createdAt")
    parts = []
    if exam.get("categoryName"):
        parts.append(str(exam.get("categoryName")))
    if exam.get("subcategoryName"):
        parts.append(str(exam.get("subcategoryName")))
    if exam.get("stage"):
        parts.append(str(exam.get("stage")))
    detail = " • ".join(parts)
    duration = int(exam.get("duration", 0) or 0)
    questions = int(exam.get("questionCount", 0) or 0)
    message = f"This assigned test opens on {available_from.strftime('%d %b %Y, %I:%M %p')} UTC."
    if duration or questions:
        message += f" Duration: {duration} minutes. Questions: {questions}."
    if detail:
        message += f" Category: {detail}."
    return {
        "id": f"test-update-{exam['_id']}",
        "title": f"Upcoming test: {exam.get('name', 'Assigned test')}",
        "message": message,
        "linkUrl": "",
        "imageName": "",
        "imageUrl": "",
        "publishAt": available_from,
        "expiresAt": exam.get("validUntil"),
        "createdAt": exam.get("updatedAt") or exam.get("createdAt") or available_from,
        "assignedUserIds": [],
        "assignedCount": 0,
        "type": "test_update",
        "testId": str(exam["_id"]),
    }


@admin_announcements_bp.route("", methods=["GET", "POST"])
@admin_announcements_bp.route("/", methods=["GET", "POST"])
def announcement_collection():
    db=get_db()
    if request.method=="GET":
        result=[]
        for row in db.announcements.find({}).sort("createdAt",-1):
            users=db.announcement_assignments.distinct("userId",{"announcementId":row["_id"]})
            result.append(_announcement_json(row,users))
        return jsonify({"announcements":to_jsonable(result)})
    title=str(request.form.get("title") or "").strip();message=str(request.form.get("message") or "").strip()
    if not title or not message:return jsonify({"error":"Title and message are required"}),400
    image=request.files.get("image");image_name=""
    if image and image.filename:
        original=secure_filename(image.filename);extension=original.rsplit(".",1)[-1].lower() if "." in original else ""
        if extension not in {"png","jpg","jpeg"}:return jsonify({"error":"Announcement image must be PNG or JPG"}),400
        image_name=f"{uuid.uuid4().hex}.{extension}";image.save(ANNOUNCEMENT_DIR/image_name)
    now=datetime.utcnow()
    publish_at=_parse_announcement_datetime(request.form.get("publishAt")) or now
    expires_at=_parse_announcement_datetime(request.form.get("expiresAt"))
    if expires_at and expires_at < publish_at:return jsonify({"error":"Expire date must be after the publish date"}),400
    doc={"title":title,"message":message,"linkUrl":str(request.form.get("linkUrl") or "").strip(),"imageName":image_name,"publishAt":publish_at,"expiresAt":expires_at,"createdAt":now}
    doc["_id"]=db.announcements.insert_one(doc).inserted_id
    return jsonify({"announcement":to_jsonable(_announcement_json(doc))}),201


@admin_announcements_bp.delete("/<announcement_id>")
def delete_announcement(announcement_id):
    db=get_db()
    try:oid=ObjectId(announcement_id)
    except Exception:return jsonify({"error":"Invalid announcement id"}),400
    row=db.announcements.find_one({"_id":oid})
    if not row:return jsonify({"error":"Announcement not found"}),404
    path=ANNOUNCEMENT_DIR/row.get("imageName","")
    if path.is_file():path.unlink()
    db.announcements.delete_one({"_id":oid});db.announcement_assignments.delete_many({"announcementId":oid})
    return jsonify({"message":"Announcement deleted"})


@admin_announcements_bp.post("/<announcement_id>/assign")
def assign_announcement(announcement_id):
    db=get_db();payload=request.get_json(silent=True) or {};user_ids=[str(value) for value in payload.get("userIds") or []]
    try:oid=ObjectId(announcement_id)
    except Exception:return jsonify({"error":"Invalid announcement id"}),400
    if not db.announcements.find_one({"_id":oid}):return jsonify({"error":"Announcement not found"}),404
    valid={row["userId"] for row in db.users.find({"role":"answerer","userId":{"$in":user_ids}},{"userId":1})};db.announcement_assignments.delete_many({"announcementId":oid});now=datetime.utcnow()
    if valid:db.announcement_assignments.insert_many([{"announcementId":oid,"userId":uid,"createdAt":now} for uid in valid])
    return jsonify({"message":"Announcement assigned","assigned":len(valid)})


@answerer_resources_bp.get("/announcements")
def candidate_announcements():
    user_id=str(request.args.get("userId") or "").strip();db=get_db();now=datetime.utcnow();ids=[row["announcementId"] for row in db.announcement_assignments.find({"userId":user_id})]
    rows=list(db.announcements.find({"_id":{"$in":ids}}).sort("createdAt",-1)) if ids else []
    announcements=[]
    for row in rows:
        publish_at=_parse_announcement_datetime(row.get("publishAt")) or row.get("createdAt") or now
        expires_at=_parse_announcement_datetime(row.get("expiresAt"))
        if publish_at <= now and (not expires_at or expires_at >= now):
            announcements.append(_announcement_json(row))
    exam_ids=[row["examId"] for row in db.exam_assignments.find({"userId":user_id}) if row.get("examId")]
    exams=list(db.exams.find({"_id":{"$in":exam_ids},"status":"active"})) if exam_ids else []
    for exam in exams:
        available_from=exam.get("availableFrom") or exam.get("createdAt")
        valid_until=exam.get("validUntil")
        if available_from and available_from > now and (not valid_until or valid_until >= now):
            announcements.append(_candidate_test_update_json(exam))
    announcements.sort(key=lambda item:_parse_announcement_datetime(item.get("publishAt")) or _parse_announcement_datetime(item.get("createdAt")) or now, reverse=True)
    return jsonify({"announcements":to_jsonable(announcements)})


@answerer_resources_bp.get("/announcements/<announcement_id>/image")
def announcement_image(announcement_id):
    try:row=get_db().announcements.find_one({"_id":ObjectId(announcement_id)})
    except Exception:row=None
    if not row or not row.get("imageName"):return jsonify({"error":"Image not found"}),404
    path=ANNOUNCEMENT_DIR/row["imageName"]
    if not path.is_file():return jsonify({"error":"Image file is missing"}),404
    return send_file(path)
