# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at localhost:5173
npm run build     # Production build
npm run preview   # Preview production build
firebase deploy --only hosting  # Deploy to https://league-of-poets.web.app
```

No lint or test scripts are configured.

## Architecture

**React + Vite + Firebase Realtime Database** app for two users (Maxim and Oleg) to independently rate and rank Russian poets across 4 weighted categories.

### State management

All global state lives in `src/context/PoetsContext.jsx` (`PoetsProvider` + `usePoets` hook). This is the single source of truth — it syncs bidirectionally with Firebase Realtime DB and exposes poets, ratings, tournaments, category coefficients, likes, duel winners, etc.

### Data model (Firebase Realtime DB paths)
- `poets/` — poet objects
- `ratings/{maxim|oleg}/{poetId}/{category}` — per-user ratings
- `categoryLeaders/{maxim|oleg}/` — category-level top picks
- `overallDuelWinners/` — head-to-head results
- `tournaments/` — tournament brackets
- `categoryCoefficients/` — live-editable weights

User preferences (theme, current user) are stored in **localStorage**, not Firebase.

### Scoring

4 categories rated 1–5 (0.5 increments), weighted to produce a 0–5 final score:
- Творчество (Creativity) × 0.6
- Драма (Drama) × 0.2
- Мораль (Morality/Influence) × 0.1
- Красота (Beauty) × 0.1

Coefficients are defined in `DEFAULT_CATEGORIES` (PoetsContext) and can be overridden via Firebase (loaded into `categoryCoefficients`). Use `categoryCoefficients` from `usePoets()`, not the exported `CATEGORIES` constant (deprecated).

### Theme system

Two themes — Classic (light/parchment) and Letterboxd (dark/green). Defined in `src/themes.js`, applied via CSS custom properties on `:root`. Default is Letterboxd.

### AI integration

`src/ai/gemini.js` wraps Google Gemini (`gemini-flash-latest`) to auto-generate poet bios. Requires `VITE_GEMINI_API_KEY` in `.env`. Rate-limited to ~5 RPM (12s delay between calls). Prompts are in `src/ai/prompts.js`.

### Routing

`src/App.jsx` defines all routes. Pages are in `src/pages/`, shared components in `src/components/`. Each has a co-located `.css` file.

## Code style

Use comments sparingly. Only comment complex code.
