# Tests

Unit tests for the recipe pipeline's pure logic — no cloud credentials or running
server required. Each Python test reproduces or imports the dependency-light
backend logic and runs with the standard library; the `.mjs` test runs on plain
Node.

```bash
# backend (run from repo root)
for t in cache technique_merge json_parse keyframes create_recipe; do
  python3 backend/tests/test_$t.py
done

# frontend logic
node backend/tests/payload.test.mjs
```

| File | Tests | Covers |
|---|---|---|
| `test_cache.py` | 11 | TTL cache — expiry, eviction, key derivation |
| `test_technique_merge.py` | 10 | Merging LLM technique output onto steps (robust to malformed payloads) |
| `test_json_parse.py` | 9 | Tolerant JSON parsing (markdown fences, prose, salvage) |
| `test_keyframes.py` | 5 | Scene-change keyframe extraction + even-sampling fallback (requires `ffmpeg`) |
| `test_create_recipe.py` | 31 | Recipe payload building + step/ingredient filtering |
| `payload.test.mjs` | 44 | Recipe-save payload construction (frontend logic) |

`test_keyframes.py` synthesizes its own video clips with ffmpeg, so it's skipped
automatically if ffmpeg isn't installed.
