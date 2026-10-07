begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'save-user@test.local'
);

insert into public.profiles (id, name, email)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Save Test User',
  'save-user@test.local'
);

insert into public.exercises (id, name, type, is_public)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Save Test Bench',
  'strength'::public.exercise_type,
  true
);

insert into public.workouts (id, user_id, title)
values (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Save Test Workout'
);

insert into public.workout_exercises (
  id,
  workout_id,
  exercise_id,
  order_index,
  target_sets,
  target_reps,
  target_weight
)
values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  0,
  2,
  5,
  100
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select lives_ok(
  $$
    select public.save_completed_workout_v1(
      '{
        "client_save_id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        "workout_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        "completed_at":"2026-10-07T09:00:00Z",
        "duration_seconds":1800,
        "notes":"database contract test",
        "exercise_history":[
          {
            "exercise_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            "workout_exercise_id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            "order_index":0,
            "is_dropset":false,
            "sets":[
              {"set_number":1,"drop_index":0,"reps":5,"weight":100},
              {"set_number":2,"drop_index":0,"reps":5,"weight":102.5}
            ]
          }
        ],
        "workout_exercise_updates":[]
      }'::jsonb
    )
  $$,
  'completed workout save succeeds'
);

select is(
  (
    select count(*)
    from public.workout_history
    where client_save_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  ),
  1::bigint,
  'save creates exactly one workout history row'
);

select is(
  (
    select count(*)
    from public.workout_exercise_history weh
    join public.workout_history wh on wh.id = weh.workout_history_id
    where wh.client_save_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  ),
  1::bigint,
  'save creates exactly one exercise history row'
);

select is(
  (
    select count(*)
    from public.workout_set_history wsh
    join public.workout_exercise_history weh
      on weh.id = wsh.workout_exercise_history_id
    join public.workout_history wh
      on wh.id = weh.workout_history_id
    where wh.client_save_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  ),
  2::bigint,
  'save creates every submitted set'
);

select is(
  (
    select user_id
    from public.workout_history
    where client_save_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  ),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'saved workout history belongs to auth.uid()'
);

select is(
  public.save_completed_workout_v1(
    '{
      "client_save_id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      "workout_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "completed_at":"2026-10-07T09:00:00Z",
      "duration_seconds":1800,
      "notes":"database contract test",
      "exercise_history":[
        {
          "exercise_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          "workout_exercise_id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          "order_index":0,
          "is_dropset":false,
          "sets":[
            {"set_number":1,"drop_index":0,"reps":5,"weight":100},
            {"set_number":2,"drop_index":0,"reps":5,"weight":102.5}
          ]
        }
      ],
      "workout_exercise_updates":[]
    }'::jsonb
  ),
  (
    select id
    from public.workout_history
    where client_save_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  ),
  'retry with same client_save_id returns original history id'
);

select is(
  (
    select count(*)
    from public.workout_history
    where client_save_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  ),
  1::bigint,
  'retry does not duplicate workout history'
);

select * from finish();
rollback;
