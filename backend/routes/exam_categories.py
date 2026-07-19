from datetime import datetime
import re

from bson import ObjectId
from flask import Blueprint, jsonify, request

from config.db import get_db
from utils.json import to_jsonable

admin_exam_categories_bp = Blueprint("admin_exam_categories", __name__)
answerer_exam_categories_bp = Blueprint("answerer_exam_categories", __name__)


def _slug(value):
    return re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower()).strip("-")


def _serialize(category):
    return {
        "id": str(category["_id"]),
        "name": category.get("name", ""),
        "slug": category.get("slug", ""),
        "order": int(category.get("order", 0)),
        "isActive": category.get("isActive", True),
        "subcategories": category.get("subcategories", []),
        "createdAt": category.get("createdAt"),
        "updatedAt": category.get("updatedAt"),
    }


@admin_exam_categories_bp.route("", methods=["GET", "POST"])
@admin_exam_categories_bp.route("/", methods=["GET", "POST"])
def category_collection():
    db = get_db()
    if request.method == "GET":
        rows = list(db.exam_categories.find({}).sort([("order", 1), ("name", 1)]))
        return jsonify({"categories": to_jsonable([_serialize(row) for row in rows])})

    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Category name is required"}), 400
    slug = _slug(name)
    if db.exam_categories.find_one({"slug": slug}):
        return jsonify({"error": "Category already exists"}), 409
    now = datetime.utcnow()
    doc = {"name": name, "slug": slug, "order": int(payload.get("order", 0)), "isActive": True, "subcategories": [], "createdAt": now, "updatedAt": now}
    doc["_id"] = db.exam_categories.insert_one(doc).inserted_id
    return jsonify({"category": to_jsonable(_serialize(doc))}), 201


@admin_exam_categories_bp.route("/<category_id>", methods=["PUT", "DELETE"])
def category_item(category_id):
    db = get_db()
    try:
        oid = ObjectId(category_id)
    except Exception:
        return jsonify({"error": "Invalid category id"}), 400
    category = db.exam_categories.find_one({"_id": oid})
    if not category:
        return jsonify({"error": "Category not found"}), 404
    if request.method == "DELETE":
        if db.exams.count_documents({"categoryId": category_id}) > 0:
            return jsonify({"error": "Move or delete tests in this category first"}), 409
        db.exam_categories.delete_one({"_id": oid})
        return jsonify({"message": "Category deleted"})
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name") or category.get("name") or "").strip()
    updates = {"name": name, "slug": _slug(name), "order": int(payload.get("order", category.get("order", 0))), "isActive": bool(payload.get("isActive", category.get("isActive", True))), "updatedAt": datetime.utcnow()}
    db.exam_categories.update_one({"_id": oid}, {"$set": updates})
    updated = db.exam_categories.find_one({"_id": oid})
    return jsonify({"category": to_jsonable(_serialize(updated))})


@admin_exam_categories_bp.route("/<category_id>/subcategories", methods=["POST"])
def add_subcategory(category_id):
    db = get_db()
    try:
        oid = ObjectId(category_id)
    except Exception:
        return jsonify({"error": "Invalid category id"}), 400
    category = db.exam_categories.find_one({"_id": oid})
    if not category:
        return jsonify({"error": "Category not found"}), 404
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Subcategory name is required"}), 400
    if any(_slug(item.get("name")) == _slug(name) for item in category.get("subcategories", [])):
        return jsonify({"error": "Subcategory already exists"}), 409
    stages = [str(stage).strip() for stage in payload.get("stages", []) if str(stage).strip()]
    if not stages:
        stages = ["Prelims", "Mains"]
    item = {"id": str(ObjectId()), "name": name, "slug": _slug(name), "stages": list(dict.fromkeys(stages)), "isActive": True}
    db.exam_categories.update_one({"_id": oid}, {"$push": {"subcategories": item}, "$set": {"updatedAt": datetime.utcnow()}})
    return jsonify({"subcategory": item}), 201


@admin_exam_categories_bp.route("/<category_id>/subcategories/<subcategory_id>", methods=["PUT", "DELETE"])
def subcategory_item(category_id, subcategory_id):
    db = get_db()
    try:
        oid = ObjectId(category_id)
    except Exception:
        return jsonify({"error": "Invalid category id"}), 400
    category = db.exam_categories.find_one({"_id": oid})
    if not category:
        return jsonify({"error": "Category not found"}), 404
    subcategories = category.get("subcategories", [])
    current = next((item for item in subcategories if item.get("id") == subcategory_id), None)
    if not current:
        return jsonify({"error": "Subcategory not found"}), 404
    if request.method == "DELETE":
        if db.exams.count_documents({"categoryId": category_id, "subcategoryId": subcategory_id}) > 0:
            return jsonify({"error": "Move or delete tests in this subcategory first"}), 409
        db.exam_categories.update_one({"_id": oid}, {"$pull": {"subcategories": {"id": subcategory_id}}, "$set": {"updatedAt": datetime.utcnow()}})
        return jsonify({"message": "Subcategory deleted"})
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name") or current.get("name") or "").strip()
    stages = [str(stage).strip() for stage in payload.get("stages", current.get("stages", [])) if str(stage).strip()]
    updates = {"subcategories.$.name": name, "subcategories.$.slug": _slug(name), "subcategories.$.stages": list(dict.fromkeys(stages)), "subcategories.$.isActive": bool(payload.get("isActive", current.get("isActive", True))), "updatedAt": datetime.utcnow()}
    db.exam_categories.update_one({"_id": oid, "subcategories.id": subcategory_id}, {"$set": updates})
    return jsonify({"message": "Subcategory updated"})


@answerer_exam_categories_bp.get("")
@answerer_exam_categories_bp.get("/")
def candidate_categories():
    rows = list(get_db().exam_categories.find({"isActive": {"$ne": False}}).sort([("order", 1), ("name", 1)]))
    serialized = []
    for row in rows:
        item = _serialize(row)
        item["subcategories"] = [sub for sub in item["subcategories"] if sub.get("isActive", True)]
        serialized.append(item)
    return jsonify({"categories": to_jsonable(serialized)})
