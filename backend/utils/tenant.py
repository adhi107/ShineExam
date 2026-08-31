"""
backend/utils/tenant.py
───────────────────────
Multi-tenancy helpers for tenant isolation, organization resolution,
and automatic provisioning of the default organization and Super Admin.
"""

from datetime import datetime
from flask import request
from config.db import get_db

DEFAULT_TENANT_ID = "default"
DEFAULT_ORG_NAME = "Shine Main Organization"


def get_request_tenant_id(user_doc=None) -> str:
    """
    Extract active tenant ID from request context or user document.
    Priority:
      1. User's assigned tenantId (if user is regular admin or student)
      2. Super Admin requested tenantId from header 'X-Tenant-Id' or query param 'tenantId'
      3. Default fallback
    """
    if user_doc:
        user_role = user_doc.get("role", "")
        # If user is admin or answerer, their tenant is strictly fixed
        if user_role in ("admin", "answerer"):
            return user_doc.get("tenantId") or DEFAULT_TENANT_ID
        # If super_admin, they can switch between tenants or view all
        if user_role == "super_admin":
            req_tid = (
                request.headers.get("X-Tenant-Id")
                or request.args.get("tenantId")
                or (request.is_json and (request.get_json(silent=True) or {}).get("tenantId"))
                or "all"
            )
            return req_tid

    # From request directly
    req_tid = (
        request.headers.get("X-Tenant-Id")
        or request.args.get("tenantId")
        or (request.is_json and (request.get_json(silent=True) or {}).get("tenantId"))
        or ""
    )
    return req_tid.strip() if req_tid else DEFAULT_TENANT_ID


def build_tenant_filter(tenant_id: str, field_name: str = "tenantId") -> dict:
    """
    Build a MongoDB query filter dict for tenant isolation.
    - If tenant_id is 'all' or empty for super_admin: matches all
    - If tenant_id is 'default': matches 'default', missing, or null
    - Otherwise: matches specific tenant_id
    """
    if not tenant_id or tenant_id == "all" or tenant_id == "global":
        return {}

    if tenant_id == DEFAULT_TENANT_ID:
        return {
            "$or": [
                {field_name: DEFAULT_TENANT_ID},
                {field_name: {"$exists": False}},
                {field_name: None},
                {field_name: ""},
            ]
        }

    return {field_name: tenant_id}


DEFAULT_TENANT_FEATURES = {
    # Core Examination & Authoring
    "examCategories": True,
    "aiQuestionGenerator": True,
    "bilingualQuestions": True,
    "codingSandbox": False,
    "automatedStudentFeedback": True,
    # Classroom & LMS
    "videoClasses": True,
    "learningDocuments": True,
    "certificateGeneration": True,
    "leaderboardGamification": False,
    # Security, Anti-Cheat & DRM
    "screenProtection": True,
    "auditLogs": True,
    "customWatermark": True,
    "aiProctoring": False,
    "strictDeviceLock": True,
    # Extensibility & Future Resiliency
    "offlineExamSync": False,
    "biometricVerification": False,
    "webhookIntegrations": False,
}


def get_tenant_branding(tenant_id: str) -> dict:
    """Fetch branding and feature flags for a given tenant ID with strict tenant isolation."""
    db = get_db()
    if not tenant_id or tenant_id == "all" or tenant_id == "global":
        tenant_id = DEFAULT_TENANT_ID

    org = db.organizations.find_one({
        "$or": [{"tenantId": tenant_id}, {"slug": tenant_id}]
    })

    if not org and tenant_id == DEFAULT_TENANT_ID:
        org = ensure_default_organization(db)

    org_features = (org.get("features") if org and isinstance(org.get("features"), dict) else {}) or {}
    custom_modules = (org.get("customModuleFlags") if org and isinstance(org.get("customModuleFlags"), dict) else {}) or {}
    features = {**DEFAULT_TENANT_FEATURES, **org_features, **custom_modules}

    if org:
        return {
            "tenantId": org.get("tenantId", DEFAULT_TENANT_ID),
            "name": org.get("name", DEFAULT_ORG_NAME),
            "brandTitle": org.get("brandTitle", org.get("name", DEFAULT_ORG_NAME)),
            "logoUrl": org.get("logoUrl", ""),
            "primaryColor": org.get("primaryColor", "#2563eb"),
            "accentColor": org.get("accentColor", "#38bdf8"),
            "status": org.get("status", "active"),
            "features": features,
            "customModuleFlags": custom_modules,
        }

    return {
        "tenantId": DEFAULT_TENANT_ID,
        "name": DEFAULT_ORG_NAME,
        "brandTitle": DEFAULT_ORG_NAME,
        "logoUrl": "",
        "primaryColor": "#2563eb",
        "accentColor": "#38bdf8",
        "status": "active",
        "features": DEFAULT_TENANT_FEATURES,
        "customModuleFlags": {},
    }


def is_tenant_feature_enabled(tenant_id: str, feature_name: str) -> bool:
    """Check if a specific feature or custom dynamic module is enabled for a given tenant."""
    branding = get_tenant_branding(tenant_id)
    features = branding.get("features", {})
    return bool(features.get(feature_name, False))


def ensure_default_organization(db):
    """Ensure at least one default organization exists in the system."""
    if db.organizations.count_documents({}) > 0:
        return db.organizations.find_one({})

    now = datetime.utcnow()
    default_org = {
        "tenantId": DEFAULT_TENANT_ID,
        "slug": "default",
        "name": DEFAULT_ORG_NAME,
        "brandTitle": "Shine Examination Portal",
        "logoUrl": "",
        "primaryColor": "#2563eb",
        "accentColor": "#38bdf8",
        "contactEmail": "admin@shineexam.com",
        "contactPhone": "+1 (555) 019-2834",
        "address": "Headquarters, Main Campus",
        "status": "active",
        "allowedMaxAdmins": 25,
        "allowedMaxCandidates": 5000,
        "createdAt": now,
        "updatedAt": now,
    }
    db.organizations.insert_one(default_org)
    return default_org


def ensure_super_admin(db):
    """Ensure Super Admin account exists with requested credentials."""
    super_admin = db.users.find_one({
        "$or": [
            {"userId": "superadmin"},
            {"userId": "super admin"},
            {"role": "super_admin"},
        ]
    })
    now = datetime.utcnow()
    if not super_admin:
        db.users.insert_one({
            "userId": "superadmin",
            "name": "Super Admin",
            "email": "superadmin@shineexam.com",
            "password": "12345",
            "role": "super_admin",
            "tenantId": "global",
            "isActive": True,
            "createdAt": now,
            "lastLoginAt": None,
        })
    else:
        # Update existing super admin record with name and password
        db.users.update_one(
            {"_id": super_admin["_id"]},
            {"$set": {
                "name": "Super Admin",
                "password": "12345",
                "role": "super_admin",
                "tenantId": "global",
                "isActive": True,
            }}
        )
