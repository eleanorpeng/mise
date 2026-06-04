"""
Unit tests for the import caching layer.

Covers app/services/cache.py (TTLCache) directly — it is dependency-light
(threading + time only), so we import it for real. The video_pipeline cache-key
helper is reproduced here rather than imported, since importing video_pipeline
pulls in OpenAI/Supabase settings (same approach as test_create_recipe.py).

Run: python3 .pipeline/tests/test_cache.py
"""

import os
import sys
import unittest

# Make `app` importable.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import app.services.cache as cache_mod  # noqa: E402
from app.services.cache import TTLCache  # noqa: E402


class FakeClock:
    """A monotonic-style clock we can advance by hand."""

    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t

    def advance(self, seconds):
        self.t += seconds


# ---------------------------------------------------------------------------
# Reproduce video_pipeline._cache_key (kept in sync with the real one).
# ---------------------------------------------------------------------------

def cache_key(url: str, fast: bool) -> str:
    return f"{'fast' if fast else 'full'}:{url.strip()}"


class TTLCacheTest(unittest.TestCase):
    def setUp(self):
        # Swap in a controllable clock for every test.
        self.clock = FakeClock()
        self._real_now = cache_mod._now
        cache_mod._now = self.clock

    def tearDown(self):
        cache_mod._now = self._real_now

    def test_set_then_get_returns_value(self):
        c = TTLCache(ttl_seconds=100)
        c.set("k", "v")
        self.assertEqual(c.get("k"), "v")

    def test_missing_key_returns_none(self):
        c = TTLCache(ttl_seconds=100)
        self.assertIsNone(c.get("nope"))

    def test_entry_expires_after_ttl(self):
        c = TTLCache(ttl_seconds=100)
        c.set("k", "v")
        self.clock.advance(99)
        self.assertEqual(c.get("k"), "v")  # still alive at t+99
        self.clock.advance(2)              # now t+101 > ttl
        self.assertIsNone(c.get("k"))

    def test_expiry_is_inclusive_at_boundary(self):
        c = TTLCache(ttl_seconds=100)
        c.set("k", "v")
        self.clock.advance(100)  # exactly at expiry → treated as expired
        self.assertIsNone(c.get("k"))

    def test_per_call_ttl_override(self):
        c = TTLCache(ttl_seconds=10)
        c.set("k", "v", ttl_seconds=1000)
        self.clock.advance(500)
        self.assertEqual(c.get("k"), "v")

    def test_clear_empties_cache(self):
        c = TTLCache(ttl_seconds=100)
        c.set("a", "1")
        c.set("b", "2")
        c.clear()
        self.assertIsNone(c.get("a"))
        self.assertIsNone(c.get("b"))

    def test_eviction_when_full_drops_soonest_to_expire(self):
        c = TTLCache(ttl_seconds=100, max_entries=2)
        c.set("a", "1")          # expires at t+100
        self.clock.advance(10)
        c.set("b", "2")          # expires at t+110
        # Cache is full (2 entries). Inserting a 3rd evicts the soonest-to-expire (a).
        c.set("c", "3")          # expires at t+110
        self.assertIsNone(c.get("a"))
        self.assertEqual(c.get("b"), "2")
        self.assertEqual(c.get("c"), "3")

    def test_overwriting_existing_key_when_full_does_not_evict(self):
        c = TTLCache(ttl_seconds=100, max_entries=2)
        c.set("a", "1")
        c.set("b", "2")
        c.set("a", "1b")  # key already present → no eviction
        self.assertEqual(c.get("a"), "1b")
        self.assertEqual(c.get("b"), "2")


class CacheKeyTest(unittest.TestCase):
    def test_fast_and_full_keys_differ(self):
        self.assertNotEqual(cache_key("http://x", True), cache_key("http://x", False))

    def test_whitespace_is_normalised(self):
        self.assertEqual(cache_key("  http://x  ", False), cache_key("http://x", False))

    def test_distinct_urls_distinct_keys(self):
        self.assertNotEqual(cache_key("http://a", False), cache_key("http://b", False))


if __name__ == "__main__":
    unittest.main(verbosity=2)
