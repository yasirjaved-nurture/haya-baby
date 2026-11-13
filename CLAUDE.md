# Haya Baby — project notes

Storefront + admin dashboard + WhatsApp inventory bot (Next.js 15, Supabase, Claude).

## Where things live
- GitHub: `yasirjaved-nurture/haya-baby` (branch `main` → auto-deploys to production on Vercel)
- Vercel: team `nurture-yasir`, project `haya-baby` (prj_4N3kicPV8MAw7W514YDlmaVR5J83)
- Supabase: org `yasirjaved-nurture`, project `baby-shop` (ref `krkjtlbuapelidwuaqgp`, ap-south-1)

## Workflow
- Make changes → commit → push to `main` → Vercel deploys. No zips/downloads.
- Yasir tests on the live site himself and reports back — don't run/test locally unless asked.
- DB changes: add a new numbered file in `supabase/migrations/` AND apply it to the Supabase project.
- Secrets (service role key, Anthropic key, WhatsApp token/app secret, Whisper key) are set by Yasir in Vercel → never commit them.

## Key files
- `src/lib/bot/handler.ts` — WhatsApp bot logic (confirm/undo, photo matching, queries)
- `src/lib/ai.ts` — Claude prompts
- `supabase/migrations/0001_init.sql` — schema, RLS, stock/checkout functions
