-- Phase C: brief drafts autosave to the project itself, not to a draft
-- generation. Add a non-null jsonb column with an empty-object default so
-- existing rows back-fill cleanly.

alter table public.builder_projects
  add column brief_json jsonb not null default '{}'::jsonb;
