"""Tiny in-process TTL cache.

Used to short-circuit repeat work in the import pipeline — re-importing the same
video URL (every demo, every test run) should not re-download, re-transcribe, and
re-synthesise from scratch.

This is intentionally minimal: a process-local dict with per-entry expiry. It is
NOT shared across workers/replicas and is lost on restart. For the milestone that
is fine; a persistent store (Redis / Supabase table) is the obvious upgrade.
"""

from __future__ import annotations

import threading
import time
from typing import Generic, TypeVar

T = TypeVar("T")

# Monotonic clock so the cache is immune to wall-clock adjustments. We read it
# through a module-level indirection (rather than time.monotonic() inline) only
# so tests can substitute a fake clock.
_now = time.monotonic


class TTLCache(Generic[T]):
    """Thread-safe string-keyed cache with a per-instance default TTL."""

    def __init__(self, ttl_seconds: float = 3600.0, max_entries: int = 256):
        self._ttl = ttl_seconds
        self._max = max_entries
        self._store: dict[str, tuple[float, T]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> T | None:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if _now() >= expires_at:
                self._store.pop(key, None)
                return None
            return value

    def set(self, key: str, value: T, ttl_seconds: float | None = None) -> None:
        ttl = self._ttl if ttl_seconds is None else ttl_seconds
        with self._lock:
            # Cheap eviction: when full, drop the soonest-to-expire entry. Good
            # enough for a small cache; avoids unbounded growth.
            if len(self._store) >= self._max and key not in self._store:
                oldest = min(self._store, key=lambda k: self._store[k][0])
                self._store.pop(oldest, None)
            self._store[key] = (_now() + ttl, value)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
