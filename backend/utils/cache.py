"""
backend/utils/cache.py
──────────────────────
Lightweight, thread-safe in-memory caching utility.
Drastically reduces database query pressure during concurrent exam sessions.
"""

import time
import threading
from typing import Any, Optional, Dict, Tuple

class SimpleTTLCache:
    def __init__(self, default_ttl_seconds: int = 20, max_entries: int = 5000):
        self._cache: Dict[str, Tuple[Any, float]] = {}
        self._lock = threading.Lock()
        self._default_ttl = default_ttl_seconds
        self._max_entries = max_entries

    def get(self, key: str) -> Optional[Any]:
        if not key:
            return None
        now = time.time()
        with self._lock:
            entry = self._cache.get(key)
            if not entry:
                return None
            val, expiry = entry
            if now > expiry:
                del self._cache[key]
                return None
            return val

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        if not key:
            return
        ttl = ttl_seconds if ttl_seconds is not None else self._default_ttl
        expiry = time.time() + ttl
        with self._lock:
            # Prevent uncontrolled memory growth
            if len(self._cache) >= self._max_entries:
                # Evict expired entries first
                now = time.time()
                keys_to_remove = [k for k, (_, exp) in self._cache.items() if now > exp]
                for k in keys_to_remove:
                    del self._cache[k]
                # If still full, pop first 10% items
                if len(self._cache) >= self._max_entries:
                    pop_count = max(1, self._max_entries // 10)
                    for k in list(self._cache.keys())[:pop_count]:
                        del self._cache[k]
            self._cache[key] = (value, expiry)

    def invalidate(self, key: Optional[str] = None) -> None:
        with self._lock:
            if key is None:
                self._cache.clear()
            elif key in self._cache:
                del self._cache[key]


# Global user status cache (15-second TTL)
user_status_cache = SimpleTTLCache(default_ttl_seconds=15, max_entries=10000)

def get_cached_user_status(user_id: str) -> Optional[Dict[str, Any]]:
    return user_status_cache.get(f"user_status:{user_id}")

def set_cached_user_status(user_id: str, status_dict: Dict[str, Any], ttl_seconds: int = 15) -> None:
    user_status_cache.set(f"user_status:{user_id}", status_dict, ttl_seconds=ttl_seconds)

def invalidate_user_cache(user_id: Optional[str] = None) -> None:
    if user_id:
        user_status_cache.invalidate(f"user_status:{user_id}")
    else:
        user_status_cache.invalidate(None)
