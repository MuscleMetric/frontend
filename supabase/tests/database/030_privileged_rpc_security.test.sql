begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

-- Internal SECURITY DEFINER RPCs must not be callable by app-facing roles.
select ok(
  not has_function_privilege(
    'anon',
    'public.delete_workout_test_v1(uuid,uuid)',
    'EXECUTE'
  ),
  'anon cannot execute delete_workout_test_v1'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.delete_workout_test_v1(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute delete_workout_test_v1'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.delete_workout_test_v1(uuid,uuid)',
    'EXECUTE'
  ),
  'service_role can execute delete_workout_test_v1'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.claim_notification_push_jobs_v1(integer)',
    'EXECUTE'
  ),
  'anon cannot claim notification push jobs'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_notification_push_jobs_v1(integer)',
    'EXECUTE'
  ),
  'authenticated cannot claim notification push jobs'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.claim_notification_push_jobs_v1(integer)',
    'EXECUTE'
  ),
  'service_role can claim notification push jobs'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.enqueue_notification_push_v1(uuid,uuid)',
    'EXECUTE'
  ),
  'anon cannot enqueue notification push jobs directly'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.enqueue_notification_push_v1(uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated cannot enqueue notification push jobs directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.enqueue_notification_push_v1(uuid,uuid)',
    'EXECUTE'
  ),
  'service_role can enqueue notification push jobs'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_notification_v1(uuid,uuid,text,text,text,text,uuid,text)',
    'EXECUTE'
  ),
  'anon cannot forge current-format notifications'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_notification_v1(uuid,uuid,text,text,text,text,uuid,text)',
    'EXECUTE'
  ),
  'authenticated cannot forge current-format notifications'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.create_notification_v1(uuid,uuid,text,text,text,text,uuid,text)',
    'EXECUTE'
  ),
  'service_role can create current-format notifications'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_notification_v1(uuid,uuid,text,uuid,uuid,uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  'anon cannot execute legacy internal notification creator'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_notification_v1(uuid,uuid,text,uuid,uuid,uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  'authenticated cannot execute legacy internal notification creator'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.create_notification_v1(uuid,uuid,text,uuid,uuid,uuid,uuid,jsonb)',
    'EXECUTE'
  ),
  'service_role can execute legacy internal notification creator'
);

-- A crashed worker must not strand a processing job forever.
insert into auth.users (id, email)
values (
  '81818181-8181-4181-8181-818181818181',
  'push-recovery@test.local'
);

insert into public.profiles (id, name, email)
values (
  '81818181-8181-4181-8181-818181818181',
  'Push Recovery User',
  'push-recovery@test.local'
);

insert into public.notifications (
  id,
  recipient_id,
  actor_id,
  type,
  title,
  body,
  entity_type,
  entity_id,
  push_status
)
values (
  '82828282-8282-4282-8282-828282828282',
  '81818181-8181-4181-8181-818181818181',
  null,
  'followed_you',
  'Recovery test',
  'Recovery test',
  'profile',
  '81818181-8181-4181-8181-818181818181',
  'pending'
);

insert into public.notification_push_jobs (
  id,
  notification_id,
  recipient_id,
  status,
  attempts,
  claimed_at
)
values (
  '83838383-8383-4383-8383-838383838383',
  '82828282-8282-4282-8282-828282828282',
  '81818181-8181-4181-8181-818181818181',
  'processing',
  1,
  now() - interval '11 minutes'
);

set local role service_role;

select results_eq(
  $actual$
    select job_id
    from public.claim_notification_push_jobs_v1(20)
  $actual$,
  $expected$
    values ('83838383-8383-4383-8383-838383838383'::uuid)
  $expected$,
  'stale processing job is recovered and claimed again'
);

select is(
  (
    select status
    from public.notification_push_jobs
    where id = '83838383-8383-4383-8383-838383838383'
  ),
  'processing',
  'recovered job returns to processing after being reclaimed'
);

select is(
  (
    select attempts
    from public.notification_push_jobs
    where id = '83838383-8383-4383-8383-838383838383'
  ),
  2,
  'recovered job increments attempts when reclaimed'
);

select ok(
  (
    select claimed_at > now() - interval '1 minute'
    from public.notification_push_jobs
    where id = '83838383-8383-4383-8383-838383838383'
  ),
  'reclaimed job receives a fresh claim timestamp'
);

select * from finish();
rollback;
