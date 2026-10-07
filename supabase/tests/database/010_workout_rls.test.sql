begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'rls-user-1@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'rls-user-2@test.local');

insert into public.profiles (id, name, email)
values
  ('11111111-1111-4111-8111-111111111111', 'RLS User 1', 'rls-user-1@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'RLS User 2', 'rls-user-2@test.local');

insert into public.exercises (id, name, type, is_public)
values (
  '33333333-3333-4333-8333-333333333333',
  'RLS Test Exercise',
  'strength'::public.exercise_type,
  true
);

insert into public.workouts (id, user_id, title)
values
  (
    '44444444-4444-4444-8444-444444444441',
    '11111111-1111-4111-8111-111111111111',
    'User 1 Workout'
  ),
  (
    '44444444-4444-4444-8444-444444444442',
    '22222222-2222-4222-8222-222222222222',
    'User 2 Workout'
  );

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select is(
  (select count(*) from public.workouts),
  1::bigint,
  'user 1 can read only their own workouts'
);

select lives_ok(
  $$
    insert into public.workouts (user_id, title)
    values (
      '11111111-1111-4111-8111-111111111111',
      'User 1 New Workout'
    )
  $$,
  'user 1 can create their own workout'
);

select throws_ok(
  $$
    insert into public.workouts (user_id, title)
    values (
      '22222222-2222-4222-8222-222222222222',
      'Forged Workout'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "workouts"',
  'user 1 cannot create a workout for user 2'
);

select results_eq(
  $
    update public.workouts
    set title = 'Hacked'
    where id = '44444444-4444-4444-8444-444444444442'
    returning 1
  $,
  $ select 1 where false $,
  'user 1 cannot update user 2 workout'
);

select results_eq(
  $
    delete from public.workouts
    where id = '44444444-4444-4444-8444-444444444442'
    returning 1
  $,
  $ select 1 where false $,
  'user 1 cannot delete user 2 workout'
);

select throws_ok(
  $$
    insert into public.workout_exercises (
      workout_id,
      exercise_id,
      order_index
    )
    values (
      '44444444-4444-4444-8444-444444444442',
      '33333333-3333-4333-8333-333333333333',
      0
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "workout_exercises"',
  'user 1 cannot add exercises to user 2 workout'
);

set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';

select is(
  (select count(*) from public.workouts),
  1::bigint,
  'user 2 can read only their own workouts'
);

select * from finish();
rollback;
