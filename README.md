# LifeHub

A personal dashboard for tasks, notes, calendar planning and everyday finances.

LifeHub combines a configurable Today view, recurring events, account balances, transfers, planned subscriptions and a wishlist in one responsive workspace. This is the React/TypeScript edition adapted for Cloudflare Workers and D1 through ChatGPT Sites.

## Features

- Tasks with dates, priorities and completion state; day, week and month calendar views.
- Notes, income and expense tracking, monthly totals and budgets.
- Account balances, transfers, planned subscriptions and a wishlist.
- Light, dark, warm and system themes; configurable accent, font, density and dashboard layout.
- JSON backup/import and CSV export, including validation and duplicate-import protection.
- Owner-scoped storage and version checks to detect conflicting edits.
- PWA assets and an offline connection screen. Private data is not cached for offline use.

## Stack

React · TypeScript · Tailwind CSS · Vinext/Vite · Cloudflare Workers · D1 · Drizzle

The earlier Supabase edition is separate. This edition uses D1, not PostgreSQL.

## Local setup

Requirements: Node.js 22.13+ and npm. Node.js 24 is used by repository checks.

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. The starter provides a development-only sign-in identity. Local preview data stays on your machine. Data features require applying `drizzle/0000_thick_moonstone.sql` to the local `DB` binding using Wrangler and the generated Worker configuration. Always include `--local`; do not use your production database for tests.

## Checks

```sh
node --test tests/*.test.cjs
npx tsc --noEmit
npm run build
```

The 25 automated checks cover money/date validation, recurring events, imports, owner isolation, stale updates and transport failures. They use isolated fixtures, not a live personal account.

## Architecture

| Directory | Purpose |
| --- | --- |
| `app/` | Routes, application shell and session endpoint |
| `components/`, `hooks/` | Interface and client state |
| `lib/` | Domain rules, storage and server operations |
| `db/`, `drizzle/` | D1 schema and migrations |
| `tests/` | Domain, server and transport regressions |
| `build/`, `scripts/` | Sites/Workers integration and local tooling |

## Deployment and limits

The author's live deployment is private. This source repository does not grant access to it or include personal records, credentials, backups, or the original Site identity. `.openai/hosting.json` retains only binding declarations. Register your own Site and configure its database and authentication before deploying.

Subscriptions are reminders, not automatic charges. Marking a wishlist item as bought does not create a financial transaction. There is no offline write queue or automatic merge of conflicting edits. Physical iPhone installation and standalone authentication require device testing.

The historical `MIGRATION-AUDIT.md` is background, not a record of checks on this export. Third-party plugin and asset notices remain with their source files.
