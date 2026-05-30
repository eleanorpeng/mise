# Mise

A React Native (Expo) cooking app with a FastAPI backend. Imports TikTok/Reels videos and restaurant photos into structured recipes, plus an AI chef chatbot that turns the ingredients you have on hand into a recipe, a meal planner, voice cook-along, a sticker-based cook log, and a shareable monthly recap.

See `CLAUDE.md` for the full feature spec and `DESIGN_SYSTEM.md` for the visual system.

---

## TL;DR

```bash
npm install --legacy-peer-deps
cp .env.example .env
npx expo start -c
```

Then scan the QR with Expo Go.

---

## Quickstart

The backend (and all its API keys) is hosted on **DigitalOcean App Platform**, so you only run the frontend. No Python, database, or API keys to set up.

The whole app runs in **Expo Go** — there are no custom native modules, so no development build is required.

1. Install frontend deps:
   ```bash
   npm install --legacy-peer-deps
   ```
2. Copy the prefilled env file (already points at the hosted backend — no edits needed):
   ```bash
   cp .env.example .env
   ```
3. Start Expo:
   ```bash
   npx expo start -c
   ```
   The `-c` matters — `EXPO_PUBLIC_*` values are baked in at bundler start, so `.env` changes only take effect on a fresh start, not hot reload.
4. Scan the QR with **Expo Go** (or press `i` for iOS sim, `a` for Android emulator).

That's it. To verify the backend is reachable, open `https://mise-eni44.ondigitalocean.app/health` in a browser — it should return `{"status":"ok"}`.

---

## AI providers

The backend routes each AI task to a provider via a small client factory (`backend/app/llm.py`), falling back to OpenAI whenever the optional keys are absent:

| Task | Provider when key set | Fallback |
|---|---|---|
| Text chat — chef chatbot + voice intent | DigitalOcean serverless inference (`DO_INFERENCE_API_KEY`, `CHAT_MODEL`, default `llama3.3-70b-instruct`) | OpenAI |
| Vision — photo + video recipe import | OpenRouter (`OPENROUTER_API_KEY`, `VISION_MODEL`, default `google/gemini-2.5-pro`) | OpenAI `gpt-4o` |
| Transcription — video import + voice cook-along | Mistral Voxtral Mini Transcribe via OpenRouter (`OPENROUTER_API_KEY`, `TRANSCRIBE_MODEL`, default `mistralai/voxtral-mini-transcribe`) | OpenAI Whisper `whisper-1` |
| Text-to-speech — voice cook-along | Mistral Voxtral Mini TTS via OpenRouter (`OPENROUTER_API_KEY`, `VOXTRAL_TTS_MODEL`, default `mistralai/voxtral-mini-tts-2603`) | OpenAI TTS |

So with only `OPENAI_API_KEY` set, everything works on OpenAI. Setting `DO_INFERENCE_API_KEY` routes text chat to DigitalOcean; setting `OPENROUTER_API_KEY` routes vision, transcription, and TTS to OpenRouter — all without code changes. Optional model overrides: `CHAT_MODEL`, `VISION_MODEL`, `VISION_MODEL_FAST`, `TRANSCRIBE_MODEL`, `VOXTRAL_TTS_MODEL`.

---

## Running or deploying the backend yourself

> Only needed if you're changing the backend. Running the app against the hosted backend (Quickstart) needs none of this.

### Backend env (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and fill in:

```
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
SUPABASE_JWT_SECRET=<jwt-secret-from-supabase-settings>
OPENAI_API_KEY=sk-...            # fallback for chat / vision / transcription / TTS
EDAMAM_APP_ID=...
EDAMAM_APP_KEY=...
DO_INFERENCE_API_KEY=...         # optional — routes text chat to DigitalOcean credits
OPENROUTER_API_KEY=sk-or-...     # optional — routes vision, transcription + TTS to OpenRouter
```

`SUPABASE_URL` must match `EXPO_PUBLIC_SUPABASE_URL` in the frontend, or the two sides authenticate as different users. Only `OPENAI_API_KEY` is required for AI features — the rest are optional (see **AI providers**).

### Database

In Supabase Dashboard → SQL Editor, run each migration in order:

1. `backend/supabase_migration.sql` (base schema)
2. `backend/supabase_migration_collections.sql`
3. `backend/supabase_migration_cook_log.sql`
4. `backend/supabase_migration_profiles.sql` (onboarding + the chef's preference memory)

Then open Supabase **API Docs** once — that forces PostgREST to refresh its schema cache.

### Run locally

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Point the app at it by setting `EXPO_PUBLIC_API_URL` to your Mac's LAN IP (`http://<LAN_IP>:8000`, find it with `ipconfig getifaddr en0`) — **not** `localhost`, which resolves to the phone, not your Mac. Restart Expo with `npx expo start -c` after changing `.env`. Both flags matter: `--host 0.0.0.0` so your phone can reach uvicorn, and `-c` so `.env` changes get picked up.

### Deploy (DigitalOcean App Platform)

The backend includes a `Dockerfile` (adds `ffmpeg` for video import and the image libs `rembg` needs for sticker cut-outs).

1. Push to GitHub, then create an App on **DigitalOcean App Platform** from the repo with **source directory `backend`** — it builds from `backend/Dockerfile` and serves on port `8080`.
2. Add the `backend/.env` variables in the App Platform console (Settings → Environment Variables).
3. Set the frontend `EXPO_PUBLIC_API_URL` to the deployed URL (no trailing slash) and restart Expo with `npx expo start -c`.

Health check: `GET /health` → `{"status":"ok"}`. The bare URL returning `{"detail":"Not Found"}` is expected — there's no root route, only `/health` and the prefixed routers.

---

## Useful commands

```bash
npm run start         # expo start
npm run ios           # iOS simulator
npm run android       # Android emulator
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
```

---

## Project structure

```
app/             # expo-router screens — (tabs)/, recipe/[id].tsx, cook-along/, recap/, cook-log/
components/      # ui/ primitives, home/, recipe/, cook-log/, chef/ (ChefChat)
constants/       # colors, typography, spacing — single source of truth
hooks/           # useFonts, useGreeting, useVoice
lib/             # supabase client (with RN AppState wiring)
services/        # API calls (api.ts base, recipes, planner, cookLog, chef, recap, voice)
store/           # Zustand stores
types/           # shared TS interfaces
backend/app/     # FastAPI — routers/ (incl. chef, recap, voice), services/, llm.py, schemas, auth
backend/Dockerfile  # App Platform build (ffmpeg + rembg deps)
backend/*.sql    # Supabase migrations
```

The chef chatbot lives in the **Recipe tab** behind a *Cookbooks ⇄ Chef* toggle (not a separate tab). Voice cook-along records with `expo-audio` and transcribes via the backend `/voice/cook-along` Whisper endpoint, so the whole app runs in **Expo Go** — no custom native modules or dev build required.
