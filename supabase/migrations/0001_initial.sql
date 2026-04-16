-- Irie Builder — standalone Supabase initial migration
-- Schema + RLS + triggers + indexes for phased foundation rebuild.
-- Every user-scoped row carries owner_id (references auth.users) and a nullable
-- commerce_tenant_id reserved for a future Irie Commerce bridge (do not populate).
--
-- RLS model: owner-only CRUD via auth.uid() = owner_id on every table.
-- Service role bypasses RLS by design (server-only admin operations).

-- -------------------------------------------------------------------------
-- Extensions
-- -------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- -------------------------------------------------------------------------
-- Tables
-- -------------------------------------------------------------------------

create table public.builder_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  commerce_tenant_id uuid,
  name text not null,
  slug text not null,
  current_generation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create table public.builder_generations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.builder_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  commerce_tenant_id uuid,
  brief_json jsonb not null,
  agent_outputs_json jsonb,
  final_html text,
  final_css text,
  final_js text,
  status text not null default 'pending'
    check (status in ('pending','generating','complete','failed')),
  created_at timestamptz not null default now()
);

-- Forward FK from projects.current_generation_id → generations.id.
-- Deferrable so a generation can be inserted and the project updated in the
-- same transaction without ordering problems.
alter table public.builder_projects
  add constraint builder_projects_current_generation_id_fkey
  foreign key (current_generation_id)
  references public.builder_generations(id)
  on delete set null
  deferrable initially deferred;

create table public.builder_edits (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.builder_generations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  commerce_tenant_id uuid,
  edit_json jsonb not null,
  created_at timestamptz not null default now()
);

create table public.builder_publishes (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.builder_generations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  commerce_tenant_id uuid,
  published_html text not null,
  published_url text,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- Indexes
-- -------------------------------------------------------------------------
create index builder_projects_owner_id_idx        on public.builder_projects(owner_id);
create index builder_generations_project_id_idx   on public.builder_generations(project_id);
create index builder_generations_owner_id_idx     on public.builder_generations(owner_id);
create index builder_edits_generation_id_idx      on public.builder_edits(generation_id);
create index builder_publishes_generation_id_idx  on public.builder_publishes(generation_id);

-- -------------------------------------------------------------------------
-- updated_at trigger on builder_projects
-- -------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger builder_projects_set_updated_at
  before update on public.builder_projects
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------------------
-- Row Level Security
-- Enable on every table, grant only owner-scoped CRUD to authenticated role.
-- Anon role gets no access; service_role bypasses RLS by platform default.
-- -------------------------------------------------------------------------
alter table public.builder_projects    enable row level security;
alter table public.builder_generations enable row level security;
alter table public.builder_edits       enable row level security;
alter table public.builder_publishes   enable row level security;

-- builder_projects
create policy "owners_select_own_projects"
  on public.builder_projects for select to authenticated
  using (auth.uid() = owner_id);

create policy "owners_insert_own_projects"
  on public.builder_projects for insert to authenticated
  with check (auth.uid() = owner_id);

create policy "owners_update_own_projects"
  on public.builder_projects for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "owners_delete_own_projects"
  on public.builder_projects for delete to authenticated
  using (auth.uid() = owner_id);

-- builder_generations
create policy "owners_select_own_generations"
  on public.builder_generations for select to authenticated
  using (auth.uid() = owner_id);

create policy "owners_insert_own_generations"
  on public.builder_generations for insert to authenticated
  with check (auth.uid() = owner_id);

create policy "owners_update_own_generations"
  on public.builder_generations for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "owners_delete_own_generations"
  on public.builder_generations for delete to authenticated
  using (auth.uid() = owner_id);

-- builder_edits
create policy "owners_select_own_edits"
  on public.builder_edits for select to authenticated
  using (auth.uid() = owner_id);

create policy "owners_insert_own_edits"
  on public.builder_edits for insert to authenticated
  with check (auth.uid() = owner_id);

create policy "owners_update_own_edits"
  on public.builder_edits for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "owners_delete_own_edits"
  on public.builder_edits for delete to authenticated
  using (auth.uid() = owner_id);

-- builder_publishes
create policy "owners_select_own_publishes"
  on public.builder_publishes for select to authenticated
  using (auth.uid() = owner_id);

create policy "owners_insert_own_publishes"
  on public.builder_publishes for insert to authenticated
  with check (auth.uid() = owner_id);

create policy "owners_update_own_publishes"
  on public.builder_publishes for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "owners_delete_own_publishes"
  on public.builder_publishes for delete to authenticated
  using (auth.uid() = owner_id);
