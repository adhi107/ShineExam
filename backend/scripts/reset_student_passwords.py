import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from config.db import get_db

def reset_all_student_passwords(new_password="12345"):
    db = get_db()
    result = db.users.update_many(
        {"role": "answerer"},
        {
            "$set": {
                "password": str(new_password),
                "passwordUpdatedAt": datetime.utcnow()
            }
        }
    )
    print(f"Matched students: {result.matched_count}")
    print(f"Modified students: {result.modified_count}")
    print(f"All student passwords have been successfully set to: {new_password}")

if __name__ == "__main__":
    reset_all_student_passwords()
