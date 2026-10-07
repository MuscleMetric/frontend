begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users(id,email) values
 ('50000000-0000-4000-8000-000000000001','ach-a@test.local'),
 ('50000000-0000-4000-8000-000000000002','ach-b@test.local');
insert into public.profiles(id,name,email) values
 ('50000000-0000-4000-8000-000000000001','Ach A','ach-a@test.local'),
 ('50000000-0000-4000-8000-000000000002','Ach B','ach-b@test.local');
insert into public.achievements(id,code,title,description,category,difficulty,rule) values
 ('51000000-0000-4000-8000-000000000001','coverage-achievement','Coverage','Coverage test','general','easy','{}');

insert into public.user_achievements(user_id,achievement_id) values
 ('50000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001'),
 ('50000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000001');
insert into public.user_achievement_progress(user_id,achievement_id,progress) values
 ('50000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001',50),
 ('50000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000001',75);
insert into public.user_weekly_goal_stats(user_id,week_start,week_end,goal,workouts_completed,met_goal) values
 ('50000000-0000-4000-8000-000000000001','2026-10-04','2026-10-10',4,3,false),
 ('50000000-0000-4000-8000-000000000002','2026-10-04','2026-10-10',3,3,true);

set local role authenticated;
set local request.jwt.claim.sub='50000000-0000-4000-8000-000000000001';

select is((select count(*) from public.user_achievements),1::bigint,'user sees only own achievements');
select is((select count(*) from public.user_achievement_progress),1::bigint,'user sees only own achievement progress');
select is((select count(*) from public.user_weekly_goal_stats),1::bigint,'user sees only own weekly goal stats');

select results_eq(
 $actual$ update public.user_achievement_progress set progress=100
 where user_id='50000000-0000-4000-8000-000000000002'
 returning 1 $actual$,
 $expected$ select 1 where false $expected$,
 'user cannot update another users achievement progress'
);
select results_eq(
 $actual$ delete from public.user_achievements
 where user_id='50000000-0000-4000-8000-000000000002'
 returning 1 $actual$,
 $expected$ select 1 where false $expected$,
 'user cannot delete another users achievement'
);
select lives_ok(
 $$ update public.user_achievement_progress set progress=60
    where user_id='50000000-0000-4000-8000-000000000001' $$,
 'user can update own achievement progress'
);
select is(
 (select progress from public.user_achievement_progress where user_id='50000000-0000-4000-8000-000000000001'),
 60::numeric,'own progress update persists'
);
select is(
 (select workouts_completed from public.user_weekly_goal_stats),
 3,'weekly goal stats expose current users progress'
);

select * from finish();
rollback;
