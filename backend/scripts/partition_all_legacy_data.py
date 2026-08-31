import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.db import get_db

def run_migration():
    db = get_db()
    
    # 1. Clean up duplicate 'default' organization
    db.organizations.delete_many({"tenantId": "default"})
    
    # 2. Collections to partition
    collections = [
        "exams", "tests", "questions", "results", "attempts", 
        "videos", "documents", "announcements", "security_violations", 
        "exam_categories", "audit_logs", "courses", "learning_materials"
    ]
    
    for col in collections:
        res = db[col].update_many(
            {"$or": [
                {"tenantId": {"$exists": False}}, 
                {"tenantId": None}, 
                {"tenantId": ""}, 
                {"tenantId": "default"}
            ]},
            {"$set": {"tenantId": "100"}}
        )
        print(f"Collection '{col}': assigned {res.modified_count} unpartitioned records to tenantId '100'")
        
    print("\n--- Current Partition Summary ---")
    for col in ["users", "organizations", "exams", "videos", "documents", "announcements", "results", "security_violations"]:
        counts = {}
        for doc in db[col].find({}, {"tenantId": 1}):
            tid = doc.get("tenantId", "UNPARTITIONED")
            counts[tid] = counts.get(tid, 0) + 1
        print(f"{col}: {counts}")

if __name__ == "__main__":
    run_migration()
