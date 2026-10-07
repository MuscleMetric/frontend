begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users(id,email) values
 ('40000000-0000-4000-8000-000000000001','workout-a@test.local'),
 ('40000000-0000-4000-8000-000000000002','workout-b@test.local');
insert into public.profiles(id,name,email) values
 ('40000000-0000-4000-8000-000000000001','Workout A','workout-a@test.local'),
 ('40000000-0000-4000-8000-000000000002','Workout B','workout-b@test.local');

insert into public.exercises(id,name,type,is_public) values
 ('41000000-0000-4000-8000-000000000001','Coverage Bench','strength',true),
 ('41000000-0000-4000-8000-000000000002','Coverage Run','cardio',true);

insert into public.workouts(id,user_id,title) values
 ('42000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','A workout'),
 ('42000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','B workout');

insert into public.workout_exercises(id,workout_id,exercise_id,order_index,target_sets,target_reps,target_weight) values
 ('43000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001',0,3,5,100),
 ('43000000-0000-4000-8000-000000000002','42000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000001',0,3,5,80);

insert into public.plans(id,user_id,title) values
 ('44000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','A plan'),
 ('44000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','B plan');

insert into public.plan_workouts(id,plan_id,workout_id,title,weekly_complete) values
 ('45000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','A planned workout',false),
 ('45000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000002','42000000-0000-4000-8000-000000000002','B planned workout',false);

set local role authenticated;
set local request.jwt.claim.sub='40000000-0000-4000-8000-000000000001';

select lives_ok(
 $$
 select public.save_completed_workout_v1(
 '{
   "client_save_id":"46000000-0000-4000-8000-000000000001",
   "workout_id":"42000000-0000-4000-8000-000000000001",
   "plan_workout_id":"45000000-0000-4000-8000-000000000001",
   "completed_at":"2026-10-07T18:00:00Z",
   "duration_seconds":1800,
   "exercise_history":[{
      "exercise_id":"41000000-0000-4000-8000-000000000001",
      "workout_exercise_id":"43000000-0000-4000-8000-000000000001",
      "order_index":0,
      "is_dropset":false,
      "sets":[{"set_number":1,"drop_index":0,"reps":6,"weight":105}]
   }],
   "workout_exercise_updates":[{
      "id":"43000000-0000-4000-8000-000000000001",
      "target_sets":4,"target_reps":6,"target_weight":105
   },{
      "id":"43000000-0000-4000-8000-000000000002",
      "target_sets":9,"target_reps":9,"target_weight":999
   }]
 }'::jsonb)
 $$,
 'save supports plan completion and target updates'
);

select is(
 (select weekly_complete from public.plan_workouts where id='45000000-0000-4000-8000-000000000001'),
 true,'owned plan workout is marked complete'
);

set local role postgres;
select is(
 (select weekly_complete from public.plan_workouts where id='45000000-0000-4000-8000-000000000002'),
 false,'another users plan workout is not modified'
);
select is(
 (select target_sets from public.workout_exercises where id='43000000-0000-4000-8000-000000000001'),
 4::smallint,'owned workout target sets update'
);
select is(
 (select target_weight from public.workout_exercises where id='43000000-0000-4000-8000-000000000001'),
 105::numeric,'owned workout target weight updates'
);
select is(
 (select target_weight from public.workout_exercises where id='43000000-0000-4000-8000-000000000002'),
 80::numeric,'another users workout target is not modified'
);

set local role authenticated;
set local request.jwt.claim.sub='40000000-0000-4000-8000-000000000001';

select throws_ok(
 $$
 select public.save_completed_workout_v1(
 '{
   "client_save_id":"46000000-0000-4000-8000-000000000002",
   "workout_id":"42000000-0000-4000-8000-000000000001",
   "completed_at":"2026-10-07T19:00:00Z",
   "duration_seconds":100,
   "exercise_history":[{
      "exercise_id":"41000000-0000-4000-8000-000000000001",
      "order_index":0,
      "is_dropset":false,
      "sets":[{"set_number":40000,"drop_index":0,"reps":5,"weight":100}]
   }],
   "workout_exercise_updates":[]
 }'::jsonb)
 $$,
 '22003', null, 'invalid child set aborts the completed-workout save'
);

select is(
 (select count(*) from public.workout_history where client_save_id='46000000-0000-4000-8000-000000000002'),
 0::bigint,'failed save rolls back parent workout history'
);

select lives_ok(
 $$
 select public.save_completed_workout_v1(
 '{
   "client_save_id":"46000000-0000-4000-8000-000000000003",
   "workout_id":"42000000-0000-4000-8000-000000000001",
   "completed_at":"2026-10-07T20:00:00Z",
   "duration_seconds":1500,
   "exercise_history":[{
      "exercise_id":"41000000-0000-4000-8000-000000000002",
      "order_index":0,
      "is_dropset":false,
      "sets":[{"set_number":1,"drop_index":0,"time_seconds":1500,"distance":5}]
   }],
   "workout_exercise_updates":[]
 }'::jsonb)
 $$,
 'cardio workout save succeeds'
);

select is(
 (select count(*) from public.cardio_prs cp join public.workout_history wh on wh.id=cp.workout_history_id
  where wh.client_save_id='46000000-0000-4000-8000-000000000003' and cp.metric='longest_distance'),
 1::bigint,'cardio save creates longest-distance PR'
);
select is(
 (select value from public.cardio_prs cp join public.workout_history wh on wh.id=cp.workout_history_id
  where wh.client_save_id='46000000-0000-4000-8000-000000000003' and cp.metric='fastest_5k'),
 1500::numeric,'cardio save creates 5k benchmark PR from average pace'
);
select is(
 (select user_id from public.cardio_prs cp join public.workout_history wh on wh.id=cp.workout_history_id
  where wh.client_save_id='46000000-0000-4000-8000-000000000003' limit 1),
 '40000000-0000-4000-8000-000000000001'::uuid,'cardio PR belongs to authenticated user'
);
select ok(
 (select count(*) from public.cardio_prs cp join public.workout_history wh on wh.id=cp.workout_history_id
  where wh.client_save_id='46000000-0000-4000-8000-000000000003') >= 4,
 'cardio save generates applicable PR metrics'
);

select * from finish();
rollback;
