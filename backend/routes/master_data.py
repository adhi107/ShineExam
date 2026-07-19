# Shine Exam master data and student registration routes.
# Admins maintain dropdown values for student profiles, while students use the
# public routes to register and receive their generated NAX login ID.

from flask import Blueprint, jsonify, request
from datetime import datetime
from bson import ObjectId
from config.db import get_db
from utils.json import to_jsonable

master_data_bp = Blueprint("master_data", __name__)
public_bp = Blueprint("public", __name__)

VALID_CATEGORIES = ("genders", "streams", "certifications", "colleges")

# Admin master data list for registration dropdown management.
@master_data_bp.get("")
@master_data_bp.get("/")
def get_master_data():
    db = get_db()
    result = {}
    for cat in VALID_CATEGORIES:
        items = list(db.master_data.find({"category": cat}, {"_id": 1, "label": 1, "createdAt": 1}))
        result[cat] = [
            {"id": str(i["_id"]), "label": i["label"], "createdAt": i.get("createdAt")}
            for i in items
        ]
    return jsonify(to_jsonable(result))


# Add a new Shine Exam dropdown value for student registration.
@master_data_bp.post("/<category>")
@master_data_bp.post("/<category>/")
def add_master_item(category: str):
    if category not in VALID_CATEGORIES:
        return jsonify({"error": f"Invalid category. Must be one of {VALID_CATEGORIES}"}), 400

    payload = request.get_json(silent=True) or {}
    label = str(payload.get("label", "")).strip()
    if not label:
        return jsonify({"error": "label is required"}), 400

    db = get_db()
    if db.master_data.find_one({"category": category, "label": {"$regex": f"^{label}$", "$options": "i"}}):
        return jsonify({"error": f"'{label}' already exists in {category}"}), 409

    doc = {
        "category": category,
        "label": label,
        "createdAt": datetime.utcnow(),
    }
    res = db.master_data.insert_one(doc)
    return jsonify(to_jsonable({
        "id": str(res.inserted_id),
        "label": label,
        "createdAt": doc["createdAt"],
    })), 201


# Rename a Shine Exam dropdown value without duplicating existing labels.
@master_data_bp.patch("/<category>/<item_id>")
@master_data_bp.patch("/<category>/<item_id>/")
def update_master_item(category: str, item_id: str):
    if category not in VALID_CATEGORIES:
        return jsonify({"error": "Invalid category"}), 400

    payload = request.get_json(silent=True) or {}
    label = str(payload.get("label", "")).strip()
    if not label:
        return jsonify({"error": "label is required"}), 400

    db = get_db()
    try:
        q = {"_id": ObjectId(item_id), "category": category}
    except Exception:
        return jsonify({"error": "Invalid id"}), 400

    # Keep dropdown labels unique while allowing the current item to retain its label.
    existing = db.master_data.find_one({
        "category": category,
        "label": {"$regex": f"^{label}$", "$options": "i"},
        "_id": {"$ne": ObjectId(item_id)}
    })
    if existing:
        return jsonify({"error": f"'{label}' already exists in {category}"}), 409

    result = db.master_data.update_one(q, {"$set": {"label": label}})
    if result.matched_count == 0:
        return jsonify({"error": "Item not found"}), 404
    
    return jsonify(to_jsonable({
        "id": str(item_id),
        "label": label,
        "createdAt": None
    })), 200


# Remove an unused dropdown value from Shine Exam registration data.
@master_data_bp.delete("/<category>/<item_id>")
@master_data_bp.delete("/<category>/<item_id>/")
def delete_master_item(category: str, item_id: str):
    if category not in VALID_CATEGORIES:
        return jsonify({"error": "Invalid category"}), 400

    db = get_db()
    try:
        q = {"_id": ObjectId(item_id), "category": category}
    except Exception:
        return jsonify({"error": "Invalid id"}), 400

    result = db.master_data.delete_one(q)
    if result.deleted_count == 0:
        return jsonify({"error": "Item not found"}), 404
    return jsonify({"message": "Deleted"})


# Public dropdown values used by the student registration form.
@public_bp.get("/master-data")
@public_bp.get("/master-data/")
def public_get_master_data():
    db = get_db()
    result = {}
    for cat in VALID_CATEGORIES:
        items = list(db.master_data.find({"category": cat}, {"_id": 1, "label": 1}))
        result[cat] = [{"id": str(i["_id"]), "label": i["label"]} for i in items]
    return jsonify(to_jsonable(result))


# Preview the next generated NAX login ID for the registration page.
@public_bp.get("/next-unid")
@public_bp.get("/next-unid/")
def get_next_unid():
    db = get_db()
    count = db.student_registrations.count_documents({})
    next_num = 1500488 + count
    nax_unid = f"NAX_{str(next_num)}"
    return jsonify({"naxUnid": nax_unid})


# Create a new student registration and candidate login account.
@public_bp.post("/register")
@public_bp.post("/register/")
def student_register():
    payload = request.get_json(silent=True) or {}

    required = ["studentName", "studentId", "email", "mobile",
                "gender", "courseStream", "cgpa", "sapCertification", "collegeName", "collegeEmail"]
    missing = [f for f in required if not payload.get(f)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    db = get_db()

    # Prevent duplicate student registrations before creating portal access.
    if db.student_registrations.find_one({"email": payload["email"].strip().lower()}):
        return jsonify({"error": "An account with this email already exists"}), 409
    if db.student_registrations.find_one({"studentId": payload["studentId"].strip()}):
        return jsonify({"error": "An account with this Student ID already exists"}), 409

    # Generate the student's sequential NAX login ID with a shared counter.
    counter = db.counters.find_one_and_update(
        {"_id": "nax_unid"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = counter.get("seq", 1)
    nax_unid = f"NAX_{str(1500487 + seq)}"

    # Validate the academic score captured during registration.
    try:
        cgpa = float(payload["cgpa"])
        if not (0 <= cgpa <= 10):
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "CGPA must be a number between 0 and 10"}), 400

    now = datetime.utcnow()
    default_password = "Welcome@123"
    student_id = payload["studentId"].strip()
    student_name = payload["studentName"].strip()
    email = payload["email"].strip().lower()
    college_email = payload["collegeEmail"].strip().lower()

    # Store the submitted registration profile for admin review and audit history.
    reg_doc = {
        "naxUnid": nax_unid,
        "studentName": student_name,
        "studentId": student_id,
        "email": email,
        "collegeEmail": college_email,
        "mobile": str(payload["mobile"]).strip(),
        "gender": payload["gender"],
        "courseStream": payload["courseStream"],
        "cgpa": cgpa,
        "sapCertification": payload["sapCertification"],
        "collegeName": payload["collegeName"],
        "status": "pending",
        "createdAt": now,
    }
    db.student_registrations.insert_one(reg_doc)

    # Create the candidate account so the student can log in to Shine Exam immediately.
    user_doc = {
        "name": student_name,
        "email": email,
        "userId": nax_unid,           # Shine Exam uses the NAX ID as the candidate username.
        "naxUnid": nax_unid,
        "password": default_password,
        "role": "answerer",
        "createdAt": now,
        "lastLoginAt": None,
        "isActive": True,
        # Candidate profile details shown in admin records and reports.
        "studentId": student_id,
        "collegeRollNumber": student_id,   # Registration student ID is the college roll number.
        "mobile": str(payload["mobile"]).strip(),
        "gender": payload["gender"],
        "courseStream": payload["courseStream"],
        "cgpa": cgpa,
        "sapCertification": payload["sapCertification"],
        "collegeName": payload["collegeName"],
        "collegeEmail": college_email,
    }
    db.users.insert_one(user_doc)

    return jsonify({"naxUnid": nax_unid, "message": "Registration successful"}), 201
