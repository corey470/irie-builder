# Rollback Procedures — Foundation Rebuild (Phases A → D)

Each phase ships as a single commit to `main` with one Vercel build. If a
phase goes sideways, roll back to the prior phase's green state.

Supabase project: `jcxxfycsongfchpaxzkf` (region `us-east-1`, org `ovbpiuanqzunamxwisav`).

## Phase D — Auth gating cutover

**Symptom:** Gated routes broken after cutover. Rescue flow misfires. Real
users can't sign in.

**Rollback:**
1. In Vercel → `irie-builder` project → Settings → Environment Variables →
   Production: set `NEXT_PUBLIC_AUTH_GATING=off`.
2. Trigger a production redeploy (Vercel dashboard → Deployments → Redeploy,
   or push an empty commit).
3. Site returns to pre-cutover behavior. Auth pages still exist but middleware
   stops gating routes. Supabase data stays intact.

Rollback impact: zero data loss. Auth schema + user accounts persist.

## Phase C — localStorage → Supabase persistence refactor

**Symptom:** Persistence refactor broke brief draft autosave, generation flow,
edit session, or publish flow on the preview URL.

**Rollback:**
1. `git revert <phase-c-commit-sha>` on `main` and push.
2. Vercel rebuilds. localStorage code paths return. Any rows written to
   Supabase during preview testing are orphaned but harmless (service_role can
   prune later via `delete from builder_projects where owner_id in (test-user-ids)`).
3. Phase B auth pages + middleware remain functional; the site is in the same
   state as end-of-Phase-B.

Rollback impact: no user data loss (no real users on a preview-only phase).

## Phase B — Auth pages, middleware, Supabase client

**Symptom:** Middleware crash, auth page build failure, env var misconfigured
in preview.

**Rollback:**
1. `git revert <phase-b-commit-sha>` on `main` and push.
2. Vercel rebuilds. All auth code removed. `middleware.ts` gone. Site runs
   exactly as Phase A ended: production app code unchanged from the original
   pre-foundation-rebuild state.
3. Leave env vars in Vercel in place — they're harmless when no code reads
   them. Or remove them (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_AUTH_GATING`).

Rollback impact: zero to users — gating was off.

## Phase A — Supabase project + schema + RLS

**Symptom:** Schema issue discovered after Phase A ships but before Phase B
starts. No app code depends on Supabase yet.

**Rollback options:**
1. **Drop and re-apply** — easiest in greenfield. In Supabase SQL editor:
   ```sql
   drop table if exists public.builder_publishes cascade;
   drop table if exists public.builder_edits cascade;
   drop table if exists public.builder_generations cascade;
   drop table if exists public.builder_projects cascade;
   drop function if exists public.set_updated_at();
   ```
   Then fix `supabase/migrations/0001_initial.sql` and reapply via MCP
   `apply_migration`.
2. **Pause the project** — Supabase dashboard → Project settings → Pause
   project. Zero cost while paused.
3. **Delete the project** — Supabase dashboard → Project settings → Delete.
   Data is unrecoverable. Only do this if the project needs a full do-over.

Rollback impact: no app impact until Phase B wires the client. Test users and
seed project are disposable.

## Phase 0 — Schema draft commit

**Symptom:** Want to change the schema before Phase A applies it.

**Rollback:** Edit `supabase/migrations/0001_initial.sql` on `main` and push.
No DB exists yet; only the draft file changes.
