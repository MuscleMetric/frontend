-- Review-stage schema for MuscleMetric in-app feedback.
-- Apply this to Supabase before wiring the forms into production screens.

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feedback_type text not null check (feedback_type in ('issue', 'improvement', 'rating')),
  source_screen text,
  category text,
  message text,
  additional_context text,
  impact text check (impact is null or impact in ('minor', 'annoying', 'blocked')),
  rating smallint check (rating is null or rating between 1 and 5),
  rating_tags text[] not null default '{}',
  app_version text,
  platform text,
  os_version text,
  device_model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint app_feedback_required_content check (
    (feedback_type = 'issue' and message is not null and length(btrim(message)) > 0)
    or (feedback_type = 'improvement' and message is not null and length(btrim(message)) > 0)
    or (feedback_type = 'rating' and rating is not null)
  )
);

alter table public.app_feedback enable row level security;

revoke all on public.app_feedback from anon;
grant insert on public.app_feedback to authenticated;
grant all on public.app_feedback to service_role;

create policy "Users can submit their own feedback"
on public.app_feedback
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create index if not exists app_feedback_created_at_idx
  on public.app_feedback (created_at desc);

create index if not exists app_feedback_type_created_at_idx
  on public.app_feedback (feedback_type, created_at desc);

create index if not exists app_feedback_user_id_idx
  on public.app_feedback (user_id);
