"""
backend/routes/admin_security_controls.py
─────────────────────────────────────────
Endpoints for Admin Security Controls & Settings:
- Configure inactivity auto-logout timeout (e.g. 5, 10, 15, 30, 60 minutes)
- Configure strict screenshot lock policy
- Configure watermark visibility / dynamic settings
- Public endpoint for clients to retrieve active settings
"""

from datetime import datetime
from flask import Blueprint, jsonify, request
from config.db import get_db
from utils.security import audit_log

admin_security_controls_bp = Blueprint("admin_security_controls", __name__)
public_security_bp = Blueprint("public_security", __name__)

DEFAULT_SECURITY_SETTINGS = {
    "autoLogoutEnabled": True,
    "autoLogoutMinutes": 15,          # 15 minutes idle timeout default
    "strictScreenshotLock": True,     # Instant permanent block on screenshot attempt
    "watermarkEnabled": True,         # Dynamic watermark active
    "watermarkIntervalSec": 8,        # Redraw interval
    "allowCandidateDocumentView": True,       # Candidate permission to view study documents
    "allowCandidateDocumentDownload": False,   # Candidate permission to download raw PDF files
    "watermarkDocuments": True,               # Burn watermarks onto document viewer
    "updatedAt": datetime.utcnow().isoformat(),
    "updatedBy": "system"
}


@admin_security_controls_bp.get("/security-settings")
def get_security_settings():
    """
    Get active security settings from DB.
    """
    db = get_db()
    settings = db.system_settings.find_one({"type": "security_config"})
    if not settings:
        settings = dict(DEFAULT_SECURITY_SETTINGS)
        settings["type"] = "security_config"
        db.system_settings.insert_one(settings)

    return jsonify({
        "settings": {
            "autoLogoutEnabled": bool(settings.get("autoLogoutEnabled", True)),
            "autoLogoutMinutes": int(settings.get("autoLogoutMinutes", 15)),
            "strictScreenshotLock": bool(settings.get("strictScreenshotLock", True)),
            "watermarkEnabled": bool(settings.get("watermarkEnabled", True)),
            "watermarkIntervalSec": int(settings.get("watermarkIntervalSec", 8)),
            "allowCandidateDocumentView": bool(settings.get("allowCandidateDocumentView", True)),
            "allowCandidateDocumentDownload": bool(settings.get("allowCandidateDocumentDownload", False)),
            "watermarkDocuments": bool(settings.get("watermarkDocuments", True)),
            "updatedAt": settings.get("updatedAt"),
            "updatedBy": settings.get("updatedBy", "Admin"),
        }
    })


@admin_security_controls_bp.put("/security-settings")
def update_security_settings():
    """
    Update security configuration settings.
    """
    payload = request.get_json(silent=True) or {}
    db = get_db()

    updates = {
        "autoLogoutEnabled": bool(payload.get("autoLogoutEnabled", True)),
        "autoLogoutMinutes": max(1, min(240, int(payload.get("autoLogoutMinutes", 15)))),
        "strictScreenshotLock": bool(payload.get("strictScreenshotLock", True)),
        "watermarkEnabled": bool(payload.get("watermarkEnabled", True)),
        "watermarkIntervalSec": max(3, min(60, int(payload.get("watermarkIntervalSec", 8)))),
        "allowCandidateDocumentView": bool(payload.get("allowCandidateDocumentView", True)),
        "allowCandidateDocumentDownload": bool(payload.get("allowCandidateDocumentDownload", False)),
        "watermarkDocuments": bool(payload.get("watermarkDocuments", True)),
        "updatedAt": datetime.utcnow().isoformat(),
        "updatedBy": request.headers.get("X-User-Id", "Admin"),
    }

    db.system_settings.update_one(
        {"type": "security_config"},
        {"$set": updates},
        upsert=True
    )

    audit_log(
        action="ADMIN_UPDATED_SECURITY_SETTINGS",
        user_id=request.headers.get("X-User-Id", "Admin"),
        details=updates,
        severity="info"
    )

    return jsonify({
        "message": "Security settings updated successfully",
        "settings": updates
    })


@public_security_bp.get("/config")
def get_public_security_config():
    """
    Public lightweight endpoint for candidates & frontend to read active auto-logout settings.
    """
    db = get_db()
    settings = db.system_settings.find_one({"type": "security_config"}) or DEFAULT_SECURITY_SETTINGS
    return jsonify({
        "autoLogoutEnabled": bool(settings.get("autoLogoutEnabled", True)),
        "autoLogoutMinutes": int(settings.get("autoLogoutMinutes", 15)),
        "watermarkEnabled": bool(settings.get("watermarkEnabled", True)),
        "watermarkIntervalSec": int(settings.get("watermarkIntervalSec", 8)),
        "allowCandidateDocumentView": bool(settings.get("allowCandidateDocumentView", True)),
        "allowCandidateDocumentDownload": bool(settings.get("allowCandidateDocumentDownload", False)),
        "watermarkDocuments": bool(settings.get("watermarkDocuments", True)),
    })

