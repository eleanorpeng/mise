# Mise

A React Native (Expo) cooking app with a FastAPI backend. Imports TikTok/Reels videos and restaurant photos into structured recipes, plus a meal planner, voice cook-along, and a sticker-based cook log.

See `CLAUDE.md` for the full feature spec and `DESIGN_SYSTEM.md` for the visual system.

---

## Quickstart

You need **two terminals running at the same time**: one for the backend, one for Expo.

### Terminal 1 — Backend

```bash
cd backend
source .venv/bin/activate              # create with: python -m venv .venv
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Terminal 2 — Frontend

```bash
npx expo start -c
```

Then scan the QR with the **Expo Go** app on your phone (or press `i` for iOS sim, `a` for Android emulator).

> ⚠️ The two flags that catch people out: `--host 0.0.0.0` on uvicorn (so your phone can reach it) and `-c` on `expo start` (so `.env` changes get picked up). Skip either and things break in confusing ways.

---

## First-time setup

### 1. Install dependencies

```bash
# repo root — frontend
npm install --legacy-peer-deps

# backend
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

### 3. Backend `backend/.env`

Copy `backend/.env.example` to `backend/.env` and fill in:

```
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
SUPABASE_JWT_SECRET=<jwt-secret-from-supabase-settings>
OPENAI_API_KEY=sk-...
EDAMAM_APP_ID=...
EDAMAM_APP_KEY=...
```

`SUPABASE_URL` here must match `EXPO_PUBLIC_SUPABASE_URL` in the frontend — otherwise you'll be authenticated as different users on each side.

### 4. Database

In Supabase Dashboard → SQL Editor, run each migration in order:

1. `backend/supabase_migration.sql` (base schema)
2. `backend/supabase_migration_collections.sql`
3. `backend/supabase_migration_cook_log.sql`

After running migrations, open Supabase **API Docs** in the dashboard once — that forces PostgREST to refresh its schema cache.

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
app/             # expo-router screens — (tabs)/, recipe/[id].tsx, cook-log/, etc.
components/      # ui/ primitives, home/, recipe/, cook-log/
constants/       # colors, typography, spacing — single source of truth
hooks/           # useFonts, useGreeting, useVoice
lib/             # supabase client (with RN AppState wiring)
services/        # API calls (api.ts base, recipes, planner, cookLog, etc.)
store/           # Zustand stores
types/           # shared TS interfaces
backend/app/     # FastAPI — routers/, services/, schemas, auth
backend/*.sql    # Supabase migrations
```
