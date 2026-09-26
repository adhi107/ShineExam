import os
import sys
import time
import logging
from datetime import datetime

# Ensure backend root is in sys.path so modules (config, routes, etc.) resolve cleanly
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Ensure unbuffered stdout on Windows/Linux so logs appear in the terminal immediately
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass

from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS

from config.settings import settings
from routes.auth_routes import auth_bp
from routes.admin_users import admin_users_bp
from routes.admin_exams import admin_exams_bp
from routes.admin_dashboard import admin_dashboard_bp
from routes.admin_results import admin_results_bp
from routes.admin_courses import admin_courses_bp
from routes.answerer import answerer_bp
from routes.exam_categories import admin_exam_categories_bp, answerer_exam_categories_bp
from routes.learning_resources import admin_documents_bp, admin_announcements_bp, answerer_resources_bp
from routes.admin_videos import admin_videos_bp, answerer_videos_bp
from routes.security_routes import security_bp
from routes.admin_violations import admin_violations_bp
from routes.admin_audit import admin_audit_bp
from routes.super_admin import super_admin_bp
from routes.admin_security_controls import admin_security_controls_bp, public_security_bp
from routes.test_series import test_series_bp
from routes.student_test_series import student_series_bp
from routes.exam_configurations import exam_config_bp
from routes.syllabus_management import syllabus_bp
from routes.question_bank import question_bank_bp
from routes.descriptive_evaluation import descriptive_eval_bp
from routes.manual_assignments import manual_assign_bp
from routes.pyq_current_affairs import pyq_ca_bp
from routes.student_enrollment_engine import enrollment_bp
from routes.current_affairs_engine import ca_engine_bp
from utils.security import add_security_headers


def create_app() -> Flask:
    # Setup standard logging
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stdout
    )
    logging.getLogger("werkzeug").setLevel(logging.INFO)

    app = Flask(__name__)

    # Allow the configured Shine Exam frontend origins.
    origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
    CORS(app, resources={r"/*": {"origins": origins}}, supports_credentials=True)

    # Allow large video uploads (up to 2 GB)
    app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024 * 1024

    @app.get("/")
    def health():
        return jsonify({"status": "ok", "service": "exam-portal-backend"})

    @app.route("/uploads/<path:filename>", methods=["GET", "HEAD"])
    @app.route("/api/uploads/<path:filename>", methods=["GET", "HEAD"])
    def serve_uploads(filename):
        # Route videos directly to high-speed partial-content streaming engine
        clean_name = filename.replace("\\", "/")
        if clean_name.startswith("videos/"):
            video_file = clean_name.split("videos/", 1)[-1]
            from routes.admin_videos import stream_video
            return stream_video(video_file)

        uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
        file_path = os.path.join(uploads_dir, filename)

        if not os.path.exists(file_path):
            return jsonify({"error": "File not found"}), 404

        import mimetypes
        from flask import send_file
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        mime, _ = mimetypes.guess_type(file_path)
        if not mime:
            mime_map = {
                "pdf": "application/pdf",
                "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "doc": "application/msword",
                "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "xls": "application/vnd.ms-excel",
                "csv": "text/csv",
                "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "ppt": "application/vnd.ms-powerpoint",
                "txt": "text/plain",
                "epub": "application/epub+zip",
                "png": "image/png",
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "webp": "image/webp",
            }
            mime = mime_map.get(ext, "application/octet-stream")

        as_attachment = request.args.get("download") in ("1", "true")
        download_name = request.args.get("filename") or os.path.basename(filename)

        resp = send_file(
            file_path,
            mimetype=mime,
            as_attachment=as_attachment,
            download_name=download_name,
            conditional=True
        )
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "GET, HEAD, OPTIONS"
        resp.headers["Access-Control-Expose-Headers"] = "Content-Disposition, Content-Type, Content-Length, Accept-Ranges"
        resp.headers["Accept-Ranges"] = "bytes"
        resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        resp.headers.pop("X-Frame-Options", None)
        return resp

    # Register active Shine Exam API route groups.
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(super_admin_bp, url_prefix="/api/super-admin")
    app.register_blueprint(admin_users_bp, url_prefix="/api/admin/users")
    app.register_blueprint(admin_exams_bp, url_prefix="/api/admin/exams")
    app.register_blueprint(admin_dashboard_bp, url_prefix="/api/admin")
    app.register_blueprint(admin_results_bp, url_prefix="/api/admin/results")
    app.register_blueprint(admin_courses_bp, url_prefix="/api/admin/courses")
    app.register_blueprint(answerer_bp, url_prefix="/api/answerer")
    app.register_blueprint(admin_exam_categories_bp, url_prefix="/api/admin/exam-categories")
    app.register_blueprint(answerer_exam_categories_bp, url_prefix="/api/answerer/exam-categories")
    app.register_blueprint(admin_documents_bp, url_prefix="/api/admin/documents")
    app.register_blueprint(admin_announcements_bp, url_prefix="/api/admin/announcements")
    app.register_blueprint(admin_videos_bp, url_prefix="/api/admin/videos")
    app.register_blueprint(answerer_videos_bp, url_prefix="/api/answerer/classes")
    app.register_blueprint(answerer_resources_bp, url_prefix="/api/answerer")
    app.register_blueprint(security_bp,    url_prefix="/api/security")
    app.register_blueprint(admin_violations_bp, url_prefix="/api/admin/violations")
    app.register_blueprint(admin_audit_bp,      url_prefix="/api/admin/audit-logs")
    app.register_blueprint(admin_security_controls_bp, url_prefix="/api/admin")
    app.register_blueprint(public_security_bp, url_prefix="/api/public/security")
    app.register_blueprint(test_series_bp, url_prefix="/api/admin/test-series")
    app.register_blueprint(student_series_bp, url_prefix="/api/answerer/test-series")
    app.register_blueprint(exam_config_bp, url_prefix="/api/admin/exam-config")
    app.register_blueprint(syllabus_bp, url_prefix="/api/admin/syllabus")
    app.register_blueprint(question_bank_bp, url_prefix="/api/admin/question-bank")
    app.register_blueprint(descriptive_eval_bp, url_prefix="/api/admin/evaluations")
    app.register_blueprint(manual_assign_bp, url_prefix="/api/admin/assignments")
    app.register_blueprint(pyq_ca_bp, url_prefix="/api/answerer/learning-hub")
    app.register_blueprint(enrollment_bp, url_prefix="/api/admin/enrollments")
    app.register_blueprint(enrollment_bp, url_prefix="/api/answerer/enrollments", name="answerer_enrollments")
    app.register_blueprint(ca_engine_bp, url_prefix="/api/admin/current-affairs")
    app.register_blueprint(ca_engine_bp, url_prefix="/api/answerer/current-affairs", name="answerer_current_affairs")



    @app.before_request
    def record_request_start():
        request._start_time = time.time()

    # Global firewall: If a candidate account is inactive/suspended, block all requests
    @app.before_request
    def global_candidate_security_gate():
        # ALWAYS allow CORS preflight OPTIONS requests
        if request.method == "OPTIONS":
            return jsonify({"status": "ok"}), 200

        path = request.path

        # Always allow these paths without account checks
        if (
            path.startswith("/api/admin")
            or path.startswith("/api/super-admin")
            or path.startswith("/api/public")
            or path.startswith("/api/answerer/classes/stream")
            or path.startswith("/uploads")
            or path == "/"
            or path == "/api/auth/login"
            or path == "/api/security/violation/block"
        ):
            return None

        # CRITICAL: Never block exam submission
        if "/submit" in path or path.endswith("/submit"):
            return None

        user_id = (
            request.headers.get("X-User-Id")
            or request.args.get("userId")
            or ""
        )
        if not user_id and request.is_json:
            body = request.get_json(silent=True) or {}
            user_id = body.get("userId", "")

        if not user_id:
            return None

        from utils.cache import get_cached_user_status, set_cached_user_status
        user_key = str(user_id).strip()
        cached_info = get_cached_user_status(user_key)

        if cached_info is not None:
            if not cached_info.get("isActive", True):
                return jsonify({
                    "error": "Your account is suspended due to security policy violations. Contact the administrator to unblock your account.",
                    "blocked": True,
                    "statusReason": cached_info.get("statusReason", "")
                }), 403
            return None

        from config.db import get_db
        db = get_db()
        user = db.users.find_one(
            {"$or": [{"userId": user_key}, {"naxUnid": user_key}], "role": "answerer"},
            {"isActive": 1, "statusReason": 1}
        )
        if user:
            is_active = bool(user.get("isActive", True))
            status_reason = str(user.get("statusReason", ""))
            set_cached_user_status(user_key, {"isActive": is_active, "statusReason": status_reason}, ttl_seconds=15)
            if not is_active:
                return jsonify({
                    "error": "Your account is suspended due to security policy violations. Contact the administrator to unblock your account.",
                    "blocked": True,
                    "statusReason": status_reason
                }), 403
        else:
            set_cached_user_status(user_key, {"isActive": True, "statusReason": ""}, ttl_seconds=15)

    # Support large video and asset uploads (up to 2 GB)
    app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024 * 1024

    # Add security headers and log every API response to the terminal
    @app.after_request
    def process_response_and_log(response):
        # 1. Apply security headers
        response = add_security_headers(response)
        if request.path.startswith("/uploads") or request.path.startswith("/api/uploads"):
            response.headers.pop("X-Frame-Options", None)
            response.headers["Access-Control-Allow-Origin"] = "*"

        # 2. Calculate execution time
        start_time = getattr(request, "_start_time", None)
        if start_time:
            latency_ms = int((time.time() - start_time) * 1000)
            latency_str = f"{latency_ms}ms"
        else:
            latency_str = "-ms"

        # 3. Format method, path, IP, status code
        method = request.method
        path = request.path
        if request.query_string:
            qs = request.query_string.decode("utf-8", errors="replace")
            if qs:
                path = f"{path}?{qs}"
        status_code = response.status_code
        ip = request.headers.get("X-Forwarded-For", request.remote_addr or "127.0.0.1").split(",")[0].strip()
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Color indicator based on HTTP status code
        # 2xx: Green/Normal, 3xx: Cyan, 4xx: Yellow, 5xx: Red
        status_tag = f"[{status_code}]"
        print(f"[{ts}] [API] {method:<6} {path:<45} -> {status_tag} ({latency_str}) [IP: {ip}]", flush=True)

        return response


    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        # Return safe JSON errors without exposing backend stack traces.
        import traceback
        err_tb = traceback.format_exc()
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{ts}] [ERROR 500] {request.method} {request.path}\n{err_tb}", flush=True)
        return jsonify({"error": "Internal server error"}), 500

    @app.errorhandler(413)
    def request_entity_too_large(_):
        return jsonify({"error": "File too large. Maximum upload size is 2 GB."}), 413

    return app

app = create_app()

if __name__ == "__main__":
    app = create_app()
    # On Windows, use_reloader=False prevents WinError 10038 socket collision
    app.run(host="0.0.0.0", port=settings.PORT, debug=True, threaded=True, use_reloader=False)
