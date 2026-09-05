import os
import re
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, send_from_directory, current_app, Response
from werkzeug.utils import secure_filename
from config.db import get_db
from utils.tenant import get_request_tenant_id, build_tenant_filter, DEFAULT_TENANT_ID

admin_videos_bp = Blueprint("admin_videos", __name__)
answerer_videos_bp = Blueprint("answerer_videos", __name__)

ALLOWED_VIDEO_EXTENSIONS = {
    "mp4", "webm", "ogg", "mov", "m4v", "mkv",
    "avi", "flv", "wmv", "3gp", "3g2", "ts", "m2ts",
    "mpeg", "mpg", "f4v", "rm", "rmvb", "vob", "divx",
    "asf", "mxf", "dv", "ogv"
}
UPLOAD_SUBDIR = "videos"


def get_videos_dir() -> str:
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    videos_dir = os.path.join(backend_dir, "uploads", UPLOAD_SUBDIR)
    os.makedirs(videos_dir, exist_ok=True)
    return videos_dir


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_VIDEO_EXTENSIONS


# Extended MIME type map for formats not in mimetypes stdlib
EXTRA_MIME_TYPES = {
    "mp4": "video/mp4",
    "m4v": "video/x-m4v",
    "webm": "video/webm",
    "ogg": "video/ogg",
    "ogv": "video/ogg",
    "mov": "video/quicktime",
    "mkv": "video/x-matroska",
    "avi": "video/x-msvideo",
    "flv": "video/x-flv",
    "wmv": "video/x-ms-wmv",
    "3gp": "video/3gpp",
    "3g2": "video/3gpp2",
    "ts": "video/mp2t",
    "m2ts": "video/mp2t",
    "mpeg": "video/mpeg",
    "mpg": "video/mpeg",
    "f4v": "video/x-f4v",
    "rm": "application/vnd.rn-realmedia",
    "rmvb": "application/vnd.rn-realmedia-vbr",
    "vob": "video/dvd",
    "divx": "video/divx",
    "asf": "video/x-ms-asf",
    "dv": "video/x-dv",
    "mxf": "application/mxf",
}


def normalize_video_url(url: str) -> dict:
    """Detect platform and construct embed/direct stream URL.
    Supports: YouTube (standard, shorts, live, playlist links), Vimeo, direct URLs.
    """
    url = url.strip()

    # ── YouTube Shorts (youtube.com/shorts/<id>, m.youtube.com/shorts/<id>)
    yt_shorts_match = re.search(
        r"(?:youtube\.com|youtu\.be)\/shorts\/([A-Za-z0-9_-]+)",
        url,
        re.IGNORECASE
    )
    if yt_shorts_match:
        video_id = yt_shorts_match.group(1).split("?")[0].split("&")[0]
        return {
            "type": "link",
            "provider": "youtube",
            "videoId": video_id,
            "embedUrl": f"https://www.youtube.com/embed/{video_id}?rel=0&modestbranding=1&enablejsapi=1",
            "originalUrl": url,
        }

    # ── YouTube standard / embed / live / youtu.be short links
    yt_match = re.search(
        r"(?:(?:www\.|m\.)?youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live)\/|.*[?&]v=)|youtu\.be\/)([A-Za-z0-9_-]+)",
        url,
        re.IGNORECASE
    )
    if yt_match:
        video_id = yt_match.group(1).split("?")[0].split("&")[0]
        return {
            "type": "link",
            "provider": "youtube",
            "videoId": video_id,
            "embedUrl": f"https://www.youtube.com/embed/{video_id}?rel=0&modestbranding=1&enablejsapi=1",
            "originalUrl": url,
        }

    # ── Vimeo
    vimeo_match = re.search(
        r"vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/[^\/]*\/videos\/|album\/(?:\d+\/)?video\/|video\/|)(\d+)",
        url,
    )
    if vimeo_match:
        video_id = vimeo_match.group(1)
        return {
            "type": "link",
            "provider": "vimeo",
            "videoId": video_id,
            "embedUrl": f"https://player.vimeo.com/video/{video_id}?dnt=1",
            "originalUrl": url,
        }

    # ── Direct video URL / Stream
    return {
        "type": "link",
        "provider": "direct",
        "embedUrl": url,
        "originalUrl": url,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN VIDEO ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@admin_videos_bp.get("")
def list_videos():
    try:
        db = get_db()
        tenant_id = get_request_tenant_id()
        tenant_filter = build_tenant_filter(tenant_id)

        search = request.args.get("search", "").strip()
        category = request.args.get("category", "").strip()

        query = {**tenant_filter}
        if search:
            query["$and"] = query.get("$and", []) + [
                {
                    "$or": [
                        {"title": {"$regex": search, "$options": "i"}},
                        {"description": {"$regex": search, "$options": "i"}},
                        {"category": {"$regex": search, "$options": "i"}},
                    ]
                }
            ]
        if category and category.lower() != "all":
            query["category"] = category

        videos_cursor = db.videos.find(query).sort("createdAt", -1)
        videos = []
        for doc in videos_cursor:
            doc["id"] = str(doc.get("_id"))
            del doc["_id"]
            videos.append(doc)

        # Overall statistics for this tenant only
        total_videos = db.videos.count_documents(tenant_filter)
        file_uploads = db.videos.count_documents({**tenant_filter, "sourceType": "file"})
        link_videos = db.videos.count_documents({**tenant_filter, "sourceType": "link"})
        total_views = sum(v.get("viewCount", 0) for v in db.videos.find(tenant_filter, {"viewCount": 1}))

        return jsonify({
            "videos": videos,
            "stats": {
                "total": total_videos,
                "fileUploads": file_uploads,
                "links": link_videos,
                "totalViews": total_views,
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def get_temp_chunks_dir(session_id: str) -> str:
    safe_session = re.sub(r"[^A-Za-z0-9_-]", "", session_id)
    temp_dir = os.path.join(get_videos_dir(), "temp", safe_session)
    os.makedirs(temp_dir, exist_ok=True)
    return temp_dir


def parse_assigned_to(raw_value):
    if not raw_value or raw_value == "all":
        return "all"
    if isinstance(raw_value, list):
        clean = [str(x).strip() for x in raw_value if str(x).strip()]
        return clean if clean else "all"
    if isinstance(raw_value, str):
        parts = [x.strip() for x in raw_value.split(",") if x.strip()]
        if not parts:
            return "all"
        if len(parts) == 1 and parts[0].lower() == "all":
            return "all"
        return parts
    return "all"


@admin_videos_bp.post("/upload-init")
def init_chunked_upload():
    """Initializes a high-speed chunked video upload session."""
    try:
        data = request.get_json(silent=True) or request.form or {}
        filename = data.get("filename", "video.mp4")
        file_size = int(data.get("fileSize", 0))

        if not allowed_file(filename):
            return jsonify({"error": f"Invalid video format for '{filename}'. Allowed: MP4, WebM, MKV, MOV, AVI, etc."}), 400

        session_id = f"vup_{uuid.uuid4().hex}"
        temp_dir = get_temp_chunks_dir(session_id)

        # 5 MB standard high-throughput chunk size
        chunk_size = 5 * 1024 * 1024

        return jsonify({
            "sessionId": session_id,
            "chunkSize": chunk_size,
            "message": "Upload session initialized",
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_videos_bp.post("/upload-chunk")
def upload_video_chunk():
    """Receives and writes an individual binary chunk with high-speed unbuffered I/O."""
    try:
        session_id = request.form.get("sessionId") or request.args.get("sessionId") or ""
        chunk_index_raw = request.form.get("chunkIndex") or request.args.get("chunkIndex")
        total_chunks_raw = request.form.get("totalChunks") or request.args.get("totalChunks")

        if not session_id or chunk_index_raw is None:
            return jsonify({"error": "Missing sessionId or chunkIndex"}), 400

        chunk_index = int(chunk_index_raw)
        temp_dir = get_temp_chunks_dir(session_id)

        if "chunk" not in request.files:
            return jsonify({"error": "Chunk file data missing"}), 400

        chunk_file = request.files["chunk"]
        part_filename = f"chunk_{chunk_index:05d}.part"
        part_path = os.path.join(temp_dir, part_filename)

        # Ultra-fast direct save
        chunk_file.save(part_path)

        return jsonify({
            "status": "ok",
            "sessionId": session_id,
            "chunkIndex": chunk_index,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_videos_bp.post("/upload-complete")
def complete_chunked_upload():
    """Reassembles all chunks with 4MB streaming blocks into a final video file and saves DB record."""
    import shutil
    import threading
    try:
        db = get_db()
        tenant_id = get_request_tenant_id()
        data = request.get_json(silent=True) or request.form or {}

        session_id = data.get("sessionId", "")
        filename = data.get("filename", "video.mp4")
        total_chunks = int(data.get("totalChunks", 1))
        title = (data.get("title") or "").strip()
        description = (data.get("description") or "").strip()
        category = (data.get("category") or "General").strip()
        duration = (data.get("duration") or "15m").strip()
        assigned_to_raw = data.get("assignedTo", "all")
        tags_raw = data.get("tags", "")

        if not session_id:
            return jsonify({"error": "sessionId is required"}), 400
        if not title:
            return jsonify({"error": "Video title is required"}), 400

        temp_dir = get_temp_chunks_dir(session_id)
        if not os.path.exists(temp_dir):
            return jsonify({"error": "Upload session not found or expired"}), 404

        # Verify all chunks exist
        missing_chunks = []
        for idx in range(total_chunks):
            part_path = os.path.join(temp_dir, f"chunk_{idx:05d}.part")
            if not os.path.exists(part_path):
                missing_chunks.append(idx)

        if missing_chunks:
            return jsonify({
                "error": f"Missing {len(missing_chunks)} chunks",
                "missingChunks": missing_chunks
            }), 400

        ext = filename.rsplit(".", 1)[1].lower() if "." in filename else "mp4"
        unique_filename = f"video_{uuid.uuid4().hex[:12]}.{ext}"
        videos_dir = get_videos_dir()
        final_path = os.path.join(videos_dir, unique_filename)

        # High-throughput 4MB block assembly
        with open(final_path, "wb", buffering=4 * 1024 * 1024) as f_out:
            for idx in range(total_chunks):
                part_path = os.path.join(temp_dir, f"chunk_{idx:05d}.part")
                with open(part_path, "rb", buffering=4 * 1024 * 1024) as f_in:
                    shutil.copyfileobj(f_in, f_out, length=4 * 1024 * 1024)

        # Asynchronous cleanup so client response is not delayed by disk deletions
        def async_cleanup(p):
            shutil.rmtree(p, ignore_errors=True)
        threading.Thread(target=async_cleanup, args=(temp_dir,), daemon=True).start()

        file_size_bytes = os.path.getsize(final_path)

        tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if isinstance(tags_raw, str) else (tags_raw or [])
        assigned_to = parse_assigned_to(assigned_to_raw)

        video_record = {
            "tenantId": tenant_id,
            "title": title,
            "description": description,
            "category": category,
            "duration": duration,
            "assignedTo": assigned_to,
            "tags": tags,
            "sourceType": "file",
            "filename": unique_filename,
            "originalFilename": secure_filename(filename),
            "fileSize": file_size_bytes,
            "videoUrl": f"/api/answerer/classes/stream/{unique_filename}",
            "provider": "local",
            "viewCount": 0,
            "createdAt": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow().isoformat(),
        }

        result = db.videos.insert_one(video_record)
        video_record["id"] = str(result.inserted_id)
        if "_id" in video_record:
            del video_record["_id"]

        # Ensure database indexes
        try:
            db.videos.create_index([("tenantId", 1), ("createdAt", -1)], background=True)
            db.videos.create_index([("category", 1)], background=True)
        except Exception:
            pass

        return jsonify({
            "message": "Video uploaded and published successfully",
            "video": video_record
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_videos_bp.post("")
def create_video():
    try:
        db = get_db()
        tenant_id = get_request_tenant_id()

        source_type = request.form.get("sourceType") or (request.json.get("sourceType") if request.is_json else "link")
        title = request.form.get("title") or (request.json.get("title") if request.is_json else "")
        description = request.form.get("description") or (request.json.get("description") if request.is_json else "")
        category = request.form.get("category") or (request.json.get("category") if request.is_json else "General")
        duration = request.form.get("duration") or (request.json.get("duration") if request.is_json else "15m")
        assigned_to_raw = request.form.get("assignedTo") or (request.json.get("assignedTo") if request.is_json else "all")
        tags_raw = request.form.get("tags") or (request.json.get("tags") if request.is_json else "")

        if not title:
            return jsonify({"error": "Video title is required"}), 400

        tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if isinstance(tags_raw, str) else (tags_raw or [])
        assigned_to = parse_assigned_to(assigned_to_raw)

        video_record = {
            "tenantId": tenant_id,
            "title": title.strip(),
            "description": description.strip(),
            "category": category.strip(),
            "duration": duration.strip(),
            "assignedTo": assigned_to,
            "tags": tags,
            "sourceType": source_type,
            "viewCount": 0,
            "createdAt": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow().isoformat(),
        }

        if source_type == "file":
            if "file" not in request.files:
                return jsonify({"error": "Video file is required for file upload mode"}), 400
            file = request.files["file"]
            if file.filename == "" or not allowed_file(file.filename):
                return jsonify({"error": "Invalid or missing video file. Allowed formats: MP4, WebM, MKV, MOV, AVI, etc."}), 400

            ext = file.filename.rsplit(".", 1)[1].lower() if "." in file.filename else "mp4"
            unique_filename = f"video_{uuid.uuid4().hex[:12]}.{ext}"
            videos_dir = get_videos_dir()
            file_path = os.path.join(videos_dir, unique_filename)

            # Fast direct save
            file.save(file_path)
            file_size_bytes = os.path.getsize(file_path)

            video_record["filename"] = unique_filename
            video_record["originalFilename"] = secure_filename(file.filename)
            video_record["fileSize"] = file_size_bytes
            video_record["videoUrl"] = f"/api/answerer/classes/stream/{unique_filename}"
            video_record["provider"] = "local"
        else:
            video_url = request.form.get("videoUrl") or (request.json.get("videoUrl") if request.is_json else "")
            if not video_url:
                return jsonify({"error": "Video URL/Link is required"}), 400
            
            parsed = normalize_video_url(video_url)
            video_record["originalUrl"] = parsed["originalUrl"]
            video_record["embedUrl"] = parsed["embedUrl"]
            video_record["provider"] = parsed["provider"]
            if "videoId" in parsed:
                video_record["videoId"] = parsed["videoId"]
            video_record["videoUrl"] = parsed["embedUrl"]

        result = db.videos.insert_one(video_record)
        video_record["id"] = str(result.inserted_id)
        if "_id" in video_record:
            del video_record["_id"]

        return jsonify({"message": "Video lecture created successfully", "video": video_record}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_videos_bp.put("/<video_id>")
def update_video(video_id: str):
    try:
        from bson import ObjectId
        db = get_db()
        data = request.get_json() or {}

        update_fields = {
            "updatedAt": datetime.utcnow().isoformat(),
        }
        for k in ["title", "description", "category", "duration", "assignedTo", "tags"]:
            if k in data:
                update_fields[k] = data[k]

        if "videoUrl" in data and data.get("sourceType") == "link":
            parsed = normalize_video_url(data["videoUrl"])
            update_fields["originalUrl"] = parsed["originalUrl"]
            update_fields["embedUrl"] = parsed["embedUrl"]
            update_fields["provider"] = parsed["provider"]
            update_fields["videoUrl"] = parsed["embedUrl"]

        db.videos.update_one({"_id": ObjectId(video_id)}, {"$set": update_fields})
        return jsonify({"message": "Video updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_videos_bp.delete("/<video_id>")
def delete_video(video_id: str):
    try:
        from bson import ObjectId
        db = get_db()
        video = db.videos.find_one({"_id": ObjectId(video_id)})
        if not video:
            return jsonify({"error": "Video not found"}), 404

        # If it was a local file, remove from disk
        if video.get("sourceType") == "file" and video.get("filename"):
            file_path = os.path.join(get_videos_dir(), video["filename"])
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except OSError:
                    pass

        db.videos.delete_one({"_id": ObjectId(video_id)})
        return jsonify({"message": "Video removed successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# STUDENT / CANDIDATE VIDEO CLASS ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@answerer_videos_bp.get("")
def list_candidate_classes():
    try:
        db = get_db()
        user_id = request.args.get("userId", "").strip()
        category = request.args.get("category", "").strip()
        search = request.args.get("search", "").strip()

        user_doc = None
        if user_id:
            user_doc = db.users.find_one({
                "$or": [{"userId": user_id}, {"naxUnid": user_id}]
            })

        tenant_id = get_request_tenant_id(user_doc)
        tenant_filter = build_tenant_filter(tenant_id)

        # Videos assigned to 'all' or specifically including this user_id within the student's tenant
        query = {
            **tenant_filter,
            "$or": [
                {"assignedTo": "all"},
                {"assignedTo": user_id},
                {"assignedTo": {"$in": [user_id]}},
            ]
        }

        if category and category.lower() != "all":
            query["category"] = category

        if search:
            query["$and"] = [
                {
                    "$or": [
                        {"title": {"$regex": search, "$options": "i"}},
                        {"description": {"$regex": search, "$options": "i"}},
                        {"category": {"$regex": search, "$options": "i"}},
                        {"tags": {"$regex": search, "$options": "i"}},
                    ]
                }
            ]

        videos_cursor = db.videos.find(query).sort("createdAt", -1)
        classes = []
        for doc in videos_cursor:
            doc["id"] = str(doc.get("_id"))
            del doc["_id"]
            classes.append(doc)

        # Extract available distinct categories within this tenant only
        categories = db.videos.distinct("category", tenant_filter)

        return jsonify({
            "classes": classes,
            "categories": categories or ["General"],
            "totalCount": len(classes),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@answerer_videos_bp.post("/track")
def track_class_view():
    try:
        from bson import ObjectId
        db = get_db()
        body = request.get_json() or {}
        video_id = body.get("videoId", "")
        user_id = body.get("userId", "")

        if video_id:
            db.videos.update_one(
                {"_id": ObjectId(video_id)},
                {"$inc": {"viewCount": 1}}
            )

        if user_id and video_id:
            db.video_views.insert_one({
                "userId": user_id,
                "videoId": video_id,
                "timestamp": datetime.utcnow().isoformat(),
            })

        return jsonify({"status": "ok"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@answerer_videos_bp.get("/stream/<filename>")
def stream_video(filename: str):
    """Secure range-supporting video stream endpoint with conditional range delivery."""
    try:
        import mimetypes
        from flask import send_file

        safe_filename = secure_filename(filename)
        video_path = os.path.join(get_videos_dir(), safe_filename)

        if not os.path.exists(video_path):
            return jsonify({"error": "Video file not found"}), 404

        # Try stdlib mimetypes first, fall back to our extended map
        ext = safe_filename.rsplit(".", 1)[-1].lower() if "." in safe_filename else ""
        mime, _ = mimetypes.guess_type(video_path)
        if not mime or not mime.startswith("video/"):
            mime = EXTRA_MIME_TYPES.get(ext, "video/mp4")

        # Flask conditional=True natively supports HTTP 206 Byte-Range streaming & video scrubbing
        response = send_file(
            video_path,
            mimetype=mime,
            as_attachment=False,
            conditional=True,
        )
        response.headers["Accept-Ranges"] = "bytes"
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Cache-Control"] = "public, max-age=3600"
        return response

    except Exception as e:
        return jsonify({"error": str(e)}), 500
