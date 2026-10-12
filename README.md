# Fettle

> *in fine fettle* — in good health and spirits.

Fettle is a full-stack personal health companion: food and macros, water, steps and workouts,
weight and body measurements, sleep, mood and breathing, vitals, habits, medication reminders,
intermittent fasting, insights and achievements. Everything is stored in **your local PostgreSQL**
and never leaves your computer.

## Features

| Area | What you get |
| --- | --- |
| **Today** | Animated activity rings (food, steps, water, active minutes), a daily Fettle score across five pillars, macros, hydration glass, meals, habits, doses, logging streak |
| **Food** | 150+ built-in foods (Indian and international) with fuzzy search, your own custom foods, quick add, servings, copy yesterday's meals, macro split, fibre/sugar/sodium, 14-day trends |
| **Activity** | Daily steps with distance and burn, 14 workout types with MET-based calorie estimates, WHO 150-minute weekly goal, 30-day chart, six-month heatmap |
| **Body** | Weigh-ins with a smoothed trend line, goal projection, healthy BMI band, BMI, measurements, Navy body-fat estimate, waist-to-height ratio |
| **Sleep** | Duration, quality, awakenings, consistency score, sleep debt, sleep-window chart |
| **Mind** | Mood/energy/stress check-ins with tags and journal, animated guided breathing (box, 4-7-8, coherent), mindful minutes, mood-by-tag analysis |
| **Vitals** | Heart rate, blood pressure (AHA categories), glucose (with fasting context), SpO₂, temperature, charts with healthy ranges |
| **Habits** | Custom habits with emoji/colour, multi-count per day, 14-day grid, current/best streaks |
| **Medication** | Medicines & supplements with daily schedules, take/skip checklist |
| **Fasting** | Live timer ring with presets (13:11 → 24h), metabolic stage timeline, history |
| **Insights** | Period-over-period averages, plain-language discoveries from correlations in your data, energy balance, sleep vs mood, 20 achievement badges |
| **Settings** | Metric/imperial, light/dark/system theme, profile, auto-suggested targets (Mifflin-St Jeor), full JSON export, delete account |

Plus: onboarding wizard, confetti for goals and badges, keyboard shortcut (`L` / `Ctrl+K`) to log
anything, mobile bottom sheet dialogs, reduced-motion support.

## Stack

- **Monorepo** with npm workspaces: `apps/api`, `apps/web`, `packages/shared`
- **API:** Fastify 5, Drizzle ORM, PostgreSQL (built in via `embedded-postgres`, `pg_trgm` for fuzzy search), Better Auth (argon2id), Zod validation
- **Web:** React 19, Vite, TanStack Router + Query, Tailwind CSS v4, Motion, ECharts
- **Shared:** Zod schemas, types and the health maths (BMR/TDEE, targets, weight trend, score, streaks), unit-tested with Vitest

### Built to scale

- Stateless API (sessions in Postgres), so you can run several instances behind a load balancer
- Every table is keyed by user with composite indexes on `(user_id, day)`; aggregates run in SQL
- Feature modules are self-contained (`apps/api/src/modules/*`) and registered in one place
- Categorical columns are typed text validated at the edge, so new workout types or vital kinds need no enum migration
- Versioned SQL migrations (Drizzle), applied automatically on start with an advisory lock
- Nutrients are snapshotted onto diary entries, so editing a food never rewrites history
- Gzip compression, connection pooling (`DB_POOL_SIZE`), auth rate limits

## Getting started

Requirements: Node 22.12+. Nothing else: Fettle runs its own PostgreSQL server inside the project
(data in `.data/postgres`, git-ignored), started and stopped together with the app.

```bash
npm install
npm run dev        # database on :54330, API on :4100, web on http://localhost:5174
```

The first run creates `.env` with a random auth secret and database password.

### Looking inside the database (DBeaver, pgAdmin, psql)

While Fettle is running, connect with:

| Setting | Value |
| --- | --- |
| Host | `localhost` |
| Port | `54330` (`EMBEDDED_PG_PORT` in `.env`) |
| Database | `fettle` |
| Username | `postgres` |
| Password | the `EMBEDDED_PG_PASSWORD` value in `.env` |

### Using another PostgreSQL server instead

Set `DATABASE_URL` in `.env` and the built-in server stays idle. `npm run db:setup` can create a
dedicated `fettle` role and database on a server you have the superuser password for.

Other commands:

```bash
npm start                                   # production build, served by the API on :4100
npm test                                    # unit tests
npm run typecheck
npm run db:demo -- --email you@example.com  # fill an account with 60 days of sample data
npm run db:generate                         # new migration after editing apps/api/src/db/schema.ts
```

To use Fettle from your phone on the same Wi-Fi, set `API_HOST=0.0.0.0` and
`APP_URL=http://<your-pc-ip>:4100` in `.env`, then `npm start`.

## Privacy

Your health data lives only in the local database (`.data/postgres`). `.env`, `.data/`, exports, dumps and backups are all in
`.gitignore`, so nothing personal ends up in the repository. Use **Settings → Export** for a full
JSON copy, and **Delete account** to erase everything.

Fettle offers general wellness tracking, not medical advice.
