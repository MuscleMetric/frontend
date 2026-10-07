-- Harden internal SECURITY DEFINER RPCs and make notification claims recoverable.
--
-- This is a forward migration. Do not edit the production baseline migrations.

alter table public.notification_push_jobs
  add column if not exists claimed_at timestamptz;

create index if not exists notification_push_jobs_processing_claimed_at_idx
  on public.notification_push_jobs (claimed_at)
  where status = 'processing';

-- Existing processing rows pre-date claimed_at. Give them a lease start so they
-- become recoverable rather than remaining permanently stranded.
update public.notification_push_jobs
set claimed_at = now()
where status = 'processing'
  and claimed_at is null;

create or replace function public.claim_notification_push_jobs_v1(
  p_limit integer default 20
)
returns table(
  job_id uuid,
  notification_id uuid,
  recipient_id uuid
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Recover jobs left in processing by a crashed/timed-out worker.
  update public.notification_push_jobs j
  set
    status = 'pending',
    claimed_at = null,
    processed_at = null,
    last_error = 'stale_processing_requeued'
  where j.status = 'processing'
    and j.claimed_at is not null
    and j.claimed_at < now() - interval '10 minutes';

  return query
  with to_claim as (
    select j.id
    from public.notification_push_jobs j
    where j.status = 'pending'
    order by j.created_at asc
    limit greatest(least(coalesce(p_limit, 20), 100), 1)
    for update skip locked
  ),
  claimed as (
    update public.notification_push_jobs j
    set
      status = 'processing',
      attempts = j.attempts + 1,
      claimed_at = now(),
      processed_at = null
    where j.id in (select id from to_claim)
    returning j.id, j.notification_id, j.recipient_id
  )
  select
    c.id as job_id,
    c.notification_id,
    c.recipient_id
  from claimed c;
end;
$function$;

-- These are internal/service operations. None should be callable directly by
-- anonymous or ordinary authenticated clients through PostgREST RPC endpoints.

revoke execute on function public.delete_workout_test_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_workout_test_v1(uuid, uuid)
  to service_role;

revoke execute on function public.claim_notification_push_jobs_v1(integer)
  from public, anon, authenticated;
grant execute on function public.claim_notification_push_jobs_v1(integer)
  to service_role;

revoke execute on function public.enqueue_notification_push_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.enqueue_notification_push_v1(uuid, uuid)
  to service_role;

revoke execute on function public.create_notification_v1(
  uuid, uuid, text, text, text, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.create_notification_v1(
  uuid, uuid, text, text, text, text, uuid, text
) to service_role;

revoke execute on function public.create_notification_v1(
  uuid, uuid, text, uuid, uuid, uuid, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.create_notification_v1(
  uuid, uuid, text, uuid, uuid, uuid, uuid, jsonb
) to service_role;
