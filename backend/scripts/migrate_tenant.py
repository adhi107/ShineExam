import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.db import get_db

db = get_db()
# Remove duplicate default org if 100 exists
if db.organizations.find_one({"tenantId": "100"}):
    db.organizations.delete_many({"tenantId": "default"})

print("Current Organizations in database:")
for org in db.organizations.find({}):
    print(f"- {org.get('name')} | Tenant ID: '{org.get('tenantId')}' | Candidates: {db.users.count_documents({'tenantId': org.get('tenantId'), 'role': 'answerer'})}")
