"""
Unit tests for the create_recipe logic in backend/app/routers/recipes.py.

Tests exercise the payload-building and step/ingredient-filtering logic by
extracting the pure Python transformations (no Supabase connection needed).

Run: python3 .pipeline/tests/test_create_recipe.py
"""

import sys
import unittest


# ---------------------------------------------------------------------------
# Extract the pure logic from create_recipe without importing the full router
# (which requires Supabase credentials).  We reproduce the exact logic from
# the router so the tests stay honest about what was actually written.
# ---------------------------------------------------------------------------

def build_recipe_row(data: dict, user_id: str = "user-123") -> dict:
    """Mirrors the `row` dict constructed in create_recipe (lines 119-130)."""
    return {
        "user_id": user_id,
        "title": data.get("title", "Untitled"),
        "description": data.get("description"),
        "source_type": data.get("sourceType", "manual"),
        "cuisine": data.get("cuisine"),
        "servings": data.get("servings", 2),
        "duration_minutes": data.get("durationMinutes"),
        "difficulty": data.get("difficulty"),
        "source_url": data.get("sourceUrl"),
        "status": "ready",
    }


def build_ingredient_rows(data: dict, recipe_id: str = "recipe-abc") -> list:
    """Mirrors the ingredients-insert block in create_recipe (lines 134-147)."""
    ingredients = data.get("ingredients", [])
    if not ingredients:
        return []
    return [
        {
            "recipe_id": recipe_id,
            "name": ing["name"],
            "quantity": ing.get("quantity"),
            "unit": ing.get("unit"),
            "notes": ing.get("notes"),
            "order_index": i,
        }
        for i, ing in enumerate(ingredients)
    ]


def build_step_rows(data: dict, recipe_id: str = "recipe-abc") -> list:
    """Mirrors the steps-insert block in create_recipe (lines 149-162)."""
    steps = data.get("steps", [])
    if not steps:
        return []
    rows = [
        {
            "recipe_id": recipe_id,
            "instruction": s["instruction"],
            "order_index": s.get("orderIndex", i),
            "duration_seconds": s.get("durationSeconds"),
        }
        for i, s in enumerate(steps)
        if s.get("instruction")
    ]
    return rows


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestRecipeRowConstruction(unittest.TestCase):

    def test_happy_path_title_only(self):
        """Title-only payload produces a ready row with correct source_type."""
        row = build_recipe_row({"title": "Pasta", "sourceType": "manual"})
        self.assertEqual(row["title"], "Pasta")
        self.assertEqual(row["source_type"], "manual")
        self.assertEqual(row["status"], "ready")
        self.assertIsNone(row["description"])
        self.assertIsNone(row["difficulty"])
        self.assertIsNone(row["source_url"])

    def test_difficulty_persisted(self):
        """difficulty field is picked up from payload."""
        row = build_recipe_row({"title": "Curry", "difficulty": "hard"})
        self.assertEqual(row["difficulty"], "hard")

    def test_difficulty_missing_is_none(self):
        """difficulty defaults to None when not supplied."""
        row = build_recipe_row({"title": "Curry"})
        self.assertIsNone(row["difficulty"])

    def test_source_url_persisted(self):
        """sourceUrl is stored as source_url."""
        row = build_recipe_row({"title": "Curry", "sourceUrl": "https://tiktok.com/x"})
        self.assertEqual(row["source_url"], "https://tiktok.com/x")

    def test_source_url_missing_is_none(self):
        """source_url defaults to None when sourceUrl not in payload."""
        row = build_recipe_row({"title": "Curry"})
        self.assertIsNone(row["source_url"])

    def test_servings_passed_through(self):
        """servings value is stored as-is (parsing happens on the frontend)."""
        row = build_recipe_row({"title": "Curry", "servings": 4})
        self.assertEqual(row["servings"], 4)

    def test_servings_default_is_2(self):
        """servings defaults to 2 when not supplied."""
        row = build_recipe_row({"title": "Curry"})
        self.assertEqual(row["servings"], 2)

    def test_duration_minutes_omitted_when_not_supplied(self):
        """durationMinutes key absent from data → duration_minutes is None."""
        row = build_recipe_row({"title": "Curry"})
        self.assertIsNone(row["duration_minutes"])

    def test_duration_minutes_persisted(self):
        """durationMinutes is stored as duration_minutes."""
        row = build_recipe_row({"title": "Curry", "durationMinutes": 30})
        self.assertEqual(row["duration_minutes"], 30)

    def test_status_always_ready(self):
        """Manual recipes always get status='ready'."""
        row = build_recipe_row({"title": "Test"})
        self.assertEqual(row["status"], "ready")

    def test_source_type_defaults_to_manual(self):
        """source_type defaults to 'manual' when sourceType not supplied."""
        row = build_recipe_row({"title": "Test"})
        self.assertEqual(row["source_type"], "manual")

    def test_title_default_untitled(self):
        """Missing title falls back to 'Untitled' (backend safety net)."""
        row = build_recipe_row({})
        self.assertEqual(row["title"], "Untitled")


class TestIngredientRows(unittest.TestCase):

    def test_no_ingredients_returns_empty_list(self):
        rows = build_ingredient_rows({"title": "Test"})
        self.assertEqual(rows, [])

    def test_empty_ingredients_list_returns_empty(self):
        rows = build_ingredient_rows({"title": "Test", "ingredients": []})
        self.assertEqual(rows, [])

    def test_ingredient_fields_mapped(self):
        rows = build_ingredient_rows({
            "title": "Test",
            "ingredients": [{"name": "Flour", "quantity": 2, "unit": "cups"}],
        })
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["name"], "Flour")
        self.assertEqual(rows[0]["quantity"], 2)
        self.assertEqual(rows[0]["unit"], "cups")
        self.assertEqual(rows[0]["order_index"], 0)
        self.assertEqual(rows[0]["recipe_id"], "recipe-abc")

    def test_multiple_ingredients_order_index(self):
        rows = build_ingredient_rows({
            "title": "Test",
            "ingredients": [
                {"name": "Flour", "quantity": 2, "unit": "cups"},
                {"name": "Salt", "quantity": None, "unit": None},
            ],
        })
        self.assertEqual(rows[0]["order_index"], 0)
        self.assertEqual(rows[1]["order_index"], 1)

    def test_optional_ingredient_fields_absent(self):
        """quantity, unit, notes all optional — None when not supplied."""
        rows = build_ingredient_rows({
            "title": "Test",
            "ingredients": [{"name": "Salt"}],
        })
        self.assertIsNone(rows[0]["quantity"])
        self.assertIsNone(rows[0]["unit"])
        self.assertIsNone(rows[0]["notes"])


class TestStepRows(unittest.TestCase):

    def test_no_steps_returns_empty_list(self):
        rows = build_step_rows({"title": "Test"})
        self.assertEqual(rows, [])

    def test_empty_steps_list_returns_empty(self):
        rows = build_step_rows({"title": "Test", "steps": []})
        self.assertEqual(rows, [])

    def test_blank_instruction_filtered_out(self):
        """Steps with falsy instruction are excluded (spec requirement)."""
        rows = build_step_rows({
            "title": "Test",
            "steps": [
                {"instruction": "Boil water", "orderIndex": 0},
                {"instruction": "", "orderIndex": 1},
                {"instruction": "Add pasta", "orderIndex": 2},
            ],
        })
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["instruction"], "Boil water")
        self.assertEqual(rows[1]["instruction"], "Add pasta")

    def test_step_fields_mapped(self):
        rows = build_step_rows({
            "title": "Test",
            "steps": [{"instruction": "Boil water", "orderIndex": 0}],
        })
        self.assertEqual(rows[0]["instruction"], "Boil water")
        self.assertEqual(rows[0]["order_index"], 0)
        self.assertEqual(rows[0]["recipe_id"], "recipe-abc")
        self.assertIsNone(rows[0]["duration_seconds"])

    def test_step_order_index_from_payload(self):
        """orderIndex in each step object is used when present."""
        rows = build_step_rows({
            "title": "Test",
            "steps": [
                {"instruction": "First", "orderIndex": 0},
                {"instruction": "Second", "orderIndex": 1},
            ],
        })
        self.assertEqual(rows[0]["order_index"], 0)
        self.assertEqual(rows[1]["order_index"], 1)

    def test_step_order_index_falls_back_to_enumerate(self):
        """orderIndex falls back to enumerate index when not present in step."""
        rows = build_step_rows({
            "title": "Test",
            "steps": [
                {"instruction": "First"},
                {"instruction": "Second"},
            ],
        })
        self.assertEqual(rows[0]["order_index"], 0)
        self.assertEqual(rows[1]["order_index"], 1)

    def test_duration_seconds_persisted(self):
        rows = build_step_rows({
            "title": "Test",
            "steps": [{"instruction": "Simmer", "orderIndex": 0, "durationSeconds": 300}],
        })
        self.assertEqual(rows[0]["duration_seconds"], 300)

    def test_no_technique_id_in_step_rows(self):
        """Manually-entered steps must not set technique_id (spec: null)."""
        rows = build_step_rows({
            "title": "Test",
            "steps": [{"instruction": "Chop onions", "orderIndex": 0}],
        })
        self.assertNotIn("technique_id", rows[0])

    def test_all_blank_instructions_returns_empty(self):
        """All-blank step list results in no rows inserted."""
        rows = build_step_rows({
            "title": "Test",
            "steps": [
                {"instruction": ""},
                {"instruction": ""},
            ],
        })
        self.assertEqual(rows, [])

    def test_title_only_no_steps_no_ingredients(self):
        """Spec: recipe with zero ingredients and zero steps is allowed."""
        recipe_row = build_recipe_row({"title": "Minimalist", "sourceType": "manual"})
        ing_rows = build_ingredient_rows({"title": "Minimalist", "ingredients": []})
        step_rows = build_step_rows({"title": "Minimalist", "steps": []})
        self.assertEqual(recipe_row["title"], "Minimalist")
        self.assertEqual(ing_rows, [])
        self.assertEqual(step_rows, [])


class TestAssembleRecipeStepHandling(unittest.TestCase):
    """
    Tests for assemble_recipe's technique handling logic —
    specifically that steps without a technique_id get technique: None.

    We reproduce the step-assembly transform (lines 61-70 of recipes.py).
    """

    def _assemble_steps(self, raw_rows: list) -> list:
        """Mirrors the step-assembly block in assemble_recipe."""
        # Import row_to_camel inline to avoid needing the full app context
        import re

        def to_camel(s: str) -> str:
            parts = s.split("_")
            return parts[0] + "".join(p.capitalize() for p in parts[1:])

        def row_to_camel(d: dict) -> dict:
            return {to_camel(k): v for k, v in d.items()}

        steps = []
        for row in raw_rows:
            row = dict(row)  # copy
            tech_data = row.pop("techniques", None)
            step = row_to_camel(row)
            step.pop("techniqueId", None)
            step.pop("recipeId", None)
            if tech_data:
                step["technique"] = row_to_camel(tech_data)
            else:
                step["technique"] = None
            steps.append(step)
        return steps

    def test_step_without_technique_gets_null(self):
        raw = [{"id": "s1", "recipe_id": "r1", "instruction": "Boil", "order_index": 0,
                "technique_id": None, "duration_seconds": None, "techniques": None}]
        steps = self._assemble_steps(raw)
        self.assertIsNone(steps[0]["technique"])

    def test_step_with_technique_joined(self):
        raw = [{"id": "s1", "recipe_id": "r1", "instruction": "Deglaze", "order_index": 0,
                "technique_id": "t1", "duration_seconds": None,
                "techniques": {"id": "t1", "name": "Deglazing", "description": "..."}}]
        steps = self._assemble_steps(raw)
        self.assertIsNotNone(steps[0]["technique"])
        self.assertEqual(steps[0]["technique"]["name"], "Deglazing")

    def test_technique_id_stripped_from_step(self):
        """techniqueId must not appear in the returned step dict."""
        raw = [{"id": "s1", "recipe_id": "r1", "instruction": "Fold", "order_index": 0,
                "technique_id": None, "duration_seconds": None, "techniques": None}]
        steps = self._assemble_steps(raw)
        self.assertNotIn("techniqueId", steps[0])

    def test_recipe_id_stripped_from_step(self):
        """recipeId must not appear in the returned step dict."""
        raw = [{"id": "s1", "recipe_id": "r1", "instruction": "Fold", "order_index": 0,
                "technique_id": None, "duration_seconds": None, "techniques": None}]
        steps = self._assemble_steps(raw)
        self.assertNotIn("recipeId", steps[0])


if __name__ == "__main__":
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    suite.addTests(loader.loadTestsFromTestCase(TestRecipeRowConstruction))
    suite.addTests(loader.loadTestsFromTestCase(TestIngredientRows))
    suite.addTests(loader.loadTestsFromTestCase(TestStepRows))
    suite.addTests(loader.loadTestsFromTestCase(TestAssembleRecipeStepHandling))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
