"""
Unit tests for loads_json_object in backend/app/services/recipe_builder.py —
the tolerant JSON-object parser that stands in for strict structured outputs.

Run: python3 .pipeline/tests/test_json_parse.py
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.recipe_builder import loads_json_object  # noqa: E402


class LoadsJsonObjectTest(unittest.TestCase):
    def test_plain_object(self):
        self.assertEqual(loads_json_object('{"a": 1}'), {"a": 1})

    def test_whitespace_padding(self):
        self.assertEqual(loads_json_object('  \n {"a": 1}\n '), {"a": 1})

    def test_json_fence(self):
        self.assertEqual(loads_json_object('```json\n{"a": 1}\n```'), {"a": 1})

    def test_bare_fence(self):
        self.assertEqual(loads_json_object('```\n{"a": 1}\n```'), {"a": 1})

    def test_leading_and_trailing_prose(self):
        raw = 'Sure! Here is the recipe:\n{"a": 1, "b": [2,3]}\nHope that helps.'
        self.assertEqual(loads_json_object(raw), {"a": 1, "b": [2, 3]})

    def test_nested_braces_salvage(self):
        raw = 'prefix {"a": {"b": 1}} suffix'
        self.assertEqual(loads_json_object(raw), {"a": {"b": 1}})

    def test_empty_raises(self):
        with self.assertRaises(ValueError):
            loads_json_object("")
        with self.assertRaises(ValueError):
            loads_json_object("   ")

    def test_none_raises(self):
        with self.assertRaises(ValueError):
            loads_json_object(None)

    def test_unrecoverable_raises(self):
        with self.assertRaises(Exception):
            loads_json_object("not json at all, no braces here")


if __name__ == "__main__":
    unittest.main(verbosity=2)
