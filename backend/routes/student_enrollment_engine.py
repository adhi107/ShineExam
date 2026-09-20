"""
backend/routes/student_enrollment_engine.py
───────────────────────────────────────────
Enterprise Student Enrollment, Paper Selection & Optional Subject Engine.
Implements the Student-First workflow:
Create Student → Enroll in Exam/Year/Stage → Select Papers → Select Optional Track (with historical audit trail) → Compute Eligible Tests → Manual Test Assignment → Dashboard.
"""

from datetime import datetime
from bson import ObjectId
from flask import Blueprint, jsonify, request

from config.db import get_db
from utils.json import to_jsonable
from utils.tenant import get_request_tenant_id, DEFAULT_TENANT_ID
from utils.validators import require_fields
from utils.audit import log_audit_event

enrollment_bp = Blueprint("student_enrollment_engine", __name__)


def _serialize(doc):
    if not doc:
        return None
    doc["id"] = str(doc.get("_id", ""))
    return doc


# ────────────────────────────────────────────────────────────────
# 1. Student Creation & Profile Management
# ────────────────────────────────────────────────────────────────

@enrollment_bp.route("/students", methods=["POST"])
def create_student_profile():
    """
    Admin: Register new Student profile with personal, academic, and organization info.
    """
    db = get_db()
    data = request.get_json(silent=True) or {}

    ok, msg = require_fields(data, ["name", "email"])
    if not ok:
        return jsonify({"error": msg}), 400

    tenant_id = get_request_tenant_id() or DEFAULT_TENANT_ID
    email = str(data["email"]).strip().lower()
    user_id = str(data.get("userId") or email.split("@")[0]).strip()
    now = datetime.utcnow().isoformat()

    # Check duplicate email or userId
    existing = db.users.find_one({"$or": [{"email": email}, {"userId": user_id}]})
    if existing:
        return jsonify({"error": "A student with this Email or Student ID already exists."}), 409

    student_doc = {
        "tenantId": tenant_id,
        "userId": user_id,
        "naxUnid": user_id,
        "role": "answerer",
        "name": str(data["name"]).strip(),
        "email": email,
        "password": str(data.get("password") or "ShineExam@2026").strip(),
        # Personal Information
        "mobile": str(data.get("mobile", "")).strip(),
        "alternateMobile": str(data.get("alternateMobile", "")).strip(),
        "gender": str(data.get("gender", "Not Specified")).strip(),
        "dateOfBirth": str(data.get("dateOfBirth", "")).strip(),
        "address": str(data.get("address", "")).strip(),
        "state": str(data.get("state", "")).strip(),
        "profilePhotoUrl": str(data.get("profilePhotoUrl", "")).strip(),
        # Academic Information
        "qualification": str(data.get("qualification", "")).strip(),
        "graduationYear": data.get("graduationYear"),
        "category": str(data.get("category", "General")).strip(),
        "mediumOfStudy": str(data.get("mediumOfStudy", "English")).strip(),
        # Organization Information
        "organization": str(data.get("organization", "Main Branch")).strip(),
        "branch": str(data.get("branch", "Main")).strip(),
        "batch": str(data.get("batch", "2026-Batch-A")).strip(),
        "course": str(data.get("course", "UPSC Civil Services")).strip(),
        "courseStream": str(data.get("course", "UPSC Civil Services")).strip(),
        # Status
        "isActive": True,
        "status": str(data.get("status", "Active")).strip(),  # Active | Inactive | Suspended
        "enrolledExams": [],
        "createdAt": now,
        "updatedAt": now,
    }

    res = db.users.insert_one(student_doc)
    student_doc["_id"] = res.inserted_id

    log_audit_event("create_student_profile", {
        "userId": user_id,
        "name": student_doc["name"],
        "email": email,
        "course": student_doc["course"]
    })

    return jsonify({
        "message": "Student profile created successfully",
        "student": to_jsonable(_serialize(student_doc))
    }), 201


@enrollment_bp.route("/students", methods=["GET"])
def list_students():
    """Admin: List all students with filters, pagination, and enrollment counts."""
    db = get_db()
    tenant_id = get_request_tenant_id()
    query = {"role": "answerer"}
    if tenant_id and tenant_id != "all":
        query["$or"] = [
            {"tenantId": tenant_id},
            {"tenantId": {"$exists": False}},
            {"tenantId": None},
        ]

    search = request.args.get("search", "").strip()
    batch = request.args.get("batch")
    course = request.args.get("course")
    status = request.args.get("status")

    if batch: query["batch"] = batch
    if course: query["course"] = course
    if status: query["status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"userId": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"mobile": {"$regex": search, "$options": "i"}},
        ]

    page = max(1, int(request.args.get("page", 1)))
    limit = min(500, max(1, int(request.args.get("limit", 100))))
    skip = (page - 1) * limit

    total = db.users.count_documents(query)
    students = list(db.users.find(query).sort("createdAt", -1).skip(skip).limit(limit))

    # Enrich with optional subject for quick display
    all_uids = [s.get("userId") for s in students if s.get("userId")]
    opt_map = {
        doc["userId"]: doc.get("optionalSubject", "")
        for doc in db.student_optional_subjects.find({"userId": {"$in": all_uids}})
    }

    serialized_students = []
    for s in students:
        s_data = _serialize(s)
        s_data["optionalSubject"] = opt_map.get(s.get("userId"), "")
        serialized_students.append(s_data)

    return jsonify({
        "total": total,
        "page": page,
        "limit": limit,
        "students": to_jsonable(serialized_students)
    })


@enrollment_bp.route("/stats", methods=["GET"])
def get_enrollment_stats():
    """Admin: Get high-level KPI stats for student enrollment and exam distribution."""
    db = get_db()
    tenant_id = get_request_tenant_id()
    query = {"role": "answerer"}
    if tenant_id and tenant_id != "all":
        query["$or"] = [
            {"tenantId": tenant_id},
            {"tenantId": {"$exists": False}},
            {"tenantId": None},
        ]

    total_students = db.users.count_documents(query)
    enrolled_uids = db.student_exam_enrollments.distinct("userId")
    opt_uids = db.student_optional_subjects.distinct("userId")
    batches = [b for b in db.users.distinct("batch", query) if b]
    courses = [c for c in db.users.distinct("course", query) if c]

    return jsonify({
        "totalStudents": total_students,
        "enrolledStudents": len(enrolled_uids),
        "optionalConfigured": len(opt_uids),
        "totalBatches": len(batches),
        "batches": sorted(batches),
        "courses": sorted(courses)
    })


@enrollment_bp.route("/students/<user_id>", methods=["PUT"])
def update_student_profile(user_id):
    """Admin: Update student profile details, contact, batch, or status."""
    db = get_db()
    data = request.get_json(silent=True) or {}
    uid = str(user_id).strip()

    student = db.users.find_one({"$or": [{"userId": uid}, {"naxUnid": uid}]})
    if not student:
        return jsonify({"error": "Student not found"}), 404

    now = datetime.utcnow().isoformat()
    update_doc = {"updatedAt": now}

    for key in ["name", "email", "mobile", "batch", "course", "status", "category", "organization", "branch", "qualification", "mediumOfStudy"]:
        if key in data:
            update_doc[key] = str(data[key]).strip()

    if "course" in update_doc:
        update_doc["courseStream"] = update_doc["course"]

    if "status" in update_doc:
        update_doc["isActive"] = update_doc["status"].lower() == "active"

    db.users.update_one({"_id": student["_id"]}, {"$set": update_doc})

    log_audit_event("update_student_profile", {"userId": uid, "updates": update_doc})

    updated = db.users.find_one({"_id": student["_id"]})
    return jsonify({
        "message": "Student profile updated successfully",
        "student": to_jsonable(_serialize(updated))
    })


@enrollment_bp.route("/bulk-enroll", methods=["POST"])
def bulk_enroll_students():
    """Admin: Bulk enroll multiple students into an exam."""
    db = get_db()
    data = request.get_json(silent=True) or {}
    user_ids = data.get("userIds", [])
    exam_name = str(data.get("examName", "")).strip()
    exam_year = int(data.get("examYear", datetime.utcnow().year))
    selected_stages = data.get("selectedStages", ["prelims", "mains", "optional"])
    admin_name = str(data.get("adminName", "Admin")).strip()

    if not user_ids or not exam_name:
        return jsonify({"error": "userIds and examName are required"}), 400

    now = datetime.utcnow().isoformat()
    count = 0

    for uid in user_ids:
        u_str = str(uid).strip()
        enrollment_doc = {
            "userId": u_str,
            "examName": exam_name,
            "examYear": exam_year,
            "selectedStages": selected_stages,
            "status": "active",
            "enrolledBy": admin_name,
            "enrollmentDate": now[:10],
            "updatedAt": now,
        }
        db.student_exam_enrollments.update_one(
            {"userId": u_str, "examName": exam_name, "examYear": exam_year},
            {"$set": enrollment_doc},
            upsert=True
        )
        db.users.update_one(
            {"$or": [{"userId": u_str}, {"naxUnid": u_str}]},
            {"$addToSet": {"enrolledExams": exam_name}}
        )
        count += 1

    log_audit_event("bulk_enroll_students", {
        "count": count,
        "examName": exam_name,
        "examYear": exam_year
    })

    return jsonify({"message": f"Successfully enrolled {count} students into {exam_name} {exam_year}", "count": count})


@enrollment_bp.route("/bulk-batch", methods=["POST"])
def bulk_change_batch():
    """Admin: Bulk change batch for multiple students."""
    db = get_db()
    data = request.get_json(silent=True) or {}
    user_ids = data.get("userIds", [])
    batch = str(data.get("batch", "")).strip()

    if not user_ids or not batch:
        return jsonify({"error": "userIds and batch are required"}), 400

    res = db.users.update_many(
        {"$or": [{"userId": {"$in": user_ids}}, {"naxUnid": {"$in": user_ids}}]},
        {"$set": {"batch": batch, "updatedAt": datetime.utcnow().isoformat()}}
    )

    return jsonify({"message": f"Updated batch to '{batch}' for {res.modified_count} students", "count": res.modified_count})



# ────────────────────────────────────────────────────────────────
# 2. Exam Enrollment & Paper Configuration
# ────────────────────────────────────────────────────────────────

@enrollment_bp.route("/enroll", methods=["POST"])
def enroll_student_in_exam():
    """
    Admin: Enroll student in an Exam, Year, and Stage.
    e.g. UPSC Civil Services → 2026 → Mains.
    """
    db = get_db()
    data = request.get_json(silent=True) or {}

    ok, msg = require_fields(data, ["userId", "examName", "examYear", "stage"])
    if not ok:
        return jsonify({"error": msg}), 400

    user_id = str(data["userId"]).strip()
    student = db.users.find_one({"$or": [{"userId": user_id}, {"naxUnid": user_id}]})
    if not student:
        return jsonify({"error": "Student not found"}), 404

    tenant_id = get_request_tenant_id() or DEFAULT_TENANT_ID
    now = datetime.utcnow().isoformat()
    exam_name = str(data["examName"]).strip()
    exam_year = int(data["examYear"])
    stage = str(data["stage"]).strip()  # Preliminary | Mains | Interview | Daily Mock

    enrollment_doc = {
        "tenantId": tenant_id,
        "userId": user_id,
        "studentName": student.get("name", user_id),
        "examName": exam_name,
        "examCode": str(data.get("examCode") or exam_name[:6].upper()).strip(),
        "examYear": exam_year,
        "stage": stage,
        "enrollmentDate": data.get("enrollmentDate", now[:10]),
        "status": data.get("status", "Active"),  # Active | Completed | Deferred
        "selectedPapers": data.get("selectedPapers", []),
        "optionalSubject": str(data.get("optionalSubject", "")).strip(),
        "createdAt": now,
        "updatedAt": now,
    }

    # Upsert enrollment
    res = db.student_exam_enrollments.update_one(
        {"userId": user_id, "examName": exam_name, "examYear": exam_year, "stage": stage},
        {"$set": enrollment_doc},
        upsert=True
    )

    # Add to user's enrolledExams summary
    db.users.update_one(
        {"_id": student["_id"]},
        {"$addToSet": {"enrolledExams": f"{exam_name} {exam_year} ({stage})"}}
    )

    log_audit_event("enroll_student_in_exam", {
        "userId": user_id,
        "exam": exam_name,
        "year": exam_year,
        "stage": stage
    })

    return jsonify({
        "message": f"Student successfully enrolled in {exam_name} {exam_year} ({stage})",
        "enrollment": to_jsonable(enrollment_doc)
    }), 201


@enrollment_bp.route("/optional-subject", methods=["POST"])
def assign_or_change_optional_subject():
    """
    Admin: Assign or change Optional Subject for a student with complete historical audit trail.
    """
    db = get_db()
    data = request.get_json(silent=True) or {}

    ok, msg = require_fields(data, ["userId", "optionalSubject"])
    if not ok:
        return jsonify({"error": msg}), 400

    user_id = str(data["userId"]).strip()
    new_subject = str(data["optionalSubject"]).strip()
    reason = str(data.get("reason", "Student track specialization request")).strip()
    changed_by = str(data.get("changedBy", "Administrator")).strip()
    tenant_id = get_request_tenant_id() or DEFAULT_TENANT_ID
    now = datetime.utcnow().isoformat()

    student = db.users.find_one({"$or": [{"userId": user_id}, {"naxUnid": user_id}]})
    if not student:
        return jsonify({"error": "Student not found"}), 404

    # Fetch existing current optional subject
    curr = db.student_optional_subjects.find_one({"userId": user_id})
    prev_subject = curr.get("optionalSubject", "") if curr else ""

    # Record historical log in optional_subject_history
    history_doc = {
        "tenantId": tenant_id,
        "userId": user_id,
        "studentName": student.get("name", user_id),
        "previousSubject": prev_subject or "None (Initial Assignment)",
        "newSubject": new_subject,
        "changedBy": changed_by,
        "changedAt": now,
        "reason": reason,
    }
    db.optional_subject_history.insert_one(history_doc)

    # Upsert current active optional subject
    db.student_optional_subjects.update_one(
        {"userId": user_id},
        {
            "$set": {
                "tenantId": tenant_id,
                "userId": user_id,
                "studentName": student.get("name", user_id),
                "optionalSubject": new_subject,
                "assignedAt": now,
                "assignedBy": changed_by,
                "updatedAt": now,
            }
        },
        upsert=True
    )

    # Sync into latest enrollments & test assignments
    db.student_exam_enrollments.update_many(
        {"userId": user_id},
        {"$set": {"optionalSubject": new_subject, "updatedAt": now}}
    )
    db.series_assignments.update_many(
        {"userId": user_id},
        {"$set": {"optionalSubject": new_subject, "updatedAt": now}}
    )

    log_audit_event("change_optional_subject", {
        "userId": user_id,
        "previousSubject": prev_subject,
        "newSubject": new_subject,
        "reason": reason
    })

    return jsonify({
        "message": f"Optional Subject updated to '{new_subject}' successfully with audit log saved.",
        "previousSubject": prev_subject,
        "newSubject": new_subject
    })


@enrollment_bp.route("/optional-subject/history", methods=["GET"])
def get_optional_subject_history():
    """Admin: Retrieve complete optional subject change audit log for a student."""
    db = get_db()
    user_id = request.args.get("userId", "").strip()
    if not user_id:
        return jsonify({"error": "userId required"}), 400

    history = list(db.optional_subject_history.find({"userId": user_id}).sort("changedAt", -1))
    return jsonify({"userId": user_id, "history": to_jsonable([_serialize(h) for h in history])})


# ────────────────────────────────────────────────────────────────
# 3. Eligible Test Engine (Filter tests by Student's Compulsory + Optional Track)
# ────────────────────────────────────────────────────────────────

@enrollment_bp.route("/students/<user_id>/eligible-tests", methods=["GET"])
def get_student_eligible_tests(user_id):
    """
    Computes all eligible tests & papers for student based on:
    Enrolled Exams + Selected Papers + Chosen Optional Track.
    Ensures tests for unchosen optionals are never assigned or displayed.
    """
    db = get_db()
    uid = str(user_id).strip()

    # Get student optional track
    opt_doc = db.student_optional_subjects.find_one({"userId": uid})
    selected_optional = opt_doc.get("optionalSubject", "") if opt_doc else ""

    # Get student's enrollments
    enrollments = list(db.student_exam_enrollments.find({"userId": uid}))

    # Get all active series in system
    tenant_id = get_request_tenant_id()
    query = {"status": "active"}
    if tenant_id and tenant_id != "all":
        query["$or"] = [
            {"tenantId": tenant_id},
            {"tenantId": {"$exists": False}},
            {"tenantId": None},
        ]

    all_series = list(db.test_series.find(query))
    eligible_series = []

    for s in all_series:
        papers = list(db.series_papers.find({"seriesId": s["_id"]}).sort("paperNumber", 1))

        # Filter papers: Include compulsory papers + matching optional papers
        eligible_papers = []
        for p in papers:
            is_opt = bool(p.get("isOptional", False))
            opt_sub = p.get("optionalSubject", "")
            if not is_opt:
                eligible_papers.append(p)
            elif selected_optional and opt_sub.lower() == selected_optional.lower():
                eligible_papers.append(p)

        if eligible_papers:
            s_dict = _serialize(s)
            s_dict["eligiblePaperCount"] = len(eligible_papers)
            s_dict["eligiblePapers"] = [_serialize(p) for p in eligible_papers]
            s_dict["userOptional"] = selected_optional
            eligible_series.append(s_dict)

    return jsonify({
        "userId": uid,
        "selectedOptionalSubject": selected_optional,
        "enrollmentCount": len(enrollments),
        "eligibleSeriesCount": len(eligible_series),
        "eligibleSeries": to_jsonable(eligible_series)
    })


# ────────────────────────────────────────────────────────────────
# 4. Student Portal Enrollment Overview
# ────────────────────────────────────────────────────────────────

@enrollment_bp.route("/student-profile", methods=["GET"])
def get_student_portal_profile():
    """Student portal: Get full personal profile, enrolled exams, selected optional, and assignments."""
    db = get_db()
    user_id = request.args.get("userId", "").strip()
    if not user_id:
        return jsonify({"error": "userId required"}), 400

    student = db.users.find_one({"$or": [{"userId": user_id}, {"naxUnid": user_id}]})
    if not student:
        return jsonify({"error": "Student not found"}), 404

    enrollments = list(db.student_exam_enrollments.find({"userId": user_id}))
    opt_doc = db.student_optional_subjects.find_one({"userId": user_id})
    assignments = list(db.series_assignments.find({"userId": user_id}))

    return jsonify({
        "profile": to_jsonable(_serialize(student)),
        "enrollments": to_jsonable([_serialize(e) for e in enrollments]),
        "optionalSubject": opt_doc.get("optionalSubject", "") if opt_doc else "",
        "assignedTestsCount": len(assignments)
    })
