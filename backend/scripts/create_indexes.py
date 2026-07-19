from config.db import get_db


def main():
    db = get_db()

    # Candidate and admin account lookup indexes.
    db.users.create_index("userId", unique=True)
    db.users.create_index("role")

    # Test publishing and question retrieval indexes.
    db.exams.create_index("status")
    db.questions.create_index("examId")

    # Candidate-to-test assignment indexes.
    db.exam_assignments.create_index([("examId", 1), ("userId", 1)], unique=True)
    db.exam_assignments.create_index("userId")

    # Test attempt and result reporting indexes.
    db.attempts.create_index([("examId", 1), ("userId", 1), ("status", 1)])
    db.results.create_index("attemptId", unique=True)
    db.results.create_index("userId")

    print("Indexes created/ensured.")


if __name__ == "__main__":
    main()
