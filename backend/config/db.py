from pymongo import MongoClient, ASCENDING, DESCENDING
from .settings import settings
import threading

_client = None
_db = None
_indexes_initialized = False
_index_lock = threading.Lock()

def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(
            settings.MONGO_URI,
            serverSelectionTimeoutMS=3000,
            maxPoolSize=50,
            minPoolSize=5,
            maxIdleTimeMS=45000,
            socketTimeoutMS=20000,
            connect=False,
            retryWrites=True,
        )
    return _client

def ensure_indexes(db) -> None:
    """Create essential MongoDB indexes in the background to ensure blazing-fast queries and prevent server load."""
    global _indexes_initialized
    if _indexes_initialized:
        return
    with _index_lock:
        if _indexes_initialized:
            return
        try:
            # Users collection
            db.users.create_index([("userId", ASCENDING)], background=True)
            db.users.create_index([("naxUnid", ASCENDING)], background=True)
            db.users.create_index([("role", ASCENDING), ("isActive", ASCENDING)], background=True)
            db.users.create_index([("tenantId", ASCENDING)], background=True)

            # Exams collection
            db.exams.create_index([("status", ASCENDING)], background=True)
            db.exams.create_index([("tenantId", ASCENDING)], background=True)

            # Results & Attempts collection
            db.results.create_index([("userId", ASCENDING), ("examId", ASCENDING)], background=True)
            db.results.create_index([("submittedAt", DESCENDING)], background=True)
            db.attempts.create_index([("userId", ASCENDING), ("examId", ASCENDING)], background=True)

            # Violations & Audit collection
            db.violations.create_index([("userId", ASCENDING)], background=True)
            db.audit_logs.create_index([("userId", ASCENDING)], background=True)
            db.audit_logs.create_index([("timestamp", DESCENDING)], background=True)

            # Security sessions
            db.security_sessions.create_index([("sessionId", ASCENDING)], background=True)
            db.security_sessions.create_index([("userId", ASCENDING)], background=True)

            _indexes_initialized = True
        except Exception:
            # Non-blocking if running offline or read-only replica
            pass

def get_db():
    global _db
    if _db is None:
        _db = get_client()[settings.DB_NAME]
        ensure_indexes(_db)
    return _db

