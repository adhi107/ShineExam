import os
import sys

# Ensure backend root is in sys.path so modules (config, routes, etc.) resolve cleanly
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, send_from_directory
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
from utils.security import add_security_headers


def create_app() -> Flask:
    app = Flask(__name__)

    # Allow the configured Shine Exam frontend origins.
    origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
    CORS(app, resources={r"/*": {"origins": origins}}, supports_credentials=True)

    # Allow large video uploads (up to 2 GB)
    app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024 * 1024

    @app.get("/")
    def health():
        return jsonify({"status": "ok", "service": "exam-portal-backend"})

    @app.get("/uploads/<path:filename>")
    @app.get("/api/uploads/<path:filename>")
    def serve_uploads(filename):
        uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
        return send_from_directory(uploads_dir, filename)

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



    # Global firewall: If a candidate account is inactive/suspended, block all requests
    @app.before_request
    def global_candidate_security_gate():
        from flask import request
        # ALWAYS allow CORS preflight OPTIONS requests
        if request.method == "OPTIONS":
            return None

        path = request.path

        # Always allow these paths without account checks
        if (
            path.startswith("/api/admin")
            or path.startswith("/api/super-admin")
            or path.startswith("/api/public")
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

    # Support large video and asset uploads (up to 1 GB)
    app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024 * 1024

    # Add security headers to every API response
    app.after_request(add_security_headers)


    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        # Return safe JSON errors without exposing backend stack traces.
        import traceback
        print("[500 ERROR]", traceback.format_exc())
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
