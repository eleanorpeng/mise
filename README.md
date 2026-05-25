# Mise

A React Native (Expo) cooking app with a FastAPI backend. Imports TikTok/Reels videos and restaurant photos into structured recipes, plus an AI chef chatbot that turns the ingredients you have on hand into a recipe, a meal planner, voice cook-along, a sticker-based cook log, and a shareable monthly recap.

See `CLAUDE.md` for the full feature spec and `DESIGN_SYSTEM.md` for the visual system.

---

## Quickstart

The backend is deployed on **DigitalOcean App Platform**, so there are two ways to run the app:

- **Option A — Frontend only, against the hosted backend.** Fastest path. No Python, database, or backend API keys needed. Best for working on the app itself.
- **Option B — Full local stack.** Run the FastAPI backend yourself. Needed for backend changes.

The whole app runs in **Expo Go** — there are no custom native modules, so no development build is required either way.

### Option A — Frontend against the hosted backend

1. Install frontend deps: `npm install --legacy-peer-deps`
2. In the repo-root `.env`, point at the deployed backend:
   ```
   EXPO_PUBLIC_API_URL=https://<deployment>.ondigitalocean.app
   EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-or-publishable-key>
   ```
   (No trailing slash on the API URL.)
3. `npx expo start -c`
4. Scan the QR with **Expo Go** (or press `i` for iOS sim, `a` for Android emulator).

### Option B — Full local stack

Run the backend and Expo in **two terminals at the same time**:

**Terminal 1 — Backend**

```bash
cd backend
source .venv/bin/activate              # create with: python -m venv .venv
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — Frontend**

```bash
npx expo start -c
```

For this path, set `EXPO_PUBLIC_API_URL` to your Mac's LAN IP (`http://<LAN_IP>:8000`) — **not** `localhost` — so your phone can reach the backend (see First-time setup).

> ⚠️ The two flags that catch people out: `--host 0.0.0.0` on uvicorn (so your phone can reach it) and `-c` on `expo start` (so `.env` changes get picked up). Skip either and things break in confusing ways.

---

## First-time setup

Steps 1–2 apply to everyone. **Steps 3–4 (backend env + database) are only needed for Option B** (running the backend locally) — skip them if you're using the hosted backend.

### 1. Install dependencies

```bash
# repo root — frontend (everyone)
npm install --legacy-peer-deps

# backend (Option B only)
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Frontend `.env`

Copy `.env.example` to `.env` at the repo root and fill in:

```
EXPO_PUBLIC_API_URL=http://<YOUR_MAC_LAN_IP>:8000
EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-or-publishable-key>
```

Find your Mac's LAN IP with:

```bash
ipconfig getifaddr en0
```

> Do **not** use `http://localhost:8000`. Your phone runs the JS bundle locally — `localhost` resolves to the *phone*, not your Mac.

### 3. Backend `backend/.env` *(Option B only)*

Copy `backend/.env.example` to `backend/.env` and fill in:

```
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
SUPABASE_JWT_SECRET=<jwt-secret-from-supabase-settings>
OPENAI_API_KEY=sk-...            # Whisper, plus fallback for chat/vision/TTS
EDAMAM_APP_ID=...
EDAMAM_APP_KEY=...
ELEVENLABS_API_KEY=...           # voice cook-along text-to-speech
DO_INFERENCE_API_KEY=...         # optional — routes text chat to DigitalOcean credits
OPENROUTER_API_KEY=sk-or-...     # optional — routes vision (photo/video import) to OpenRouter
```

`SUPABASE_URL` here must match `EXPO_PUBLIC_SUPABASE_URL` in the frontend — otherwise you'll be authenticated as different users on each side.

Only `OPENAI_API_KEY` is required for AI features to work — the other AI keys are optional and just shift specific workloads onto other providers (see **AI providers** below).

### 4. Database *(Option B only)*

In Supabase Dashboard → SQL Editor, run each migration in order:

1. `backend/supabase_migration.sql` (base schema)
2. `backend/supabase_migration_collections.sql`
3. `backend/supabase_migration_cook_log.sql`
4. `backend/supabase_migration_profiles.sql` (needed for onboarding + the chef's preference memory)

After running migrations, open Supabase **API Docs** in the dashboard once — that forces PostgREST to refresh its schema cache.

---

## AI providers

The backend routes each AI task to a provider via a small client factory (`backend/app/llm.py`), falling back to OpenAI whenever the optional keys are absent:

| Task | Provider when key set | Fallback |
|---|---|---|
| Text chat — chef chatbot + voice intent | DigitalOcean serverless inference (`DO_INFERENCE_API_KEY`, `CHAT_MODEL`, default `llama3.3-70b-instruct`) | OpenAI |
| Vision — photo + video recipe import | OpenRouter (`OPENROUTER_API_KEY`, `VISION_MODEL`, default `google/gemini-2.5-pro`) | OpenAI `gpt-4o` |
| Whisper transcription | OpenAI | — |
| Text-to-speech — voice cook-along | ElevenLabs (`ELEVENLABS_API_KEY`) | OpenAI TTS |

So with only `OPENAI_API_KEY` set, everything works on OpenAI (TTS aside, which needs `ELEVENLABS_API_KEY`). Setting `DO_INFERENCE_API_KEY` / `OPENROUTER_API_KEY` simply moves those workloads onto sponsored/credit pools without code changes. Optional model overrides: `CHAT_MODEL`, `VISION_MODEL`, `VISION_MODEL_FAST`.

---

## Deploying the backend (DigitalOcean App Platform)

The backend includes a `Dockerfile` (adds `ffmpeg` for video import and the image libs `rembg` needs for sticker cut-outs).

1. Push to GitHub, then create an App on **DigitalOcean App Platform** from the repo with **source directory `backend`** — it builds from `backend/Dockerfile` and serves on port `8080`.
2. Add the same variables from `backend/.env` in the App Platform console (Settings → Environment Variables).
3. Point the app at it: set `EXPO_PUBLIC_API_URL` to the deployed URL (e.g. `https://<app>.ondigitalocean.app`, no trailing slash) and restart Expo with `npx expo start -c`.

Health check: `GET /health` → `{"status":"ok"}`. The bare URL returning `{"detail":"Not Found"}` is expected — there's no root route, only `/health` and the prefixed routers.

---

## Verifying the connection

Before opening the app, confirm everything is wired up:

```bash
# from your Mac
curl http://localhost:8000/health
```

Then on your **phone's browser**, open:

```
http://<YOUR_MAC_LAN_IP>:8000/docs
```

If FastAPI's Swagger page loads on your phone, the app will be able to reach the backend too.

---

## Common issues

### "Network request failed"

In order of likelihood:
1. `.env` still says `localhost`. Use your LAN IP.
2. Forgot `-c` after editing `.env`. Stop Metro, run `npx expo start -c`. `EXPO_PUBLIC_*` values are baked in at bundler start, not on hot reload.
3. Backend started without `--host 0.0.0.0`.
4. Phone and Mac are on different Wi-Fi (or the network has client isolation).
5. macOS firewall is blocking inbound. System Settings → Network → Firewall.

### 401 Unauthorized on `/recipes/`

Backend returned `307 → /recipes/` and the HTTP client dropped the `Authorization` header on the redirect. Make sure all API calls include the trailing slash for router-root paths (already fixed in `services/recipes.ts`, `services/planner.ts`).

### "Could not find table 'public.X' in the schema cache"

You haven't run that table's migration yet. Run the SQL files in `backend/` in the Supabase SQL editor (see step 4).

### "I have to log in again every reload"

Session persistence is wired in `lib/supabase.ts` (AsyncStorage + AppState). If you're still seeing it:
- Expo Go sandboxes AsyncStorage — uninstalling Expo Go wipes the session.
- If your refresh token expired before the AppState wiring landed, log in once more.

### Recipe detail shows only the title and photo

The list endpoint returns summaries (no ingredients/steps). The detail screen fetches the full record from `/recipes/{id}` — if that's failing, check uvicorn logs for the request line.

---

## Useful commands

```bash
# Frontend
npm run start         # expo start
npm run ios           # iOS simulator
npm run android       # Android emulator
npm run typecheck     # tsc --noEmit
npm run lint          # eslint

# Backend (from backend/)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Diagnostics
ipconfig getifaddr en0                   # your Mac's LAN IP
curl http://localhost:8000/health        # is backend up?
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
