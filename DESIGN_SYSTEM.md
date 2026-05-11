# Mise — design system

> **How to use this file with Claude Code**
> Start every UI-related session with: "Before writing any code, read `DESIGN_SYSTEM.md` and apply those tokens exactly. Do not introduce any color, font, spacing, or radius value not defined in this file."

---

## Project overview

Mise is a React Native mobile app (iOS + Android) that converts TikTok/Reels cooking videos and restaurant photos into structured, cookable recipes. Six AI-powered features drive the experience:

1. **Video ingestion pipeline** — URL → Whisper transcription → GPT-4o vision → structured recipe
2. **Restaurant photo pipeline** — dish photo → vision model → home-cooking reconstruction
3. **Technique annotation layer** — each recipe step enriched with contextual cooking technique explanations (key differentiator)
4. **Meal prep + macros engine** — weekly planner, grocery list aggregation, Edamam macro breakdown
5. **Voice cook-along assistant** — hands-free step navigation via Whisper + GPT-4o
6. **Monthly recap** — shareable visual summary of recipes cooked, cuisines, techniques, macro trends

**Stack:** React Native, Python/FastAPI, PostgreSQL, OpenAI (Whisper + GPT-4o), Edamam Nutrition API

---

## Design direction

**Warm Retro, modernised.** The feeling of a well-loved 1970s cookbook that got a modern, design-forward rebrand. Calm and warm first, expressive second. Tactile and confident without being loud.

Reference points: Ottolenghi's visual identity, early Monocle magazine, a really good natural wine bar's menu.

Modern layer: floating pill tab bar, subtle gradient blobs as hero card decoration, soft drop shadows for card depth, bento-style section layout on the home screen.

---

## Color palette

All colors must come from this list. Do not introduce any hex value not defined here.

### Neutrals

| Token | Hex | Usage |
|---|---|---|
| `color.oat` | `#F5EFE0` | Screen background only — never for cards or components |
| `color.linen` | `#EDE4CE` | Secondary surfaces: ghost buttons, input fields, inactive states |
| `color.sand` | `#DDD0B3` | Borders, dividers, subtle strokes |
| `color.umber` | `#9A826A` | Captions, secondary labels, placeholder text, timestamps |
| `color.espresso` | `#2C2218` | Primary text, dark surfaces (tab bar, hero cards) |

### Primary — terracotta ramp

| Token | Hex | Usage |
|---|---|---|
| `color.blush` | `#F5D0BC` | Technique chip backgrounds, warm tags, highlight fills |
| `color.ember` | `#E87A4A` | Hover/pressed state of Terra, progress fills, streaks |
| `color.terra` | `#D4521C` | **Primary CTA buttons, active nav icon, hero moments — one per screen max** |
| `color.rust` | `#A83E10` | Deep emphasis, pressed/active states |
| `color.brick` | `#6C250A` | Text on light terra fills (Blush background) |

### Accents

| Token | Hex | Usage |
|---|---|---|
| `color.sagePale` | `#D8EACE` | Success chip backgrounds, saved indicators |
| `color.sage` | `#7A9E6A` | Success states, saved badges, positive macro signals |
| `color.butterPale` | `#FBF0CC` | "New" badge backgrounds |
| `color.butter` | `#F0C96A` | "New" badges, monthly recap accent — use sparingly |
| `color.peach` | `#E8A87C` | Warm secondary accent, ingredient highlights |

### Semantic

| Token | Value | Usage |
|---|---|---|
| `color.cardBg` | `#FFFFFF` | Elevated cards only — creates depth against Oat without shadows |
| `color.textOnDark` | `#FAE8DA` | Text on Espresso or Terra backgrounds — never pure white |
| `color.borderResting` | `rgba(92,74,54,0.15)` | Default border on all components |
| `color.borderEmphasis` | `rgba(92,74,54,0.22)` | Hover, focused, or emphasized borders |

### Color rules — do not break these

- `color.oat` is always the screen background. Never use it for cards or components.
- `color.cardBg` (white) is used **only** for elevated cards — nowhere else.
- `color.terra` appears **once per screen** as the dominant brand moment. Never scatter it.
- Text on `color.terra` or `color.espresso` backgrounds → use `color.textOnDark` (`#FAE8DA`), never pure `#FFFFFF`.
- Text on `color.blush` → use `color.brick` (`#6C250A`).
- Text on `color.sagePale` → use `#3A5C2A`.
- Text on `color.butterPale` → use `#7A5C10`.
- Borders are always `rgba(92,74,54,0.15)` or `rgba(92,74,54,0.22)`. Never `#000`, never `#ccc`, never `gray`.
- No box shadows anywhere. Depth comes from background color contrast (Oat → White card), not shadows.
- No gradients anywhere.
- No pure black (`#000000`) or pure white (`#FFFFFF`) for text.

---

## Typography

### Font families

```
Display / headings:  DM Serif Display
Body / UI:           Urbanist
```

**React Native install:**
```bash
npx expo install @expo-google-fonts/dm-serif-display @expo-google-fonts/urbanist expo-font
```

**Import:**
```js
import { useFonts, DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { Urbanist_400Regular, Urbanist_500Medium } from '@expo-google-fonts/urbanist';
```

Only two weights are used across the entire app: **400 Regular** and **500 Medium**. Never 600, 700, or bold.

### Type scale

| Role | Font | Size | Weight | Line height | Tracking |
|---|---|---|---|---|---|
| Display (app name) | DM Serif Display | 32px | 400 | 1.1 | +0.02em |
| H1 (screen titles) | DM Serif Display | 24px | 400 | 1.2 | +0.01em |
| H2 (section headers) | DM Serif Display | 18–22px | 400 | 1.2 | +0.01em |
| Card title | DM Serif Display | 14–15px | 400 | 1.25 | 0 |
| Body large | Urbanist | 17px | 400 | 1.6 | 0 |
| Body | Urbanist | 15px | 400 | 1.55 | 0 |
| UI / buttons | Urbanist | 13–15px | 500 | — | 0 |
| Caption / meta | Urbanist | 11–12px | 400 | — | 0 |
| Label / all-caps | Urbanist | 10–11px | 500 | — | +0.08–0.1em |

### Typography rules

- All-caps labels use Outfit 500 with `letterSpacing: 1.2` (≈0.1em at 12px) and `textTransform: 'uppercase'`.
- Recipe names and screen titles always use DM Serif Display.
- Buttons, chips, tags, captions, and all interactive UI use Outfit.
- Never mix both fonts in the same text element.
- Sentence case everywhere except all-caps labels. No Title Case.

---

## Spacing scale

```js
export const spacing = {
  xs:  4,   // icon gap, tight inline
  sm:  8,   // chip padding, row gaps
  md:  12,  // card inner gap
  lg:  16,  // card padding, section gap
  xl:  20,  // screen horizontal margin
  xl2: 24,  // list gap
  xl3: 40,  // section separation
  xl4: 64,  // hero / screen top padding
};
```

Screen horizontal margin is always **20px** (`spacing.xl`). Apply this consistently to all full-width content.

---

## Border radius

```js
export const radius = {
  tag:    4,    // small tags, badges
  input:  8,    // inputs, chips
  inner:  12,   // inner card elements, image thumbs
  card:   16,   // recipe cards, standard cards
  hero:   20,   // week/feature cards
  sheet:  24,   // bottom sheets, modals
  pill:   100,  // all buttons, cuisine/technique tags
  avatar: 9999, // circular avatars
};
```

---

## Component tokens

### Primary button

```js
{
  backgroundColor: '#D4521C',   // color.terra
  color: '#FAE8DA',             // color.textOnDark
  borderRadius: 100,            // radius.pill
  paddingVertical: 12,
  paddingHorizontal: 24,
  fontFamily: 'Urbanist_500Medium',
  fontSize: 15,
}
// NOT: blue, NOT: border-radius 8, NOT: fontWeight 'bold'
```

### Secondary button

```js
{
  backgroundColor: 'transparent',
  borderWidth: 1.5,
  borderColor: '#DDD0B3',       // color.sand
  color: '#2C2218',             // color.espresso
  borderRadius: 100,            // radius.pill
  paddingVertical: 11,
  paddingHorizontal: 22,
  fontFamily: 'Urbanist_500Medium',
  fontSize: 15,
}
```

### Ghost button

```js
{
  backgroundColor: '#EDE4CE',   // color.linen
  borderRadius: 100,            // radius.pill
  paddingVertical: 8,
  paddingHorizontal: 16,
  fontFamily: 'Urbanist_500Medium',
  fontSize: 13,
  color: '#9A826A',             // color.umber
}
```

### Elevated card (recipe card)

```js
{
  backgroundColor: '#FFFFFF',   // color.cardBg
  borderRadius: 16,             // radius.card
  borderWidth: 0.5,
  borderColor: 'rgba(92,74,54,0.15)', // color.borderResting
  // NO shadowColor, NO elevation, NO shadowOffset
}
```

### Hero card (week overview, dark)

```js
{
  backgroundColor: '#2C2218',   // color.espresso
  borderRadius: 20,             // radius.hero
  padding: 16,
  // Text inside uses color.textOnDark (#FAE8DA) and color.umber (#9A826A)
}
```

### Input field

```js
{
  backgroundColor: '#EDE4CE',   // color.linen
  borderWidth: 0.5,
  borderColor: '#DDD0B3',       // color.sand
  borderRadius: 12,             // radius.inner
  paddingVertical: 12,
  paddingHorizontal: 14,
  fontFamily: 'Urbanist_400Regular',
  fontSize: 15,
  color: '#2C2218',             // color.espresso
  // placeholder color: color.umber (#9A826A)
}
```

### Technique chip (primary)

```js
{
  backgroundColor: '#F5D0BC',   // color.blush
  borderRadius: 100,            // radius.pill
  paddingVertical: 5,
  paddingHorizontal: 12,
  fontFamily: 'Urbanist_500Medium',
  fontSize: 12,
  color: '#6C250A',             // color.brick
}
```

### Saved chip

```js
{
  backgroundColor: '#D8EACE',   // color.sagePale
  borderRadius: 100,
  paddingVertical: 5,
  paddingHorizontal: 12,
  fontFamily: 'Urbanist_500Medium',
  fontSize: 12,
  color: '#3A5C2A',
}
```

### Neutral chip / meta tag

```js
{
  backgroundColor: '#EDE4CE',   // color.linen
  borderRadius: 100,
  paddingVertical: 5,
  paddingHorizontal: 12,
  fontFamily: 'Urbanist_400Regular',
  fontSize: 12,
  color: '#9A826A',             // color.umber
}
```

### Time badge (overlay on card image)

```js
{
  backgroundColor: 'rgba(44,34,24,0.68)',
  borderRadius: 6,
  paddingVertical: 2,
  paddingHorizontal: 7,
  fontFamily: 'Urbanist_400Regular',
  fontSize: 10,
  color: '#F5EFE0',             // color.oat
}
```

### Tab bar — floating pill

```js
// Outer wrapper (transparent, provides safe-area padding)
{ backgroundColor: colors.oat, paddingHorizontal: 12, paddingTop: 8 }

// Pill container
{
  backgroundColor: '#2C2218',   // color.espresso
  borderRadius: 32,
  flexDirection: 'row',
  paddingVertical: 6,
  paddingHorizontal: 6,
}

// Active tab inner pill
{
  backgroundColor: '#D4521C',  // color.terra
  borderRadius: 22,
  flexDirection: 'row',
  gap: 6,
  paddingVertical: 9,
  paddingHorizontal: 14,
}

// Active label (shown only on active tab)
{ fontFamily: 'Urbanist_500Medium', fontSize: 12, color: '#FAE8DA' } // color.textOnDark

// Inactive icon color
rgba(245,239,224,0.50)
```

### Toast — success

```js
{
  backgroundColor: '#2C2218',   // color.espresso
  borderRadius: 12,
  padding: 12,
  // Text: color.oat (#F5EFE0)
  // Indicator dot: color.sage (#7A9E6A)
}
```

### Toast — error

```js
{
  backgroundColor: '#F5D0BC',   // color.blush
  borderRadius: 12,
  padding: 12,
  // Text: color.brick (#6C250A)
  // Indicator dot: color.rust (#A83E10)
}
```

### Avatar

```js
{
  backgroundColor: '#D4521C',   // color.terra
  borderRadius: 9999,           // radius.avatar
  width: 34,
  height: 34,
  // Initials text: color.textOnDark (#FAE8DA), Outfit 500, 13px
}
```

---

## Screen anatomy

### Home screen (v4 — bento)

```
StatusBar
TopBar          → "mise" wordmark (DM Serif Display 28px) + avatar (initials "E")
Greeting        → sub-label uppercase (Urbanist 500, 11px, umber) + title (DM Serif Display 28px)
WeekCard        → dark espresso hero card: big count (52px DM Serif), vertical progress bars,
                  colour blob decorations (ember + rust circles), "Open planner" ghost pill button
QuickActions    → two side-by-side pill buttons: "Open planner" (terra) + "Import recipe" (white card)
RecentlySaved   → section label (uppercase 10px) + horizontal scroll of recipe cards
GroceryPeek     → collapsible white card: sage icon, progress bar, expandable checklist
TabBar          → floating pill (espresso bg, terra active pill, active label visible)
```

Background: `color.oat`. Screen margin: 20px horizontal. Bottom content padding: 120px.

---

## Screens to build

- [ ] Recipe detail — hero image, ingredients, technique chips, step-by-step
- [ ] Cook-along mode — hands-free, large DM Serif type, voice UI, step navigator
- [ ] Weekly meal planner — 7-day grid, grocery list, macro breakdown
- [ ] Monthly recap — shareable card: dish grid, cuisine donut, macro sparkline
- [ ] Onboarding flow
- [ ] Recipe import flow — URL paste → processing state → preview

---

## What Claude Code must never do

- Introduce any color not in this file
- Use `fontWeight: '600'`, `'700'`, or `'bold'` — only `'400'` and `'500'`
- Use `borderRadius` values other than those in the radius scale
- Use pure `#000000` or `#FFFFFF` for text
- Use blue, purple, or any cool-toned color as a primary action color
- Use `#333`, `#666`, `#999`, or any generic gray — use the named tokens only
- Apply `color.terra` more than once per screen as a dominant element
- Use `color.oat` for cards or components — it is the screen background only
- Use `color.cardBg` (white) anywhere except elevated cards
- Mix DM Serif Display and Urbanist in the same text element
- Use Title Case — sentence case everywhere except all-caps labels

### Approved exceptions (v4 direction)

- **Gradients are allowed** as decorative blobs inside dark hero cards (ember/rust overlapping circles inside WeekCard). Do not use gradients on text, buttons, or screen backgrounds.
- **Soft drop shadows are allowed** on elevated cards and the floating tab bar. Use `rgba(20,16,10,0.06)` tones only — never `#000` shadows.
