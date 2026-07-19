from flask import Flask, jsonify
from flask_cors import CORS

from config.settings import settings
from routes.auth_routes import auth_bp
from routes.admin_users import admin_users_bp
from routes.admin_exams import admin_exams_bp
from routes.admin_dashboard import admin_dashboard_bp
from routes.admin_results import admin_results_bp
from routes.admin_courses import admin_courses_bp
from routes.answerer import answerer_bp
from routes.master_data import master_data_bp, public_bp
from routes.offer_letter import offer_letter_bp
from routes.exam_categories import admin_exam_categories_bp, answerer_exam_categories_bp
from routes.learning_resources import admin_documents_bp, admin_announcements_bp, answerer_resources_bp


def create_app() -> Flask:
    app = Flask(__name__)

    # CORS (comma-separated)
    origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
    CORS(app, resources={r"/*": {"origins": origins}}, supports_credentials=True)

    @app.get("/")
    def health():
        return jsonify({"status": "ok", "service": "exam-portal-backend"})

    # Blueprints
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(admin_users_bp, url_prefix="/admin/users")
    app.register_blueprint(admin_exams_bp, url_prefix="/admin/exams")
    app.register_blueprint(admin_dashboard_bp, url_prefix="/admin")
    app.register_blueprint(admin_results_bp, url_prefix="/admin/results")
    app.register_blueprint(admin_courses_bp, url_prefix="/admin/courses")
    app.register_blueprint(answerer_bp, url_prefix="/answerer")
    app.register_blueprint(admin_exam_categories_bp, url_prefix="/admin/exam-categories")
    app.register_blueprint(answerer_exam_categories_bp, url_prefix="/answerer/exam-categories")
    app.register_blueprint(admin_documents_bp, url_prefix="/admin/documents")
    app.register_blueprint(admin_announcements_bp, url_prefix="/admin/announcements")
    app.register_blueprint(answerer_resources_bp, url_prefix="/answerer")
    app.register_blueprint(master_data_bp, url_prefix="/admin/master-data")
    app.register_blueprint(public_bp,      url_prefix="/public")
    app.register_blueprint(offer_letter_bp, url_prefix="/admin/offer-letter")

    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        # Avoid leaking stack traces in JSON
        return jsonify({"error": "Internal server error", "details": str(e)}), 500

    return app

app = create_app()

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=settings.PORT, debug=True)
