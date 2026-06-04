# Mise 🍳

**Your AI cooking companion — capture, cook, and log.**

Mise turns the cooking videos and restaurant photos you'd never get around to making into structured, *cookable* recipes — then teaches you the technique behind each step, plans your week, and guides you hands-free at the stove.

> React Native (Expo) · FastAPI · Postgres (Supabase) · Gemini 2.5 · Llama 3.3 · OpenAI

---

## Table of contents
- [The problem & the insight](#the-problem--the-insight)
- [What Mise does](#what-mise-does)
- [How it works](#how-it-works)
- [Evaluation & evidence](#evaluation--evidence)
- [Limitations & roadmap](#limitations--roadmap)
- [AI usage, credits & disclosure](#ai-usage-credits--disclosure)
- [Quickstart](#quickstart)
- [Running the backend yourself](#running-the-backend-yourself)
- [Project structure](#project-structure)

---

## The problem & the insight

Cooking content has moved almost entirely to short-form video — but **video is a terrible format to actually cook from.** Open your "saved" folder on TikTok or Instagram and you'll find dozens of recipes you swore you'd make. Most people cook almost none of them. We call it the **recipe graveyard.**

Two bottlenecks create it:

1. **An execution gap.** You can't scan ingredients or quantities at a glance, amounts flash by in half a second, you're scrubbing back and forth with greasy hands, and there's no structure to jump around.
2. **A learning gap.** Videos show you *what* to do but never *why*. You watch someone sear a fish, but never learn it's the Maillard reaction, or why a gentle steam keeps it tender.

**The insight:** AI can close both at once — by *restructuring* video into something ordered and cookable, and by *enriching* each step with the technique behind it. The name comes from *mise en place*, the chef's principle of getting everything in its place before you cook. That's exactly what the app does.

---

## What Mise does

| Feature | What it is |
|---|---|
| 📥 **Import** | Paste a TikTok/Reels link **or** a photo of a dish → a structured recipe in seconds |
| ⭐ **Technique annotations** | An expandable chip on each step explaining the cooking *science* — the differentiator |
| 🗓 **Planner + macros** | Weekly meal planner with per-meal and weekly nutrition |
| 🛒 **Smart grocery** | Aggregated, auto-categorized shopping list |
| 🎙 **Voice cook-along** | Hands-free, step-by-step voice assistant at the stove |
| 📔 **Cook log + recap** | A sticker-based cook log and a shareable monthly recap so you remember what you've made |
| 👩‍🍳 **Chef chatbot** | Turn the ingredients you have on hand into a recipe |

---

## How it works

### Architecture

```
┌──────────────────────────────────────────────┐
│  React Native app (Expo)                       │  import · recipe · planner · cook-along
└──────────────────────────────────────────────┘
                     │  HTTPS / REST
┌──────────────────────────────────────────────┐
│  FastAPI backend  (Docker on DigitalOcean)     │  pipeline orchestration · auth · thin routers
└──────────────────────────────────────────────┘
        │              │                  │
   Supabase        AI router        ┌─────┴───────────────┐
  Postgres·Auth    (per task) ──▶   OpenRouter · DigitalOcean · OpenAI
   ·Storage
```

The backend's main job is **orchestration**: it routes each task to whichever provider fits it best, and the routers stay thin while the services hold the logic.

### The import pipeline (the core engineering)

```
paste link → yt-dlp download ─┬─ ffmpeg: audio → transcribe ─┐
                              └─ ffmpeg: keyframes ────────────┤   (scene-change pruning)
                                                               ▼
                          ┌─ Gemini 2.5 Flash (vision)  → structure ─┐   run in parallel
                          └─ Gemini 2.5 Pro (text-only) → techniques ┘
                                                               ▼
                              structured recipe → Postgres → progressive render
```

1. **Ingestion** — `yt-dlp` downloads from TikTok, Reels, or YouTube Shorts behind one interface, with a duration cap.
2. **Media extraction** — `ffmpeg` runs two concurrent branches: audio (mono 16 kHz) and keyframes. Keyframes use **scene-change detection** (keep only meaningful transitions, fall back to even sampling on low-motion clips) and are downscaled + sent at low detail — both choices cut vision-token cost. The same pass picks a cover image.
3. **Transcription** — audio is sent inline as base64 to **Gemini 2.5 Flash** via OpenRouter (OpenRouter has no Whisper-style upload endpoint, so we use the chat-audio API; Whisper is the fallback).
4. **Synthesis — the key decision** — instead of one slow model doing everything, the work is **split between two specialists**: a *fast* vision model (**Gemini 2.5 Flash**) extracts the structure — title, ingredients, quantities, steps, macros — and a *smarter* model (**Gemini 2.5 Pro**), running **text-only with no images**, writes the technique annotations. Decoupling them is both faster (the smart model never processes images and runs only on step text) and higher-quality (it spends all its attention on the culinary reasoning that's the differentiator). Responses are parsed defensively against markdown/prose wrapping.
5. **Persistence + caching** — written to Postgres in a handful of batched queries; techniques are de-duplicated and shared across recipes. The finished extraction is cached by URL so re-imports return instantly.

**Photo import** reuses the back half: **Gemini 2.5 Pro** identifies the dish from a single photo (plus an optional hint) and reconstructs a home-cooking recipe, which flows into the same technique + persistence path. Video and photo are two front doors into one pipeline.

### Cook-along — a voice agent

A hands-free **perceive → reason → act** loop:

- **Perceive** — `expo-audio` records with voice-activity detection (auto-stops on silence); the clip is transcribed.
- **Reason** — a **keyword fast-path** resolves "next / back / repeat" instantly with *no model call*; open-ended questions fall through to **Llama 3.3 70B** (DigitalOcean inference), which returns a structured intent.
- **Act** — a small tool set (`next · back · goto · timer · answer`) executes, and the response is spoken with **OpenAI TTS**. Navigation is decoupled from speech, so the step moves the instant the agent understands you.

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

Push-to-ship: every commit to `main` triggers **DigitalOcean App Platform** to rebuild the Docker image (which bakes in `ffmpeg` and `yt-dlp`) and redeploy. Supabase provides managed Postgres, auth, and storage; provider keys are injected as encrypted secrets. No manual ops.

---

## Evaluation & evidence

We validated the build through testing, empirical provider comparisons, instrumentation, and iterative failure analysis.

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

### Empirical provider evaluation
Each provider choice was validated against real API behavior, not assumptions:

| What we tested | Result | Decision |
|---|---|---|
| Transcription via OpenRouter file-upload endpoint | ❌ `400 invalid content-type` — endpoint unsupported | Send audio inline via chat-audio API |
| Transcription: Voxtral vs **Gemini 2.5 Flash** (chat-audio) | Both work; Gemini returns cleaner output (no preamble) | Gemini 2.5 Flash |
| TTS via OpenRouter `/audio/speech` (Voxtral) | ❌ `404` — not available | Route TTS to OpenAI |
| `gpt-audio` for TTS on OpenRouter | ✅ works (streaming) — viable future swap | Documented as roadmap |
| Grocery category enum (frontend 9 vs DB 8) | mismatch silently dropped items | Migration + client-side guard |

### Instrumentation
The import pipeline logs **per-stage latency** (download / media+transcribe / synthesis / total) so regressions are visible in production logs, and import jobs are tracked in a DB table with status transitions.

### Iteration & failure analysis
The commit history documents debugging real production failures end-to-end — evidence of meaningful iteration: missing `ffmpeg` on deploy (buildpack → Dockerfile), truncated audio (`moov atom not found`) traced to the recording lifecycle, an iOS audio-session record/playback race, a foreign-key cascade on recipe delete, and a TTS race causing the mic to fail on the first tap. Each was root-caused and fixed.

---

## Limitations & roadmap

**Known limitations (honest):**
- **Macros are model-estimated**, not validated against a nutrition database — a rough per-serving guess.
- **Transcription degrades** on noisy or music-heavy audio, which can reduce extraction accuracy.
- **Technique coverage varies** — the model annotates only steps with a genuine insight, so some recipes get few.
- **The extraction cache is process-local** (lost on restart, not shared across instances).
- **No automated accuracy benchmark yet** — extraction quality is currently spot-checked manually.
- **TTS runs on OpenAI**, not the sponsored OpenRouter credits, because OpenRouter has no working TTS endpoint today.

**Roadmap:**
- Real nutrition data (Edamam) replacing model-estimated macros.
- Smart grocery: merge quantities across a week, pantry tracking.
- Step-timestamped video — tap a step, jump to that moment in the clip.
- **Research direction:** fine-tune a small model on the structured recipe data Mise already generates, replacing frontier-model calls on every import to cut cost and latency.

---

## AI usage, credits & disclosure

- **AI-assisted development.** This project was built with substantial help from **Claude Code** (Anthropic) for implementation, debugging, and iteration. Architectural decisions, scoping, and product direction were author-driven; the design and the choices documented here are the author's own work.
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
