import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.db import get_db

db = get_db()

# 1. Keep the active organization with candidates ('100'), delete all empty/duplicate 'default' records
db.organizations.delete_many({"tenantId": "default"})

# Also remove any duplicates if multiple exist for any tenantId
all_orgs = list(db.organizations.find({}))
seen_tids = set()
for org in all_orgs:
    tid = org.get("tenantId")
    if tid in seen_tids:
        print(f"Deleting duplicate organization: {org.get('name')} (_id: {org['_id']})")
        db.organizations.delete_one({"_id": org["_id"]})
    else:
        seen_tids.add(tid)

# 2. Create unique index on tenantId so duplicates can NEVER be created in MongoDB
try:
    db.organizations.create_index("tenantId", unique=True)
    print("SUCCESS: Unique index on 'tenantId' created in MongoDB.")
except Exception as e:
    print(f"Index notice: {e}")

print("Cleaned database. Current Organizations:")
for o in db.organizations.find({}):
    print(f"- Name: {o.get('name')} | Tenant ID: '{o.get('tenantId')}' | Candidates: {db.users.count_documents({'tenantId': o.get('tenantId'), 'role': 'answerer'})}")
