"""
Unit tests for the technique-enrichment merge logic in
backend/app/services/recipe_builder.py (Stage C of the split pipeline).

merge_techniques is a pure function (no network), so we import and exercise it
directly. It must be robust to a messy LLM payload: out-of-range indices,
missing fields, bad categories, duplicates, non-dict junk.

Run: python3 .pipeline/tests/test_technique_merge.py
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.schemas import ExtractedIngredient, ExtractedStep, RecipeExtraction  # noqa: E402
from app.services.recipe_builder import merge_techniques  # noqa: E402


def make_extraction(n_steps: int = 3) -> RecipeExtraction:
    return RecipeExtraction(
        title="Test Dish",
        servings=2,
        ingredients=[ExtractedIngredient(name="egg", quantity=2.0)],
        steps=[
            ExtractedStep(instruction=f"step {i}", duration_seconds=None)
            for i in range(n_steps)
        ],
    )


class MergeTechniquesTest(unittest.TestCase):
    def test_happy_path_annotates_named_step(self):
        ext = make_extraction(3)
        payload = {
            "techniques": [
                {
                    "step_index": 1,
                    "name": "Maillard reaction",
                    "explanation": "Browning develops flavor.",
                    "category": "heat",
                }
            ]
        }
        out = merge_techniques(ext, payload)
        self.assertIsNone(out.steps[0].technique)
        self.assertIsNotNone(out.steps[1].technique)
        self.assertEqual(out.steps[1].technique.name, "Maillard reaction")
        self.assertEqual(out.steps[1].technique.category, "heat")
        self.assertIsNone(out.steps[2].technique)

    def test_input_not_mutated(self):
        ext = make_extraction(2)
        merge_techniques(ext, {"techniques": [
            {"step_index": 0, "name": "x", "explanation": "y", "category": "heat"}
        ]})
        # Original extraction's steps remain un-annotated.
        self.assertIsNone(ext.steps[0].technique)

    def test_out_of_range_index_ignored(self):
        ext = make_extraction(2)
        out = merge_techniques(ext, {"techniques": [
            {"step_index": 5, "name": "x", "explanation": "y", "category": "heat"},
            {"step_index": -1, "name": "x", "explanation": "y", "category": "heat"},
        ]})
        self.assertTrue(all(s.technique is None for s in out.steps))

    def test_missing_fields_ignored(self):
        ext = make_extraction(2)
        out = merge_techniques(ext, {"techniques": [
            {"step_index": 0, "name": "x"},                       # no explanation
            {"step_index": 1, "explanation": "y", "name": ""},    # empty name
        ]})
        self.assertTrue(all(s.technique is None for s in out.steps))

    def test_bad_category_falls_back_to_general(self):
        ext = make_extraction(1)
        out = merge_techniques(ext, {"techniques": [
            {"step_index": 0, "name": "x", "explanation": "y", "category": "wizardry"}
        ]})
        self.assertEqual(out.steps[0].technique.category, "general")

    def test_missing_category_falls_back_to_general(self):
        ext = make_extraction(1)
        out = merge_techniques(ext, {"techniques": [
            {"step_index": 0, "name": "x", "explanation": "y"}
        ]})
        self.assertEqual(out.steps[0].technique.category, "general")

    def test_duplicate_index_last_wins(self):
        ext = make_extraction(1)
        out = merge_techniques(ext, {"techniques": [
            {"step_index": 0, "name": "first", "explanation": "y", "category": "heat"},
            {"step_index": 0, "name": "second", "explanation": "z", "category": "sauce"},
        ]})
        self.assertEqual(out.steps[0].technique.name, "second")

    def test_non_dict_items_skipped(self):
        ext = make_extraction(1)
        out = merge_techniques(ext, {"techniques": ["junk", 42, None]})
        self.assertIsNone(out.steps[0].technique)

    def test_empty_or_missing_payload(self):
        ext = make_extraction(2)
        self.assertTrue(all(s.technique is None for s in merge_techniques(ext, {}).steps))
        self.assertTrue(all(s.technique is None for s in merge_techniques(ext, {"techniques": []}).steps))

    def test_non_int_index_skipped(self):
        ext = make_extraction(2)
        out = merge_techniques(ext, {"techniques": [
            {"step_index": "1", "name": "x", "explanation": "y", "category": "heat"}
        ]})
        self.assertTrue(all(s.technique is None for s in out.steps))


if __name__ == "__main__":
    unittest.main(verbosity=2)
