begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id,email) values
 ('10000000-0000-4000-8000-000000000001','plans-a@test.local'),
 ('10000000-0000-4000-8000-000000000002','plans-b@test.local');
insert into public.profiles (id,name,email) values
 ('10000000-0000-4000-8000-000000000001','Plans A','plans-a@test.local'),
 ('10000000-0000-4000-8000-000000000002','Plans B','plans-b@test.local');
insert into public.plans (id,user_id,title) values
 ('11000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','A plan'),
 ('11000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','B plan');
insert into public.workouts (id,user_id,title) values
 ('12000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','A workout'),
 ('12000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','B workout');
insert into public.plan_workouts (id,plan_id,workout_id,title) values
 ('13000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','A plan workout'),
 ('13000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000002','12000000-0000-4000-8000-000000000002','B plan workout');
insert into public.goals (id,user_id,plan_id,type,target_number,goal_summary) values
 ('14000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','workout_frequency',4,'A goal'),
 ('14000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000002','workout_frequency',3,'B goal');

set local role authenticated;
set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000001';

select is((select count(*) from public.plans),1::bigint,'user sees only own plans');
select is((select count(*) from public.plan_workouts),1::bigint,'user sees only own plan workouts');
select is((select count(*) from public.goals),1::bigint,'user sees only own goals');

select lives_ok(
 $$ insert into public.plans(user_id,title) values('10000000-0000-4000-8000-000000000001','new own plan') $$,
 'user can create own plan'
);
select throws_ok(
 $$ insert into public.plans(user_id,title) values('10000000-0000-4000-8000-000000000002','forged plan') $$,
 '42501', null, 'user cannot create plan for another user'
);
select throws_ok(
 $$ insert into public.goals(user_id,type,target_number,goal_summary) values('10000000-0000-4000-8000-000000000002','workout_frequency',5,'forged goal') $$,
 '42501', null, 'user cannot create goal for another user'
);
select results_eq(
 $actual$ update public.plans set title='hacked' where id='11000000-0000-4000-8000-000000000002' returning 1 $actual$,
 $expected$ select 1 where false $expected$,
 'user cannot update another user plan'
);
select results_eq(
 $actual$ delete from public.goals where id='14000000-0000-4000-8000-000000000002' returning 1 $actual$,
 $expected$ select 1 where false $expected$,
 'user cannot delete another user goal'
);
select throws_ok(
 $$ insert into public.plan_workouts(plan_id,workout_id,title) values(
 '11000000-0000-4000-8000-000000000002',
 '12000000-0000-4000-8000-000000000001',
 'forged link') $$,
 '42501', null, 'user cannot attach a workout to another user plan'
);

set local request.jwt.claim.sub='10000000-0000-4000-8000-000000000002';
select is((select count(*) from public.plans),1::bigint,'second user sees only own plans');

select * from finish();
rollback;
