"""
scripts/migrate_registrations_to_users.py

One-time Shine Exam script: creates candidate login accounts for historical
student registrations that do not already have a matching user record.

Run from the backend/ directory:
    python -m scripts.migrate_registrations_to_users
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from config.db import get_db

DEFAULT_PASSWORD = "Welcome@123"

def migrate():
    db = get_db()
    registrations = list(db.student_registrations.find({}))
    print(f"Found {len(registrations)} registration(s) to check.")

    created = 0
    skipped = 0

    for reg in registrations:
        nax_unid = reg.get("naxUnid")
        if not nax_unid:
            print(f"  SKIP (no naxUnid): {reg.get('_id')}")
            skipped += 1
            continue

        # Skip registrations that already have a Shine Exam candidate account.
        existing = db.users.find_one({"$or": [{"userId": nax_unid}, {"naxUnid": nax_unid}]})
        if existing:
            print(f"  SKIP (already exists): {nax_unid}")
            skipped += 1
            continue

        user_doc = {
            "name":             reg.get("studentName", "").strip(),
            "email":            reg.get("email", "").strip().lower(),
            "userId":           nax_unid,
            "naxUnid":          nax_unid,
            "password":         DEFAULT_PASSWORD,
            "role":             "answerer",
            "createdAt":        reg.get("createdAt", datetime.utcnow()),
            "lastLoginAt":      None,
            "isActive":         True,
            "studentId":        reg.get("studentId", ""),
            "collegeRollNumber": reg.get("studentId", ""),
            "mobile":           reg.get("mobile", ""),
            "gender":           reg.get("gender", ""),
            "courseStream":     reg.get("courseStream", ""),
            "cgpa":             reg.get("cgpa"),
            "sapCertification": reg.get("sapCertification", ""),
            "collegeName":      reg.get("collegeName", ""),
            "collegeEmail":     reg.get("collegeEmail", "").strip().lower(),
        }

        db.users.insert_one(user_doc)
        print(f"  CREATED user: {nax_unid}  ({user_doc['name']})")
        created += 1

    print(f"\nDone. Created: {created}  Skipped: {skipped}")

if __name__ == "__main__":
    migrate()
