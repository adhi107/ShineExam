"""
backend/routes/admin_security_controls.py
─────────────────────────────────────────
Endpoints for Admin Security Controls & Settings:
- Configure inactivity auto-logout timeout (e.g. 5, 10, 15, 30, 60 minutes)
- Configure strict screenshot lock policy
- Configure screenshot attempt threshold before permanent block
- Configure watermark visibility / dynamic settings
- Public endpoint for clients to retrieve active settings
"""

from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from config.db import get_db
from utils.security import audit_log

admin_security_controls_bp = Blueprint("admin_security_controls", __name__)
public_security_bp = Blueprint("public_security", __name__)

DEFAULT_SECURITY_SETTINGS = {
    "autoLogoutEnabled": True,
    "autoLogoutMinutes": 15,
    "strictScreenshotLock": True,
    "screenshotAllowedAttempts": 1,       # 1 = instant permanent block on first attempt
    "screenshotProtectedModules": ["exam", "results", "documents", "classes"],  # modules where protection is active
    "watermarkEnabled": True,
    "watermarkIntervalSec": 8,
    "allowCandidateDocumentView": True,
    "allowCandidateDocumentDownload": False,
    "watermarkDocuments": True,
    # Solution Report & Test Results Watermark Settings
    "solutionReportWatermarkEnabled": True,
    "solutionReportWatermarkText": "SHINE EXAM • CONFIDENTIAL SOLUTION REPORT",
    "solutionReportWatermarkColor": "#dc2626",   # Bold red default
    "solutionReportWatermarkOpacity": 0.25,      # 0.10 to 0.70
    "solutionReportWatermarkIncludeCandidate": True,
    "solutionReportWatermarkIncludeTimestamp": True,
    "retentionPolicy": {
        "autoPurgeEnabled": False,
        "auditLogsRetentionDays": 30,       # -1 = Never, or 7, 15, 30, 60, 90, 180, 365, 730
        "violationsRetentionDays": 60,
        "examResultsRetentionDays": 180,
        "sessionsRetentionHours": 48,       # 24, 48, 72, 168 (7d), 720 (30d)
        "tempDocumentsRetentionDays": 30,
        "lastPurgeAt": None,
        "lastPurgeStats": None,
    },
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

    retention = settings.get("retentionPolicy") or DEFAULT_SECURITY_SETTINGS["retentionPolicy"]

    return jsonify({
        "settings": {
            "autoLogoutEnabled": bool(settings.get("autoLogoutEnabled", True)),
            "autoLogoutMinutes": int(settings.get("autoLogoutMinutes", 15)),
            "strictScreenshotLock": bool(settings.get("strictScreenshotLock", True)),
            "screenshotAllowedAttempts": int(settings.get("screenshotAllowedAttempts", 1)),
            "screenshotProtectedModules": list(settings.get("screenshotProtectedModules", ["exam", "results", "documents", "classes"])),
            "watermarkEnabled": bool(settings.get("watermarkEnabled", True)),
            "watermarkIntervalSec": int(settings.get("watermarkIntervalSec", 8)),
            "allowCandidateDocumentView": bool(settings.get("allowCandidateDocumentView", True)),
            "allowCandidateDocumentDownload": bool(settings.get("allowCandidateDocumentDownload", False)),
            "watermarkDocuments": bool(settings.get("watermarkDocuments", True)),
            "solutionReportWatermarkEnabled": bool(settings.get("solutionReportWatermarkEnabled", True)),
            "solutionReportWatermarkText": str(settings.get("solutionReportWatermarkText", "SHINE EXAM • CONFIDENTIAL SOLUTION REPORT")),
            "solutionReportWatermarkColor": str(settings.get("solutionReportWatermarkColor", "#dc2626")),
            "solutionReportWatermarkOpacity": float(settings.get("solutionReportWatermarkOpacity", 0.25)),
            "solutionReportWatermarkIncludeCandidate": bool(settings.get("solutionReportWatermarkIncludeCandidate", True)),
            "solutionReportWatermarkIncludeTimestamp": bool(settings.get("solutionReportWatermarkIncludeTimestamp", True)),
            "retentionPolicy": {
                "autoPurgeEnabled": bool(retention.get("autoPurgeEnabled", False)),
                "auditLogsRetentionDays": int(retention.get("auditLogsRetentionDays", 30)),
                "violationsRetentionDays": int(retention.get("violationsRetentionDays", 60)),
                "examResultsRetentionDays": int(retention.get("examResultsRetentionDays", 180)),
                "sessionsRetentionHours": int(retention.get("sessionsRetentionHours", 48)),
                "tempDocumentsRetentionDays": int(retention.get("tempDocumentsRetentionDays", 30)),
                "lastPurgeAt": retention.get("lastPurgeAt"),
                "lastPurgeStats": retention.get("lastPurgeStats"),
            },
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

    VALID_MODULES = {"exam", "results", "documents", "classes", "dashboard"}
    raw_modules = payload.get("screenshotProtectedModules", ["exam", "results", "documents", "classes"])
    if not isinstance(raw_modules, list):
        raw_modules = ["exam", "results", "documents", "classes"]
    validated_modules = [m for m in raw_modules if m in VALID_MODULES]
    if not validated_modules:
        validated_modules = ["exam", "results", "documents", "classes"]
    
    raw_retention = payload.get("retentionPolicy") or {}
    current_doc = db.system_settings.find_one({"type": "security_config"}) or {}
    curr_ret = current_doc.get("retentionPolicy") or {}

    retention_updates = {
        "autoPurgeEnabled": bool(raw_retention.get("autoPurgeEnabled", False)),
        "auditLogsRetentionDays": int(raw_retention.get("auditLogsRetentionDays", 30)),
        "violationsRetentionDays": int(raw_retention.get("violationsRetentionDays", 60)),
        "examResultsRetentionDays": int(raw_retention.get("examResultsRetentionDays", 180)),
        "sessionsRetentionHours": int(raw_retention.get("sessionsRetentionHours", 48)),
        "tempDocumentsRetentionDays": int(raw_retention.get("tempDocumentsRetentionDays", 30)),
        "lastPurgeAt": curr_ret.get("lastPurgeAt"),
        "lastPurgeStats": curr_ret.get("lastPurgeStats"),
    }

    raw_opacity = payload.get("solutionReportWatermarkOpacity", 0.25)
    try:
        clean_opacity = max(0.05, min(0.90, float(raw_opacity)))
    except (TypeError, ValueError):
        clean_opacity = 0.25

    updates = {
        "autoLogoutEnabled": bool(payload.get("autoLogoutEnabled", True)),
        "autoLogoutMinutes": max(1, min(240, int(payload.get("autoLogoutMinutes", 15)))),
        "strictScreenshotLock": bool(payload.get("strictScreenshotLock", True)),
        "screenshotAllowedAttempts": max(1, min(20, int(payload.get("screenshotAllowedAttempts", 1)))),
        "screenshotProtectedModules": validated_modules,
        "watermarkEnabled": bool(payload.get("watermarkEnabled", True)),
        "watermarkIntervalSec": max(3, min(60, int(payload.get("watermarkIntervalSec", 8)))),
        "allowCandidateDocumentView": bool(payload.get("allowCandidateDocumentView", True)),
        "allowCandidateDocumentDownload": bool(payload.get("allowCandidateDocumentDownload", False)),
        "watermarkDocuments": bool(payload.get("watermarkDocuments", True)),
        "solutionReportWatermarkEnabled": bool(payload.get("solutionReportWatermarkEnabled", True)),
        "solutionReportWatermarkText": str(payload.get("solutionReportWatermarkText", "SHINE EXAM • CONFIDENTIAL SOLUTION REPORT")).strip(),
        "solutionReportWatermarkColor": str(payload.get("solutionReportWatermarkColor", "#dc2626")).strip(),
        "solutionReportWatermarkOpacity": clean_opacity,
        "solutionReportWatermarkIncludeCandidate": bool(payload.get("solutionReportWatermarkIncludeCandidate", True)),
        "solutionReportWatermarkIncludeTimestamp": bool(payload.get("solutionReportWatermarkIncludeTimestamp", True)),
        "retentionPolicy": retention_updates,
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
        "message": "Security settings and retention policies deployed successfully",
        "settings": updates
    })


@admin_security_controls_bp.post("/wipeout/execute")
def execute_data_wipeout():
    """
    Execute module-wise data wipeout based on configured retention timeline.
    Admin can choose specific modules to wipe or purge all expired records.
    """
    payload = request.get_json(silent=True) or {}
    modules_to_wipe = payload.get("modules", ["audit_logs", "violations", "sessions", "results", "temp_docs"])
    user_id = request.headers.get("X-User-Id", "Admin")

    db = get_db()
    settings = db.system_settings.find_one({"type": "security_config"}) or DEFAULT_SECURITY_SETTINGS
    retention = settings.get("retentionPolicy") or DEFAULT_SECURITY_SETTINGS["retentionPolicy"]

    now = datetime.utcnow()
    wipe_stats = {}
    total_purged = 0

    # 1. Audit Logs Wipeout
    if "audit_logs" in modules_to_wipe:
        days = int(retention.get("auditLogsRetentionDays", 30))
        if days > 0:
            cutoff = now - timedelta(days=days)
            res = db.audit_logs.delete_many({
                "$or": [
                    {"timestamp": {"$lt": cutoff}},
                    {"timestamp": {"$lt": cutoff.isoformat()}}
                ]
            })
            wipe_stats["audit_logs"] = res.deleted_count
            total_purged += res.deleted_count
        else:
            wipe_stats["audit_logs"] = 0

    # 2. Security Violations Wipeout
    if "violations" in modules_to_wipe:
        days = int(retention.get("violationsRetentionDays", 60))
        if days > 0:
            cutoff = now - timedelta(days=days)
            res = db.security_violations.delete_many({
                "$or": [
                    {"recordedAt": {"$lt": cutoff}},
                    {"recordedAt": {"$lt": cutoff.isoformat()}}
                ]
            })
            wipe_stats["violations"] = res.deleted_count
            total_purged += res.deleted_count
        else:
            wipe_stats["violations"] = 0

    # 3. Candidate Security Sessions Wipeout
    if "sessions" in modules_to_wipe:
        hours = int(retention.get("sessionsRetentionHours", 48))
        if hours > 0:
            cutoff = now - timedelta(hours=hours)
            res = db.security_sessions.delete_many({
                "$or": [
                    {"createdAt": {"$lt": cutoff}},
                    {"createdAt": {"$lt": cutoff.isoformat()}},
                    {"active": False}
                ]
            })
            wipe_stats["sessions"] = res.deleted_count
            total_purged += res.deleted_count
        else:
            wipe_stats["sessions"] = 0

    # 4. Exam Results / Attempts Wipeout (Optional, only if retention > 0)
    if "results" in modules_to_wipe:
        days = int(retention.get("examResultsRetentionDays", 180))
        if days > 0:
            cutoff = now - timedelta(days=days)
            res1 = db.results.delete_many({
                "$or": [
                    {"submittedAt": {"$lt": cutoff}},
                    {"submittedAt": {"$lt": cutoff.isoformat()}},
                    {"createdAt": {"$lt": cutoff}},
                ]
            })
            res2 = db.attempts.delete_many({
                "$or": [
                    {"submittedAt": {"$lt": cutoff}},
                    {"submittedAt": {"$lt": cutoff.isoformat()}},
                    {"createdAt": {"$lt": cutoff}},
                ]
            })
            deleted_results = res1.deleted_count + res2.deleted_count
            wipe_stats["results"] = deleted_results
            total_purged += deleted_results
        else:
            wipe_stats["results"] = 0

    # 5. Temporary Documents & Drafts
    if "temp_docs" in modules_to_wipe:
        days = int(retention.get("tempDocumentsRetentionDays", 30))
        if days > 0:
            cutoff = now - timedelta(days=days)
            res = db.documents.delete_many({
                "isTemporary": True,
                "$or": [
                    {"createdAt": {"$lt": cutoff}},
                    {"createdAt": {"$lt": cutoff.isoformat()}}
                ]
            })
            wipe_stats["temp_docs"] = res.deleted_count
            total_purged += res.deleted_count
        else:
            wipe_stats["temp_docs"] = 0

    # Record purge metadata
    purge_record = {
        "lastPurgeAt": now.isoformat() + "Z",
        "lastPurgeStats": wipe_stats,
        "totalPurged": total_purged,
        "purgedBy": user_id
    }

    db.system_settings.update_one(
        {"type": "security_config"},
        {"$set": {
            "retentionPolicy.lastPurgeAt": purge_record["lastPurgeAt"],
            "retentionPolicy.lastPurgeStats": wipe_stats
        }}
    )

    audit_log(
        action="ADMIN_EXECUTED_DATA_WIPEOUT",
        user_id=user_id,
        details={"stats": wipe_stats, "totalPurged": total_purged},
        severity="critical" if total_purged > 0 else "info"
    )

    return jsonify({
        "message": f"Data wipeout executed successfully. {total_purged} expired records purged.",
        "stats": wipe_stats,
        "totalPurged": total_purged,
        "timestamp": purge_record["lastPurgeAt"]
    })


@public_security_bp.get("/config")
def get_public_security_config():
    """
    Public lightweight endpoint for candidates & frontend to read active security & watermark settings.
    """
    db = get_db()
    settings = db.system_settings.find_one({"type": "security_config"}) or DEFAULT_SECURITY_SETTINGS
    return jsonify({
        "autoLogoutEnabled": bool(settings.get("autoLogoutEnabled", True)),
        "autoLogoutMinutes": int(settings.get("autoLogoutMinutes", 15)),
        "strictScreenshotLock": bool(settings.get("strictScreenshotLock", True)),
        "screenshotAllowedAttempts": int(settings.get("screenshotAllowedAttempts", 1)),
        "screenshotProtectedModules": list(settings.get("screenshotProtectedModules", ["exam", "results", "documents", "classes"])),
        "watermarkEnabled": bool(settings.get("watermarkEnabled", True)),
        "watermarkIntervalSec": int(settings.get("watermarkIntervalSec", 8)),
        "allowCandidateDocumentView": bool(settings.get("allowCandidateDocumentView", True)),
        "allowCandidateDocumentDownload": bool(settings.get("allowCandidateDocumentDownload", False)),
        "watermarkDocuments": bool(settings.get("watermarkDocuments", True)),
        "solutionReportWatermarkEnabled": bool(settings.get("solutionReportWatermarkEnabled", True)),
        "solutionReportWatermarkText": str(settings.get("solutionReportWatermarkText", "SHINE EXAM • CONFIDENTIAL SOLUTION REPORT")),
        "solutionReportWatermarkColor": str(settings.get("solutionReportWatermarkColor", "#dc2626")),
        "solutionReportWatermarkOpacity": float(settings.get("solutionReportWatermarkOpacity", 0.25)),
        "solutionReportWatermarkIncludeCandidate": bool(settings.get("solutionReportWatermarkIncludeCandidate", True)),
        "solutionReportWatermarkIncludeTimestamp": bool(settings.get("solutionReportWatermarkIncludeTimestamp", True)),
    })

