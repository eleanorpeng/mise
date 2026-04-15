# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Mise

A React Native mobile app that turns TikTok/Reels cooking videos and restaurant photos into structured, cookable recipes — enriched with AI-generated technique annotations, a weekly meal planner, voice cook-along, and a monthly shareable recap.

## Stack

- **Frontend:** React Native (Expo), TypeScript, expo-router
- **Backend:** Python / FastAPI
- **Database:** PostgreSQL
- **AI:** OpenAI Whisper (transcription), GPT-4o (vision + conversational)
- **Nutrition:** Edamam API
- **State:** Zustand
- **Lists:** @shopify/flash-list

## Core features

1. **Video import** — paste a TikTok or Reels URL → Whisper transcribes audio, GPT-4o vision synthesizes transcript + key frames → structured recipe
2. **Photo import** — photograph a restaurant dish → vision model identifies and reconstructs a home-cooking approximation
3. **Technique annotations** — each recipe step is enriched with a contextual explanation of the underlying cooking technique, surfaced as expandable chips (key differentiator)
4. **Meal planner + macros** — weekly recipe planner, aggregated grocery list, per-meal and weekly macro breakdown via Edamam
5. **Voice cook-along** — hands-free step navigation and mid-cook Q&A via Whisper + GPT-4o
6. **Monthly recap** — shareable visual summary of recipes cooked, cuisines, techniques learned, and macro trends

## Design system

**Read `DESIGN_SYSTEM.md` before writing any UI code.**

- Visual direction: Warm Retro — calm, warm, editorial
- Fonts: DM Serif Display (headings) + Urbanist (body/UI)
- All colors, spacing, radius, and component tokens are defined in `DESIGN_SYSTEM.md` and `constants/`
- No raw hex values, no shadows, no gradients, no bold font weights in components

## Commands

```bash
# Frontend
npm install           # install dependencies
npm run start         # start Expo dev server
npm run ios           # run on iOS simulator
npm run android       # run on Android emulator
npm run typecheck     # TypeScript check (no emit)
npm run lint          # ESLint

# Backend (run from backend/)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Database
createdb mise
# Alembic migrations (once configured):
alembic upgrade head
```

## Project structure

```
app/          # expo-router screens — (tabs)/ for tab screens, recipe/[id].tsx, import.tsx
components/   # ui/ primitives, home/ widgets, recipe/ cards and chips
constants/    # colors.ts, typography.ts, spacing.ts — single source of truth for all tokens
hooks/        # useFonts, useGreeting, useVoice
services/     # API calls (api.ts base client, recipes, import, planner, voice)
store/        # Zustand stores (recipes, plan, session)
types/        # Shared TypeScript interfaces (Recipe, RecipeStep, MealPlanEntry, etc.)
backend/app/  # FastAPI app — routers/, services/, models/, schemas/
```

## Environment

```
# .env (frontend root)
EXPO_PUBLIC_API_URL=    # FastAPI backend base URL

# backend/.env
DATABASE_URL=           # postgresql+asyncpg://...
OPENAI_API_KEY=
EDAMAM_APP_ID=
EDAMAM_APP_KEY=
```

## Key patterns

- All screens use `SafeAreaView` from `react-native-safe-area-context` with `edges={['top']}`.
- Screen background is always `colors.oat`. Never apply it to cards or components.
- `colors.terra` appears at most once per screen as the primary brand moment.
- Text on dark (`colors.espresso`, `colors.terra`) backgrounds uses `colors.textOnDark` — never `#fff`.
- No `elevation`, no `shadowColor`, no gradients anywhere in the UI.
- Font weights are only `400` (Regular) or `500` (Medium). Never `600`, `700`, or `'bold'`.
- Backend services in `backend/app/services/` hold all OpenAI and Edamam logic. Routers stay thin.
