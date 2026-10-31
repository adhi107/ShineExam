"""
Patch: Fix list_submissions to safely merge tenant $or filter with other query conditions
using $and instead of dict spread, which breaks when tenant_filter contains $or.
"""
import re

path = r'd:\Adhi\Shine\Shine-Exam\backend\routes\test_series.py'

with open(path, 'rb') as f:
    content = f.read()

# Find the function and replace
old_block = (
    b'    q = {**tenant_filter}\r\n'
    b'    if status_filter:\r\n'
    b'        if status_filter == "pending":\r\n'
    b'            q["status"] = {"$in": ["pending", "submitted", "under_evaluation"]}\r\n'
    b'        elif status_filter == "evaluated":\r\n'
    b'            q["status"] = "evaluated"\r\n'
    b'        elif status_filter == "published":\r\n'
    b'            q["status"] = "published"\r\n'
    b'        elif status_filter != "all":\r\n'
    b'            q["status"] = status_filter\r\n'
    b'    if series_id:\r\n'
    b'        try:\r\n'
    b'            q["seriesId"] = ObjectId(series_id)\r\n'
    b'        except Exception:\r\n'
    b'            q["seriesId"] = series_id\r\n'
    b'    if paper_id:\r\n'
    b'        try:\r\n'
    b'            q["paperId"] = ObjectId(paper_id)\r\n'
    b'        except Exception:\r\n'
    b'            q["paperId"] = paper_id\r\n'
    b'    if paper_type_param and paper_type_param != "all":\r\n'
    b'        q["paperType"] = paper_type_param\r\n'
    b'\r\n'
    b'    subs = list(db.series_attempts.find(q).sort("submittedAt", -1))'
)

new_block = (
    b'    # Build conditions list to safely merge tenant $or with other filters using $and\r\n'
    b'    conditions = []\r\n'
    b'\r\n'
    b'    if tenant_filter:\r\n'
    b'        conditions.append(tenant_filter)\r\n'
    b'\r\n'
    b'    if status_filter:\r\n'
    b'        if status_filter == "pending":\r\n'
    b'            conditions.append({"status": {"$in": ["pending", "submitted", "under_evaluation"]}})\r\n'
    b'        elif status_filter == "evaluated":\r\n'
    b'            conditions.append({"status": "evaluated"})\r\n'
    b'        elif status_filter == "published":\r\n'
    b'            conditions.append({"status": "published"})\r\n'
    b'        elif status_filter != "all":\r\n'
    b'            conditions.append({"status": status_filter})\r\n'
    b'\r\n'
    b'    if series_id:\r\n'
    b'        try:\r\n'
    b'            conditions.append({"seriesId": ObjectId(series_id)})\r\n'
    b'        except Exception:\r\n'
    b'            conditions.append({"seriesId": series_id})\r\n'
    b'\r\n'
    b'    if paper_id:\r\n'
    b'        try:\r\n'
    b'            conditions.append({"paperId": ObjectId(paper_id)})\r\n'
    b'        except Exception:\r\n'
    b'            conditions.append({"paperId": paper_id})\r\n'
    b'\r\n'
    b'    if paper_type_param and paper_type_param != "all":\r\n'
    b'        conditions.append({"paperType": paper_type_param})\r\n'
    b'\r\n'
    b'    if len(conditions) == 0:\r\n'
    b'        q = {}\r\n'
    b'    elif len(conditions) == 1:\r\n'
    b'        q = conditions[0]\r\n'
    b'    else:\r\n'
    b'        q = {"$and": conditions}\r\n'
    b'\r\n'
    b'    subs = list(db.series_attempts.find(q).sort("submittedAt", -1))'
)

if old_block in content:
    new_content = content.replace(old_block, new_block, 1)
    with open(path, 'wb') as f:
        f.write(new_content)
    print("SUCCESS: list_submissions patched correctly")
else:
    print("ERROR: Could not find the target block. Showing nearby content...")
    idx = content.find(b'q = {**tenant_filter}')
    if idx >= 0:
        print(repr(content[idx:idx+200]))
    else:
        print("Could not find 'q = {**tenant_filter}' at all")

