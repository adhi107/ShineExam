from datetime import datetime

from bson import ObjectId
from flask import Blueprint, jsonify, request

from config.db import get_db
from utils.json import to_jsonable
from utils.validators import require_fields
from utils.tenant import get_request_tenant_id, build_tenant_filter, DEFAULT_TENANT_ID


admin_courses_bp = Blueprint("admin_courses", __name__)


DEFAULT_LESSON_MATERIALS = {
    1: {
        "title": "Introduction to SAP ERP and ABAP",
        "content": "Static Day 1 course page",
        "contentType": "lesson",
        "contentJson": None,
        "summary": "Day 1 course page",
        "estimatedMinutes": 0,
    },
    2: {
        "title": "ABAP Data Dictionary",
        "content": "Static Day 2 course page",
        "contentType": "lesson",
        "contentJson": None,
        "summary": "Day 2 course page",
        "estimatedMinutes": 0,
    },
    3: {
        "title": "Control Structures, Internal Tables, and Clean ABAP",
        "content": "Static Day 3 course page",
        "contentType": "lesson",
        "contentJson": None,
        "summary": "Day 3 course page",
        "estimatedMinutes": 0,
    },
}


def _serialize_course(course, assignment_count=0):
    return {
        "id": str(course["_id"]),
        "name": course.get("name", ""),
        "description": course.get("description", ""),
        "status": course.get("status", "active"),
        "createdAt": course.get("createdAt"),
        "updatedAt": course.get("updatedAt"),
        "assignmentCount": assignment_count,
    }


def _serialize_material(material):
    return {
        "id": str(material["_id"]),
        "courseId": str(material["courseId"]),
        "dayNumber": int(material.get("dayNumber", 1)),
        "title": material.get("title", ""),
        "content": material.get("content", ""),
        "contentType": material.get("contentType", "plain_text"),
        "contentJson": material.get("contentJson"),
        "estimatedMinutes": int(material.get("estimatedMinutes", 0) or 0),
        "summary": material.get("summary", ""),
        "createdAt": material.get("createdAt"),
        "updatedAt": material.get("updatedAt"),
    }


def _normalize_material_payload(payload):
    day_number = int((payload.get("dayNumber") or 1))
    title = str(payload.get("title") or "").strip()
    content = str(payload.get("content") or "").strip()
    content_type = str(payload.get("contentType") or "plain_text").strip() or "plain_text"
    content_json = payload.get("contentJson")
    estimated_minutes = int(payload.get("estimatedMinutes") or 0)
    summary = str(payload.get("summary") or "").strip()

    return {
        "dayNumber": day_number,
        "title": title,
        "content": content,
        "contentType": content_type,
        "contentJson": content_json,
        "estimatedMinutes": estimated_minutes,
        "summary": summary,
    }


def _ensure_default_course_materials(db, course_id, now=None):
    timestamp = now or datetime.utcnow()
    existing_days = {
        int(item.get("dayNumber", 0) or 0)
        for item in db.course_materials.find({"courseId": course_id}, {"dayNumber": 1})
    }

    docs = []
    for day_number, defaults in DEFAULT_LESSON_MATERIALS.items():
        if day_number in existing_days:
            continue
        docs.append({
            "courseId": course_id,
            "dayNumber": day_number,
            **defaults,
            "createdAt": timestamp,
            "updatedAt": timestamp,
        })

    if docs:
        db.course_materials.insert_many(docs)


@admin_courses_bp.route("", methods=["GET"])
@admin_courses_bp.route("/", methods=["GET"])
def list_courses():
    db = get_db()
    tenant_id = get_request_tenant_id()
    filter_q = build_tenant_filter(tenant_id)
    courses = list(db.courses.find(filter_q).sort("createdAt", -1))
    out = []
    for course in courses:
        assignment_count = db.course_assignments.count_documents({"courseId": course["_id"]})
        out.append(_serialize_course(course, assignment_count))
    return jsonify({"courses": to_jsonable(out)})


@admin_courses_bp.route("/<course_id>/assignments", methods=["GET"])
@admin_courses_bp.route("/<course_id>/assignments/", methods=["GET"])
def list_course_assignments(course_id: str):
    db = get_db()
    try:
        oid = ObjectId(course_id)
    except Exception:
        return jsonify({"error": "Invalid course id"}), 400

    course = db.courses.find_one({"_id": oid})
    if not course:
        return jsonify({"error": "Course not found"}), 404

    assignments = list(db.course_assignments.find({"courseId": oid, "status": "assigned"}))
    return jsonify({
        "userIds": sorted({str(item.get("userId") or "").strip() for item in assignments if item.get("userId")})
    })


@admin_courses_bp.route("", methods=["POST"])
@admin_courses_bp.route("/", methods=["POST"])
def create_course():
    payload = request.get_json(silent=True) or {}
    ok, msg = require_fields(payload, ["name"])
    if not ok:
        return jsonify({"error": msg}), 400

    name = str(payload["name"]).strip()
    if not name:
        return jsonify({"error": "Course name is required"}), 400

    db = get_db()
    tenant_id = get_request_tenant_id()
    filter_q = build_tenant_filter(tenant_id)

    existing = db.courses.find_one({"nameLower": name.lower(), **filter_q})
    if existing:
        return jsonify({"error": "Course name already exists"}), 409

    now = datetime.utcnow()
    doc = {
        "tenantId": tenant_id,
        "name": name,
        "nameLower": name.lower(),
        "description": str(payload.get("description") or "").strip(),
        "status": "active",
        "createdAt": now,
        "updatedAt": now,
    }
    res = db.courses.insert_one(doc)
    _ensure_default_course_materials(db, res.inserted_id, now)
    return jsonify({"course": to_jsonable(_serialize_course({**doc, "_id": res.inserted_id}))}), 201


@admin_courses_bp.route("/seed/day-1", methods=["POST"])
@admin_courses_bp.route("/seed/day-1/", methods=["POST"])
def seed_day_one_course():
    payload = request.get_json(silent=True) or {}
    db = get_db()

    course_name = str(payload.get("name") or "DevCon Campus Edition - Day 1 Foundations").strip()
    course_description = str(
        payload.get("description")
        or "Day 1 introduction to ERP, SAP architecture, consultant roles, and ABAP foundations."
    ).strip()

    existing_course = db.courses.find_one({"nameLower": course_name.lower()})
    if existing_course:
        course_id = existing_course["_id"]
        course_doc = existing_course
    else:
        now = datetime.utcnow()
        course_doc = {
            "name": course_name,
            "nameLower": course_name.lower(),
            "description": course_description,
            "status": "active",
            "createdAt": now,
            "updatedAt": now,
        }
        course_id = db.courses.insert_one(course_doc).inserted_id
        course_doc["_id"] = course_id

    material_exists = db.course_materials.find_one({"courseId": course_id, "dayNumber": 1})
    if not material_exists:
        now = datetime.utcnow()
        db.course_materials.insert_one({
            "courseId": course_id,
            "dayNumber": 1,
            "title": "SAP, ERP, and ABAP Foundations",
            "summary": "A structured Day 1 learning page based on the DevCon introduction deck.",
            "estimatedMinutes": 75,
            "contentType": "lesson",
            "content": "Structured Day 1 lesson content",
            "contentJson": payload.get("contentJson"),
            "createdAt": now,
            "updatedAt": now,
        })

    assignment_count = db.course_assignments.count_documents({"courseId": course_id})
    return jsonify({
        "course": to_jsonable(_serialize_course(course_doc, assignment_count)),
        "message": "Day 1 starter course is ready",
    }), 201


@admin_courses_bp.route("/<course_id>", methods=["PUT", "PATCH"])
@admin_courses_bp.route("/<course_id>/", methods=["PUT", "PATCH"])
def update_course(course_id: str):
    payload = request.get_json(silent=True) or {}
    ok, msg = require_fields(payload, ["name"])
    if not ok:
        return jsonify({"error": msg}), 400

    try:
        oid = ObjectId(course_id)
    except Exception:
        return jsonify({"error": "Invalid course id"}), 400

    name = str(payload["name"]).strip()
    if not name:
        return jsonify({"error": "Course name is required"}), 400

    db = get_db()
    course = db.courses.find_one({"_id": oid})
    if not course:
        return jsonify({"error": "Course not found"}), 404

    duplicate = db.courses.find_one({"_id": {"$ne": oid}, "nameLower": name.lower()})
    if duplicate:
        return jsonify({"error": "Course name already exists"}), 409

    update = {
        "name": name,
        "nameLower": name.lower(),
        "description": str(payload.get("description") or "").strip(),
        "updatedAt": datetime.utcnow(),
    }
    db.courses.update_one({"_id": oid}, {"$set": update})
    updated = db.courses.find_one({"_id": oid})
    assignment_count = db.course_assignments.count_documents({"courseId": oid})
    return jsonify({"course": to_jsonable(_serialize_course(updated, assignment_count))})


@admin_courses_bp.route("/<course_id>", methods=["DELETE"])
@admin_courses_bp.route("/<course_id>/", methods=["DELETE"])
def delete_course(course_id: str):
    db = get_db()
    try:
        oid = ObjectId(course_id)
    except Exception:
        return jsonify({"error": "Invalid course id"}), 400

    course = db.courses.find_one({"_id": oid})
    if not course:
        return jsonify({"error": "Course not found"}), 404

    db.courses.delete_one({"_id": oid})
    db.course_assignments.delete_many({"courseId": oid})
    db.course_materials.delete_many({"courseId": oid})
    return jsonify({"message": "Course deleted"})


@admin_courses_bp.route("/<course_id>/assign", methods=["POST"])
@admin_courses_bp.route("/<course_id>/assign/", methods=["POST"])
def assign_course(course_id: str):
    payload = request.get_json(silent=True) or {}
    ok, msg = require_fields(payload, ["userIds"])
    if not ok:
        return jsonify({"error": msg}), 400

    user_ids = payload.get("userIds") or []
    if not isinstance(user_ids, list) or len(user_ids) == 0:
        return jsonify({"error": "userIds must be a non-empty list"}), 400

    db = get_db()
    try:
        oid = ObjectId(course_id)
    except Exception:
        return jsonify({"error": "Invalid course id"}), 400

    course = db.courses.find_one({"_id": oid})
    if not course:
        return jsonify({"error": "Course not found"}), 404

    now = datetime.utcnow()
    assigned = 0
    for user_id in user_ids:
        normalized = str(user_id).strip()
        if not normalized:
            continue
        user = db.users.find_one({"userId": normalized, "role": "answerer"})
        if not user:
            continue
        db.course_assignments.update_one(
            {"courseId": oid, "userId": normalized},
            {"$setOnInsert": {"createdAt": now}, "$set": {"updatedAt": now, "status": "assigned"}},
            upsert=True,
        )
        assigned += 1

    return jsonify({"message": "Assigned", "assigned": assigned})


@admin_courses_bp.route("/<course_id>/assignments", methods=["PUT"])
@admin_courses_bp.route("/<course_id>/assignments/", methods=["PUT"])
def sync_course_assignments(course_id: str):
    payload = request.get_json(silent=True) or {}
    ok, msg = require_fields(payload, ["userIds"])
    if not ok:
        return jsonify({"error": msg}), 400

    requested_user_ids = payload.get("userIds") or []
    if not isinstance(requested_user_ids, list):
        return jsonify({"error": "userIds must be a list"}), 400

    try:
        oid = ObjectId(course_id)
    except Exception:
        return jsonify({"error": "Invalid course id"}), 400

    db = get_db()
    course = db.courses.find_one({"_id": oid})
    if not course:
        return jsonify({"error": "Course not found"}), 404

    normalized_user_ids = sorted({str(user_id).strip() for user_id in requested_user_ids if str(user_id).strip()})
    valid_users = list(db.users.find({"userId": {"$in": normalized_user_ids}, "role": "answerer"}, {"userId": 1}))
    valid_user_ids = sorted({str(user.get("userId") or "").strip() for user in valid_users if user.get("userId")})

    existing_assignments = list(db.course_assignments.find({"courseId": oid}, {"userId": 1}))
    existing_user_ids = {str(item.get("userId") or "").strip() for item in existing_assignments if item.get("userId")}

    target_user_ids = set(valid_user_ids)
    to_remove = [user_id for user_id in existing_user_ids if user_id not in target_user_ids]

    now = datetime.utcnow()
    for user_id in valid_user_ids:
        db.course_assignments.update_one(
            {"courseId": oid, "userId": user_id},
            {"$setOnInsert": {"createdAt": now}, "$set": {"updatedAt": now, "status": "assigned"}},
            upsert=True,
        )

    if to_remove:
        db.course_assignments.delete_many({"courseId": oid, "userId": {"$in": to_remove}})

    return jsonify({
        "message": "Assignments updated",
        "assignedCount": len(valid_user_ids),
        "userIds": valid_user_ids,
    })


@admin_courses_bp.route("/<course_id>/materials", methods=["GET"])
@admin_courses_bp.route("/<course_id>/materials/", methods=["GET"])
def list_course_materials(course_id: str):
    db = get_db()
    try:
        oid = ObjectId(course_id)
    except Exception:
        return jsonify({"error": "Invalid course id"}), 400

    course = db.courses.find_one({"_id": oid})
    if not course:
        return jsonify({"error": "Course not found"}), 404

    _ensure_default_course_materials(db, oid)
    materials = list(db.course_materials.find({"courseId": oid}).sort([("dayNumber", 1), ("createdAt", 1)]))
    return jsonify({"materials": to_jsonable([_serialize_material(m) for m in materials])})


@admin_courses_bp.route("/<course_id>/materials", methods=["POST"])
@admin_courses_bp.route("/<course_id>/materials/", methods=["POST"])
def create_course_material(course_id: str):
    payload = request.get_json(silent=True) or {}

    try:
        oid = ObjectId(course_id)
    except Exception:
        return jsonify({"error": "Invalid course id"}), 400

    db = get_db()
    course = db.courses.find_one({"_id": oid})
    if not course:
        return jsonify({"error": "Course not found"}), 404

    material_payload = _normalize_material_payload(payload)
    now = datetime.utcnow()
    doc = {
        "courseId": oid,
        **material_payload,
        "createdAt": now,
        "updatedAt": now,
    }
    if doc["dayNumber"] < 1:
        return jsonify({"error": "dayNumber must be at least 1"}), 400
    if not doc["title"]:
        return jsonify({"error": "title is required"}), 400
    if not doc["content"] and not doc.get("contentJson"):
        return jsonify({"error": "content is required"}), 400

    res = db.course_materials.insert_one(doc)
    return jsonify({"material": to_jsonable(_serialize_material({**doc, "_id": res.inserted_id}))}), 201


@admin_courses_bp.route("/materials/<material_id>", methods=["PUT", "PATCH"])
@admin_courses_bp.route("/materials/<material_id>/", methods=["PUT", "PATCH"])
def update_course_material(material_id: str):
    payload = request.get_json(silent=True) or {}

    db = get_db()
    try:
        oid = ObjectId(material_id)
    except Exception:
        return jsonify({"error": "Invalid material id"}), 400

    material = db.course_materials.find_one({"_id": oid})
    if not material:
        return jsonify({"error": "Material not found"}), 404

    update = {
        **_normalize_material_payload(payload),
        "updatedAt": datetime.utcnow(),
    }
    if update["dayNumber"] < 1:
        return jsonify({"error": "dayNumber must be at least 1"}), 400
    if not update["title"]:
        return jsonify({"error": "title is required"}), 400
    if not update["content"] and not update.get("contentJson"):
        return jsonify({"error": "content is required"}), 400

    db.course_materials.update_one({"_id": oid}, {"$set": update})
    updated = db.course_materials.find_one({"_id": oid})
    return jsonify({"material": to_jsonable(_serialize_material(updated))})


@admin_courses_bp.route("/materials/<material_id>", methods=["DELETE"])
@admin_courses_bp.route("/materials/<material_id>/", methods=["DELETE"])
def delete_course_material(material_id: str):
    db = get_db()
    try:
        oid = ObjectId(material_id)
    except Exception:
        return jsonify({"error": "Invalid material id"}), 400

    material = db.course_materials.find_one({"_id": oid})
    if not material:
        return jsonify({"error": "Material not found"}), 404

    db.course_materials.delete_one({"_id": oid})
    return jsonify({"message": "Material deleted"})
