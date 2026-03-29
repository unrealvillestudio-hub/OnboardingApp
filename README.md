# UNRLVL Onboarding App

AI-powered brand onboarding → Supabase data pipeline.

## Stack

- **Frontend:** Vite + React 18 + TypeScript + Tailwind CSS
- **API:** Vercel serverless function (proxies Anthropic API)
- **DB:** Supabase (fetch-native, no SDK)
- **AI:** Claude Sonnet 4 via `/api/claude`

## Setup

```bash
npm install
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
# ANTHROPIC_API_KEY goes in Vercel dashboard (not in .env.local for prod)

npm run dev
```

## Architecture

```
OnboardingApp/
├── api/
│   └── claude.ts          ← Vercel serverless — proxies Anthropic API
├── src/
│   ├── api/
│   │   └── claude.ts      ← Client fetch wrapper → /api/claude
│   ├── lib/
│   │   ├── supabaseClient.ts  ← fetch-native REST client
│   │   └── brandWriter.ts     ← UPSERT orchestrator (all tables)
│   ├── modules/onboarding/
│   │   ├── Phase1Input.tsx    ← Free brief editor
│   │   ├── Phase2Enrichment.tsx ← Side-by-side AI review
│   │   ├── Phase3Gaps.tsx     ← Gap interview chat
│   │   ├── Phase4Summary.tsx  ← Write to Supabase
│   │   └── prompts.ts         ← Claude system prompts
│   ├── store/
│   │   └── onboardingStore.ts ← Context + useReducer state
│   └── types/
│       └── index.ts           ← All TypeScript types
├── vercel.json
└── .env.example
```

## Supabase Tables Written

| Table | Operation | Conflict Key |
|-------|-----------|-------------|
| `brands` | UPSERT | `id` |
| `humanize_profiles` | UPSERT | `brand_id, medium` |
| `compliance_rules` | UPSERT | `brand_id, rule_type` |
| `brand_palette` | UPSERT | `brand_id, role` |
| `brand_typography` | UPSERT | `brand_id, role` |

## Env Vars

| Var | Where | Purpose |
|-----|-------|---------|
| `VITE_SUPABASE_URL` | Vercel + local | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Vercel + local | Supabase anon key |
| `ANTHROPIC_API_KEY` | Vercel only (server) | Anthropic API — never expose to browser |

## Deploy

Push to `unrealvillestudio-hub/OnboardingApp` → Vercel auto-deploys via GitHub integration.
Set env vars in Vercel dashboard under team `team_fEH94Irp6BAI9YGm4btGna5n`.

## Phase Roadmap

- [x] Phase 1 — Free brief editor
- [x] Phase 2 — Claude enrichment + side-by-side review
- [x] Phase 3 — Gap interview chat
- [x] Phase 4 — Supabase write + summary
- [ ] Brand edit mode (load existing brand data into Phase 2)
- [ ] geomix table population
- [ ] brand_services completeness check
- [ ] TenzorArt voice ID configuration
