# Mise 🍳

**Your cooking companion — save it, cook it, log it.**

Mise turns the cooking videos and restaurant photos you'd never get around to making into structured recipes.

> React Native (Expo) · FastAPI · Postgres (Supabase) · Gemini 2.5 · Llama 3.3 · OpenAI

---

## Table of contents
- [The problem & the insight](#the-problem--the-insight)
- [What Mise does](#what-mise-does)
- [How it works](#how-it-works)
- [Use cases & impact](#use-cases--impact)
- [Evaluation & evidence](#evaluation--evidence)
- [Limitations & roadmap](#limitations--roadmap)
- [AI usage, credits & disclosure](#ai-usage-credits--disclosure)
- [Quickstart](#quickstart)
- [Running the backend yourself](#running-the-backend-yourself)
- [Project structure](#project-structure)

---

## The problem & the insight

Cooking content has moved almost entirely to short-form video, but **video is a terrible format to actually cook from.** The recipes are everywhere across social media, and it's difficult to view all the steps and ingredients at once. Once you starts cookign, you have to go back and forth to view the steps in the videos.

That's why I built Mise.

---

## What Mise does

*Your cooking companion — save, cook, log.*

| Feature | What it is |
|---|---|
| 📥 **Import** | TikTok/Reel link or photo → a structured recipe |
| ⭐ **Technique Pills** | Shows the cooking science behind each step — the differentiator |
| 🗓 **Planner + macros** | Plan your meals and see macros for each meal (with an aggregated grocery list) |
| 👩‍🍳 **AI Chef** | Chat with the AI to generate recipes from the ingredients you have left |
| 🎙 **Cook-along** | Hands-free mode — ask questions at each step |
| 📔 **Cook Log** | See a recap of the meals you've cooked |

---

## How it works

### Architecture
<img width="1923" height="1077" alt="Screenshot 2026-06-04 at 2 26 33 PM" src="https://github.com/user-attachments/assets/5bd7d189-2310-4d1c-b71f-7b42ef8e8317" />


The backend's main job is **orchestration**: it routes each task to whichever provider fits it best, and the routers stay thin while the services hold the logic.

### The video ingestion pipeline
<img width="1923" height="1077" alt="Screenshot 2026-06-04 at 2 26 43 PM" src="https://github.com/user-attachments/assets/3ab73317-8978-452c-ae52-469180339c2e" />

1. **Ingestion** — `yt-dlp` downloads from TikTok, Reels, or YouTube Shorts behind one interface, with a duration cap.
2. **Media extraction** — `ffmpeg` runs two concurrent branches: audio (mono 16 kHz) and keyframes. Keyframes use **scene-change detection** (keep only meaningful transitions, fall back to even sampling on low-motion clips) and are downscaled + sent at low detail — both choices cut vision-token cost. The same pass picks a cover image.
3. **Transcription** — audio is sent inline as base64 to **Gemini 2.5 Flash** via OpenRouter.
4. **Synthesis** — instead of one slow model doing everything, the work is **split between two specialists**: a *fast* vision model (**Gemini 2.5 Flash**) extracts the structure–title, ingredients, quantities, steps, macros–and a *smarter* model (**Gemini 2.5 Pro**), running **text-only with no images**, writes the technique annotations. We then combined the result and return a full, structured recipe.

**Photo import** reuses the back half: **Gemini 2.5 Pro** identifies the dish from a single photo (plus an optional hint) and reconstructs a home-cooking recipe, which flows into the same technique + persistence path.

### Cook-along

<img width="1923" height="1077" alt="Screenshot 2026-06-04 at 2 26 47 PM" src="https://github.com/user-attachments/assets/5c25593d-65e6-4aef-9888-85591c495c16" />

- **Perceive** — `expo-audio` records on-device with voice-activity detection (auto-stops on silence); the clip is uploaded and transcribed on the backend (Gemini 2.5 Flash, the same transcription path as the import pipeline).
- **Reason** — a **keyword fast-path** resolves "next / back / repeat" instantly with *no model call*; open-ended questions fall through to **Llama 3.3 70B** (DigitalOcean inference), which returns a structured intent.
- **Act** — a small tool set (`next · back · goto · timer · answer`) executes, and the response is spoken with **OpenAI TTS**.

### Models & providers

| Stage | Model | Provider |
|---|---|---|
| Transcription (speech-to-text) | Gemini 2.5 Flash (chat-audio) | OpenRouter |
| Structure extraction (fast vision) | Gemini 2.5 Flash | OpenRouter |
| Technique annotations (smart, text-only) | Gemini 2.5 Pro | OpenRouter |
| Photo → recipe (vision) | Gemini 2.5 Pro | OpenRouter |
| Voice-intent / chef chatbot (LLM) | Llama 3.3 70B | DigitalOcean |
| Cook-along voice (TTS) | GPT-4o-mini-TTS | OpenAI |

Provider routing lives in `backend/app/llm.py` and is configurable via env vars (`VISION_MODEL`, `VISION_MODEL_FAST`, `TRANSCRIBE_MODEL`, `CHAT_MODEL`) with OpenAI as the universal fallback.

### Deployment

Every commit to `main` triggers **DigitalOcean App Platform** to rebuild the Docker image (which bakes in `ffmpeg` and `yt-dlp`) and redeploy. Supabase provides managed Postgres, auth, and storage; provider keys are injected as encrypted secrets. No manual ops.

---

## Use cases & impact

For anyone who's interested in cooking:

- **Keep track of all your recipes in one place** — no more losing them across social media.
- **Learn *why* certain techniques matter** — the technique pills build real culinary skill and knowledge, not just step-following.
- **Plan and log your meals** — a weekly planner with macros, plus a cook log of what you've actually made.
- **See a recap of the meals you've cooked** — and share it with friends.

---

## Evaluation & evidence

We validated the build through testing, instrumentation, and iterative failure analysis.

### Automated tests
**110 tests** (66 backend + 44 frontend) covering the pipeline's pure logic, runnable without cloud credentials, plus a TypeScript typecheck gate on every change. They live in [`backend/tests/`](backend/tests):

| Suite | Tests | Covers |
|---|---|---|
| `test_cache.py` | 11 | TTL cache expiry, eviction, key derivation |
| `test_technique_merge.py` | 10 | Merging LLM technique output onto steps (bad indices, missing fields, dupes, junk) |
| `test_json_parse.py` | 9 | Tolerant JSON parsing (markdown fences, prose, salvage) |
| `test_keyframes.py` | 5 | Scene-change extraction + even-sampling fallback (synthetic ffmpeg clips) |
| `test_create_recipe.py` | 31 | Recipe payload building + step/ingredient filtering |
| `payload.test.mjs` | 44 | Recipe-save payload construction (frontend logic) |

```bash
for t in cache technique_merge json_parse keyframes create_recipe; do python3 backend/tests/test_$t.py; done
node backend/tests/payload.test.mjs
npm run typecheck
```

### Instrumentation
The import pipeline logs **per-stage latency** (download / media+transcribe / synthesis / total) so regressions are visible in production logs, and import jobs are tracked in a DB table with status transitions.

### Iteration & failure analysis
The commit history documents debugging real production failures end-to-end. Examples include truncated audio, recording lifecycle, TTS race conditions.

---

## Limitations & roadmap

**Known limitations (honest):**
- **Macros are model-estimated**, not validated against a nutrition database — a rough per-serving guess.
- **Transcription degrades** on noisy or music-heavy audio, which can reduce extraction accuracy.
- **Technique coverage varies** — the model annotates only steps with a genuine insight, so some recipes get few.
- **The extraction cache is process-local** (lost on restart, not shared across instances).
- **No automated accuracy benchmark yet** — extraction quality is currently spot-checked manually.
- **TTS runs on OpenAI**, not the sponsored OpenRouter credits, because OpenRouter has no working TTS endpoint today.

**Roadmap (what's next):**
- **Make it social** — add friends and share cooking progress.
- **Recipe exploration** — embed recipe search in the app, alongside importing photos and videos.
- **Fine-tune models** to remember user preferences and reduce response latency.

---

## AI usage, credits & disclosure

- **AI-assisted development.** This project was built with substantial help from **Claude Code** for implementation, debugging, and iteration. Architectural decisions, scoping, product direction, and design were my own work.
- **Foundation models, not trained models.** Mise is *applied* AI — it builds on Google **Gemini 2.5**, **Llama 3.3 70B**, and **OpenAI** models via API. No model was trained or fine-tuned (see roadmap for the fine-tuning direction).
- **Tooling & libraries:** Expo / React Native, FastAPI, Supabase, Zustand, `@shopify/flash-list`, `yt-dlp`, `ffmpeg`, OpenRouter, DigitalOcean serverless inference.
- **Repository:** public, with full commit history reflecting development over time.

---

## Quickstart

The backend (and all its API keys) is hosted on **DigitalOcean App Platform**, so you only run the frontend — no Python, database, or keys to set up. The whole app runs in **Expo Go** (no custom native modules).

```bash
npm install --legacy-peer-deps
cp .env.example .env          # already points at the hosted backend — no edits needed
npx expo start -c             # -c matters: EXPO_PUBLIC_* is baked in at bundler start
```

Scan the QR with **Expo Go** (or press `i` for iOS sim, `a` for Android). Verify the backend with `https://mise-eni44.ondigitalocean.app/health` → `{"status":"ok"}`.

**Useful commands**
```bash
npm run start | ios | android   # expo start / simulators
npm run typecheck               # tsc --noEmit
npm run lint                    # eslint
```

---

## Running the backend yourself

> Only needed if you're changing the backend.

**Backend env** — copy `backend/.env.example` to `backend/.env`:
```
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
SUPABASE_JWT_SECRET=<jwt-secret>
OPENAI_API_KEY=sk-...            # universal fallback
DO_INFERENCE_API_KEY=...         # optional — routes chat to DigitalOcean
OPENROUTER_API_KEY=sk-or-...     # optional — routes vision + transcription to OpenRouter
```
`SUPABASE_URL` must match `EXPO_PUBLIC_SUPABASE_URL` in the frontend, or the two sides authenticate as different users.

**Database** — in Supabase → SQL Editor, run the migrations in order:
```
supabase_migration.sql                       (base schema)
supabase_migration_collections.sql
supabase_migration_cook_log.sql
supabase_migration_profiles.sql
supabase_migration_chef_history.sql
supabase_migration_recipe_cascade.sql        (ON DELETE CASCADE for recipe children)
supabase_migration_grocery_categories.sql    (adds 'spices' + 'drinks' to the grocery enum)
```
Then open Supabase **API Docs** once to refresh PostgREST's schema cache.

**Run locally**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Point the app at it via `EXPO_PUBLIC_API_URL=http://<LAN_IP>:8000` (or use `npm run start:local` to auto-detect), then restart Expo with `-c`. Use your Mac's LAN IP, **not** `localhost`.

**Deploy** — the backend ships a `Dockerfile` (adds `ffmpeg`/`yt-dlp` and the image libs `rembg` needs). Create a DigitalOcean App from the repo with **source directory `backend`**; it builds from `backend/Dockerfile` on port `8080` and auto-deploys on push to `main`. Health check: `GET /health`.

---

## Project structure

```
app/             # expo-router screens — (tabs)/, recipe/[id].tsx, cook-along/, recap/, cook-log/
components/      # ui/ primitives, home/, recipe/, cook-log/, chef/
constants/       # colors, typography, spacing — single source of truth
hooks/  lib/  services/  store/  types/   # fonts/voice · supabase · API clients · Zustand · TS types
backend/app/     # FastAPI — routers/ (import, recipes, planner, voice, chef, recap), services/, llm.py
backend/Dockerfile  backend/*.sql           # App Platform build · Supabase migrations
backend/tests/   # unit tests — python3 backend/tests/test_*.py
```

See `CLAUDE.md` for the full feature spec and `DESIGN_SYSTEM.md` for the visual system.
