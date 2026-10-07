-- MuscleMetric database baseline: functions
-- Current-state reconstruction from production on 2026-10-07.
-- Remote migration version 20260925170627 is already marked applied.
-- Future function changes belong in new migrations.

SET check_function_bodies = false;

CREATE OR REPLACE FUNCTION admin.weekly_maintenance_v1(force boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$declare
  now_london timestamp := now() at time zone 'Europe/London';
  dow int := extract(dow from now_london);  -- 0=Sun, 1=Mon...
  hh  int := extract(hour from now_london);
  mm  int := extract(minute from now_london);

  curr_week_start_london timestamp := date_trunc('week', now_london); -- Mon 00:00 London
  prev_week_start_london timestamp := curr_week_start_london - interval '7 days';
  prev_week_end_london   timestamp := curr_week_start_london;

  v_pw_reset int := 0;
  v_streaks  int := 0;
  run_id bigint;
begin
  insert into admin.job_runs(job_name, meta)
  values (
    'weekly_maintenance_v1',
    jsonb_build_object(
      'force', force,
      'now_london', now_london,
      'prev_week_start_london', prev_week_start_london,
      'prev_week_end_london', prev_week_end_london
    )
  )
  returning id into run_id;

if not force then
  if not (
    dow = 1
    and (
      (hh = 0 and mm between 0 and 9)
      or
      (hh = 1 and mm between 0 and 9)
    )
  ) then
    update admin.job_runs
    set ok = true,
        note = 'guard: skipped',
        finished_at = now()
    where id = run_id;
    return;
  end if;
end if;

  -- 1) Update weekly streaks FIRST, while weekly_complete still reflects last week
  with plan_users as (
    select id as user_id, active_plan_id
    from profiles
    where active_plan_id is not null
  ),
  plan_incomplete as (
    select pu.user_id
    from plan_users pu
    join plan_workouts pw
      on pw.plan_id = pu.active_plan_id
    where coalesce(pw.is_archived, false) = false
      and coalesce(pw.weekly_complete, false) = false
    group by pu.user_id
  ),
  plan_complete as (
    select pu.user_id
    from plan_users pu
    left join plan_incomplete pi
      on pi.user_id = pu.user_id
    where pi.user_id is null
  ),
  np_users as (
    select id as user_id, coalesce(weekly_workout_goal, 0) as goal
    from profiles
    where active_plan_id is null
  ),
  np_counts as (
    select
      p.id as user_id,
      count(wh.id) as wcount
    from profiles p
    left join workout_history wh
      on wh.user_id = p.id
     and (wh.completed_at at time zone 'Europe/London') >= prev_week_start_london
     and (wh.completed_at at time zone 'Europe/London') <  prev_week_end_london
    where p.active_plan_id is null
    group by p.id
  ),
  np_met as (
    select n.user_id
    from np_users n
    join np_counts c
      on c.user_id = n.user_id
    where n.goal > 0
      and c.wcount >= n.goal
  )
  update profiles p
  set weekly_streak = case
    when p.active_plan_id is not null then
      case
        when exists (
          select 1
          from plan_complete pc
          where pc.user_id = p.id
        )
        then coalesce(p.weekly_streak, 0) + 1
        else 0
      end
    else
      case
        when exists (
          select 1
          from np_met m
          where m.user_id = p.id
        )
        then coalesce(p.weekly_streak, 0) + 1
        else 0
      end
  end;
  get diagnostics v_streaks = row_count;

  -- 2) Reset weekly_complete flags AFTER streaks are calculated
  update plan_workouts
     set weekly_complete = false,
         updated_at = now()
   where coalesce(weekly_complete, false) = true;
  get diagnostics v_pw_reset = row_count;

  -- 3) Optional weekly stats snapshot refresh
  perform public.update_weekly_goal_stats(null);

  update admin.job_runs
  set ok = true,
      note = 'completed',
      finished_at = now(),
      meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object(
        'pw_reset_rows', v_pw_reset,
        'streak_rows', v_streaks
      )
  where id = run_id;

exception when others then
  update admin.job_runs
  set ok = false,
      note = sqlerrm,
      finished_at = now()
  where id = run_id;
  raise;
end;$function$

CREATE OR REPLACE FUNCTION public._is_core_muscle(p_name text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select lower(coalesce(p_name, '')) in (
    'core',
    'abs',
    'obliques',
    'core stabilizers'
  );
$function$

CREATE OR REPLACE FUNCTION public._mm_assert(p_condition boolean, p_message text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  if not coalesce(p_condition, false) then
    raise exception 'ASSERTION FAILED: %', p_message;
  end if;
end;
$function$

CREATE OR REPLACE FUNCTION public.accept_follow_request(p_requester uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  v_target uuid := auth.uid();
begin
  if v_target is null then
    raise exception 'Not authenticated';
  end if;

  if p_requester is null or p_requester = v_target then
    raise exception 'Invalid requester';
  end if;

  -- block check (either direction)
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = v_target and b.blocked_id = p_requester)
       or (b.blocker_id = p_requester and b.blocked_id = v_target)
  ) then
    raise exception 'Cannot accept due to block';
  end if;

  -- must be pending request to me
  if not exists (
    select 1
    from public.follow_requests r
    where r.requester_id = p_requester
      and r.target_id = v_target
      and r.status = 'pending'
  ) then
    raise exception 'No pending request found';
  end if;

  -- mark accepted
  update public.follow_requests
  set status = 'accepted',
      responded_at = now()
  where requester_id = p_requester
    and target_id = v_target
    and status = 'pending';

  -- insert follow edge (idempotent)
  insert into public.user_follows (follower_id, followee_id)
  values (p_requester, v_target)
  on conflict do nothing;

end;
$function$

CREATE OR REPLACE FUNCTION public.ack_home_transition(p_event_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
update public.user_events ue
set consumed_at = now()
where ue.id = p_event_id
  and ue.user_id = (select auth.uid())
  and ue.type = 'home_transition'
  and ue.consumed_at is null;
$function$

CREATE OR REPLACE FUNCTION public.add_post_comment(p_post_id uuid, p_body text)
 RETURNS TABLE(id uuid, post_id uuid, user_id uuid, user_name text, user_username text, body text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_body text := nullif(btrim(coalesce(p_body,'')), '');
  v_post record;
begin
  if v_user_id is null then
    raise exception 'auth_missing';
  end if;

  if p_post_id is null then
    raise exception 'post_id_required';
  end if;

  if v_body is null then
    raise exception 'body_required';
  end if;

  -- ensure post exists + viewer can see it (matches your get_feed rules)
  select p.*
    into v_post
  from public.posts p
  where p.id = p_post_id;

  if not found then
    raise exception 'post_not_found';
  end if;

  if not (
    v_post.user_id = v_user_id
    or (
      v_post.visibility = 'public'
      and public.can_view_user(v_user_id, v_post.user_id)
    )
    or (
      v_post.visibility = 'followers'
      and public.can_view_user(v_user_id, v_post.user_id)
      and exists (
        select 1 from public.user_follows f
        where f.follower_id = v_user_id
          and f.followee_id = v_post.user_id
      )
    )
    or (
      v_post.visibility = 'private'
      and v_post.user_id = v_user_id
    )
  ) then
    raise exception 'not_allowed';
  end if;

  insert into public.post_comments (post_id, user_id, body)
  values (p_post_id, v_user_id, v_body);

  -- return the inserted row hydrated
  return query
  select
    pc.id,
    pc.post_id,
    pc.user_id,
    pr.name as user_name,
    pr.username as user_username,
    pc.body,
    pc.created_at
  from public.post_comments pc
  join public.profiles pr on pr.id = pc.user_id
  where pc.post_id = p_post_id
    and pc.user_id = v_user_id
  order by pc.created_at desc, pc.id desc
  limit 1;
end;
$function$

CREATE OR REPLACE FUNCTION public.admin_alerts_v1(p_days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  v_total_users int;
  v_zero int;
  v_one int;
  v_missing_sets int;
begin
  select count(*) into v_total_users from public.profiles;

  -- all-time
  select count(*) into v_zero
  from public.profiles p
  where not exists (
    select 1 from public.workout_history wh where wh.user_id = p.id
  );

  select count(*) into v_one
  from public.profiles p
  where (
    select count(*) from public.workout_history wh where wh.user_id = p.id
  ) = 1;

  -- last 30d missing sets (same idea as your KPI)
  select count(*) into v_missing_sets
  from public.workout_history wh
  where wh.completed_at >= now() - interval '30 days'
    and not exists (
      select 1
      from public.workout_exercise_history weh
      join public.workout_set_history wsh
        on wsh.workout_exercise_history_id = weh.id
      where weh.workout_history_id = wh.id
    );

  return jsonb_build_array(
    jsonb_build_object(
      'key','zero_workouts',
      'severity', case when v_total_users = 0 then 'neutral'
                       when (v_zero::numeric / v_total_users) < 0.35 then 'good'
                       when (v_zero::numeric / v_total_users) <= 0.55 then 'ok'
                       else 'bad' end,
      'title','Users with 0 workouts',
      'description','These users never logged a workout.',
      'count', v_zero,
      'cta_label','View users',
      'drilldown','zero_workouts'
    ),
    jsonb_build_object(
      'key','one_workout',
      'severity','ok',
      'title','Users with 1 workout',
      'description','At-risk users (did not build a habit).',
      'count', v_one,
      'cta_label','View users',
      'drilldown','one_workout'
    ),
    jsonb_build_object(
      'key','missing_sets',
      'severity', case when v_missing_sets = 0 then 'good'
                       when v_missing_sets <= 2 then 'ok'
                       else 'bad' end,
      'title','Workouts missing sets',
      'description','Workouts created but no set rows logged (last 30d).',
      'count', v_missing_sets,
      'cta_label','View workouts',
      'drilldown','missing_sets'
    ),
    jsonb_build_object(
      'key','new_users',
      'severity','neutral',
      'title','New users',
      'description','Inspect recent signups.',
      'count', null,
      'cta_label','View users',
      'drilldown','new_users'
    )
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.admin_cron_end_due_plans()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  run_id uuid;
begin
  run_id := public.admin_job_run_start('end-due-plans-daily', 'cron');

  begin
    perform public.end_due_plans();
    perform public.admin_job_run_finish(run_id, 'success');
  exception when others then
    perform public.admin_job_run_finish(run_id, 'error', null, null, null, sqlerrm, jsonb_build_object('sqlstate', sqlstate));
    perform public.admin_log_error('job', 'end_due_plans_failed', sqlerrm, null, 'error', jsonb_build_object('sqlstate', sqlstate));
    raise;
  end;
end;
$function$

CREATE OR REPLACE FUNCTION public.admin_cron_recompute_all_step_stats(p_job_key text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  run_id uuid;
begin
  run_id := public.admin_job_run_start(p_job_key, 'cron');

  begin
    perform public.recompute_all_step_stats();

    perform public.admin_job_run_finish(run_id, 'success');
  exception when others then
    perform public.admin_job_run_finish(
      run_id,
      'error',
      null, null, null,
      sqlerrm,
      jsonb_build_object('sqlstate', sqlstate)
    );
    perform public.admin_log_error('job', p_job_key || '_failed', sqlerrm, null, 'error', jsonb_build_object('sqlstate', sqlstate));
    raise;
  end;
end;
$function$

CREATE OR REPLACE FUNCTION public.admin_cron_weekly_rollover()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  run_id uuid;
begin
  run_id := public.admin_job_run_start('weekly_rollover', 'cron');

  begin
    perform admin.process_weekly_rollover();
    perform public.admin_job_run_finish(run_id, 'success');
  exception when others then
    perform public.admin_job_run_finish(run_id, 'error', null, null, null, sqlerrm, jsonb_build_object('sqlstate', sqlstate));
    perform public.admin_log_error('job', 'weekly_rollover_failed', sqlerrm, null, 'error', jsonb_build_object('sqlstate', sqlstate));
    raise;
  end;
end;
$function$

CREATE OR REPLACE FUNCTION public.admin_dashboard_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  now_ts timestamptz := now();
  d1 interval := interval '1 day';
  d7 interval := interval '7 days';
  d30 interval := interval '30 days';
  w12 interval := interval '12 weeks';

  new_1 int;
  new_7 int;
  new_30 int;

  active_7 int;

  workouts_7 int;
  workouts_30 int;

  sets_7 int;
  sets_30 int;

  zero_workouts int;
  one_workout int;
  total_users int;

  activation_24h_rate numeric;
  retention_7d_2plus_rate numeric;

  missing_sets_30 int;

  new_users_daily jsonb;
  active_users_weekly jsonb;

  top_exercises_30 jsonb;
  equipment_dist_30 jsonb;

begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  -- totals
  select count(*)::int into total_users from public.profiles;

  select count(*)::int into new_1  from public.profiles p where p.created_at >= now_ts - d1;
  select count(*)::int into new_7  from public.profiles p where p.created_at >= now_ts - d7;
  select count(*)::int into new_30 from public.profiles p where p.created_at >= now_ts - d30;

  -- active users (7d) = users who completed >=1 workout
  select count(distinct wh.user_id)::int into active_7
  from public.workout_history wh
  where wh.completed_at >= now_ts - d7;

  -- workouts counts
  select count(*)::int into workouts_7
  from public.workout_history wh
  where wh.completed_at >= now_ts - d7;

  select count(*)::int into workouts_30
  from public.workout_history wh
  where wh.completed_at >= now_ts - d30;

  -- sets counts (join through exercise_history -> workout_history)
  select count(*)::int into sets_7
  from public.workout_set_history wsh
  join public.workout_exercise_history weh on weh.id = wsh.workout_exercise_history_id
  join public.workout_history wh on wh.id = weh.workout_history_id
  where wh.completed_at >= now_ts - d7;

  select count(*)::int into sets_30
  from public.workout_set_history wsh
  join public.workout_exercise_history weh on weh.id = wsh.workout_exercise_history_id
  join public.workout_history wh on wh.id = weh.workout_history_id
  where wh.completed_at >= now_ts - d30;

  -- funnel: 0 workouts
  select count(*)::int into zero_workouts
  from public.profiles p
  left join public.workout_history wh on wh.user_id = p.id
  where wh.id is null;

  -- funnel: 1 workout only
  select count(*)::int into one_workout
  from (
    select wh.user_id, count(*)::int as c
    from public.workout_history wh
    group by wh.user_id
  ) t
  where t.c = 1;

  -- activation rate: new users (last 30d) who do first workout within 24h
  select
    case when count(*) = 0 then 0
         else round(
           (count(*) filter (where first_workout_at is not null
                             and first_workout_at <= created_at + interval '24 hours'))::numeric
           / count(*)::numeric,
           4
         )
    end
  into activation_24h_rate
  from (
    select p.id, p.created_at,
           (select min(wh.completed_at)
            from public.workout_history wh
            where wh.user_id = p.id) as first_workout_at
    from public.profiles p
    where p.created_at >= now_ts - d30
  ) s;

  -- retention signal: new users (last 30d) who complete >=2 workouts in first 7d
  select
    case when count(*) = 0 then 0
         else round(
           (count(*) filter (where workouts_first7 >= 2))::numeric / count(*)::numeric,
           4
         )
    end
  into retention_7d_2plus_rate
  from (
    select p.id,
      (select count(*)
       from public.workout_history wh
       where wh.user_id = p.id
         and wh.completed_at >= p.created_at
         and wh.completed_at <  p.created_at + interval '7 days'
      )::int as workouts_first7
    from public.profiles p
    where p.created_at >= now_ts - d30
  ) r;

  -- =========================================================
  -- FIX #1: workouts missing sets (last 30d)
  -- count workout_history_id that has exercise_history but 0 sets
  -- =========================================================
  select count(*)::int
  into missing_sets_30
  from (
    select weh.workout_history_id
    from public.workout_exercise_history weh
    join public.workout_history wh on wh.id = weh.workout_history_id
    left join public.workout_set_history wsh
      on wsh.workout_exercise_history_id = weh.id
    where wh.completed_at >= now_ts - d30
    group by weh.workout_history_id
    having count(wsh.id) = 0
  ) x;

  -- trends: new users daily (last 30d)
  select jsonb_agg(x order by (x->>'day')::date)
  into new_users_daily
  from (
    select jsonb_build_object('day', d.day, 'count', count(p.id)::int) as x
    from generate_series((now_ts - d30)::date, now_ts::date, interval '1 day') d(day)
    left join public.profiles p on p.created_at::date = d.day
    group by d.day
  ) q;

  -- trends: active users weekly (last 12w)
  select jsonb_agg(x order by (x->>'week_start')::date)
  into active_users_weekly
  from (
    select jsonb_build_object('week_start', w.week_start, 'active_users', count(distinct wh.user_id)::int) as x
    from (
      select (date_trunc('week', now_ts)::date - (n * 7))::date as week_start
      from generate_series(0, 11) as n
    ) w
    left join public.workout_history wh
      on date_trunc('week', wh.completed_at)::date = w.week_start
    group by w.week_start
  ) q;

  -- top exercises (last 30d)
  select jsonb_agg(x)
  into top_exercises_30
  from (
    select jsonb_build_object('name', e.name, 'count', count(*)::int) as x
    from public.workout_exercise_history weh
    join public.workout_history wh on wh.id = weh.workout_history_id
    join public.exercises e on e.id = weh.exercise_id
    where wh.completed_at >= now_ts - d30
    group by e.name
    order by count(*) desc
    limit 10
  ) t;

  -- =========================================================
  -- FIX #2: equipment distribution (last 30d)
  -- group by equipment key first, then build json
  -- =========================================================
  select jsonb_agg(
    jsonb_build_object('equipment', equipment_key, 'count', cnt)
    order by cnt desc
  )
  into equipment_dist_30
  from (
    select
      coalesce(nullif(trim(e.equipment), ''), 'unknown') as equipment_key,
      count(*)::int as cnt
    from public.workout_exercise_history weh
    join public.workout_history wh on wh.id = weh.workout_history_id
    join public.exercises e on e.id = weh.exercise_id
    where wh.completed_at >= now_ts - d30
    group by 1
  ) t;

  return jsonb_build_object(
    'kpis', jsonb_build_object(
      'new_1d', new_1,
      'new_7d', new_7,
      'new_30d', new_30,
      'active_7d', active_7,
      'workouts_7d', workouts_7,
      'workouts_30d', workouts_30,
      'sets_7d', sets_7,
      'sets_30d', sets_30,
      'activation_24h_rate', activation_24h_rate,
      'retention_7d_2plus_rate', retention_7d_2plus_rate,
      'total_users', total_users,
      'zero_workouts', zero_workouts,
      'one_workout', one_workout,
      'missing_sets_30d', missing_sets_30
    ),
    'trends', jsonb_build_object(
      'new_users_daily', coalesce(new_users_daily, '[]'::jsonb),
      'active_users_weekly', coalesce(active_users_weekly, '[]'::jsonb)
    ),
    'content', jsonb_build_object(
      'top_exercises_30d', coalesce(top_exercises_30, '[]'::jsonb),
      'equipment_dist_30d', coalesce(equipment_dist_30, '[]'::jsonb)
    )
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.admin_funnel_v1(p_days integer DEFAULT 7)
 RETURNS TABLE(signed_up integer, created_plan integer, started_workout integer, completed_workout_with_sets integer, returned_within_7d integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  since_ts timestamptz := now() - make_interval(days => greatest(p_days, 1));
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  -- cohort: users who signed up in the last p_days
  signed_up := (
    select count(*)::int
    from public.profiles p
    where p.created_at >= since_ts
  );

  created_plan := (
    select count(distinct p.id)::int
    from public.profiles p
    join public.plans pl on pl.user_id = p.id
    where p.created_at >= since_ts
      and pl.created_at >= p.created_at
      and pl.created_at <= p.created_at + interval '30 days'
  );

  started_workout := (
    select count(distinct p.id)::int
    from public.profiles p
    join public.workout_history wh on wh.user_id = p.id
    where p.created_at >= since_ts
      and wh.completed_at >= p.created_at
      and wh.completed_at <= p.created_at + interval '30 days'
  );

  completed_workout_with_sets := (
    select count(distinct p.id)::int
    from public.profiles p
    join public.workout_history wh on wh.user_id = p.id
    where p.created_at >= since_ts
      and wh.completed_at >= p.created_at
      and wh.completed_at <= p.created_at + interval '30 days'
      and exists (
        select 1
        from public.workout_exercise_history weh
        join public.workout_set_history wsh
          on wsh.workout_exercise_history_id = weh.id
        where weh.workout_history_id = wh.id
        limit 1
      )
  );

  -- "returned" = at least 2 workouts within 7 days of signup
  returned_within_7d := (
    select count(*)::int
    from (
      select p.id
      from public.profiles p
      join public.workout_history wh on wh.user_id = p.id
      where p.created_at >= since_ts
        and wh.completed_at >= p.created_at
        and wh.completed_at <= p.created_at + interval '7 days'
      group by p.id
      having count(*) >= 2
    ) t
  );

  return next;
end;
$function$

CREATE OR REPLACE FUNCTION public.admin_job_run_finish(p_run_id uuid, p_status text, p_rows_processed integer DEFAULT NULL::integer, p_rows_updated integer DEFAULT NULL::integer, p_rows_inserted integer DEFAULT NULL::integer, p_error_message text DEFAULT NULL::text, p_error_detail jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  v_start timestamptz;
  v_ms int;
begin
  select started_at into v_start
  from public.admin_job_runs
  where id = p_run_id;

  v_ms := case when v_start is null then null else (extract(epoch from (now() - v_start)) * 1000)::int end;

  update public.admin_job_runs
  set
    finished_at = now(),
    status = p_status,
    duration_ms = v_ms,
    rows_processed = p_rows_processed,
    rows_updated = p_rows_updated,
    rows_inserted = p_rows_inserted,
    error_message = p_error_message,
    error_detail = p_error_detail
  where id = p_run_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.admin_job_run_start(p_job_key text, p_job_source text DEFAULT 'cron'::text, p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  v_id uuid;
begin
  insert into public.admin_job_runs(job_key, job_source, status, started_at, triggered_by, meta)
  values (p_job_key, p_job_source, 'running', now(), auth.uid(), coalesce(p_meta, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.admin_job_runs_recent(p_job_key text, p_limit integer DEFAULT 12)
 RETURNS TABLE(id uuid, started_at timestamp with time zone, finished_at timestamp with time zone, status text, duration_ms integer, rows_processed integer, rows_updated integer, rows_inserted integer, error_message text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
  select
    r.id,
    r.started_at,
    r.finished_at,
    r.status,
    r.duration_ms,
    r.rows_processed,
    r.rows_updated,
    r.rows_inserted,
    r.error_message
  from public.admin_job_runs r
  where r.job_key = p_job_key
  order by r.started_at desc
  limit greatest(1, least(p_limit, 50));
$function$

CREATE OR REPLACE FUNCTION public.admin_list_active_users_v1(p_days integer DEFAULT 7, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, name text, email text, role text, workouts_in_period integer, last_workout_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with period as (
    select *
    from public.workout_history
    where completed_at >= now() - make_interval(days => greatest(p_days, 1))
  ),
  agg as (
    select user_id,
           count(*)::int as cnt,
           max(completed_at) as last_at
    from period
    group by user_id
  )
  select
    p.id,
    p.name,
    p.email,
    p.role,
    a.cnt as workouts_in_period,
    a.last_at as last_workout_at
  from agg a
  join public.profiles p on p.id = a.user_id
  where public.is_admin()
  order by a.cnt desc, a.last_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$function$

CREATE OR REPLACE FUNCTION public.admin_list_new_users_v1(p_days integer DEFAULT 7, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, name text, email text, role text, workouts_total integer, last_workout_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    p.id,
    p.created_at,
    p.name,
    p.email,
    p.role,
    coalesce(wc.cnt, 0)::int as workouts_total,
    wl.last_at as last_workout_at
  from public.profiles p
  left join (
    select user_id, count(*) as cnt
    from public.workout_history
    group by user_id
  ) wc on wc.user_id = p.id
  left join (
    select user_id, max(completed_at) as last_at
    from public.workout_history
    group by user_id
  ) wl on wl.user_id = p.id
  where public.is_admin()
    and p.created_at >= now() - make_interval(days => greatest(p_days, 1))
  order by p.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$function$

CREATE OR REPLACE FUNCTION public.admin_list_users_one_workout_v1(p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, name text, email text, role text, workout_id uuid, workout_completed_at timestamp with time zone, workout_title text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with c as (
    select wh.user_id, count(*) as cnt
    from public.workout_history wh
    group by wh.user_id
    having count(*) = 1
  )
  select
    p.id,
    p.created_at,
    p.name,
    p.email,
    p.role,
    wh.id as workout_id,
    wh.completed_at as workout_completed_at,
    coalesce(w.title, 'Workout') as workout_title
  from c
  join public.profiles p on p.id = c.user_id
  join public.workout_history wh on wh.user_id = p.id
  left join public.workouts w on w.id = wh.workout_id
  where public.is_admin()
  order by wh.completed_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$function$

CREATE OR REPLACE FUNCTION public.admin_list_users_zero_workouts_v1(p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, name text, email text, role text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    p.id,
    p.created_at,
    p.name,
    p.email,
    p.role
  from public.profiles p
  where public.is_admin()
    and not exists (
      select 1 from public.workout_history wh where wh.user_id = p.id
    )
  order by p.created_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$function$

CREATE OR REPLACE FUNCTION public.admin_list_workouts_missing_sets_v1(p_days integer DEFAULT 30, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS TABLE(workout_history_id uuid, user_id uuid, completed_at timestamp with time zone, workout_title text, has_notes boolean, exercises_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with recent as (
    select wh.*
    from public.workout_history wh
    where wh.completed_at >= now() - make_interval(days => greatest(p_days, 1))
  ),
  ex_count as (
    select weh.workout_history_id, count(*)::int as cnt
    from public.workout_exercise_history weh
    group by weh.workout_history_id
  )
  select
    wh.id as workout_history_id,
    wh.user_id,
    wh.completed_at,
    coalesce(w.title, 'Workout') as workout_title,
    (wh.notes is not null and length(trim(wh.notes)) > 0) as has_notes,
    coalesce(ec.cnt, 0) as exercises_count
  from recent wh
  left join public.workouts w on w.id = wh.workout_id
  left join ex_count ec on ec.workout_history_id = wh.id
  where public.is_admin()
    and not exists (
      select 1
      from public.workout_exercise_history weh
      join public.workout_set_history wsh
        on wsh.workout_exercise_history_id = weh.id
      where weh.workout_history_id = wh.id
      limit 1
    )
  order by wh.completed_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$function$

CREATE OR REPLACE FUNCTION public.admin_log_error(p_source text, p_event_key text, p_message text, p_user_id uuid DEFAULT NULL::uuid, p_level text DEFAULT 'error'::text, p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
  insert into public.admin_error_events(source, event_key, message, user_id, level, meta)
  values (p_source, p_event_key, p_message, p_user_id, p_level, coalesce(p_meta, '{}'::jsonb));
$function$

CREATE OR REPLACE FUNCTION public.admin_new_users(p_days integer, p_lim integer)
 RETURNS TABLE(kind text, user_id uuid, email text, name text, created_at timestamp with time zone, meta text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
  select
    'user'::text as kind,
    p.id as user_id,
    p.email,
    p.name,
    p.created_at,
    null::text as meta
  from public.profiles p
  where p.created_at >= now() - (p_days || ' days')::interval
  order by p.created_at desc
  limit p_lim;
$function$

CREATE OR REPLACE FUNCTION public.admin_ops_snapshot_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  v jsonb;
begin
  with latest as (
    select
      d.job_key,
      d.title,
      d.enabled,
      d.expected_every_minutes,
      d.alert_after_minutes,
      r.started_at,
      r.finished_at,
      r.status,
      r.duration_ms,
      r.error_message
    from public.admin_job_definitions d
    left join lateral (
      select *
      from public.admin_job_runs r
      where r.job_key = d.job_key
      order by r.started_at desc
      limit 1
    ) r on true
  ),
  jobs as (
    select jsonb_agg(
      jsonb_build_object(
        'job_key', job_key,
        'title', title,
        'enabled', enabled,
        'status', coalesce(status, 'never'),
        'started_at', started_at,
        'finished_at', finished_at,
        'duration_ms', duration_ms,
        'error_message', error_message,
        'is_late',
          case
            when not enabled then false
            when started_at is null then true
            else (extract(epoch from (now() - started_at)) / 60) > alert_after_minutes
          end
      )
      order by title asc
    ) as arr
    from latest
  ),
  errs as (
    select jsonb_agg(
      jsonb_build_object(
        'id', id,
        'created_at', created_at,
        'source', source,
        'level', level,
        'event_key', event_key,
        'message', message,
        'user_id', user_id,
        'meta', meta
      )
      order by created_at desc
    ) as arr
    from (
      select *
      from public.admin_error_events
      order by created_at desc
      limit 30
    ) e
  )
  select jsonb_build_object(
    'jobs', coalesce((select arr from jobs), '[]'::jsonb),
    'recent_errors', coalesce((select arr from errs), '[]'::jsonb)
  ) into v;

  return v;
end;
$function$

CREATE OR REPLACE FUNCTION public.admin_search_users(q text, lim integer DEFAULT 10)
 RETURNS TABLE(id uuid, email text, name text, created_at timestamp with time zone, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    p.id,
    p.email,
    p.name,
    p.created_at,
    p.role::text
  from public.profiles p
  where
    q is null
    or length(trim(q)) = 0
    or p.email ilike ('%' || q || '%')
    or p.name  ilike ('%' || q || '%')
  order by p.created_at desc
  limit greatest(1, least(lim, 50));
end;
$function$

CREATE OR REPLACE FUNCTION public.admin_set_user_flag(p_user_id uuid, p_flag_key text, p_value boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  updated jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if p_flag_key is null or length(trim(p_flag_key)) = 0 then
    raise exception 'flag key required';
  end if;

  update public.profiles p
  set settings =
    jsonb_set(
      coalesce(p.settings, '{}'::jsonb),
      array['flags', p_flag_key],
      to_jsonb(p_value),
      true
    ),
    updated_at = now()
  where p.id = p_user_id
  returning p.settings into updated;

  return jsonb_build_object('ok', true, 'settings', updated);
end;
$function$

CREATE OR REPLACE FUNCTION public.admin_user_summary(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  prof record;
  workouts_total int;
  last_workout timestamptz;
  sets_total int;
  goals_active int;
  active_plan_title text;

  total_volume numeric;
  most_performed_exercise_30d text;

begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select p.*
  into prof
  from public.profiles p
  where p.id = p_user_id;

  if prof.id is null then
    return jsonb_build_object('found', false);
  end if;

  select count(*)::int into workouts_total
  from public.workout_history wh
  where wh.user_id = p_user_id;

  select max(wh.completed_at) into last_workout
  from public.workout_history wh
  where wh.user_id = p_user_id;

  select count(*)::int into sets_total
  from public.workout_set_history wsh
  join public.workout_exercise_history weh on weh.id = wsh.workout_exercise_history_id
  join public.workout_history wh on wh.id = weh.workout_history_id
  where wh.user_id = p_user_id;

  select count(*)::int into goals_active
  from public.goals g
  where g.user_id = p_user_id and g.is_active = true;

  select p.title into active_plan_title
  from public.plans p
  where p.id = prof.active_plan_id;

  -- total volume (all-time): sum(weight * reps)
  select coalesce(sum(coalesce(wsh.weight, 0) * coalesce(wsh.reps, 0)), 0)
  into total_volume
  from public.workout_set_history wsh
  join public.workout_exercise_history weh on weh.id = wsh.workout_exercise_history_id
  join public.workout_history wh on wh.id = weh.workout_history_id
  where wh.user_id = p_user_id
    and wsh.weight is not null
    and wsh.reps is not null;

  -- most performed exercise (30d)
  select e.name
  into most_performed_exercise_30d
  from public.workout_exercise_history weh
  join public.workout_history wh on wh.id = weh.workout_history_id
  join public.exercises e on e.id = weh.exercise_id
  where wh.user_id = p_user_id
    and wh.completed_at >= now() - interval '30 days'
  group by e.name
  order by count(*) desc, e.name asc
  limit 1;

  return jsonb_build_object(
    'found', true,
    'profile', jsonb_build_object(
      'id', prof.id,
      'email', prof.email,
      'name', prof.name,
      'created_at', prof.created_at,
      'date_of_birth', prof.date_of_birth,
      'timezone', prof.timezone,
      'weekly_streak', prof.weekly_streak,
      'weekly_workout_goal', prof.weekly_workout_goal,
      'steps_goal', prof.steps_goal,
      'role', prof.role::text,
      'settings', prof.settings,
      'active_plan_id', prof.active_plan_id,
      'active_plan_title', active_plan_title
    ),
    'stats', jsonb_build_object(
      'workouts_total', workouts_total,
      'sets_total', sets_total,
      'last_workout_at', last_workout,
      'active_goals', goals_active,
      'total_volume', total_volume,
      'most_performed_exercise_30d', most_performed_exercise_30d
    )
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.admin_users_one_workout(p_days integer, p_lim integer)
 RETURNS TABLE(kind text, user_id uuid, email text, name text, created_at timestamp with time zone, meta text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
  select
    'user'::text as kind,
    p.id as user_id,
    p.email,
    p.name,
    p.created_at,
    'Exactly 1 workout'::text as meta
  from public.profiles p
  where p.created_at >= now() - (p_days || ' days')::interval
    and (select count(*) from public.workout_history wh where wh.user_id = p.id) = 1
  order by p.created_at desc
  limit p_lim;
$function$

CREATE OR REPLACE FUNCTION public.admin_users_zero_workouts(p_days integer, p_lim integer)
 RETURNS TABLE(kind text, user_id uuid, email text, name text, created_at timestamp with time zone, meta text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
  select
    'user'::text as kind,
    p.id as user_id,
    p.email,
    p.name,
    p.created_at,
    'No workouts'::text as meta
  from public.profiles p
  where p.created_at >= now() - (p_days || ' days')::interval
    and not exists (select 1 from public.workout_history wh where wh.user_id = p.id)
  order by p.created_at desc
  limit p_lim;
$function$

CREATE OR REPLACE FUNCTION public.admin_workouts_missing_sets(p_days integer, p_lim integer)
 RETURNS TABLE(kind text, workout_history_id uuid, user_id uuid, email text, name text, completed_at timestamp with time zone, workout_title text, meta text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
  select
    'workout'::text as kind,
    wh.id as workout_history_id,
    wh.user_id,
    p.email,
    p.name,
    wh.completed_at,
    w.title as workout_title,
    'No set rows'::text as meta
  from public.workout_history wh
  join public.profiles p on p.id = wh.user_id
  left join public.workouts w on w.id = wh.workout_id
  where wh.completed_at >= now() - (p_days || ' days')::interval
    and not exists (
      select 1
      from public.workout_exercise_history weh
      join public.workout_set_history wsh
        on wsh.workout_exercise_history_id = weh.id
      where weh.workout_history_id = wh.id
    )
  order by wh.completed_at desc
  limit p_lim;
$function$

CREATE OR REPLACE FUNCTION public.assert_can_activate_existing_plan(p_user_id uuid, p_plan_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_plan_owner uuid;
  v_is_completed boolean;
begin
  select p.user_id, p.is_completed
  into v_plan_owner, v_is_completed
  from public.plans p
  where p.id = p_plan_id;

  if v_plan_owner is null then
    raise exception using
      errcode = 'P0001',
      message = 'PLAN_NOT_FOUND',
      detail = 'Plan does not exist.';
  end if;

  if v_plan_owner <> p_user_id then
    raise exception using
      errcode = 'P0001',
      message = 'PLAN_NOT_FOUND',
      detail = 'Plan does not belong to this user.';
  end if;

  if v_is_completed = false then
    return;
  end if;

  perform public.assert_can_create_or_activate_plan(p_user_id);
end;
$function$

CREATE OR REPLACE FUNCTION public.assert_can_add_goal_to_plan(p_user_id uuid, p_plan_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_plan_owner uuid;
begin
  select p.user_id
    into v_plan_owner
  from public.plans p
  where p.id = p_plan_id;

  if v_plan_owner is null then
    raise exception using
      errcode = 'P0001',
      message = 'PLAN_NOT_FOUND',
      detail = 'Plan does not exist.';
  end if;

  if v_plan_owner <> p_user_id then
    raise exception using
      errcode = 'P0001',
      message = 'PLAN_NOT_FOUND',
      detail = 'Plan does not belong to this user.';
  end if;
end;
$function$

CREATE OR REPLACE FUNCTION public.assert_can_create_or_activate_plan(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current_count integer;
begin
  v_current_count := public.count_user_active_plans(p_user_id);

  if v_current_count >= 3 then
    raise exception using
      errcode = 'P0001',
      message = 'PLAN_LIMIT_REACHED',
      detail = format(
        'Active plan limit reached. Current=%s Max=3',
        v_current_count
      );
  end if;
end;
$function$

CREATE OR REPLACE FUNCTION public.assert_can_create_template(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_current_count integer;
begin
  v_current_count := public.count_user_templates(p_user_id);

  if v_current_count >= 15 then
    raise exception using
      errcode = 'P0001',
      message = 'TEMPLATE_LIMIT_REACHED',
      detail = format(
        'Template limit reached. Current=%s Max=15',
        v_current_count
      );
  end if;
end;
$function$

CREATE OR REPLACE FUNCTION public.assert_can_view_deep_analytics(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOT_AUTHENTICATED',
      detail = 'A user id is required.';
  end if;

  return;
end;
$function$

CREATE OR REPLACE FUNCTION public.award_achievements(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$declare
  a                         record;
  already                   boolean;

  -- toggle this to TRUE while testing
  debug                     boolean := true;

  -- precomputed stats
  workouts_total            int;
  best_streak               int;
  sessions_last7            int;
  sessions_this_month       int;
  total_vol                 numeric;
  distinct_ex               int;
  days_trained_total        int;
  weeks_active_total        int;
  best_month_streak         int;
  best_cardio_streak        int;
  distance_total_km         numeric;
  best_session_distance_km  numeric;
  max_session_volume        numeric;
  goals_completed_total     int;
  plans_completed_total     int;
  best_muscle_groups_week   int;
  best_session_duration_sec int;
  baseline_weekly_volume    numeric;
  best_weekly_volume        numeric;
  pr_best_pct_increase      numeric;

  -- helpers reused in branches
  bw_kg                     numeric;
  best_1rm                  numeric;
  needed                    numeric;

  step_needed               int;
  best_step_streak          int;

  target_month              int;
  month_sessions_count      int;

  cardio_this_month         int;

  per_week                  int;
  weeks_needed              int;
  best_consistency          int;

  months_needed             int[];
  months_have               int;

  need_cardio               int;
  need_strength             int;
  period_days               int;
  has_window                boolean;

  best_reps                 int;
begin
  ---------------------------------------------------------------------------
  -- PRECOMPUTED METRICS (all from your actual schema)
  ---------------------------------------------------------------------------

  -- total workouts
  select count(*) into workouts_total
  from public.workout_history
  where user_id = p_user_id;

  -- sessions in trailing 7 days
  select count(*) into sessions_last7
  from public.workout_history
  where user_id = p_user_id
    and completed_at >= now() - interval '7 days';

  -- sessions in current calendar month
  select count(*) into sessions_this_month
  from public.workout_history
  where user_id = p_user_id
    and date_trunc('month', completed_at) = date_trunc('month', now());

  -- total volume (sum reps * weight across all sets)
  select coalesce(sum(wsh.reps * coalesce(wsh.weight, 0)), 0) into total_vol
  from public.workout_history wh
  join public.workout_exercise_history weh on weh.workout_history_id = wh.id
  join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
  where wh.user_id = p_user_id;

  -- distinct exercises
  select count(distinct weh.exercise_id) into distinct_ex
  from public.workout_history wh
  join public.workout_exercise_history weh on weh.workout_history_id = wh.id
  where wh.user_id = p_user_id;

  -- total training days (distinct dates)
  select count(distinct date(completed_at)) into days_trained_total
  from public.workout_history
  where user_id = p_user_id;

  -- distinct active weeks
  select count(distinct date_trunc('week', completed_at)) into weeks_active_total
  from public.workout_history
  where user_id = p_user_id;

  -- best all-time day streak (consecutive days with any training)
  with days as (
    select distinct date(completed_at) d
    from public.workout_history
    where user_id = p_user_id
  ),
  runs as (
    select d,
           d - (row_number() over (order by d)) * interval '1 day' as grp
    from days
  ),
  agg as (
    select grp, count(*) as cnt
    from runs
    group by grp
  )
  select coalesce(max(cnt), 0) into best_streak
  from agg;

  -- best month streak (consecutive months with any training)
  with months as (
    select distinct date_trunc('month', completed_at)::date m
    from public.workout_history
    where user_id = p_user_id
  ),
  m_runs as (
    select m,
           (extract(year from m) * 12 + extract(month from m))::int
           - row_number() over (order by m) as grp
    from months
  ),
  m_agg as (
    select grp, count(*) as cnt
    from m_runs
    group by grp
  )
  select coalesce(max(cnt), 0) into best_month_streak
  from m_agg;

-- total distance + best single-session distance (distance stored in meters → convert to km)
select coalesce(sum(wsh.distance) / 1000.0, 0)
into distance_total_km
from public.workout_history wh
join public.workout_exercise_history weh on weh.workout_history_id = wh.id
join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
where wh.user_id = p_user_id;

select coalesce(max(sess_dist_km), 0)
into best_session_distance_km
from (
  select
    wh.id,
    sum(coalesce(wsh.distance, 0)) / 1000.0 as sess_dist_km
  from public.workout_history wh
  join public.workout_exercise_history weh on weh.workout_history_id = wh.id
  join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
  where wh.user_id = p_user_id
  group by wh.id
) dists;


  -- max single-session volume
  select coalesce(max(sess_vol), 0) into max_session_volume
  from (
    select wh.id,
           sum(wsh.reps * coalesce(wsh.weight, 0)) as sess_vol
    from public.workout_history wh
    join public.workout_exercise_history weh on weh.workout_history_id = wh.id
    join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
    where wh.user_id = p_user_id
    group by wh.id
  ) v;

  -- best single-session duration (seconds)
  select coalesce(max(duration_seconds), 0) into best_session_duration_sec
  from public.workout_history
  where user_id = p_user_id;

  -- goals completed:
  -- there is NO status column; we treat is_active = false as "completed".
  select count(*) into goals_completed_total
  from public.goals
  where user_id = p_user_id
    and is_active = false;

  -- plans completed
  select count(*) into plans_completed_total
  from public.plans
  where user_id = p_user_id
    and is_completed = true;

  -- best #muscle-groups in any week
  with week_muscles as (
    select
      date_trunc('week', wh.completed_at)::date as wk,
      em.muscle_id
    from public.workout_history wh
    join public.workout_exercise_history weh on weh.workout_history_id = wh.id
    join public.exercise_muscles em on em.exercise_id = weh.exercise_id
    where wh.user_id = p_user_id
    group by wk, em.muscle_id
  ),
  week_counts as (
    select wk, count(*) as cnt
    from week_muscles
    group by wk
  )
  select coalesce(max(cnt), 0) into best_muscle_groups_week
  from week_counts;

  -- weekly volume baseline & best (for volume_growth_pct)
  with weekly as (
    select
      date_trunc('week', wh.completed_at)::date as wk,
      sum(wsh.reps * coalesce(wsh.weight, 0)) as vol
    from public.workout_history wh
    join public.workout_exercise_history weh on weh.workout_history_id = wh.id
    join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
    where wh.user_id = p_user_id
    group by wk
    order by wk
  )
  select
    coalesce((select vol from weekly order by wk asc limit 1), 0),
    coalesce((select max(vol) from weekly), 0)
  into baseline_weekly_volume, best_weekly_volume;

  -- best PR percentage increase across exercises (for pr_increase_pct)
  with prs as (
    select
      weh.exercise_id,
      wsh.weight * (1 + wsh.reps::numeric / 30.0) as e1rm
    from public.workout_history wh
    join public.workout_exercise_history weh on weh.workout_history_id = wh.id
    join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
    where wh.user_id = p_user_id
      and wsh.weight is not null
      and wsh.reps > 0
  ),
  per_ex as (
    select exercise_id,
           min(e1rm) as min_1rm,
           max(e1rm) as max_1rm
    from prs
    group by exercise_id
    having min(e1rm) > 0
  )
  select coalesce(
           max((max_1rm - min_1rm) * 100.0 / nullif(min_1rm, 0)),
           0
         )
  into pr_best_pct_increase
  from per_ex;

  -- best cardio streak (days with ≥1 cardio workout)
  with cardio_days as (
    select distinct date(wh.completed_at) d
    from public.workout_history wh
    where wh.user_id = p_user_id
      and exists (
        select 1
        from public.workout_exercise_history weh
        join public.exercises e on e.id = weh.exercise_id
        where weh.workout_history_id = wh.id
          and e.type = 'cardio'
      )
  ),
  cardio_runs as (
    select d,
           d - (row_number() over (order by d)) * interval '1 day' as grp
    from cardio_days
  ),
  cardio_agg as (
    select grp, count(*) as cnt
    from cardio_runs
    group by grp
  )
  select coalesce(max(cnt), 0) into best_cardio_streak
  from cardio_agg;

  if debug then
    raise notice 'award_achievements: user=% workouts_total=% days_trained=% weeks_active=% total_vol=%km distance_total=%',
      p_user_id, workouts_total, days_trained_total, weeks_active_total, total_vol, distance_total_km;
  end if;

  ---------------------------------------------------------------------------
  -- MAIN LOOP: CHECK ALL ACHIEVEMENTS (from public.achievements)
  ---------------------------------------------------------------------------

  for a in
    select * from public.achievements
  loop
    -- skip if already unlocked
    select exists (
      select 1
      from public.user_achievements ua
      where ua.user_id = p_user_id
        and ua.achievement_id = a.id
    ) into already;

    if already then
      continue;
    end if;

    -------------------------------------------------------------------
    -- ========== SIMPLE COUNT-BASED RULES ==========
    -------------------------------------------------------------------

    if a.rule->>'type' = 'count_workouts' then
      if workouts_total >= (a.rule->>'gte')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (count_workouts)', a.code;
        end if;
      end if;

    elsif a.rule->>'type' = 'streak_days' then
      if best_streak >= (a.rule->>'gte')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (streak_days)', a.code;
        end if;
      end if;

    elsif a.rule->>'type' = 'sessions_in_period' then
      if (a.rule->>'period_days')::int = 7 then
        if sessions_last7 >= (a.rule->>'gte')::int then
          insert into public.user_achievements(user_id, achievement_id)
          values (p_user_id, a.id)
          on conflict do nothing;
          if debug then
            raise notice 'UNLOCK % (sessions_in_period,7d)', a.code;
          end if;
        end if;
      else
        if (
          select count(*)
          from public.workout_history wh
          where wh.user_id = p_user_id
            and wh.completed_at >=
                now() - ((a.rule->>'period_days')::int || ' days')::interval
        ) >= (a.rule->>'gte')::int then
          insert into public.user_achievements(user_id, achievement_id)
          values (p_user_id, a.id)
          on conflict do nothing;
          if debug then
            raise notice 'UNLOCK % (sessions_in_period,%d)', a.code,
              (a.rule->>'period_days')::int;
          end if;
        end if;
      end if;

    elsif a.rule->>'type' = 'sessions_in_month' then
      if sessions_this_month >= (a.rule->>'gte')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (sessions_in_month)', a.code;
        end if;
      end if;

    elsif a.rule->>'type' = 'total_volume' then
      if total_vol >= (a.rule->>'gte_kg')::numeric then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (total_volume)', a.code;
        end if;
      end if;

    elsif a.rule->>'type' in ('exercise_1rm_pct_bw', 'exercise_1rm_value') then
      -----------------------------------------------------------------
      -- best estimated 1RM for the named exercise
      -----------------------------------------------------------------
      select max(wsh.weight * (1 + wsh.reps::numeric / 30.0))
      into best_1rm
      from public.workout_history wh
      join public.workout_exercise_history weh on weh.workout_history_id = wh.id
      join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
      join public.exercises e on e.id = weh.exercise_id
      where wh.user_id = p_user_id
        and e.name = a.rule->>'exercise_name'
        and wsh.weight is not null
        and wsh.reps > 0;

      if best_1rm is null then
        continue;
      end if;

      if a.rule->>'type' = 'exercise_1rm_value' then
        needed := (a.rule->>'gte_kg')::numeric;
        if best_1rm >= needed then
          insert into public.user_achievements(user_id, achievement_id)
          values (p_user_id, a.id)
          on conflict do nothing;
          if debug then
            raise notice 'UNLOCK % (exercise_1rm_value)', a.code;
          end if;
        end if;
      else
        -- 1RM as multiple of bodyweight (profiles.weight or settings.weight_kg)
        select
          coalesce(
            p.weight::numeric,
            nullif((p.settings->>'weight_kg')::numeric, 0)
          )
        into bw_kg
        from public.profiles p
        where p.id = p_user_id;

        if bw_kg is null or bw_kg <= 0 then
          continue;
        end if;

        needed := (a.rule->>'gte_ratio')::numeric * bw_kg;
        if best_1rm >= needed then
          insert into public.user_achievements(user_id, achievement_id)
          values (p_user_id, a.id)
          on conflict do nothing;
          if debug then
            raise notice 'UNLOCK % (exercise_1rm_pct_bw)', a.code;
          end if;
        end if;
      end if;

    elsif a.rule->>'type' = 'variety_exercises' then
      if distinct_ex >= (a.rule->>'gte')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (variety_exercises)', a.code;
        end if;
      end if;

    elsif a.rule->>'type' = 'set_volume_single' then
      if max_session_volume >= (a.rule->>'gte_kg')::numeric then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (set_volume_single)', a.code;
        end if;
      end if;

    -------------------------------------------------------------------
    -- ========== DISTANCE / CARDIO / DURATION ==========
    -------------------------------------------------------------------

    elsif a.rule->>'type' = 'distance_total' then
      if distance_total_km >= (a.rule->>'gte_km')::numeric then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (distance_total)', a.code;
        end if;
      end if;

    elsif a.rule->>'type' = 'distance_single' then
      if best_session_distance_km >= (a.rule->>'gte_km')::numeric then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (distance_single)', a.code;
        end if;
      end if;

    elsif a.rule->>'type' = 'cardio_streak' then
      if best_cardio_streak >= (a.rule->>'gte_days')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (cardio_streak)', a.code;
        end if;
      end if;

    elsif a.rule->>'type' = 'cardio_sessions_month' then
      with cardio_sessions as (
        select distinct wh.id
        from public.workout_history wh
        where wh.user_id = p_user_id
          and date_trunc('month', wh.completed_at) = date_trunc('month', now())
          and exists (
            select 1
            from public.workout_exercise_history weh
            join public.exercises e on e.id = weh.exercise_id
            where weh.workout_history_id = wh.id
              and e.type = 'cardio'
          )
      )
      select count(*) into cardio_this_month
      from cardio_sessions;

      if cardio_this_month >= (a.rule->>'gte')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (cardio_sessions_month)', a.code;
        end if;
      end if;

    elsif a.rule->>'type' = 'duration_single' then
      if best_session_duration_sec >= (a.rule->>'gte_min')::int * 60 then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (duration_single)', a.code;
        end if;
      end if;

    -------------------------------------------------------------------
    -- ========== GOALS / PLANS ==========
    -------------------------------------------------------------------

    elsif a.rule->>'type' = 'goals_completed' then
      if goals_completed_total >= (a.rule->>'gte')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (goals_completed)', a.code;
        end if;
      end if;

    elsif a.rule->>'type' = 'plan_completed' then
      if plans_completed_total >= (a.rule->>'gte')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (plan_completed)', a.code;
        end if;
      end if;

    -------------------------------------------------------------------
    -- ========== CONSISTENCY / WEEKS / MONTHS / DAYS ==========
    -------------------------------------------------------------------

    elsif a.rule->>'type' = 'weekly_activity_weeks' then
      if weeks_active_total >= (a.rule->>'gte')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (weekly_activity_weeks)', a.code;
        end if;
      end if;

    elsif a.rule->>'type' = 'days_trained_total' then
      if days_trained_total >= (a.rule->>'gte')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (days_trained_total)', a.code;
        end if;
      end if;

    elsif a.rule->>'type' = 'month_specific_sessions' then
      target_month := (a.rule->>'month')::int;

      select count(*) into month_sessions_count
      from public.workout_history
      where user_id = p_user_id
        and extract(month from completed_at) = target_month;

      if month_sessions_count >= (a.rule->>'gte')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (month_specific_sessions)', a.code;
        end if;
      end if;

    elsif a.rule->>'type' = 'month_streak' then
      if best_month_streak >= (a.rule->>'gte_months')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (month_streak)', a.code;
        end if;
      end if;

    elsif a.rule->>'type' = 'consistency_weeks' then
      per_week     := (a.rule->>'per_week')::int;
      weeks_needed := (a.rule->>'weeks')::int;

      with weekly as (
        select
          date_trunc('week', completed_at)::date as wk,
          count(*) as cnt
        from public.workout_history
        where user_id = p_user_id
        group by wk
      ),
      ok_weeks as (
        select wk
        from weekly
        where cnt >= per_week
      ),
      runs as (
        select wk,
               wk - (row_number() over (order by wk)) * interval '7 days' as grp
        from ok_weeks
      ),
      agg as (
        select grp, count(*) as cnt
        from runs
        group by grp
      )
      select coalesce(max(cnt), 0) into best_consistency
      from agg;

      if best_consistency >= weeks_needed then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (consistency_weeks)', a.code;
        end if;
      end if;

    elsif a.rule->>'type' = 'daily_steps_streak' then
      step_needed := (a.rule->>'gte_steps')::int;

      with step_days as (
        select distinct day as d
        from public.daily_steps
        where user_id = p_user_id
          and steps >= step_needed
      ),
      step_runs as (
        select d,
               d - (row_number() over (order by d)) * interval '1 day' as grp
        from step_days
      ),
      step_agg as (
        select grp, count(*) as cnt
        from step_runs
        group by grp
      )
      select coalesce(max(cnt), 0) into best_step_streak
      from step_agg;

      if best_step_streak >= (a.rule->>'gte_days')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (daily_steps_streak)', a.code;
        end if;
      end if;

    -------------------------------------------------------------------
    -- ========== MUSCLE GROUP / SEASONS / MIXED TRAINING ==========
    -------------------------------------------------------------------

    elsif a.rule->>'type' = 'muscle_groups_trained' then
      if best_muscle_groups_week >= (a.rule->>'gte')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (muscle_groups_trained)', a.code;
        end if;
      end if;

    elsif a.rule->>'type' = 'season_participation' then
      -- **** FIXED HERE: use jsonb_array_elements_text instead of json_array_elements_text ****
      select array_agg((value)::int) into months_needed
      from jsonb_array_elements_text(a.rule->'months') as t(value);

      if months_needed is not null and cardinality(months_needed) > 0 then
        select count(distinct extract(month from completed_at)::int)
        into months_have
        from public.workout_history
        where user_id = p_user_id
          and extract(month from completed_at)::int = any (months_needed);

        if months_have = cardinality(months_needed) then
          insert into public.user_achievements(user_id, achievement_id)
          values (p_user_id, a.id)
          on conflict do nothing;
          if debug then
            raise notice 'UNLOCK % (season_participation)', a.code;
          end if;
        end if;
      end if;

    elsif a.rule->>'type' = 'mixed_training' then
      need_cardio   := (a.rule->>'cardio')::int;
      need_strength := (a.rule->>'strength')::int;
      period_days   := (a.rule->>'period_days')::int;
      has_window    := false;

      with workouts as (
        select
          wh.id,
          date(wh.completed_at) as d,
          bool_or(e.type = 'cardio') as is_cardio,
          bool_or(e.type <> 'cardio') as is_strength
        from public.workout_history wh
        join public.workout_exercise_history weh on weh.workout_history_id = wh.id
        join public.exercises e on e.id = weh.exercise_id
        where wh.user_id = p_user_id
        group by wh.id, d
      ),
      day_range as (
        select min(d) as min_d, max(d) as max_d
        from workouts
      ),
      windows as (
        select
          g::date as start_day,
          (g::date + (period_days - 1) * interval '1 day') as end_day
        from day_range dr,
             generate_series(dr.min_d, dr.max_d, interval '1 day') g
      ),
      window_stats as (
        select
          w.start_day,
          sum(case when wo.is_cardio   then 1 else 0 end) as cardio_sessions,
          sum(case when wo.is_strength then 1 else 0 end) as strength_sessions
        from windows w
        left join workouts wo
          on wo.d >= w.start_day
         and wo.d <= w.end_day
        group by w.start_day
      )
      select exists (
        select 1
        from window_stats
        where cardio_sessions   >= need_cardio
          and strength_sessions >= need_strength
      ) into has_window;

      if has_window then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (mixed_training)', a.code;
        end if;
      end if;

    -------------------------------------------------------------------
    -- ========== PROGRESSION ACHIEVEMENTS ==========
    -------------------------------------------------------------------

    elsif a.rule->>'type' = 'volume_growth_pct' then
      if baseline_weekly_volume > 0 then
        if (best_weekly_volume - baseline_weekly_volume) * 100.0
             / baseline_weekly_volume >= (a.rule->>'gte_pct')::numeric then
          insert into public.user_achievements(user_id, achievement_id)
          values (p_user_id, a.id)
          on conflict do nothing;
          if debug then
            raise notice 'UNLOCK % (volume_growth_pct)', a.code;
          end if;
        end if;
      end if;

    elsif a.rule->>'type' = 'pr_increase_pct' then
      if pr_best_pct_increase >= (a.rule->>'gte_pct')::numeric then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (pr_increase_pct)', a.code;
        end if;
      end if;

    elsif a.rule->>'type' = 'pr_sets_in_session' then
      select max(wsh.reps) into best_reps
      from public.workout_history wh
      join public.workout_exercise_history weh on weh.workout_history_id = wh.id
      join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
      join public.exercises e on e.id = weh.exercise_id
      where wh.user_id = p_user_id
        and e.name = a.rule->>'exercise_name';

      if best_reps is not null
         and best_reps >= (a.rule->>'gte_sets')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id)
        on conflict do nothing;
        if debug then
          raise notice 'UNLOCK % (pr_sets_in_session)', a.code;
        end if;
      end if;

    end if;
  end loop;
end;$function$

CREATE OR REPLACE FUNCTION public.birthday_check_and_mark()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  p record;

  today_local date;
  dob date;

  bday_this_year date;
  last_birthday date;
  window_end date;

  last_shown date;
  should_show boolean := false;

  age_years int := null;
begin
  select *
  into p
  from public.profiles
  where id = auth.uid();

  if p.id is null then
    return jsonb_build_object('shouldShow', false);
  end if;

  dob := p.date_of_birth;

  if dob is null then
    return jsonb_build_object('shouldShow', false);
  end if;

  -- local date using stored timezone
  today_local := (now() at time zone coalesce(p.timezone, 'UTC'))::date;

  -- build "birthday date" for this year
  bday_this_year :=
    make_date(extract(year from today_local)::int, extract(month from dob)::int, extract(day from dob)::int);

  -- most recent birthday (this year if passed; else last year)
  if bday_this_year > today_local then
    last_birthday :=
      make_date((extract(year from today_local)::int - 1), extract(month from dob)::int, extract(day from dob)::int);
  else
    last_birthday := bday_this_year;
  end if;

  window_end := last_birthday + 6; -- 7 day window total (birthday day + next 6)

  -- last shown date stored in settings
  last_shown := nullif(p.settings #>> '{birthday,lastShownDate}', '')::date;

  -- eligible if within window and not yet shown for this birthday
  if today_local >= last_birthday
     and today_local <= window_end
     and (last_shown is null or last_shown < last_birthday)
  then
    should_show := true;

    -- age at their most recent birthday
    age_years := extract(year from last_birthday)::int - extract(year from dob)::int;

    update public.profiles
    set settings =
      jsonb_set(
        coalesce(settings, '{}'::jsonb),
        '{birthday,lastShownDate}',
        to_jsonb(last_birthday::text),
        true
      ),
      updated_at = now()
    where id = auth.uid();
  end if;

  return jsonb_build_object(
    'shouldShow', should_show,
    'age', age_years,
    'name', p.name
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.block_user(p_target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  if p_target is null or p_target = v_me then
    raise exception 'Invalid target';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_me, p_target)
  on conflict do nothing;

  -- remove follows both directions
  delete from public.user_follows
  where (follower_id = v_me and followee_id = p_target)
     or (follower_id = p_target and followee_id = v_me);

  -- cancel/cleanup follow requests both directions
  update public.follow_requests
  set status = 'cancelled',
      responded_at = now()
  where (requester_id = v_me and target_id = p_target and status = 'pending')
     or (requester_id = p_target and target_id = v_me and status = 'pending');
end;
$function$

CREATE OR REPLACE FUNCTION public.bump_exercise_usage_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  v_user_id uuid;
  v_completed_at timestamptz;
begin
  -- find the user + completed time from workout_history
  select wh.user_id, wh.completed_at
    into v_user_id, v_completed_at
  from public.workout_history wh
  where wh.id = new.workout_history_id;

  insert into public.exercise_usage (user_id, exercise_id, sessions_count, last_used_at, updated_at)
  values (v_user_id, new.exercise_id, 1, v_completed_at, now())
  on conflict (user_id, exercise_id)
  do update set
    sessions_count = public.exercise_usage.sessions_count + 1,
    last_used_at = greatest(public.exercise_usage.last_used_at, excluded.last_used_at),
    updated_at = now();

  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.bump_exercise_usage_set()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  v_user_id uuid;
  v_exercise_id uuid;
  v_completed_at timestamptz;
begin
  select wh.user_id, weh.exercise_id, wh.completed_at
    into v_user_id, v_exercise_id, v_completed_at
  from public.workout_set_history wsh
  join public.workout_exercise_history weh
    on weh.id = new.workout_exercise_history_id
  join public.workout_history wh
    on wh.id = weh.workout_history_id
  where wsh.id = new.id;

  insert into public.exercise_usage (user_id, exercise_id, sets_count, last_used_at, updated_at)
  values (v_user_id, v_exercise_id, 1, v_completed_at, now())
  on conflict (user_id, exercise_id)
  do update set
    sets_count = public.exercise_usage.sets_count + 1,
    last_used_at = greatest(public.exercise_usage.last_used_at, excluded.last_used_at),
    updated_at = now();

  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.can_interact_with_post_v1(p_viewer uuid, p_post_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_post_owner_id uuid;
  v_visibility text;
begin
  if p_viewer is null or p_post_id is null then
    return false;
  end if;

  select p.user_id, p.visibility
    into v_post_owner_id, v_visibility
  from public.posts p
  where p.id = p_post_id;

  if not found then
    return false;
  end if;

  -- owner can always interact
  if v_post_owner_id = p_viewer then
    return true;
  end if;

  -- respect user/profile visibility gate
  if not public.can_view_user(p_viewer, v_post_owner_id) then
    return false;
  end if;

  if v_visibility = 'public' then
    return true;
  end if;

  if v_visibility = 'followers' then
    return exists (
      select 1
      from public.user_follows f
      where f.follower_id = p_viewer
        and f.followee_id = v_post_owner_id
    );
  end if;

  -- private post: only owner (already handled)
  return false;
end;
$function$

CREATE OR REPLACE FUNCTION public.can_view_post(p_viewer uuid, p_post_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    case
      when p_viewer is null or p_post_id is null then false
      when exists (
        select 1
        from public.posts p
        where p.id = p_post_id
          and (
            -- owner always
            p.user_id = p_viewer

            -- public post: viewer must be allowed to view poster
            or (p.visibility = 'public' and public.can_view_user(p_viewer, p.user_id))

            -- followers post: viewer must follow poster
            or (p.visibility = 'followers' and exists (
              select 1 from public.user_follows f
              where f.follower_id = p_viewer and f.followee_id = p.user_id
            ))
          )
      ) then true
      else false
    end;
$function$

CREATE OR REPLACE FUNCTION public.can_view_user(p_viewer uuid, p_profile_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_vis public.profile_visibility;
begin
  if p_viewer is null or p_profile_id is null then
    return false;
  end if;

  -- block gate either direction
  if exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = p_viewer and b.blocked_id = p_profile_id)
       or (b.blocker_id = p_profile_id and b.blocked_id = p_viewer)
  ) then
    return false;
  end if;

  -- self always view
  if p_viewer = p_profile_id then
    return true;
  end if;

  select p.visibility
    into v_vis
  from public.profiles p
  where p.id = p_profile_id;

  if not found then
    return false;
  end if;

  if v_vis = 'public' then
    return true;
  end if;

  if v_vis = 'followers' then
    return exists (
      select 1
      from public.user_follows f
      where f.follower_id = p_viewer
        and f.followee_id = p_profile_id
    );
  end if;

  -- private: only self (already handled)
  return false;
end;
$function$

CREATE OR REPLACE FUNCTION public.cancel_follow_request(p_target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  v_requester uuid := auth.uid();
begin
  if v_requester is null then
    raise exception 'Not authenticated';
  end if;

  if p_target is null or p_target = v_requester then
    raise exception 'Invalid target';
  end if;

  update public.follow_requests
  set status = 'cancelled',
      responded_at = now()
  where requester_id = v_requester
    and target_id = p_target
    and status = 'pending';

  if not found then
    raise exception 'No pending request found';
  end if;
end;
$function$

CREATE OR REPLACE FUNCTION public.check_and_award_achievements(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$declare
  a record;
  already boolean;
  workouts_total int;
  best_streak int;
  sessions_last7 int;
  total_vol numeric;
  distinct_ex int;
  sessions_this_month int;
  -- helper vars
  bw_kg numeric;
  best_1rm numeric;
  needed numeric;
begin
  -- Precompute quick metrics
  select count(*) into workouts_total
  from public.workout_history
  where user_id = p_user_id;

  -- 7-day sessions
  select count(*) into sessions_last7
  from public.workout_history
  where user_id = p_user_id and completed_at >= now() - interval '7 days';

  -- This month sessions
  select count(*) into sessions_this_month
  from public.workout_history
  where user_id = p_user_id
    and date_trunc('month', completed_at) = date_trunc('month', now());

  -- Total volume
  select coalesce(sum(wsh.reps * coalesce(wsh.weight,0)),0) into total_vol
  from public.workout_history wh
  join public.workout_exercise_history weh on weh.workout_history_id = wh.id
  join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
  where wh.user_id = p_user_id;

  -- Distinct exercises performed
  select count(distinct weh.exercise_id) into distinct_ex
  from public.workout_history wh
  join public.workout_exercise_history weh on weh.workout_history_id = wh.id
  where wh.user_id = p_user_id;

  -- Very simple streak calc (consecutive days up to today)
  with days as (
    select date(completed_at) d
    from public.workout_history
    where user_id = p_user_id
    group by 1
  ),
  runs as (
    select d, d - (row_number() over(order by d))::int * interval '1 day' as grp
    from days
  )
  select coalesce(max(count(*)) over(),0) into best_streak
  from runs group by grp;

  -- Try every achievement and award if passed
  for a in
    select * from public.achievements
  loop
    -- skip if already unlocked
    select exists(
      select 1 from public.user_achievements ua
      where ua.user_id = p_user_id and ua.achievement_id = a.id
    ) into already;
    if already then continue; end if;

    -- ---- Rule checks ----
    if a.rule->>'type' = 'count_workouts' then
      if workouts_total >= (a.rule->>'gte')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id) on conflict do nothing;
      end if;

    elsif a.rule->>'type' = 'streak_days' then
      if best_streak >= (a.rule->>'gte')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id) on conflict do nothing;
      end if;

    elsif a.rule->>'type' = 'sessions_in_period' then
      if (a.rule->>'period_days')::int = 7
         and sessions_last7 >= (a.rule->>'gte')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id) on conflict do nothing;
      end if;

    elsif a.rule->>'type' = 'sessions_in_month' then
      if sessions_this_month >= (a.rule->>'gte')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id) on conflict do nothing;
      end if;

    elsif a.rule->>'type' = 'total_volume' then
      if total_vol >= (a.rule->>'gte_kg')::numeric then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id) on conflict do nothing;
      end if;

    elsif a.rule->>'type' in ('exercise_1rm_pct_bw','exercise_1rm_value') then
      -- naive e1RM = weight * (1 + reps/30). Best across history for the named exercise
      select max(wsh.weight * (1 + wsh.reps::numeric/30.0))
      into best_1rm
      from public.workout_history wh
      join public.workout_exercise_history weh on weh.workout_history_id = wh.id
      join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
      join public.exercises e on e.id = weh.exercise_id
      where wh.user_id = p_user_id
        and e.name = a.rule->>'exercise_name';

      if best_1rm is null then continue; end if;

      if a.rule->>'type' = 'exercise_1rm_value' then
        needed := (a.rule->>'gte_kg')::numeric;
        if best_1rm >= needed then
          insert into public.user_achievements(user_id, achievement_id)
          values (p_user_id, a.id) on conflict do nothing;
        end if;
      else
       select
  coalesce(
    p.weight::numeric,
    nullif((p.settings->>'weight_kg')::numeric, 0)
  )
into bw_kg
from public.profiles p
where p.id = p_user_id;
        if bw_kg is null or bw_kg <= 0 then continue; end if;
        needed := (a.rule->>'gte_ratio')::numeric * bw_kg;
        if best_1rm >= needed then
          insert into public.user_achievements(user_id, achievement_id)
          values (p_user_id, a.id) on conflict do nothing;
        end if;
      end if;

    elsif a.rule->>'type' = 'variety_exercises' then
      if distinct_ex >= (a.rule->>'gte')::int then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id) on conflict do nothing;
      end if;

    elsif a.rule->>'type' = 'set_volume_single' then
      perform 1 from (
        select max(sess_vol) as best
        from (
          select wh.id, sum(wsh.reps*coalesce(wsh.weight,0)) as sess_vol
          from public.workout_history wh
          join public.workout_exercise_history weh on weh.workout_history_id = wh.id
          join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
          where wh.user_id = p_user_id
          group by wh.id
        ) s
      ) b where b.best >= (a.rule->>'gte_kg')::numeric;
      if found then
        insert into public.user_achievements(user_id, achievement_id)
        values (p_user_id, a.id) on conflict do nothing;
      end if;

    end if;
  end loop;
end;$function$

CREATE OR REPLACE FUNCTION public.check_and_award_achievements_home_v2()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_tz text := 'UTC';
  v_payload jsonb := '{}'::jsonb;
begin
  if v_user_id is null then
    raise exception 'auth_missing';
  end if;

  select coalesce(p.timezone, 'UTC')
    into v_tz
  from public.profiles p
  where p.id = v_user_id;

  with
  me as (
    select v_user_id as user_id
  ),

  wh as (
    select
      w.id,
      w.user_id,
      w.workout_id,
      w.completed_at,
      w.duration_seconds,
      (w.completed_at at time zone v_tz)::date as local_day,
      date_trunc('week', (w.completed_at at time zone v_tz))::date as week_key,
      date_trunc('month', (w.completed_at at time zone v_tz))::date as month_key,
      extract(month from (w.completed_at at time zone v_tz))::int as local_month
    from public.workout_history w
    join me on me.user_id = w.user_id
  ),

  -- Strength/cardio flags (based on sets/exercise types)
  sets as (
    select
      wh.id as workout_history_id,
      wh.completed_at,
      wh.local_day,
      wh.week_key,
      wh.month_key,

      weh.exercise_id,
      ex.type as exercise_type,

      wsh.reps::numeric as reps,
      wsh.weight::numeric as weight_kg,
      wsh.distance::numeric as distance_m,
      wsh.time_seconds::numeric as time_seconds,

      (coalesce(wsh.weight,0) * coalesce(wsh.reps,0))::numeric as volume,
      (coalesce(wsh.weight,0) * (1 + (coalesce(wsh.reps,0)::numeric / 30.0)))::numeric as e1rm
    from wh
    join public.workout_exercise_history weh on weh.workout_history_id = wh.id
    join public.exercises ex on ex.id = weh.exercise_id
    join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
    where coalesce(wsh.reps,0) > 0
      and (
        coalesce(wsh.weight,0) > 0
        or coalesce(wsh.distance,0) > 0
        or coalesce(wsh.time_seconds,0) > 0
      )
  ),

  workout_flags as (
    select
      wh.id as workout_history_id,
      bool_or(s.exercise_type = 'cardio') as has_cardio,
      bool_or(coalesce(s.exercise_type::text,'') <> 'cardio') as has_strength
    from wh
    left join sets s on s.workout_history_id = wh.id
    group by wh.id
  ),

  totals as (
    select
      (select count(*)::int from wh) as workouts_total,
      (select count(distinct local_day)::int from wh) as days_trained_total
  ),

  -- ✅ generic workout streak (for streak_days achievements)
  workout_days as (
    select distinct local_day
    from wh
  ),
  workout_streak_calc as (
    select
      coalesce((
        with ordered as (
          select
            local_day,
            (row_number() over (order by local_day))::int as rn
          from workout_days
        ),
        groups as (
          select local_day, rn, (local_day - rn) as grp
          from ordered
        )
        select max(cnt)::int
        from (
          select grp, count(*)::int as cnt
          from groups
          group by grp
        ) x
      ), 0)::int as best_len
  ),

  -- ✅ cardio streak (for cardio_streak achievements)
  cardio_days as (
    select distinct wh.local_day
    from wh
    join workout_flags f on f.workout_history_id = wh.id
    where f.has_cardio
  ),
  cardio_streak_calc as (
    select
      coalesce((
        with ordered as (
          select
            local_day,
            (row_number() over (order by local_day))::int as rn
          from cardio_days
        ),
        groups as (
          select local_day, rn, (local_day - rn) as grp
          from ordered
        )
        select max(cnt)::int
        from (
          select grp, count(*)::int as cnt
          from groups
          group by grp
        ) x
      ), 0)::int as best_len
  ),

  sessions_by_month as (
    select month_key, count(*)::int as n
    from wh
    group by month_key
  ),

  current_week as (
    select date_trunc('week', (v_now at time zone v_tz))::date as wk
  ),

  distinct_exercises as (
    select count(distinct exercise_id)::int as n
    from sets
  ),

  muscles_this_week as (
    select count(distinct em.muscle_id)::int as n
    from sets s
    join public.exercise_muscles em on em.exercise_id = s.exercise_id
    where s.week_key = (select wk from current_week)
  ),

  total_volume as (
    select coalesce(sum(volume),0)::numeric as v
    from sets
    where weight_kg > 0 and reps > 0
  ),

  volume_by_workout as (
    select workout_history_id, coalesce(sum(volume),0)::numeric as v
    from sets
    where weight_kg > 0 and reps > 0
    group by workout_history_id
  ),

  distance_by_workout as (
    select workout_history_id, coalesce(sum(distance_m),0)::numeric as m
    from sets
    where coalesce(distance_m,0) > 0
    group by workout_history_id
  ),

  volume_by_week as (
    select week_key, coalesce(sum(volume),0)::numeric as v
    from sets
    where weight_kg > 0 and reps > 0
    group by week_key
  ),

  prev_week as (
    select ((select wk from current_week) - 7) as wk
  ),

  week_compare as (
    select
      coalesce((select v from volume_by_week where week_key = (select wk from current_week)), 0) as cur_v,
      coalesce((select v from volume_by_week where week_key = (select wk from prev_week)), 0) as prev_v
  ),

  cardio_sessions_this_month as (
    select count(*)::int as n
    from wh
    join workout_flags f on f.workout_history_id = wh.id
    where f.has_cardio
      and wh.month_key = date_trunc('month', (v_now at time zone v_tz))::date
  ),

  bw as (
    select coalesce(p.weight, 0)::numeric as kg
    from public.profiles p
    where p.id = v_user_id
  ),

  -- PR tracking
  session_best_by_ex as (
    select
      workout_history_id,
      max(completed_at) as completed_at,
      exercise_id,
      max(e1rm) as best_e1rm
    from sets
    where weight_kg > 0 and reps > 0
    group by workout_history_id, exercise_id
  ),
  pr_events as (
    select
      exercise_id,
      completed_at,
      best_e1rm,
      max(best_e1rm) over (
        partition by exercise_id
        order by completed_at
        rows between unbounded preceding and 1 preceding
      ) as prev_running_best
    from session_best_by_ex
  ),
  pr_jumps as (
    select
      exercise_id,
      completed_at,
      best_e1rm,
      prev_running_best,
      case
        when prev_running_best is null or prev_running_best <= 0 then null
        when best_e1rm > prev_running_best
          then ((best_e1rm - prev_running_best) / prev_running_best) * 100.0
        else null
      end as pct_increase
    from pr_events
  ),

  completed_goals as (
    select count(*)::int as n
    from public.goals g
    where g.user_id = v_user_id
      and g.is_active = false
  ),

  pending as (
    select a.*
    from public.achievements a
    where not exists (
      select 1
      from public.user_achievements ua
      where ua.user_id = v_user_id
        and ua.achievement_id = a.id
    )
  ),

  eligible as (
    select
      a.id as achievement_id,
      a.code,
      a.title,
      a.description,
      a.category,
      a.difficulty,
      a.rule,
      case
        when (a.rule->>'type') = 'count_workouts'
          then (select workouts_total from totals) >= coalesce((a.rule->>'gte')::int, 0)

        when (a.rule->>'type') = 'days_trained_total'
          then (select days_trained_total from totals) >= coalesce((a.rule->>'gte')::int, 0)

        when (a.rule->>'type') = 'sessions_in_month'
          then coalesce(
            (select n from sessions_by_month
             where month_key = date_trunc('month', (v_now at time zone v_tz))::date),
            0
          ) >= coalesce((a.rule->>'gte')::int, 0)

        when (a.rule->>'type') = 'month_specific_sessions'
          then (
            select count(*)::int
            from wh
            where extract(month from (completed_at at time zone v_tz))::int = coalesce((a.rule->>'month')::int, -1)
          ) >= coalesce((a.rule->>'gte')::int, 0)

        when (a.rule->>'type') = 'sessions_in_period'
          then (
            select count(*)::int
            from wh
            where completed_at >= (v_now - (coalesce((a.rule->>'period_days')::int, 7) || ' days')::interval)
          ) >= coalesce((a.rule->>'gte')::int, 0)

        when (a.rule->>'type') = 'weekly_activity_weeks'
          then (select count(distinct week_key)::int from wh) >= coalesce((a.rule->>'gte')::int, 0)

        when (a.rule->>'type') = 'plan_completed'
          then (
            select count(*)::int
            from public.plans pl
            where pl.user_id = v_user_id
              and pl.is_completed = true
          ) >= coalesce((a.rule->>'gte')::int, 0)

        when (a.rule->>'type') = 'variety_exercises'
          then (select n from distinct_exercises) >= coalesce((a.rule->>'gte')::int, 0)

        when (a.rule->>'type') = 'total_volume'
          then (select v from total_volume) >= coalesce((a.rule->>'gte_kg')::numeric, 0)

        when (a.rule->>'type') = 'set_volume_single'
          then coalesce((select max(v) from volume_by_workout),0) >= coalesce((a.rule->>'gte_kg')::numeric, 0)

        when (a.rule->>'type') = 'volume_growth_pct'
          then (
            select case
              when prev_v <= 0 then false
              else ((cur_v - prev_v) / prev_v) * 100.0 >= coalesce((a.rule->>'gte_pct')::numeric, 0)
            end
            from week_compare
          )

        when (a.rule->>'type') = 'duration_single'
          then coalesce((select max(duration_seconds) from wh), 0) >= (coalesce((a.rule->>'gte_min')::int, 0) * 60)

        when (a.rule->>'type') = 'distance_single'
          then coalesce((select max(m) from distance_by_workout),0) / 1000.0 >= coalesce((a.rule->>'gte_km')::numeric, 0)

        when (a.rule->>'type') = 'distance_total'
          then (
            select coalesce(sum(distance_m),0)::numeric / 1000.0
            from sets
            where coalesce(distance_m,0) > 0
          ) >= coalesce((a.rule->>'gte_km')::numeric, 0)

        when (a.rule->>'type') = 'muscle_groups_trained'
          then (select n from muscles_this_week) >= coalesce((a.rule->>'gte')::int, 0)

        when (a.rule->>'type') = 'season_participation'
          then (
            select bool_and(has_month)
            from (
              select m as req_month,
                exists (
                  select 1
                  from wh
                  where extract(month from (completed_at at time zone v_tz))::int = m
                ) as has_month
              from jsonb_array_elements_text(a.rule->'months') t(mtxt)
              cross join lateral (select (mtxt::int) as m) mm
            ) x
          )

        when (a.rule->>'type') = 'cardio_sessions_month'
          then (select n from cardio_sessions_this_month) >= coalesce((a.rule->>'gte')::int, 0)

        when (a.rule->>'type') = 'cardio_streak'
          then (select best_len from cardio_streak_calc) >= coalesce((a.rule->>'gte_days')::int, 0)

        when (a.rule->>'type') = 'streak_days'
          then (select best_len from workout_streak_calc) >= coalesce((a.rule->>'gte')::int, 0)

        when (a.rule->>'type') = 'mixed_training'
          then (
            with window_wh as (
              select wh.id
              from wh
              where wh.completed_at >= (v_now - (coalesce((a.rule->>'period_days')::int, 7) || ' days')::interval)
            )
            select
              (select count(*)::int from window_wh w join workout_flags f on f.workout_history_id = w.id where f.has_cardio) >= coalesce((a.rule->>'cardio')::int, 0)
              and
              (select count(*)::int from window_wh w join workout_flags f on f.workout_history_id = w.id where f.has_strength) >= coalesce((a.rule->>'strength')::int, 0)
          )

        when (a.rule->>'type') = 'daily_steps_streak'
          then (
            with s as (
              select day
              from public.daily_steps
              where user_id = v_user_id
                and steps >= coalesce((a.rule->>'gte_steps')::int, 0)
            ),
            grp as (
              select
                day,
                (day - ((row_number() over (order by day))::int)) as g
              from s
            )
            select coalesce(max(cnt),0)::int >= coalesce((a.rule->>'gte_days')::int, 0)
            from (
              select g, count(*)::int as cnt
              from grp
              group by g
            ) x
          )

        when (a.rule->>'type') = 'goals_completed'
          then (select n from completed_goals) >= coalesce((a.rule->>'gte')::int, 0)

        when (a.rule->>'type') = 'exercise_1rm_value'
          then exists (
            select 1
            from sets s
            where s.exercise_id = (a.rule->>'exercise_id')::uuid
              and s.weight_kg > 0 and s.reps > 0
              and s.e1rm >= coalesce((a.rule->>'gte_kg')::numeric, 0)
          )

        when (a.rule->>'type') = 'exercise_1rm_pct_bw'
          then exists (
            select 1
            from sets s
            cross join bw
            where s.exercise_id = (a.rule->>'exercise_id')::uuid
              and s.weight_kg > 0 and s.reps > 0
              and bw.kg > 0
              and (s.e1rm / bw.kg) >= coalesce((a.rule->>'gte_ratio')::numeric, 0)
          )

        when (a.rule->>'type') = 'pr_increase_pct'
          then exists (
            select 1
            from pr_jumps pj
            where pj.pct_increase is not null
              and pj.pct_increase >= coalesce((a.rule->>'gte_pct')::numeric, 0)
          )

        when (a.rule->>'type') = 'pr_sets_in_session'
          then exists (
            select 1
            from sets s
            where s.exercise_id = (a.rule->>'exercise_id')::uuid
              and coalesce(s.reps,0) >= coalesce((a.rule->>'gte_sets')::numeric, 0)
          )

        else false
      end as is_earned
    from pending a
  ),

  inserted as (
    insert into public.user_achievements (user_id, achievement_id, achieved_at)
    select v_user_id, e.achievement_id, v_now
    from eligible e
    where e.is_earned
      and not exists (
        select 1
        from public.user_achievements ua
        where ua.user_id = v_user_id
          and ua.achievement_id = e.achievement_id
      )
    returning achievement_id
  )

  select jsonb_build_object(
    'newly_unlocked', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', e.achievement_id,
            'code', e.code,
            'title', e.title,
            'description', e.description,
            'category', e.category,
            'difficulty', e.difficulty,
            'achieved_at', v_now
          )
          order by e.code
        )
        from eligible e
        where e.achievement_id in (select achievement_id from inserted)
      ),
      '[]'::jsonb
    ),
    'new_count', coalesce((select count(*) from inserted), 0),
    'generated_at', v_now
  )
  into v_payload;

  return v_payload;
end;
$function$

CREATE OR REPLACE FUNCTION public.check_and_award_achievements_home_v3()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_facts jsonb := '{}'::jsonb;
  v_payload jsonb := '{}'::jsonb;
begin
  if v_user_id is null then
    raise exception 'auth_missing';
  end if;

  v_facts := public.compute_achievement_facts_v1();

  with
  pending as (
    select a.*
    from public.achievements a
    where not exists (
      select 1
      from public.user_achievements ua
      where ua.user_id = v_user_id
        and ua.achievement_id = a.id
    )
  ),

  -- Resolve exercise_id once per pending achievement:
  -- - Prefer rule.exercise_id (string uuid)
  -- - Else fallback to rule.exercise_name -> exercises.id (best-effort)
  pending_resolved as (
    select
      p.*,
      case
        when nullif(trim(p.rule->>'exercise_id'), '') is not null
          then (p.rule->>'exercise_id')::uuid
        when nullif(trim(p.rule->>'exercise_name'), '') is not null
          then (
            select e.id
            from public.exercises e
            where lower(trim(e.name)) = lower(trim(p.rule->>'exercise_name'))
            order by e.id
            limit 1
          )
        else null
      end as rule_exercise_id
    from pending p
  ),

  eligible as (
    select
      p.id as achievement_id,
      p.code,
      p.title,
      p.description,
      p.category,
      p.difficulty,
      p.rule,

      case
        /* ---------------- Counters ---------------- */
        when (p.rule->>'type') = 'count_workouts'
          then (v_facts->>'workouts_total')::int >= coalesce((p.rule->>'gte')::int, 0)

        when (p.rule->>'type') = 'days_trained_total'
          then (v_facts->>'days_trained_total')::int >= coalesce((p.rule->>'gte')::int, 0)

        when (p.rule->>'type') = 'sessions_in_month'
          then (
            select coalesce(max((m->>'n')::int),0)
            from jsonb_array_elements(v_facts->'sessions_by_month') m
            where (m->>'month')::date = date_trunc('month', (v_now at time zone (v_facts->>'tz')))::date
          ) >= coalesce((p.rule->>'gte')::int, 0)

        when (p.rule->>'type') = 'month_specific_sessions'
          then (
            select coalesce(max((m->>'n')::int),0)
            from jsonb_array_elements(v_facts->'sessions_by_month') m
            where extract(month from (m->>'month')::date)::int = coalesce((p.rule->>'month')::int, -1)
          ) >= coalesce((p.rule->>'gte')::int, 0)

        when (p.rule->>'type') = 'sessions_in_period'
          then (
            select count(*)::int
            from public.workout_history wh
            where wh.user_id = v_user_id
              and wh.completed_at >= (v_now - (coalesce((p.rule->>'period_days')::int, 7) || ' days')::interval)
          ) >= coalesce((p.rule->>'gte')::int, 0)

        when (p.rule->>'type') = 'weekly_activity_weeks'
          then (
            select count(*)::int
            from (
              select distinct (j->>'week')::date as wk
              from jsonb_array_elements(v_facts->'weekly_sessions') j
            ) x
          ) >= coalesce((p.rule->>'gte')::int, 0)

        /* ---------------- Plan completion ---------------- */
        when (p.rule->>'type') = 'plan_completed'
          then (
            select count(*)::int
            from public.plans pl
            where pl.user_id = v_user_id
              and pl.is_completed = true
          ) >= coalesce((p.rule->>'gte')::int, 0)

        /* ---------------- Variety ---------------- */
        when (p.rule->>'type') = 'variety_exercises'
          then (v_facts->>'distinct_exercises')::int >= coalesce((p.rule->>'gte')::int, 0)

        /* ---------------- Muscle groups ---------------- */
        when (p.rule->>'type') = 'muscle_groups_trained'
          then (v_facts->>'muscles_this_week')::int >= coalesce((p.rule->>'gte')::int, 0)

        /* ---------------- Volume ---------------- */
        when (p.rule->>'type') = 'total_volume'
          then (v_facts->>'total_volume')::numeric >= coalesce((p.rule->>'gte_kg')::numeric, 0)

        when (p.rule->>'type') = 'set_volume_single'
          then (v_facts->>'max_session_volume')::numeric >= coalesce((p.rule->>'gte_kg')::numeric, 0)

        when (p.rule->>'type') = 'volume_growth_pct'
          then (
            case
              when (v_facts->>'week_volume_prev')::numeric <= 0 then false
              else (((v_facts->>'week_volume_cur')::numeric - (v_facts->>'week_volume_prev')::numeric)
                    / (v_facts->>'week_volume_prev')::numeric) * 100.0
                   >= coalesce((p.rule->>'gte_pct')::numeric, 0)
            end
          )

        /* ---------------- Distance ---------------- */
        when (p.rule->>'type') = 'distance_single'
          then ((v_facts->>'max_distance_session_m')::numeric / 1000.0) >= coalesce((p.rule->>'gte_km')::numeric, 0)

        when (p.rule->>'type') = 'distance_total'
          then ((v_facts->>'distance_total_m')::numeric / 1000.0) >= coalesce((p.rule->>'gte_km')::numeric, 0)

        /* ---------------- Duration ---------------- */
        when (p.rule->>'type') = 'duration_single'
          then (v_facts->>'max_duration_seconds')::int >= (coalesce((p.rule->>'gte_min')::int, 0) * 60)

        /* ---------------- Cardio sessions in month ---------------- */
        when (p.rule->>'type') = 'cardio_sessions_month'
          then (v_facts->>'cardio_sessions_this_month')::int >= coalesce((p.rule->>'gte')::int, 0)

        /* ---------------- Streaks ---------------- */
        when (p.rule->>'type') = 'streak_days'
          then (v_facts->>'trained_streak_best')::int >= coalesce((p.rule->>'gte')::int, 0)

        when (p.rule->>'type') = 'cardio_streak'
          then (v_facts->>'cardio_streak_best')::int >= coalesce((p.rule->>'gte_days')::int, 0)

        when (p.rule->>'type') = 'month_streak'
          then (v_facts->>'month_streak_best')::int >= coalesce((p.rule->>'gte_months')::int, 0)

        when (p.rule->>'type') = 'consistency_weeks'
          then (
            with weeks as (
              select
                (j->>'week')::date as wk,
                (j->>'n')::int as n
              from jsonb_array_elements(v_facts->'weekly_sessions') j
              where (j->>'n')::int >= coalesce((p.rule->>'per_week')::int, 0)
            ),
            ordered as (
              select wk, row_number() over (order by wk) as rn
              from weeks
            ),
            grp as (
              select ((extract(year from wk)::int * 53 + extract(week from wk)::int) - rn) as g
              from ordered
            )
            select coalesce(max(cnt),0)::int >= coalesce((p.rule->>'weeks')::int, 0)
            from (
              select g, count(*)::int as cnt
              from grp
              group by g
            ) x
          )

        /* ---------------- Seasons ---------------- */
        when (p.rule->>'type') = 'season_participation'
          then (
            select bool_and(has_month)
            from (
              select m as req_month,
                exists (
                  select 1
                  from public.workout_history wh
                  where wh.user_id = v_user_id
                    and extract(month from (wh.completed_at at time zone (v_facts->>'tz')))::int = m
                ) as has_month
              from jsonb_array_elements_text(p.rule->'months') t(mtxt)
              cross join lateral (select (mtxt::int) as m) mm
            ) x
          )

        /* ---------------- Mixed training ---------------- */
        when (p.rule->>'type') = 'mixed_training'
          then (
            with window_wh as (
              select wh.id
              from public.workout_history wh
              where wh.user_id = v_user_id
                and wh.completed_at >= (v_now - (coalesce((p.rule->>'period_days')::int, 7) || ' days')::interval)
            ),
            flags as (
              select
                wh2.id,
                bool_or(ex2.type::text = 'cardio') as has_cardio,
                bool_or(coalesce(ex2.type::text,'') <> 'cardio') as has_strength
              from public.workout_history wh2
              join public.workout_exercise_history weh2 on weh2.workout_history_id = wh2.id
              join public.workout_set_history wsh2 on wsh2.workout_exercise_history_id = weh2.id
              join public.exercises ex2 on ex2.id = weh2.exercise_id
              where wh2.user_id = v_user_id
                and (
                  (coalesce(wsh2.reps,0) > 0 and coalesce(wsh2.weight,0) > 0)
                  or (coalesce(wsh2.distance,0) > 0 or coalesce(wsh2.time_seconds,0) > 0)
                )
              group by wh2.id
            )
            select
              (select count(*)::int from window_wh w join flags f on f.id = w.id where f.has_cardio) >= coalesce((p.rule->>'cardio')::int, 0)
              and
              (select count(*)::int from window_wh w join flags f on f.id = w.id where f.has_strength) >= coalesce((p.rule->>'strength')::int, 0)
          )

        /* ---------------- Steps ---------------- */
        when (p.rule->>'type') = 'daily_steps_streak'
          then (
            with s as (
              select day
              from public.daily_steps
              where user_id = v_user_id
                and steps >= coalesce((p.rule->>'gte_steps')::int, 0)
            ),
            ordered as (
              select day, row_number() over (order by day) as rn
              from s
            ),
            grp as (
              select (day - rn) as g
              from ordered
            )
            select coalesce(max(cnt),0)::int >= coalesce((p.rule->>'gte_days')::int, 0)
            from (
              select g, count(*)::int as cnt
              from grp
              group by g
            ) x
          )

        /* ---------------- Goals completed ---------------- */
        when (p.rule->>'type') = 'goals_completed'
          then (v_facts->>'completed_goals')::int >= coalesce((p.rule->>'gte')::int, 0)

        /* ---------------- 1RM achievements (BY EXERCISE ID) ---------------- */
        when (p.rule->>'type') = 'exercise_1rm_value'
          then p.rule_exercise_id is not null and exists (
            select 1
            from public.workout_history wh
            join public.workout_exercise_history weh on weh.workout_history_id = wh.id
            join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
            where wh.user_id = v_user_id
              and weh.exercise_id = p.rule_exercise_id
              and coalesce(wsh.reps,0) > 0 and coalesce(wsh.weight,0) > 0
              and (coalesce(wsh.weight,0) * (1 + (coalesce(wsh.reps,0)::numeric / 30.0)))::numeric
                  >= coalesce((p.rule->>'gte_kg')::numeric, 0)
          )

        when (p.rule->>'type') = 'exercise_1rm_pct_bw'
          then p.rule_exercise_id is not null
               and coalesce((v_facts->>'bodyweight_kg')::numeric, 0) > 0
               and exists (
            select 1
            from public.workout_history wh
            join public.workout_exercise_history weh on weh.workout_history_id = wh.id
            join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
            where wh.user_id = v_user_id
              and weh.exercise_id = p.rule_exercise_id
              and coalesce(wsh.reps,0) > 0 and coalesce(wsh.weight,0) > 0
              and (
                ((coalesce(wsh.weight,0) * (1 + (coalesce(wsh.reps,0)::numeric / 30.0)))::numeric)
                / (v_facts->>'bodyweight_kg')::numeric
              ) >= coalesce((p.rule->>'gte_ratio')::numeric, 0)
          )

        /* ---------------- PR increase ---------------- */
        when (p.rule->>'type') = 'pr_increase_pct'
          then (v_facts->>'max_pr_jump_pct')::numeric >= coalesce((p.rule->>'gte_pct')::numeric, 0)

        /* ---------------- reps-in-one-set (BY EXERCISE ID) ---------------- */
        when (p.rule->>'type') = 'pr_sets_in_session'
          then p.rule_exercise_id is not null and exists (
            select 1
            from public.workout_history wh
            join public.workout_exercise_history weh on weh.workout_history_id = wh.id
            join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
            where wh.user_id = v_user_id
              and weh.exercise_id = p.rule_exercise_id
              and coalesce(wsh.reps,0) >= coalesce((p.rule->>'gte_sets')::int, 0)
          )

        else false
      end as is_earned
    from pending_resolved p
  ),

  inserted as (
    insert into public.user_achievements (user_id, achievement_id, achieved_at)
    select v_user_id, e.achievement_id, v_now
    from eligible e
    where e.is_earned
      and not exists (
        select 1
        from public.user_achievements ua
        where ua.user_id = v_user_id
          and ua.achievement_id = e.achievement_id
      )
    returning achievement_id
  )

  select jsonb_build_object(
    'generated_at', v_now,
    'facts', v_facts,
    'new_count', coalesce((select count(*) from inserted), 0),
    'newly_unlocked', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', e.achievement_id,
            'code', e.code,
            'title', e.title,
            'description', e.description,
            'category', e.category,
            'difficulty', e.difficulty,
            'achieved_at', v_now
          )
          order by e.code
        )
        from eligible e
        where e.achievement_id in (select achievement_id from inserted)
      ),
      '[]'::jsonb
    )
  )
  into v_payload;

  return v_payload;
end;
$function$

CREATE OR REPLACE FUNCTION public.check_username_available_v1(p_username text)
 RETURNS TABLE(normalized text, is_valid boolean, is_available boolean, reason text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$declare
  v_norm text := lower(trim(coalesce(p_username, '')));
  v_len int := length(v_norm);
  v_exists boolean;
begin
  -- basic validation: 3..10, no spaces, only letters/numbers/underscore
  if v_len < 3 then
    return query select v_norm, false, false, 'too_short';
    return;
  end if;

  if v_len > 13 then
    return query select v_norm, false, false, 'too_long';
    return;
  end if;

  if v_norm ~ '\s' then
    return query select v_norm, false, false, 'no_spaces';
    return;
  end if;

  if v_norm !~ '^[a-z0-9_]+$' then
    return query select v_norm, false, false, 'invalid_chars';
    return;
  end if;

  select exists(
    select 1
    from public.profiles p
    where p.username_lower = v_norm
      and p.id <> auth.uid()
  ) into v_exists;

  return query select v_norm, true, (not v_exists), case when v_exists then 'taken' else null end;
end;$function$

CREATE OR REPLACE FUNCTION public.christmas_check_and_mark()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  p record;
  today_local date;
  mmdd text;
  this_year int := extract(year from now())::int;
  last_year int;
  should_show boolean := false;
begin
  select *
  into p
  from public.profiles
  where id = auth.uid();

  if p.id is null then
    return jsonb_build_object('shouldShow', false);
  end if;

  today_local := (now() at time zone coalesce(p.timezone, 'UTC'))::date;
  mmdd := to_char(today_local, 'MM-DD');

  last_year := nullif((p.settings #>> '{christmas,lastShownYear}')::int, null);

  if mmdd = '12-25' and (last_year is null or last_year < this_year) then
    should_show := true;

    update public.profiles
    set settings =
      jsonb_set(
        coalesce(settings, '{}'::jsonb),
        '{christmas,lastShownYear}',
        to_jsonb(this_year),
        true
      ),
      updated_at = now()
    where id = auth.uid();
  end if;

  return jsonb_build_object(
    'shouldShow', should_show,
    'name', p.name
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.claim_notification_push_jobs_v1(p_limit integer DEFAULT 20)
 RETURNS TABLE(job_id uuid, notification_id uuid, recipient_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  with to_claim as (
    select j.id
    from public.notification_push_jobs j
    where j.status = 'pending'
    order by j.created_at asc
    limit greatest(coalesce(p_limit, 20), 1)
    for update skip locked
  ),
  claimed as (
    update public.notification_push_jobs j
    set
      status = 'processing',
      attempts = j.attempts + 1
    where j.id in (select id from to_claim)
    returning j.id, j.notification_id, j.recipient_id
  )
  select
    c.id as job_id,
    c.notification_id,
    c.recipient_id
  from claimed c;
end;
$function$

CREATE OR REPLACE FUNCTION public.clear_username_v1()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_missing';
  end if;

  update public.profiles
  set username = null,
      updated_at = now()
  where id = v_uid;

  if not found then
    raise exception 'profile_not_found';
  end if;
end;
$function$

CREATE OR REPLACE FUNCTION public.clone_starter_template(p_template_workout_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_template_owner uuid := '1ca79b4f-8d37-414e-a123-30622570c7af'::uuid;

  v_template_title text;
  v_template_image_key text;

  v_existing_workout_id uuid;
  v_new_workout_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Validate starter template
  select
    w.title,
    w.workout_image_key
  into
    v_template_title,
    v_template_image_key
  from public.workouts w
  where w.id = p_template_workout_id
    and w.user_id = v_template_owner
    and w.notes like '[MM_TEMPLATE:starter:%]';

  if v_template_title is null then
    raise exception 'Invalid template workout';
  end if;

  -- Idempotent: already cloned?
  select c.workout_id
  into v_existing_workout_id
  from public.starter_workout_clones c
  where c.user_id = v_user_id
    and c.template_workout_id = p_template_workout_id;

  if v_existing_workout_id is not null then
    return v_existing_workout_id;
  end if;

  -- Create cloned workout for user
  insert into public.workouts (
    user_id,
    title,
    notes,
    workout_image_key,
    created_source,
    counts_toward_template_limit,
    archived_at,
    deleted_at
  )
  values (
    v_user_id,
    v_template_title,
    null,                 -- notes intentionally dropped
    v_template_image_key,
    'starter_clone',
    false,
    null,
    null
  )
  returning id into v_new_workout_id;

  -- Copy workout_exercises (notes also dropped)
  insert into public.workout_exercises (
    workout_id,
    exercise_id,
    order_index,
    target_sets,
    target_reps,
    target_weight,
    target_time_seconds,
    target_distance,
    notes,
    superset_group,
    superset_index,
    is_dropset,
    is_archived
  )
  select
    v_new_workout_id,
    we.exercise_id,
    we.order_index,
    we.target_sets,
    we.target_reps,
    we.target_weight,
    we.target_time_seconds,
    we.target_distance,
    null,
    we.superset_group,
    we.superset_index,
    we.is_dropset,
    false
  from public.workout_exercises we
  where we.workout_id = p_template_workout_id
    and we.is_archived = false
  order by we.order_index;

  -- Record clone mapping
  insert into public.starter_workout_clones (
    user_id,
    template_workout_id,
    workout_id
  )
  values (
    v_user_id,
    p_template_workout_id,
    v_new_workout_id
  );

  return v_new_workout_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.clone_starter_template_test_v1(p_user_id uuid, p_template_workout_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_template_owner uuid := '1ca79b4f-8d37-414e-a123-30622570c7af'::uuid;

  v_template_title text;
  v_template_image_key text;

  v_existing_workout_id uuid;
  v_new_workout_id uuid;
begin
  select
    w.title,
    w.workout_image_key
  into
    v_template_title,
    v_template_image_key
  from public.workouts w
  where w.id = p_template_workout_id
    and w.user_id = v_template_owner
    and w.notes like '[MM_TEMPLATE:starter:%]';

  if v_template_title is null then
    raise exception 'Invalid template workout';
  end if;

  select c.workout_id
  into v_existing_workout_id
  from public.starter_workout_clones c
  where c.user_id = p_user_id
    and c.template_workout_id = p_template_workout_id;

  if v_existing_workout_id is not null then
    return v_existing_workout_id;
  end if;

  insert into public.workouts (
    user_id,
    title,
    notes,
    workout_image_key,
    created_source,
    counts_toward_template_limit,
    archived_at,
    deleted_at
  )
  values (
    p_user_id,
    v_template_title,
    null,
    v_template_image_key,
    'starter_clone',
    false,
    null,
    null
  )
  returning id into v_new_workout_id;

  insert into public.workout_exercises (
    workout_id,
    exercise_id,
    order_index,
    target_sets,
    target_reps,
    target_weight,
    target_time_seconds,
    target_distance,
    notes,
    superset_group,
    superset_index,
    is_dropset,
    is_archived
  )
  select
    v_new_workout_id,
    we.exercise_id,
    we.order_index,
    we.target_sets,
    we.target_reps,
    we.target_weight,
    we.target_time_seconds,
    we.target_distance,
    null,
    we.superset_group,
    we.superset_index,
    we.is_dropset,
    false
  from public.workout_exercises we
  where we.workout_id = p_template_workout_id
    and we.is_archived = false
  order by we.order_index;

  insert into public.starter_workout_clones (
    user_id,
    template_workout_id,
    workout_id
  )
  values (
    p_user_id,
    p_template_workout_id,
    v_new_workout_id
  );

  return v_new_workout_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.complete_onboarding_stage2_v1()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'auth_missing';
  end if;

  update public.profiles
  set onboarding_stage2_completed_at = coalesce(onboarding_stage2_completed_at, now())
  where id = auth.uid();
end;
$function$

CREATE OR REPLACE FUNCTION public.complete_onboarding_stage3()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.profiles
  set
    onboarding_stage3_completed_at = now(),
    onboarding_stage3_dismissed_at = null,
    onboarding_step = greatest(onboarding_step, 3),
    updated_at = now()
  where id = auth.uid();
end;
$function$

CREATE OR REPLACE FUNCTION public.complete_onboarding_stage_v1(p_stage text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'auth_missing';
  end if;

  if p_stage not in ('stage2','stage3') then
    raise exception 'invalid_stage';
  end if;

  if p_stage = 'stage2' then
    update public.profiles
      set onboarding_stage2_completed_at = coalesce(onboarding_stage2_completed_at, now()),
          updated_at = now()
    where id = v_user;

  else
    update public.profiles
      set onboarding_stage3_completed_at = coalesce(onboarding_stage3_completed_at, now()),
          updated_at = now()
    where id = v_user;
  end if;
end;
$function$

CREATE OR REPLACE FUNCTION public.compute_achievement_facts_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_tz text := 'UTC';
  v_payload jsonb := '{}'::jsonb;
begin
  if v_user_id is null then
    raise exception 'auth_missing';
  end if;

  select coalesce(p.timezone, 'UTC')
    into v_tz
  from public.profiles p
  where p.id = v_user_id;

  with
  wh as (
    select
      w.id,
      w.user_id,
      w.workout_id,
      w.completed_at,
      w.duration_seconds,
      (w.completed_at at time zone v_tz)::date as local_day,
      date_trunc('week', (w.completed_at at time zone v_tz))::date as week_key,
      date_trunc('month', (w.completed_at at time zone v_tz))::date as month_key
    from public.workout_history w
    where w.user_id = v_user_id
  ),

  -- ✅ VALID SETS (fix: cardio can have 0 reps)
  sets as (
    select
      wh.id as workout_history_id,
      wh.completed_at,
      wh.local_day,
      wh.week_key,
      wh.month_key,

      weh.exercise_id,
      ex.name as exercise_name,
      ex.type as exercise_type,

      wsh.id as set_id,
      coalesce(wsh.reps,0)::numeric as reps,
      coalesce(wsh.weight,0)::numeric as weight_kg,
      coalesce(wsh.distance,0)::numeric as distance_m,
      coalesce(wsh.time_seconds,0)::numeric as time_seconds,

      -- strength volume + e1rm only meaningful for weight+reps
      (coalesce(wsh.weight,0) * coalesce(wsh.reps,0))::numeric as volume,
      (coalesce(wsh.weight,0) * (1 + (coalesce(wsh.reps,0)::numeric / 30.0)))::numeric as e1rm,

      case
        when (coalesce(wsh.reps,0) > 0 and coalesce(wsh.weight,0) > 0) then true
        when (coalesce(wsh.distance,0) > 0 or coalesce(wsh.time_seconds,0) > 0) then true
        else false
      end as is_valid
    from wh
    join public.workout_exercise_history weh
      on weh.workout_history_id = wh.id
    join public.exercises ex
      on ex.id = weh.exercise_id
    join public.workout_set_history wsh
      on wsh.workout_exercise_history_id = weh.id
  ),

  valid_sets as (
    select * from sets where is_valid
  ),

  -- ✅ trained day = at least 1 valid set (strength or cardio)
  trained_days as (
    select distinct local_day
    from valid_sets
  ),

  -- ✅ cardio day = at least 1 valid cardio set
  cardio_days as (
    select distinct local_day
    from valid_sets
    where exercise_type::text = 'cardio'
  ),

  -- ✅ per workout flags for mixed_training
  workout_flags as (
    select
      wh.id as workout_history_id,
      bool_or(vs.exercise_type::text = 'cardio') as has_cardio,
      bool_or(coalesce(vs.exercise_type::text,'') <> 'cardio') as has_strength
    from wh
    left join valid_sets vs on vs.workout_history_id = wh.id
    group by wh.id
  ),

  totals as (
    select
      (select count(*)::int from wh) as workouts_total,
      (select count(distinct local_day)::int from trained_days) as days_trained_total
  ),

  sessions_by_month as (
    -- session = workout_history row (your existing achievement text implies sessions == workouts)
    select month_key, count(*)::int as n
    from wh
    group by month_key
  ),

  distinct_exercises as (
    select count(distinct exercise_id)::int as n
    from valid_sets
  ),

  -- muscle groups in current week (count distinct muscles across all sets)
  current_week as (
    select date_trunc('week', (v_now at time zone v_tz))::date as wk
  ),
  muscles_this_week as (
    select count(distinct em.muscle_id)::int as n
    from valid_sets s
    join public.exercise_muscles em
      on em.exercise_id = s.exercise_id
    where s.week_key = (select wk from current_week)
  ),

  -- strength volume (kg*reps) total + by workout + by week
  total_volume as (
    select coalesce(sum(volume),0)::numeric as v
    from valid_sets
    where weight_kg > 0 and reps > 0
  ),
  volume_by_workout as (
    select workout_history_id, coalesce(sum(volume),0)::numeric as v
    from valid_sets
    where weight_kg > 0 and reps > 0
    group by workout_history_id
  ),
  volume_by_week as (
    select week_key, coalesce(sum(volume),0)::numeric as v
    from valid_sets
    where weight_kg > 0 and reps > 0
    group by week_key
  ),
  prev_week as (
    select ((select wk from current_week) - 7) as wk
  ),
  week_compare as (
    select
      coalesce((select v from volume_by_week where week_key = (select wk from current_week)), 0) as cur_v,
      coalesce((select v from volume_by_week where week_key = (select wk from prev_week)), 0) as prev_v
  ),

  -- distance (meters stored)
  distance_by_workout as (
    select workout_history_id, coalesce(sum(distance_m),0)::numeric as m
    from valid_sets
    where distance_m > 0
    group by workout_history_id
  ),
  distance_total as (
    select coalesce(sum(distance_m),0)::numeric as m
    from valid_sets
    where distance_m > 0
  ),

  -- cardio sessions this month (count workouts with at least 1 cardio valid set)
  cardio_sessions_this_month as (
    select count(*)::int as n
    from wh
    join workout_flags f on f.workout_history_id = wh.id
    where f.has_cardio
      and wh.month_key = date_trunc('month', (v_now at time zone v_tz))::date
  ),

  -- streak helpers (days)
  trained_streak_best as (
    select coalesce((
      with ordered as (
        select local_day, row_number() over (order by local_day) as rn
        from trained_days
      ),
      grp as (
        select (local_day - rn) as g
        from ordered
      )
      select max(cnt)::int
      from (
        select g, count(*)::int as cnt
        from grp
        group by g
      ) x
    ), 0)::int as best_len
  ),
  cardio_streak_best as (
    select coalesce((
      with ordered as (
        select local_day, row_number() over (order by local_day) as rn
        from cardio_days
      ),
      grp as (
        select (local_day - rn) as g
        from ordered
      )
      select max(cnt)::int
      from (
        select g, count(*)::int as cnt
        from grp
        group by g
      ) x
    ), 0)::int as best_len
  ),

  -- month streak: train >=1 time in consecutive months (local month)
  trained_months as (
    select distinct month_key
    from wh
    where exists (
      select 1
      from valid_sets vs
      where vs.workout_history_id = wh.id
    )
  ),
  month_streak_best as (
    select coalesce((
      with ordered as (
        select
          month_key,
          row_number() over (order by month_key) as rn
        from trained_months
      ),
      grp as (
        select
          month_key,
          ( (extract(year from month_key)::int * 12 + extract(month from month_key)::int) - rn ) as g
        from ordered
      )
      select max(cnt)::int
      from (
        select g, count(*)::int as cnt
        from grp
        group by g
      ) x
    ), 0)::int as best_len
  ),

  -- consistency_weeks: >=per_week sessions for N consecutive weeks
  weekly_sessions as (
    select week_key, count(*)::int as n
    from wh
    group by week_key
  ),
  -- build a "best streak for each threshold" by exposing the per-week counts
  -- (the award function will apply per_week from rule)
  -- we keep weekly_sessions as a map-like array for award evaluation
  weekly_sessions_json as (
    select coalesce(
      jsonb_agg(jsonb_build_object('week', week_key, 'n', n) order by week_key),
      '[]'::jsonb
    ) as j
    from weekly_sessions
  ),

  -- bodyweight
  bw as (
    select coalesce(p.weight, 0)::numeric as kg
    from public.profiles p
    where p.id = v_user_id
  ),

  -- PR jumps (epley 1RM), session best vs previous running best
  session_best_by_ex as (
    select
      workout_history_id,
      max(completed_at) as completed_at,
      exercise_id,
      max(e1rm) as best_e1rm
    from valid_sets
    where weight_kg > 0 and reps > 0
    group by workout_history_id, exercise_id
  ),
  pr_events as (
    select
      exercise_id,
      completed_at,
      best_e1rm,
      max(best_e1rm) over (
        partition by exercise_id
        order by completed_at
        rows between unbounded preceding and 1 preceding
      ) as prev_running_best
    from session_best_by_ex
  ),
  pr_jumps as (
    select
      case
        when prev_running_best is null or prev_running_best <= 0 then null
        when best_e1rm > prev_running_best
          then ((best_e1rm - prev_running_best) / prev_running_best) * 100.0
        else null
      end as pct_increase
    from pr_events
  ),

  -- completed goals = inactive goals that are satisfied by history
  completed_goals as (
    select count(*)::int as n
    from public.goals g
    where g.user_id = v_user_id
      and g.is_active = false
      and (
        (g.type::text = 'exercise_weight' and exists (
          select 1 from valid_sets s
          where s.exercise_id = g.exercise_id
            and s.weight_kg >= g.target_number
        ))
        or
        (g.type::text = 'exercise_reps' and exists (
          select 1 from valid_sets s
          where s.exercise_id = g.exercise_id
            and s.reps >= g.target_number
        ))
        or
        (g.type::text = 'distance' and exists (
          select 1 from valid_sets s
          where s.exercise_id = g.exercise_id
            and (s.distance_m / 1000.0) >= g.target_number
        ))
        or
        (g.type::text = 'time' and exists (
          select 1 from valid_sets s
          where s.exercise_id = g.exercise_id
            and s.time_seconds >= (g.target_number * 60.0)
        ))
      )
  )

  select jsonb_build_object(
    'tz', v_tz,
    'generated_at', v_now,

    'workouts_total', (select workouts_total from totals),
    'days_trained_total', (select days_trained_total from totals),

    'trained_streak_best', (select best_len from trained_streak_best),
    'cardio_streak_best', (select best_len from cardio_streak_best),
    'month_streak_best', (select best_len from month_streak_best),

    'sessions_by_month', (
      select coalesce(
        jsonb_agg(jsonb_build_object('month', month_key, 'n', n) order by month_key),
        '[]'::jsonb
      )
      from sessions_by_month
    ),

    'weekly_sessions', (select j from weekly_sessions_json),

    'distinct_exercises', (select n from distinct_exercises),
    'muscles_this_week', (select n from muscles_this_week),

    'total_volume', (select v from total_volume),

    'max_session_volume', (select coalesce(max(v),0) from volume_by_workout),

    'week_volume_cur', (select cur_v from week_compare),
    'week_volume_prev', (select prev_v from week_compare),

    'max_distance_session_m', (select coalesce(max(m),0) from distance_by_workout),
    'distance_total_m', (select m from distance_total),

    'max_duration_seconds', (select coalesce(max(duration_seconds),0) from wh),
    'cardio_sessions_this_month', (select n from cardio_sessions_this_month),

    'bodyweight_kg', (select kg from bw),

    'max_pr_jump_pct', (select coalesce(max(pct_increase),0) from pr_jumps),
    'completed_goals', (select n from completed_goals)
  )
  into v_payload;

  return v_payload;
end;
$function$

CREATE OR REPLACE FUNCTION public.compute_workout_image_key(p_workout_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
with
we as (
  select we.workout_id, we.exercise_id
  from public.workout_exercises we
  where we.workout_id = p_workout_id
    and coalesce(we.is_archived, false) = false
),

-- ✅ enum-safe: cast to text before lower/coalesce
ex as (
  select
    e.id as exercise_id,
    lower(coalesce(e.type::text, '')) as type_txt
  from public.exercises e
  join we on we.exercise_id = e.id
),

totals as (
  select
    count(*) as exercise_count,
    sum(case when ex.type_txt = 'cardio' then 1 else 0 end) as cardio_count
  from ex
),

em as (
  select
    we.workout_id,
    we.exercise_id,
    m.name as muscle_name,
    em.contribution::numeric as contribution
  from we
  join public.exercise_muscles em on em.exercise_id = we.exercise_id
  join public.muscles m on m.id = em.muscle_id
),

primary_max as (
  select exercise_id, max(contribution) as max_contribution
  from em
  group by exercise_id
),

weighted as (
  select
    em.workout_id,
    em.exercise_id,
    em.muscle_name,
    em.contribution *
      case when em.contribution = pm.max_contribution then 1.6 else 1.0 end
      as w
  from em
  join primary_max pm on pm.exercise_id = em.exercise_id
),

split as (
  select
    workout_id,
    muscle_name,
    sum(w) as w_sum,
    public._is_core_muscle(muscle_name) as is_core
  from weighted
  group by workout_id, muscle_name, public._is_core_muscle(muscle_name)
),

agg as (
  select
    workout_id,
    sum(case when is_core then w_sum else 0 end) as core_total,
    sum(case when not is_core then w_sum else 0 end) as non_core_total,

    sum(case when lower(muscle_name) in ('chest','shoulders','triceps','serratus') then w_sum else 0 end) as push_total,

    sum(case when lower(muscle_name) in ('back','lats','upper back','lower back','rear delts','biceps','forearms','traps') then w_sum else 0 end) as pull_total,

    sum(case when lower(muscle_name) in ('quads','quadriceps','hamstrings','glutes','calves','adductors','abductors','hip flexors') then w_sum else 0 end) as legs_total,

    sum(case when lower(muscle_name) in ('hamstrings','glutes','lower back') then w_sum else 0 end) as posterior_total,

    sum(case when lower(muscle_name) in (
      'chest','shoulders','triceps','serratus',
      'back','lats','upper back','lower back','rear delts','biceps','forearms','traps'
    ) then w_sum else 0 end) as upper_total
  from split
  group by workout_id
),

decision as (
  select
    a.*,
    t.exercise_count,
    t.cardio_count,
    case
      -- cardio first
      when t.exercise_count > 0 and (t.cardio_count::numeric / t.exercise_count::numeric) >= 0.5 then 'cardio'
      when t.exercise_count > 0 and t.cardio_count = t.exercise_count then 'cardio'

      -- core-only -> full_body fallback (per your rule)
      when coalesce(a.non_core_total,0) = 0 then 'full_body'

      else
        case
          -- lower-dominant
          when a.legs_total >= greatest(a.push_total, a.pull_total) * 1.15 then
            case
              when a.posterior_total >= a.legs_total * 0.55 then 'lower_body'
              else 'legs'
            end

          -- upper-dominant
          when a.upper_total >= a.legs_total * 1.15 then
            case
              when abs(a.push_total - a.pull_total) <= greatest(a.push_total, a.pull_total) * 0.15 then 'upper_body'
              when a.push_total > a.pull_total then 'push'
              else 'pull'
            end

          -- mixed
          else 'full_body'
        end
    end as image_key
  from agg a
  cross join totals t
)

select image_key from decision;
$function$

CREATE OR REPLACE FUNCTION public.compute_workout_image_key_v1(p_workout_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_catalog'
AS $function$
with
we as (
  select we.workout_id, we.exercise_id
  from public.workout_exercises we
  where we.workout_id = p_workout_id
    and coalesce(we.is_archived, false) = false
),

-- enum-safe: cast to text before lower/coalesce
ex as (
  select
    e.id as exercise_id,
    lower(coalesce(e.type::text, '')) as type_txt
  from public.exercises e
  join we on we.exercise_id = e.id
),

totals as (
  select
    count(*) as exercise_count,
    sum(case when ex.type_txt = 'cardio' then 1 else 0 end) as cardio_count
  from ex
),

em as (
  select
    we.workout_id,
    we.exercise_id,
    m.name as muscle_name,
    em.contribution::numeric as contribution
  from we
  join public.exercise_muscles em on em.exercise_id = we.exercise_id
  join public.muscles m on m.id = em.muscle_id
),

primary_max as (
  select exercise_id, max(contribution) as max_contribution
  from em
  group by exercise_id
),

weighted as (
  select
    em.workout_id,
    em.exercise_id,
    em.muscle_name,
    em.contribution *
      case when em.contribution = pm.max_contribution then 1.6 else 1.0 end
      as w
  from em
  join primary_max pm on pm.exercise_id = em.exercise_id
),

split as (
  select
    workout_id,
    muscle_name,
    sum(w) as w_sum,
    public._is_core_muscle(muscle_name) as is_core
  from weighted
  group by workout_id, muscle_name, public._is_core_muscle(muscle_name)
),

agg as (
  select
    workout_id,
    sum(case when is_core then w_sum else 0 end) as core_total,
    sum(case when not is_core then w_sum else 0 end) as non_core_total,

    sum(case when lower(muscle_name) in ('chest','shoulders','triceps','serratus') then w_sum else 0 end) as push_total,

    sum(case when lower(muscle_name) in ('back','lats','upper back','lower back','rear delts','biceps','forearms','traps') then w_sum else 0 end) as pull_total,

    sum(case when lower(muscle_name) in ('quads','quadriceps','hamstrings','glutes','calves','adductors','abductors','hip flexors') then w_sum else 0 end) as legs_total,

    sum(case when lower(muscle_name) in ('hamstrings','glutes','lower back') then w_sum else 0 end) as posterior_total,

    sum(case when lower(muscle_name) in (
      'chest','shoulders','triceps','serratus',
      'back','lats','upper back','lower back','rear delts','biceps','forearms','traps'
    ) then w_sum else 0 end) as upper_total
  from split
  group by workout_id
),

decision as (
  select
    a.*,
    t.exercise_count,
    t.cardio_count,
    case
      -- cardio first
      when t.exercise_count > 0 and (t.cardio_count::numeric / t.exercise_count::numeric) >= 0.5 then 'cardio'
      when t.exercise_count > 0 and t.cardio_count = t.exercise_count then 'cardio'

      -- core-only -> full_body fallback
      when coalesce(a.non_core_total,0) = 0 then 'full_body'

      else
        case
          -- lower-dominant
          when a.legs_total >= greatest(a.push_total, a.pull_total) * 1.15 then
            case
              when a.posterior_total >= a.legs_total * 0.55 then 'lower_body'
              else 'legs'
            end

          -- upper-dominant
          when a.upper_total >= a.legs_total * 1.15 then
            case
              when abs(a.push_total - a.pull_total) <= greatest(a.push_total, a.pull_total) * 0.15 then 'upper_body'
              when a.push_total > a.pull_total then 'push'
              else 'pull'
            end

          -- mixed
          else 'full_body'
        end
    end as image_key
  from agg a
  cross join totals t
)

select image_key from decision;
$function$

CREATE OR REPLACE FUNCTION public.count_plan_goals(p_plan_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::integer
  from public.goals g
  where g.plan_id = p_plan_id
    and g.is_active = true;
$function$

CREATE OR REPLACE FUNCTION public.count_user_active_plans(p_user_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::integer
  from public.plans p
  where p.user_id = p_user_id
    and p.is_completed = false;
$function$

CREATE OR REPLACE FUNCTION public.count_user_templates(p_user_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::integer
  from public.workouts w
  where w.user_id = p_user_id
    and w.counts_toward_template_limit = true
    and w.archived_at is null
    and w.deleted_at is null;
$function$

CREATE OR REPLACE FUNCTION public.create_full_plan(p_user_id uuid, p_title text, p_end_date date, p_workouts jsonb, p_goals jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_plan_id uuid;
  v_workout_id uuid;
  w jsonb;
  e jsonb;
  g jsonb;
  idx int := 0;
  counters jsonb := '{}'::jsonb;
  group_key text;
  next_idx int;
begin
  if p_user_id <> auth.uid() then
    raise exception 'Not allowed (user mismatch)';
  end if;

  if p_title is null or btrim(p_title) = '' then
    raise exception 'Plan title required';
  end if;

  if p_end_date is null then
    raise exception 'End date required';
  end if;

  if p_workouts is null or jsonb_typeof(p_workouts) <> 'array' then
    raise exception 'p_workouts must be a jsonb array';
  end if;

  if exists (
    select 1
    from public.profiles p
    join public.plans pl on pl.id = p.active_plan_id
    where p.id = p_user_id
      and p.active_plan_id is not null
      and pl.is_completed = false
  ) then
    raise exception 'You already have an active plan';
  end if;

  insert into public.plans (
    user_id, title, start_date, end_date, is_completed,
    weekly_target_sessions
  )
  values (
    p_user_id,
    p_title,
    current_date,
    p_end_date,
    false,
    greatest(1, least(14, jsonb_array_length(p_workouts)))
  )
  returning id into v_plan_id;

  update public.profiles
  set active_plan_id = v_plan_id,
      updated_at = now()
  where id = p_user_id;

  idx := 0;

  for w in
    select * from jsonb_array_elements(p_workouts)
  loop
    insert into public.workouts (user_id, title, notes)
    values (
      p_user_id,
      coalesce(nullif(btrim(w->>'title'),''), 'Untitled Workout'),
      nullif(w->>'notes','')
    )
    returning id into v_workout_id;

    insert into public.plan_workouts (
      plan_id, workout_id, title, weekly_complete, order_index, is_archived
    )
    values (
      v_plan_id,
      v_workout_id,
      coalesce(nullif(btrim(w->>'title'),''), 'Untitled Workout'),
      false,
      idx,
      false
    );

    idx := idx + 1;
    counters := '{}'::jsonb;

    for e in
      select * from jsonb_array_elements(coalesce(w->'exercises','[]'::jsonb))
    loop
      group_key := null;
      next_idx := null;

      if (e ? 'supersetGroup') and coalesce(e->>'supersetGroup','') <> '' then
        group_key := e->>'supersetGroup';

        if not (counters ? group_key) then
          counters := counters || jsonb_build_object(group_key, 1);
          next_idx := 0;
        else
          next_idx := (counters->>group_key)::int;
          counters := counters || jsonb_build_object(group_key, next_idx + 1);
        end if;
      end if;

      insert into public.workout_exercises (
        workout_id, exercise_id, order_index,
        target_sets, target_reps, target_weight, target_time_seconds, target_distance, notes,
        superset_group, superset_index, is_dropset,
        is_archived
      )
      values (
        v_workout_id,
        (e->>'exerciseId')::uuid,
        coalesce((e->>'order_index')::int, 0),
        nullif(e->>'target_sets','')::smallint,
        nullif(e->>'target_reps','')::smallint,
        nullif(e->>'target_weight','')::numeric,
        nullif(e->>'target_time_seconds','')::int,
        nullif(e->>'target_distance','')::numeric,
        nullif(e->>'notes',''),
        group_key,
        next_idx,
        coalesce((e->>'isDropset')::boolean, false),
        false
      );
    end loop;
  end loop;

  for g in
    select * from jsonb_array_elements(coalesce(p_goals,'[]'::jsonb))
  loop
    insert into public.goals (
      user_id, plan_id, exercise_id, type, target_number, unit, deadline, is_active, notes
    )
    values (
      p_user_id,
      v_plan_id,
      (g->>'exerciseId')::uuid,
      (g->>'mode')::goal_type,
      (g->>'target')::numeric,
      nullif(g->>'unit',''),
      p_end_date,
      true,
      case
        when g ? 'start' then jsonb_build_object('start', g->'start')::text
        else null
      end
    );
  end loop;

  return v_plan_id;
exception
  when others then
    raise;
end;
$function$

CREATE OR REPLACE FUNCTION public.create_goal_guarded_test_v1(p_user_id uuid, p_plan_id uuid, p_exercise_id uuid, p_type goal_type, p_target_number numeric, p_unit text DEFAULT NULL::text, p_deadline date DEFAULT NULL::date, p_notes text DEFAULT NULL::text)
 RETURNS goals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.goals;
begin
  perform public.assert_can_add_goal_to_plan(p_user_id, p_plan_id);

  insert into public.goals (
    user_id,
    plan_id,
    exercise_id,
    type,
    target_number,
    unit,
    deadline,
    is_active,
    notes,
    created_at
  )
  values (
    p_user_id,
    p_plan_id,
    p_exercise_id,
    p_type,
    p_target_number,
    p_unit,
    p_deadline,
    true,
    p_notes,
    now()
  )
  returning * into v_row;

  return v_row;
end;
$function$

CREATE OR REPLACE FUNCTION public.create_notification_v1(p_recipient_id uuid, p_actor_id uuid, p_type text, p_title text, p_body text, p_entity_type text, p_entity_id uuid, p_dedupe_key text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_notification_id uuid;
begin
  if p_recipient_id is null then
    raise exception 'recipient_id_required';
  end if;

  if p_type is null then
    raise exception 'type_required';
  end if;

  if p_entity_type is null then
    raise exception 'entity_type_required';
  end if;

  if p_entity_id is null then
    raise exception 'entity_id_required';
  end if;

  -- no self notifications
  if p_actor_id is not null and p_actor_id = p_recipient_id then
    return null;
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    title,
    body,
    entity_type,
    entity_id,
    dedupe_key,
    push_status
  )
  values (
    p_recipient_id,
    p_actor_id,
    p_type,
    p_title,
    p_body,
    p_entity_type,
    p_entity_id,
    p_dedupe_key,
    'pending'
  )
  on conflict (dedupe_key) do nothing
  returning id into v_notification_id;

  return v_notification_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.create_notification_v1(p_user_id uuid, p_actor_id uuid, p_type text, p_post_id uuid DEFAULT NULL::uuid, p_comment_id uuid DEFAULT NULL::uuid, p_follow_requester_id uuid DEFAULT NULL::uuid, p_follow_target_id uuid DEFAULT NULL::uuid, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- basic guards
  if p_user_id is null or p_type is null then
    return;
  end if;

  -- no self-notifications
  if p_actor_id is not null and p_user_id = p_actor_id then
    return;
  end if;

  -- block guard (if actor exists)
  if p_actor_id is not null and public.is_blocked_either(p_user_id, p_actor_id) then
    return;
  end if;

  insert into public.notifications (
    user_id, actor_id, type,
    post_id, comment_id,
    follow_requester_id, follow_target_id,
    payload
  )
  values (
    p_user_id, p_actor_id, p_type,
    p_post_id, p_comment_id,
    p_follow_requester_id, p_follow_target_id,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict do nothing;
end;
$function$

CREATE OR REPLACE FUNCTION public.create_plan_guarded_test_v1(p_user_id uuid, p_title text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_weekly_target_sessions integer DEFAULT NULL::integer)
 RETURNS plans
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.plans;
begin
  perform public.assert_can_create_or_activate_plan(p_user_id);

  insert into public.plans (
    user_id,
    title,
    start_date,
    end_date,
    weekly_target_sessions,
    is_completed,
    created_at
  )
  values (
    p_user_id,
    p_title,
    p_start_date,
    p_end_date,
    p_weekly_target_sessions,
    false,
    now()
  )
  returning * into v_row;

  return v_row;
end;
$function$

CREATE OR REPLACE FUNCTION public.create_plan_guarded_v1(p_title text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_weekly_target_sessions integer DEFAULT NULL::integer)
 RETURNS plans
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_row public.plans;
begin
  if v_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'NOT_AUTHENTICATED',
      detail = 'User must be authenticated.';
  end if;

  perform public.assert_can_create_or_activate_plan(v_user_id);

  insert into public.plans (
    user_id,
    title,
    start_date,
    end_date,
    weekly_target_sessions,
    is_completed,
    created_at
  )
  values (
    v_user_id,
    p_title,
    p_start_date,
    p_end_date,
    p_weekly_target_sessions,
    false,
    now()
  )
  returning * into v_row;

  return v_row;
end;
$function$

CREATE OR REPLACE FUNCTION public.create_plan_test_v1(p_user_id uuid, p_title text, p_end_date date, p_workouts jsonb, p_goals jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_plan_id uuid;
  v_workout_id uuid;

  w jsonb;
  e jsonb;
  g jsonb;

  idx int := 0;

  counters jsonb := '{}'::jsonb;
  group_key text;
  next_idx int;

  v_image_key text;

  v_limits jsonb;
  v_max_goals integer;
  v_goal_count integer;
begin
  if p_title is null or btrim(p_title) = '' then
    raise exception 'Plan title required';
  end if;

  if p_end_date is null then
    raise exception 'End date required';
  end if;

  if p_workouts is null or jsonb_typeof(p_workouts) <> 'array' then
    raise exception 'p_workouts must be a jsonb array';
  end if;

  if p_goals is not null and jsonb_typeof(p_goals) <> 'array' then
    raise exception 'p_goals must be a jsonb array';
  end if;

  perform public.assert_can_create_or_activate_plan(p_user_id);

  v_limits := public.get_user_enforcement_limits(p_user_id);
  v_max_goals := coalesce((v_limits->>'maxGoalsPerPlan')::integer, 2);
  v_goal_count := jsonb_array_length(coalesce(p_goals, '[]'::jsonb));

  if v_goal_count > v_max_goals then
    raise exception using
      errcode = 'P0001',
      message = 'GOAL_LIMIT_REACHED',
      detail = format(
        'Goal limit reached for this plan. Current=%s Max=%s',
        v_goal_count,
        v_max_goals
      );
  end if;

  insert into public.plans (
    user_id, title, start_date, end_date, is_completed, weekly_target_sessions
  )
  values (
    p_user_id,
    p_title,
    current_date,
    p_end_date,
    false,
    greatest(1, least(14, jsonb_array_length(p_workouts)))
  )
  returning id into v_plan_id;

  update public.profiles
  set active_plan_id = v_plan_id,
      updated_at = now()
  where id = p_user_id;

  idx := 0;

  for w in
    select * from jsonb_array_elements(p_workouts)
  loop
    v_image_key := nullif(btrim(coalesce(w->>'workout_image_key','')), '');

    if v_image_key is null then
      v_image_key :=
        case
          when lower(coalesce(w->>'title','')) like '%push%' then 'push'
          when lower(coalesce(w->>'title','')) like '%pull%' then 'pull'
          when lower(coalesce(w->>'title','')) like '%leg%' then 'legs'
          when lower(coalesce(w->>'title','')) like '%cardio%' then 'cardio'
          when lower(coalesce(w->>'title','')) like '%full%' then 'full_body'
          else 'full_body'
        end;
    end if;

    insert into public.workouts (
      user_id,
      title,
      notes,
      workout_image_key,
      created_source,
      counts_toward_template_limit,
      archived_at,
      deleted_at
    )
    values (
      p_user_id,
      coalesce(nullif(btrim(w->>'title'),''), 'Untitled Workout'),
      nullif(w->>'notes',''),
      v_image_key,
      'plan_clone',
      false,
      null,
      null
    )
    returning id into v_workout_id;

    insert into public.plan_workouts (
      plan_id, workout_id, title, weekly_complete, order_index, is_archived
    )
    values (
      v_plan_id,
      v_workout_id,
      coalesce(nullif(btrim(w->>'title'),''), 'Untitled Workout'),
      false,
      idx,
      false
    );

    idx := idx + 1;
    counters := '{}'::jsonb;

    for e in
      select * from jsonb_array_elements(coalesce(w->'exercises','[]'::jsonb))
    loop
      group_key := null;
      next_idx := null;

      if (e ? 'supersetGroup') and coalesce(e->>'supersetGroup','') <> '' then
        group_key := e->>'supersetGroup';

        if not (counters ? group_key) then
          counters := counters || jsonb_build_object(group_key, 1);
          next_idx := 0;
        else
          next_idx := (counters->>group_key)::int;
          counters := counters || jsonb_build_object(group_key, next_idx + 1);
        end if;
      end if;

      insert into public.workout_exercises (
        workout_id, exercise_id, order_index,
        target_sets, target_reps, target_weight, target_time_seconds, target_distance, notes,
        superset_group, superset_index, is_dropset, is_archived
      )
      values (
        v_workout_id,
        (e->>'exerciseId')::uuid,
        coalesce((e->>'order_index')::int, 0),
        nullif(e->>'target_sets','')::smallint,
        nullif(e->>'target_reps','')::smallint,
        nullif(e->>'target_weight','')::numeric,
        nullif(e->>'target_time_seconds','')::int,
        nullif(e->>'target_distance','')::numeric,
        nullif(e->>'notes',''),
        group_key,
        next_idx,
        coalesce((e->>'isDropset')::boolean, false),
        false
      );
    end loop;
  end loop;

  for g in
    select * from jsonb_array_elements(coalesce(p_goals,'[]'::jsonb))
  loop
    insert into public.goals (
      user_id, plan_id, exercise_id, type, target_number, unit, deadline, is_active, notes
    )
    values (
      p_user_id,
      v_plan_id,
      (g->>'exerciseId')::uuid,
      (g->>'mode')::goal_type,
      (g->>'target')::numeric,
      nullif(g->>'unit',''),
      p_end_date,
      true,
      case
        when g ? 'start' then jsonb_build_object('start', g->'start')::text
        else null
      end
    );
  end loop;

  return v_plan_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.create_plan_v1(p_user_id uuid, p_title text, p_end_date date, p_workouts jsonb, p_goals jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_plan_id uuid;
  v_workout_id uuid;

  w jsonb;
  e jsonb;
  g jsonb;

  idx int := 0;

  counters jsonb := '{}'::jsonb;
  group_key text;
  next_idx int;

  v_image_key text;

begin
  if p_user_id <> auth.uid() then
    raise exception 'Not allowed (user mismatch)';
  end if;

  if p_title is null or btrim(p_title) = '' then
    raise exception 'Plan title required';
  end if;

  if p_end_date is null then
    raise exception 'End date required';
  end if;

  if p_workouts is null or jsonb_typeof(p_workouts) <> 'array' then
    raise exception 'p_workouts must be a jsonb array';
  end if;

  if p_goals is not null and jsonb_typeof(p_goals) <> 'array' then
    raise exception 'p_goals must be a jsonb array';
  end if;

  perform public.assert_can_create_or_activate_plan(p_user_id);

  insert into public.plans (
    user_id,
    title,
    start_date,
    end_date,
    is_completed,
    weekly_target_sessions
  )
  values (
    p_user_id,
    p_title,
    current_date,
    p_end_date,
    false,
    greatest(1, least(14, jsonb_array_length(p_workouts)))
  )
  returning id into v_plan_id;

  update public.profiles
  set active_plan_id = v_plan_id,
      updated_at = now()
  where id = p_user_id;

  idx := 0;

  for w in
    select * from jsonb_array_elements(p_workouts)
  loop
    v_image_key := nullif(btrim(coalesce(w->>'workout_image_key','')), '');

    if v_image_key is null then
      with ex_ids as (
        select (x->>'exerciseId')::uuid as exercise_id
        from jsonb_array_elements(coalesce(w->'exercises','[]'::jsonb)) x
        where (x ? 'exerciseId')
          and nullif(btrim(x->>'exerciseId'), '') is not null
      ),
      cardio as (
        select exists(
          select 1
          from ex_ids
          join public.exercises ex on ex.id = ex_ids.exercise_id
          where ex.type = 'cardio'
        ) as is_cardio
      ),
      muscle_counts as (
        select
          sum(case when lower(coalesce(m.name, '')) in ('chest','shoulders','triceps') then 1 else 0 end) as push_n,
          sum(case when lower(coalesce(m.name, '')) in ('back','lats','biceps') then 1 else 0 end) as pull_n,
          sum(case when lower(coalesce(m.name, '')) in ('quads','hamstrings','glutes','calves') then 1 else 0 end) as lower_n
        from ex_ids
        join public.exercise_muscles em on em.exercise_id = ex_ids.exercise_id
        join public.muscles m on m.id = em.muscle_id
      )
      select
        case
          when (select is_cardio from cardio) then 'cardio'
          else
            case
              when coalesce((select lower_n from muscle_counts), 0) >= greatest(
                coalesce((select push_n from muscle_counts), 0),
                coalesce((select pull_n from muscle_counts), 0)
              ) + 2 then 'legs'

              when coalesce((select push_n from muscle_counts), 0) >= coalesce((select pull_n from muscle_counts), 0) + 2 then 'push'

              when coalesce((select pull_n from muscle_counts), 0) >= coalesce((select push_n from muscle_counts), 0) + 2 then 'pull'

              when coalesce((select lower_n from muscle_counts), 0) > 0
                and (
                  coalesce((select push_n from muscle_counts), 0) > 0
                  or coalesce((select pull_n from muscle_counts), 0) > 0
                ) then 'full_body'

              when coalesce((select lower_n from muscle_counts), 0) > 0 then 'lower_body'

              when (
                coalesce((select push_n from muscle_counts), 0) > 0
                or coalesce((select pull_n from muscle_counts), 0) > 0
              ) then 'upper_body'

              else null
            end
        end
      into v_image_key;
    end if;

    if v_image_key is null then
      v_image_key :=
        case
          when lower(coalesce(w->>'title','')) like '%push%' then 'push'
          when lower(coalesce(w->>'title','')) like '%pull%' then 'pull'
          when lower(coalesce(w->>'title','')) like '%leg%' then 'legs'
          when lower(coalesce(w->>'title','')) like '%cardio%' then 'cardio'
          when lower(coalesce(w->>'title','')) like '%full%' then 'full_body'
          else 'full_body'
        end;
    end if;

    insert into public.workouts (
      user_id,
      title,
      notes,
      workout_image_key,
      created_source,
      counts_toward_template_limit,
      archived_at,
      deleted_at
    )
    values (
      p_user_id,
      coalesce(nullif(btrim(w->>'title'),''), 'Untitled Workout'),
      nullif(w->>'notes',''),
      v_image_key,
      'plan_clone',
      false,
      null,
      null
    )
    returning id into v_workout_id;

    insert into public.plan_workouts (
      plan_id,
      workout_id,
      title,
      weekly_complete,
      order_index,
      is_archived
    )
    values (
      v_plan_id,
      v_workout_id,
      coalesce(nullif(btrim(w->>'title'),''), 'Untitled Workout'),
      false,
      idx,
      false
    );

    idx := idx + 1;
    counters := '{}'::jsonb;

    for e in
      select * from jsonb_array_elements(coalesce(w->'exercises','[]'::jsonb))
    loop
      group_key := null;
      next_idx := null;

      if (e ? 'supersetGroup') and coalesce(e->>'supersetGroup','') <> '' then
        group_key := e->>'supersetGroup';

        if not (counters ? group_key) then
          counters := counters || jsonb_build_object(group_key, 1);
          next_idx := 0;
        else
          next_idx := (counters->>group_key)::int;
          counters := counters || jsonb_build_object(group_key, next_idx + 1);
        end if;
      end if;

      insert into public.workout_exercises (
        workout_id,
        exercise_id,
        order_index,
        target_sets,
        target_reps,
        target_weight,
        target_time_seconds,
        target_distance,
        notes,
        superset_group,
        superset_index,
        is_dropset,
        is_archived
      )
      values (
        v_workout_id,
        (e->>'exerciseId')::uuid,
        coalesce((e->>'order_index')::int, 0),
        nullif(e->>'target_sets','')::smallint,
        nullif(e->>'target_reps','')::smallint,
        nullif(e->>'target_weight','')::numeric,
        nullif(e->>'target_time_seconds','')::int,
        nullif(e->>'target_distance','')::numeric,
        nullif(e->>'notes',''),
        group_key,
        next_idx,
        coalesce((e->>'isDropset')::boolean, false),
        false
      );
    end loop;
  end loop;

  for g in
    select * from jsonb_array_elements(coalesce(p_goals,'[]'::jsonb))
  loop
    if not (g ? 'exerciseId') or nullif(btrim(g->>'exerciseId'), '') is null then
      raise exception 'Goal exerciseId required';
    end if;

    if not (g ? 'metrics')
      or jsonb_typeof(g->'metrics') <> 'array'
      or jsonb_array_length(g->'metrics') = 0 then
      raise exception 'Goal metrics required';
    end if;

    insert into public.goals (
      user_id,
      plan_id,
      exercise_id,
      type,
      target_number,
      unit,
      deadline,
      is_active,
      notes,
      metrics,
      start_weight,
      start_reps,
      start_distance,
      start_time_seconds,
      target_weight,
      target_reps,
      target_distance,
      target_time_seconds,
      goal_summary
    )
    values (
      p_user_id,
      v_plan_id,
      (g->>'exerciseId')::uuid,

      case
        when (g->'metrics') ? 'weight' then 'exercise_weight'::goal_type
        when (g->'metrics') ? 'reps' then 'exercise_reps'::goal_type
        when (g->'metrics') ? 'distance' then 'distance'::goal_type
        when (g->'metrics') ? 'time' then 'time'::goal_type
        else 'exercise_weight'::goal_type
      end,

      coalesce(
        nullif(g->>'target_weight', '')::numeric,
        nullif(g->>'target_reps', '')::numeric,
        nullif(g->>'target_distance', '')::numeric,
        nullif(g->>'target_time_seconds', '')::numeric,
        0
      ),

      case
        when (g->'metrics') ? 'weight' then 'kg'
        when (g->'metrics') ? 'reps' then 'reps'
        when (g->'metrics') ? 'distance' then 'km'
        when (g->'metrics') ? 'time' then 'seconds'
        else null
      end,

      p_end_date,
      true,
      nullif(g->>'summary', ''),

      g->'metrics',

      nullif(g->>'start_weight', '')::numeric,
      nullif(g->>'start_reps', '')::integer,
      nullif(g->>'start_distance', '')::numeric,
      nullif(g->>'start_time_seconds', '')::integer,

      nullif(g->>'target_weight', '')::numeric,
      nullif(g->>'target_reps', '')::integer,
      nullif(g->>'target_distance', '')::numeric,
      nullif(g->>'target_time_seconds', '')::integer,

      nullif(g->>'summary', '')
    );
  end loop;

  return v_plan_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.create_post_v1(p_post_type text, p_visibility text, p_caption text, p_workout_history_id uuid DEFAULT NULL::uuid, p_exercise_id uuid DEFAULT NULL::uuid, p_pr_snapshot jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_post_id uuid;
  v_is_private boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- enforce visibility rules for private users (match your RLS intent)
  select is_private into v_is_private
  from public.profiles
  where id = v_uid;

  if v_is_private is true and p_visibility = 'public' then
    raise exception 'Private accounts cannot post publicly';
  end if;

  insert into public.posts (
    user_id, post_type, visibility, caption,
    workout_history_id, exercise_id, pr_snapshot
  )
  values (
    v_uid, p_post_type, p_visibility, p_caption,
    p_workout_history_id, p_exercise_id, p_pr_snapshot
  )
  returning id into v_post_id;

  return v_post_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.create_post_v2(p_caption text, p_exercise_id uuid, p_post_type text, p_pr_reps integer, p_pr_weight numeric, p_visibility text, p_workout_history_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_post_id uuid;
  v_profile_visibility text;

  v_snapshot jsonb;

  v_exercise_name text;
  v_estimated_1rm numeric;
  v_previous_best_weight numeric;
  v_previous_best_reps int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select p.visibility
    into v_profile_visibility
  from public.profiles p
  where p.id = v_uid;

  if coalesce(v_profile_visibility, 'public') = 'private'
     and p_visibility = 'public' then
    raise exception 'Private accounts cannot post publicly';
  end if;

  if p_visibility not in ('public','followers','private') then
    raise exception 'Invalid visibility';
  end if;

  -- ======================
  -- WORKOUT POST
  -- ======================
  if p_post_type = 'workout' then

    if p_workout_history_id is null then
      raise exception 'Workout post requires workout_history_id';
    end if;

    if not exists (
      select 1
      from public.workout_history wh
      where wh.id = p_workout_history_id
        and wh.user_id = v_uid
    ) then
      raise exception 'Workout not found';
    end if;

    with
    wh as (
      select
        wh.id,
        wh.completed_at,
        wh.duration_seconds,
        w.title,
        w.workout_image_key
      from public.workout_history wh
      left join public.workouts w on w.id = wh.workout_id
      where wh.id = p_workout_history_id
    ),
    totals as (
      select
        coalesce(sum((wsh.weight * wsh.reps)::numeric), 0)::numeric as volume_kg,
        count(*)::int as sets_count
      from public.workout_exercise_history weh
      join public.workout_set_history wsh
        on wsh.workout_exercise_history_id = weh.id
      where weh.workout_history_id = p_workout_history_id
        and wsh.weight is not null and wsh.weight > 0
        and wsh.reps is not null and wsh.reps > 0
    ),
    exercises as (
      select
        jsonb_agg(
          jsonb_build_object(
            'exercise_id', weh.exercise_id,
            'exercise_name', e.name,
            'sets',
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'weight', wsh.weight,
                    'reps', wsh.reps
                  )
                  order by wsh.set_number asc
                )
                from public.workout_set_history wsh
                where wsh.workout_exercise_history_id = weh.id
              )
          )
          order by weh.order_index asc
        ) as ex_json
      from public.workout_exercise_history weh
      join public.exercises e on e.id = weh.exercise_id
      where weh.workout_history_id = p_workout_history_id
    )
    select jsonb_build_object(
      'title', coalesce((select title from wh), 'Workout'),
      'completed_at', (select completed_at from wh),
      'duration_seconds', (select duration_seconds from wh),
      'volume_kg', (select volume_kg from totals),
      'sets_count', (select sets_count from totals),
      'workout_image_key', (select workout_image_key from wh),
      'exercises', coalesce((select ex_json from exercises), '[]'::jsonb)
    )
    into v_snapshot;

    insert into public.posts (
      user_id,
      post_type,
      visibility,
      caption,
      workout_history_id,
      workout_snapshot,
      created_at,
      updated_at
    )
    values (
      v_uid,
      'workout',
      p_visibility,
      p_caption,
      p_workout_history_id,
      v_snapshot,
      now(),
      now()
    )
    returning id into v_post_id;

    return v_post_id;
  end if;

  -- ======================
  -- PR POST
  -- ======================
  if p_post_type = 'pr' then
    if p_exercise_id is null then
      raise exception 'PR post requires exercise_id';
    end if;

    if p_pr_weight is null or p_pr_weight <= 0 then
      raise exception 'PR post requires valid weight';
    end if;

    if p_pr_reps is null or p_pr_reps <= 0 then
      raise exception 'PR post requires valid reps';
    end if;

    if p_workout_history_id is not null then
      if not exists (
        select 1
        from public.workout_history wh
        where wh.id = p_workout_history_id
          and wh.user_id = v_uid
      ) then
        raise exception 'Workout not found';
      end if;
    end if;

    select e.name
      into v_exercise_name
    from public.exercises e
    where e.id = p_exercise_id;

    if v_exercise_name is null then
      raise exception 'Exercise not found';
    end if;

    v_estimated_1rm := (p_pr_weight * (1 + (p_pr_reps::numeric / 30.0)))::numeric;

    -- previous best actual lift:
    -- lower than the selected PR weight, highest weight wins, then highest reps
    select
      x.weight,
      x.reps
    into
      v_previous_best_weight,
      v_previous_best_reps
    from (
      select distinct
        wsh.weight::numeric as weight,
        wsh.reps::int as reps,
        wh.completed_at,
        wh.id as workout_history_id
      from public.workout_history wh
      join public.workout_exercise_history weh
        on weh.workout_history_id = wh.id
      join public.workout_set_history wsh
        on wsh.workout_exercise_history_id = weh.id
      where wh.user_id = v_uid
        and weh.exercise_id = p_exercise_id
        and wsh.weight is not null
        and wsh.weight > 0
        and wsh.reps is not null
        and wsh.reps > 0
        and (
          wsh.weight < p_pr_weight
          or (wsh.weight = p_pr_weight and wsh.reps < p_pr_reps)
        )
    ) x
    order by
      x.weight desc,
      x.reps desc,
      x.completed_at desc,
      x.workout_history_id desc
    limit 1;

    v_snapshot := jsonb_build_object(
      'exercise_id', p_exercise_id,
      'exercise_name', v_exercise_name,
      'weight', p_pr_weight,
      'reps', p_pr_reps,
      'estimated_1rm', round(v_estimated_1rm, 1),
      'previous_best_weight', v_previous_best_weight,
      'previous_best_reps', v_previous_best_reps,
      'delta_weight',
        case
          when v_previous_best_weight is null then null
          else (p_pr_weight - v_previous_best_weight)
        end,
      'achieved_at', now(),
      'workout_history_id', p_workout_history_id
    );

    insert into public.posts (
      user_id,
      post_type,
      visibility,
      caption,
      workout_history_id,
      exercise_id,
      pr_snapshot,
      created_at,
      updated_at
    )
    values (
      v_uid,
      'pr',
      p_visibility,
      p_caption,
      p_workout_history_id,
      p_exercise_id,
      v_snapshot,
      now(),
      now()
    )
    returning id into v_post_id;

    return v_post_id;
  end if;

  raise exception 'Invalid post type';
end;
$function$

CREATE OR REPLACE FUNCTION public.create_private_exercise(p_name text, p_equipment text, p_muscle_ids integer[], p_instructions text DEFAULT NULL::text, p_contribution integer DEFAULT 30)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  v_exercise_id uuid;
  v_uid uuid;
  v_mid int;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Name required';
  end if;

  if p_equipment is null or btrim(p_equipment) = '' then
    raise exception 'Equipment required';
  end if;

  if p_muscle_ids is null or array_length(p_muscle_ids, 1) is null then
    raise exception 'At least 1 muscle required';
  end if;

  if array_length(p_muscle_ids, 1) > 3 then
    raise exception 'Up to 3 muscles allowed';
  end if;

  -- create exercise
  insert into public.exercises (
    name, equipment, type, level, instructions, user_id, is_public
  )
  values (
    btrim(p_name),
    btrim(p_equipment),
    'strength',
    'beginner',
    nullif(btrim(p_instructions), ''),
    v_uid,
    false
  )
  returning id into v_exercise_id;

  -- link muscles (contribution int)
  foreach v_mid in array p_muscle_ids loop
    insert into public.exercise_muscles (exercise_id, muscle_id, contribution)
    values (v_exercise_id, v_mid, p_contribution);
  end loop;

  return v_exercise_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.create_starter_workout(p_split text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_split text := lower(coalesce(p_split,''));
  v_workout_id uuid;
  v_title text;
  v_workout_notes text;

  -- resolved exercise ids
  ex1 uuid; ex2 uuid; ex3 uuid; ex4 uuid; ex5 uuid; ex6 uuid;

  -- helper for deterministic-ish selection:
  -- 1) exact name (case-insensitive)
  -- 2) ilike any(patterns)
  -- prefers public exercises, then global (null user), then others
  functionless_dummy int := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_split not in ('push','pull','legs') then
    v_split := 'push';
  end if;

  v_title :=
    case v_split
      when 'push' then 'Starter Push'
      when 'pull' then 'Starter Pull'
      else 'Starter Legs'
    end;

  v_workout_notes :=
    'Warm-up: 5–8 min easy cardio + 2–3 lighter warm-up sets for the first lift. '
    || 'Use a weight you can control with good form.';

  insert into public.workouts (title, user_id, notes, created_at, updated_at)
  values (v_title, v_user_id, v_workout_notes, now(), now())
  returning id into v_workout_id;

  /* --------------------------
     PUSH (6 exercises)
     Bench: Barbell Bench Press
     Incline: Incline Dumbbell Press
     -------------------------- */
  if v_split = 'push' then
    -- 1) Barbell Bench Press (exact preferred)
    select e.id into ex1
    from public.exercises e
    where lower(e.name) = lower('Barbell Bench Press')
       or e.name ilike any (array[
         '%Barbell Bench Press%',
         '%Dumbbell Bench Press%',
         '%Smith Machine Bench Press%'
       ])
    order by
      (case when lower(e.name) = lower('Barbell Bench Press') then 0 else 1 end),
      e.is_public desc,
      e.user_id nulls first
    limit 1;

    -- 2) Incline Dumbbell Press (exact preferred)
    select e.id into ex2
    from public.exercises e
    where lower(e.name) = lower('Incline Dumbbell Press')
       or e.name ilike any (array[
         '%Incline Dumbbell Press%',
         '%Incline Dumbbell Bench Press%',
         '%Incline Barbell Bench Press%',
         '%Machine Incline Press%',
         '%Smith Machine Incline Bench Press%'
       ])
    order by
      (case when lower(e.name) = lower('Incline Dumbbell Press') then 0 else 1 end),
      e.is_public desc,
      e.user_id nulls first
    limit 1;

    -- 3) Machine Flys (use pec deck / machine fly; avoid incline cable fly if possible)
    select e.id into ex3
    from public.exercises e
    where lower(e.name) in (lower('Pec Deck'), lower('Machine Fly'), lower('Machine Flys'))
       or e.name ilike any (array[
         '%Pec Deck%',
         '%Machine Fly%',
         '%Chest Fly (Machine)%'
       ])
    order by
      -- keep cable fly as last resort
      (case when lower(e.name) like '%cable%' then 2 else 0 end),
      e.is_public desc,
      e.user_id nulls first
    limit 1;

    -- 4) Lateral raise
    select e.id into ex4
    from public.exercises e
    where lower(e.name) = lower('Lateral Raise')
       or e.name ilike any (array['%Lateral Raise%','%Side Raise%'])
    order by
      (case when lower(e.name) = lower('Lateral Raise') then 0 else 1 end),
      e.is_public desc,
      e.user_id nulls first
    limit 1;

    -- 5) Rear delt flys (prefer rear delt / reverse fly variants; avoid Y-raise)
    select e.id into ex5
    from public.exercises e
    where e.name ilike any (array['%Rear Delt%Fly%','%Reverse Fly%','%Rear Delt%'])
      and e.name not ilike '%Y-Raise%'
    order by e.is_public desc, e.user_id nulls first
    limit 1;

    -- 6) Overhead tricep extension
    select e.id into ex6
    from public.exercises e
    where lower(e.name) = lower('Overhead Tricep Extension')
       or e.name ilike any (array[
         '%Overhead%Tricep%Extension%',
         '%Tricep%Extension%',
         '%Cable%Overhead%Extension%'
       ])
    order by
      (case when lower(e.name) = lower('Overhead Tricep Extension') then 0 else 1 end),
      e.is_public desc,
      e.user_id nulls first
    limit 1;

    if ex1 is null then raise exception 'Starter Push missing exercise: Barbell Bench Press'; end if;
    if ex2 is null then raise exception 'Starter Push missing exercise: Incline Dumbbell Press'; end if;
    if ex3 is null then raise exception 'Starter Push missing exercise: Machine Fly / Pec Deck'; end if;
    if ex4 is null then raise exception 'Starter Push missing exercise: Lateral Raise'; end if;
    if ex5 is null then raise exception 'Starter Push missing exercise: Rear Delt Fly'; end if;
    if ex6 is null then raise exception 'Starter Push missing exercise: Overhead Tricep Extension'; end if;

    insert into public.workout_exercises
      (workout_id, exercise_id, order_index, target_sets, target_reps, notes, is_archived, created_at, updated_at)
    values
      (v_workout_id, ex1, 0, 3,  6, 'Rest 2–3 min. Add weight if all reps are clean.', false, now(), now()),
      (v_workout_id, ex2, 1, 2,  8, 'Controlled tempo. Full range.',                  false, now(), now()),
      (v_workout_id, ex3, 2, 3, 10, 'Pause 1s at squeeze.',                            false, now(), now()),
      (v_workout_id, ex4, 3, 3, 12, 'Avoid swinging. Stop short of pain.',             false, now(), now()),
      (v_workout_id, ex5, 4, 3, 12, 'Light and strict. Feel rear delts.',              false, now(), now()),
      (v_workout_id, ex6, 5, 3,  8, 'Elbows fixed. Full stretch.',                     false, now(), now());

  /* --------------------------
     PULL (6 exercises)
     Lat Pulldown: Lat Pulldown (exact preferred)
     -------------------------- */
  elsif v_split = 'pull' then
    -- 1) Lat Pulldown (exact preferred). Avoid straight-arm pulldown.
    select e.id into ex1
    from public.exercises e
    where lower(e.name) = lower('Lat Pulldown')
       or (
         e.name ilike any (array[
           '%Lat Pulldown%',
           '%Lat Pull Down%'
         ])
         and e.name not ilike '%Straight-Arm%'
         and e.name not ilike '%Lat Prayer%'
       )
    order by
      (case when lower(e.name) = lower('Lat Pulldown') then 0 else 1 end),
      e.is_public desc,
      e.user_id nulls first
    limit 1;

    -- 2) Single arm dumbbell row
    select e.id into ex2
    from public.exercises e
    where e.name ilike any (array['%Single-Arm%Row%','%Single Arm%Dumbbell%Row%','%One-Arm%Dumbbell%Row%'])
    order by e.is_public desc, e.user_id nulls first
    limit 1;

    -- 3) Pull ups
    select e.id into ex3
    from public.exercises e
    where e.name ilike any (array['%Pull Up%','%Pull-Up%','%Pull Ups%'])
    order by e.is_public desc, e.user_id nulls first
    limit 1;

    -- 4) Machine rows / seated row
    select e.id into ex4
    from public.exercises e
    where e.name ilike any (array['%Machine%Row%','%Seated%Row%','%Cable%Row%'])
    order by e.is_public desc, e.user_id nulls first
    limit 1;

    -- 5) Hammer curls
    select e.id into ex5
    from public.exercises e
    where e.name ilike any (array['%Hammer%Curl%'])
    order by e.is_public desc, e.user_id nulls first
    limit 1;

    -- 6) Dumbbell bicep curls
    select e.id into ex6
    from public.exercises e
    where e.name ilike any (array['%Dumbbell%Bicep%Curl%','%Dumbbell%Curl%'])
      and e.name not ilike '%Incline Dumbbell Curl%'
    order by e.is_public desc, e.user_id nulls first
    limit 1;

    if ex1 is null then raise exception 'Starter Pull missing exercise: Lat Pulldown'; end if;
    if ex2 is null then raise exception 'Starter Pull missing exercise: Single-Arm Dumbbell Row'; end if;
    if ex3 is null then raise exception 'Starter Pull missing exercise: Pull Ups'; end if;
    if ex4 is null then raise exception 'Starter Pull missing exercise: Machine Row'; end if;
    if ex5 is null then raise exception 'Starter Pull missing exercise: Hammer Curls'; end if;
    if ex6 is null then raise exception 'Starter Pull missing exercise: Dumbbell Bicep Curls'; end if;

    insert into public.workout_exercises
      (workout_id, exercise_id, order_index, target_sets, target_reps, notes, is_archived, created_at, updated_at)
    values
      (v_workout_id, ex1, 0, 3, 8, 'Drive elbows down. Don’t yank.',            false, now(), now()),
      (v_workout_id, ex2, 1, 3, 8, 'Pause at top. Keep torso stable.',         false, now(), now()),
      (v_workout_id, ex3, 2, 3, 5, 'Use assistance if needed. Full range.',    false, now(), now()),
      (v_workout_id, ex4, 3, 3, 6, 'Heavy but strict. Rest 2 min.',            false, now(), now()),
      (v_workout_id, ex5, 4, 2, 8, 'No swing. Control eccentric.',             false, now(), now()),
      (v_workout_id, ex6, 5, 3, 8, 'Full supination. Elbows pinned.',          false, now(), now());

  /* --------------------------
     LEGS (5 exercises)
     Hip thrust: Barbell Hip Thrust (exact preferred)
     -------------------------- */
  else
    -- 1) Back squat (prefer a "Back Squat" name)
    select e.id into ex1
    from public.exercises e
    where e.name ilike any (array['%Back Squat%','%Barbell%Back%Squat%'])
    order by
      (case when lower(e.name) like '%low-bar%' then 0 else 1 end),
      e.is_public desc,
      e.user_id nulls first
    limit 1;

    -- 2) Barbell Hip Thrust (exact preferred)
    select e.id into ex2
    from public.exercises e
    where lower(e.name) = lower('Barbell Hip Thrust')
       or e.name ilike any (array['%Barbell%Hip%Thrust%','%Hip Thrust (Barbell)%','%Smith Machine Hip Thrust%'])
    order by
      (case when lower(e.name) = lower('Barbell Hip Thrust') then 0 else 1 end),
      e.is_public desc,
      e.user_id nulls first
    limit 1;

    -- 3) Romanian deadlift / RDL
    select e.id into ex3
    from public.exercises e
    where e.name ilike any (array['%Romanian Deadlift%','% RDL %','%RDL%'])
    order by e.is_public desc, e.user_id nulls first
    limit 1;

    -- 4) Leg curl
    select e.id into ex4
    from public.exercises e
    where e.name ilike any (array['%Leg Curl%','%Hamstring Curl%'])
    order by e.is_public desc, e.user_id nulls first
    limit 1;

    -- 5) Leg extension
    select e.id into ex5
    from public.exercises e
    where e.name ilike any (array['%Leg Extension%'])
    order by e.is_public desc, e.user_id nulls first
    limit 1;

    if ex1 is null then raise exception 'Starter Legs missing exercise: Back Squat'; end if;
    if ex2 is null then raise exception 'Starter Legs missing exercise: Barbell Hip Thrust'; end if;
    if ex3 is null then raise exception 'Starter Legs missing exercise: Romanian Deadlift (RDL)'; end if;
    if ex4 is null then raise exception 'Starter Legs missing exercise: Leg Curl'; end if;
    if ex5 is null then raise exception 'Starter Legs missing exercise: Leg Extension'; end if;

    insert into public.workout_exercises
      (workout_id, exercise_id, order_index, target_sets, target_reps, notes, is_archived, created_at, updated_at)
    values
      (v_workout_id, ex1, 0, 3,  6, 'Warm up well. Brace hard. Rest 2–3 min.', false, now(), now()),
      (v_workout_id, ex2, 1, 3,  8, 'Pause at top. Full lockout.',             false, now(), now()),
      (v_workout_id, ex3, 2, 3,  5, 'Hinge. Keep back neutral.',               false, now(), now()),
      (v_workout_id, ex4, 3, 3, 10, 'Control the lowering phase.',             false, now(), now()),
      (v_workout_id, ex5, 4, 3, 10, 'Squeeze at top for 1s.',                  false, now(), now());
  end if;

  update public.profiles
  set onboarding_step = greatest(onboarding_step, 2)
  where id = v_user_id;

  return jsonb_build_object(
    'workout_id', v_workout_id,
    'title', v_title,
    'split', v_split,
    'exercise_count', (
      select count(*)::int
      from public.workout_exercises we
      where we.workout_id = v_workout_id
        and we.is_archived = false
    )
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.create_template_guarded_test_v1(p_user_id uuid, p_title text, p_notes text DEFAULT NULL::text)
 RETURNS workouts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.workouts;
begin
  perform public.assert_can_create_template(p_user_id);

  insert into public.workouts (
    user_id,
    title,
    notes,
    created_at,
    created_source,
    counts_toward_template_limit,
    archived_at,
    deleted_at
  )
  values (
    p_user_id,
    p_title,
    p_notes,
    now(),
    'user',
    true,
    null,
    null
  )
  returning * into v_row;

  return v_row;
end;
$function$

CREATE OR REPLACE FUNCTION public.create_workout_test_v1(p_user_id uuid, p_workout jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_workout_id uuid;

  v_title text;
  v_notes text;
  v_image_key text;

  ex jsonb;
  i int := 0;

  v_exercise_id uuid;
  v_order_index int;
  v_ex_notes text;
  v_superset_group text;
  v_superset_index int;
  v_is_dropset boolean;
begin
  perform public.assert_can_create_template(p_user_id);

  v_title := nullif(trim(coalesce(p_workout->>'title', '')), '');
  if v_title is null then
    raise exception 'title_missing';
  end if;

  v_notes := nullif(trim(coalesce(p_workout->>'notes', '')), '');
  v_image_key := nullif(trim(coalesce(p_workout->>'workout_image_key', '')), '');

  if jsonb_typeof(p_workout->'exercises') is distinct from 'array' then
    raise exception 'exercises_missing';
  end if;

  if jsonb_array_length(p_workout->'exercises') = 0 then
    raise exception 'exercises_empty';
  end if;

  insert into public.workouts (
    user_id,
    title,
    notes,
    workout_image_key,
    created_source,
    counts_toward_template_limit,
    archived_at,
    deleted_at
  )
  values (
    p_user_id,
    v_title,
    v_notes,
    v_image_key,
    'user',
    true,
    null,
    null
  )
  returning id into v_workout_id;

  i := 0;

  for ex in
    select * from jsonb_array_elements(p_workout->'exercises')
  loop
    v_exercise_id := nullif(ex->>'exercise_id', '')::uuid;
    if v_exercise_id is null then
      raise exception 'exercise_id_missing';
    end if;

    v_order_index :=
      case
        when (ex ? 'order_index') and nullif(ex->>'order_index','') is not null
          then (ex->>'order_index')::int
        else i
      end;

    v_ex_notes := nullif(trim(coalesce(ex->>'notes','')), '');
    v_superset_group := nullif(trim(coalesce(ex->>'superset_group','')), '');
    if v_superset_group is not null then
      v_superset_group := upper(v_superset_group);
    end if;

    v_superset_index :=
      case
        when (ex ? 'superset_index') and nullif(ex->>'superset_index','') is not null
          then (ex->>'superset_index')::int
        else null
      end;

    v_is_dropset :=
      case
        when (ex ? 'is_dropset') and nullif(ex->>'is_dropset','') is not null
          then (ex->>'is_dropset')::boolean
        else false
      end;

    insert into public.workout_exercises (
      workout_id,
      exercise_id,
      order_index,
      notes,
      superset_group,
      superset_index,
      is_dropset,
      is_archived
    )
    values (
      v_workout_id,
      v_exercise_id,
      v_order_index,
      v_ex_notes,
      v_superset_group,
      v_superset_index,
      v_is_dropset,
      false
    );

    i := i + 1;
  end loop;

  v_image_key := public.compute_workout_image_key_v1(v_workout_id);

  update public.workouts
  set workout_image_key = v_image_key
  where id = v_workout_id;

  return v_workout_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.create_workout_v1(p_workout jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_workout_id uuid;

  v_title text;
  v_notes text;
  v_image_key text;

  ex jsonb;
  i int := 0;

  v_exercise_id uuid;
  v_order_index int;
  v_ex_notes text;
  v_superset_group text;
  v_superset_index int;
  v_is_dropset boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'auth_missing';
  end if;

  -- Enforce template quota
  perform public.assert_can_create_template(v_user_id);

  -- Required fields
  v_title := nullif(trim(coalesce(p_workout->>'title', '')), '');
  if v_title is null then
    raise exception 'title_missing';
  end if;

  -- Optional fields
  v_notes := nullif(trim(coalesce(p_workout->>'notes', '')), '');
  v_image_key := nullif(trim(coalesce(p_workout->>'workout_image_key', '')), '');

  -- Validate exercises array exists and has at least 1 item
  if jsonb_typeof(p_workout->'exercises') is distinct from 'array' then
    raise exception 'exercises_missing';
  end if;

  if jsonb_array_length(p_workout->'exercises') = 0 then
    raise exception 'exercises_empty';
  end if;

  -- 1) Insert counted user template
  insert into public.workouts (
    user_id,
    title,
    notes,
    workout_image_key,
    created_source,
    counts_toward_template_limit,
    archived_at,
    deleted_at
  )
  values (
    v_user_id,
    v_title,
    v_notes,
    v_image_key,
    'user',
    true,
    null,
    null
  )
  returning id into v_workout_id;

  -- 2) Insert workout_exercises
  i := 0;

  for ex in
    select * from jsonb_array_elements(p_workout->'exercises')
  loop
    v_exercise_id := nullif(ex->>'exercise_id', '')::uuid;
    if v_exercise_id is null then
      raise exception 'exercise_id_missing';
    end if;

    v_order_index :=
      case
        when (ex ? 'order_index') and nullif(ex->>'order_index','') is not null
          then (ex->>'order_index')::int
        else i
      end;

    v_ex_notes := nullif(trim(coalesce(ex->>'notes','')), '');

    v_superset_group := nullif(trim(coalesce(ex->>'superset_group','')), '');
    if v_superset_group is not null then
      v_superset_group := upper(v_superset_group);
    end if;

    v_superset_index :=
      case
        when (ex ? 'superset_index') and nullif(ex->>'superset_index','') is not null
          then (ex->>'superset_index')::int
        else null
      end;

    v_is_dropset :=
      case
        when (ex ? 'is_dropset') and nullif(ex->>'is_dropset','') is not null
          then (ex->>'is_dropset')::boolean
        else false
      end;

    insert into public.workout_exercises (
      workout_id,
      exercise_id,
      order_index,
      notes,
      superset_group,
      superset_index,
      is_dropset,
      is_archived
    )
    values (
      v_workout_id,
      v_exercise_id,
      v_order_index,
      v_ex_notes,
      v_superset_group,
      v_superset_index,
      v_is_dropset,
      false
    );

    i := i + 1;
  end loop;

  -- 3) Recompute image key from actual contents
  v_image_key := public.compute_workout_image_key_v1(v_workout_id);

  update public.workouts
  set workout_image_key = v_image_key
  where id = v_workout_id;

  return v_workout_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.deep_analytics_guard_test_v1(p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_can_view_deep_analytics(p_user_id);
  return 'OK';
end;
$function$

CREATE OR REPLACE FUNCTION public.delete_workout_test_v1(p_user_id uuid, p_workout_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now timestamptz := now();
begin
  if p_workout_id is null then
    raise exception 'workout_id_missing';
  end if;

  update public.workouts w
  set
    deleted_at = v_now,
    archived_at = coalesce(w.archived_at, v_now)
  where w.id = p_workout_id
    and w.user_id = p_user_id
    and w.deleted_at is null;

  if not found then
    raise exception 'not_found_or_forbidden';
  end if;
end;
$function$

CREATE OR REPLACE FUNCTION public.delete_workout_v1(p_workout_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'auth_missing';
  end if;

  if p_workout_id is null then
    raise exception 'workout_id_missing';
  end if;

  update public.workouts w
  set
    deleted_at = v_now,
    archived_at = coalesce(w.archived_at, v_now)
  where w.id = p_workout_id
    and w.user_id = v_user_id
    and w.deleted_at is null;

  if not found then
    raise exception 'not_found_or_forbidden';
  end if;
end;
$function$

CREATE OR REPLACE FUNCTION public.dev_delete_plan(p_plan_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
begin
  update profiles set active_plan_id = null where active_plan_id = p_plan_id;
  delete from goals where plan_id = p_plan_id;
  delete from plan_workouts where plan_id = p_plan_id;
  delete from workout_exercises
    where workout_id in (
      select workout_id from plan_workouts where plan_id = p_plan_id
    );
  delete from workouts
    where id in (
      select workout_id from plan_workouts where plan_id = p_plan_id
    );
  delete from plans where id = p_plan_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.end_due_plans()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ended_count int := 0;
begin
  with due as (
    select
      p.id as user_id,
      p.active_plan_id as plan_id
    from public.profiles p
    join public.plans pl on pl.id = p.active_plan_id
    where
      p.active_plan_id is not null
      and pl.is_completed = false
      and pl.end_date is not null
      and ((now() at time zone p.timezone)::date > pl.end_date)
  ),
  mark_plan as (
    update public.plans pl
    set
      is_completed = true,
      completed_at = now(),
      updated_at = now()
    from due
    where pl.id = due.plan_id
    returning pl.id
  ),
  clear_active as (
    update public.profiles p
    set
      active_plan_id = null,
      updated_at = now()
    from due
    where p.id = due.user_id
      and p.active_plan_id = due.plan_id
    returning p.id as user_id, due.plan_id
  ),
  archive_pw as (
    update public.plan_workouts pw
    set
      is_archived = true,
      updated_at = now()
    from clear_active ca
    where pw.plan_id = ca.plan_id
      and pw.is_archived = false
    returning pw.id
  ),
  deactivate_goals as (
    update public.goals g
    set
      is_active = false,
      updated_at = now()
    from clear_active ca
    where g.user_id = ca.user_id
      and g.plan_id = ca.plan_id
      and g.is_active = true
    returning g.id
  ),
  create_events as (
    insert into public.user_events(user_id, type, payload)
    select
      ca.user_id,
      'plan_completed',
      jsonb_build_object('plan_id', ca.plan_id)
    from clear_active ca
    where not exists (
      select 1
      from public.user_events e
      where e.user_id = ca.user_id
        and e.type = 'plan_completed'
        and e.payload->>'plan_id' = ca.plan_id::text
        and e.consumed_at is null
    )
    returning id
  )
  select count(*) into ended_count from clear_active;

  return ended_count;
end;
$function$

CREATE OR REPLACE FUNCTION public.enqueue_notification_push_v1(p_notification_id uuid, p_recipient_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_notification_id is null or p_recipient_id is null then
    return;
  end if;

  insert into public.notification_push_jobs (
    notification_id,
    recipient_id
  )
  values (
    p_notification_id,
    p_recipient_id
  )
  on conflict (notification_id) do nothing;
end;
$function$

CREATE OR REPLACE FUNCTION public.exercise_id_by_name(p_name text)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT id FROM public.exercises WHERE lower(name) = lower(p_name) LIMIT 1
$function$

CREATE OR REPLACE FUNCTION public.get_create_post_bootstrap_v1(p_workout_limit integer DEFAULT 50, p_pr_limit integer DEFAULT 20, p_query text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$declare
  v_uid uuid := auth.uid();
  v_timezone text := 'UTC';
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(p.timezone, 'UTC')
    into v_timezone
  from public.profiles p
  where p.id = v_uid;

  return (
    with
    -- base workouts for selector
    base_wh as (
      select
        wh.id as workout_history_id,
        w.workout_image_key,
        wh.workout_id,
        coalesce(w.title, 'Workout') as title,
        wh.completed_at,
        wh.duration_seconds
      from public.workout_history wh
      left join public.workouts w on w.id = wh.workout_id
      where wh.user_id = v_uid
        and (
          p_query is null
          or p_query = ''
          or coalesce(w.title,'') ilike ('%'||p_query||'%')
          or exists (
            select 1
            from public.workout_exercise_history weh
            join public.exercises e on e.id = weh.exercise_id
            where weh.workout_history_id = wh.id
              and e.name ilike ('%'||p_query||'%')
          )
        )
      order by wh.completed_at desc, wh.id desc
      limit greatest(1, least(p_workout_limit, 50))
    ),
    workout_totals as (
      select
        b.workout_history_id,
        coalesce(sum((wsh.weight * wsh.reps)::numeric), 0)::numeric as volume_kg,
        count(*)::int as sets_count
      from base_wh b
      join public.workout_exercise_history weh on weh.workout_history_id = b.workout_history_id
      join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
      where wsh.weight is not null and wsh.weight > 0
        and wsh.reps is not null and wsh.reps > 0
      group by 1
    ),
workout_top_ex as (
  select
    weh.workout_history_id,
    jsonb_agg(
      jsonb_build_object(
        'exercise_id', weh.exercise_id,
        'name', e.name
      )
      order by weh.order_index asc
    ) filter (where weh.rn <= 3) as top_exercises
  from (
    select
      b.workout_history_id,
      weh.exercise_id,
      weh.order_index,
      row_number() over (
        partition by b.workout_history_id
        order by weh.order_index asc
      ) as rn
    from base_wh b
    join public.workout_exercise_history weh
      on weh.workout_history_id = b.workout_history_id
  ) weh
  join public.exercises e on e.id = weh.exercise_id
  group by weh.workout_history_id
),
    workouts as (
      select jsonb_agg(
        jsonb_build_object(
          'workout_history_id', b.workout_history_id,
          'workout_id', b.workout_id,
          'title', b.title,
          'completed_at', b.completed_at,
          'duration_seconds', b.duration_seconds,
          'sets_count', coalesce(t.sets_count, 0),
          'workout_image_key', b.workout_image_key,
          'volume_kg', coalesce(t.volume_kg, 0),
          'top_exercises', coalesce(x.top_exercises, '[]'::jsonb)
        )
        order by b.completed_at desc, b.workout_history_id desc
      ) as arr
      from base_wh b
      left join workout_totals t on t.workout_history_id = b.workout_history_id
      left join workout_top_ex x on x.workout_history_id = b.workout_history_id
    ),

    -- PR candidates (recent, derived). We scope to recent sessions for performance.
    recent_wh as (
      select wh.id, wh.completed_at
      from public.workout_history wh
      where wh.user_id = v_uid
      order by wh.completed_at desc, wh.id desc
      limit 200
    ),
    all_sets as (
      select
        wh.id as workout_history_id,
        wh.completed_at,
        weh.exercise_id,
        e.name as exercise_name,
        wsh.weight::numeric as weight,
        wsh.reps::int as reps,
        -- E1RM (Epley)
        (wsh.weight * (1 + (wsh.reps::numeric / 30.0)))::numeric as e1rm
      from recent_wh wh
      join public.workout_exercise_history weh on weh.workout_history_id = wh.id
      join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
      join public.exercises e on e.id = weh.exercise_id
      where wsh.weight is not null and wsh.weight > 0
        and wsh.reps is not null and wsh.reps > 0
    ),
    best_set_per_session as (
      select
        workout_history_id,
        completed_at,
        exercise_id,
        exercise_name,
        -- choose best e1rm set; keep its weight/reps
        (array_agg(weight order by e1rm desc))[1] as best_weight,
        (array_agg(reps order by e1rm desc))[1] as best_reps,
        max(e1rm)::numeric as best_e1rm
      from all_sets
      group by 1,2,3,4
    ),
    with_prev as (
      select
        b.*,
        max(best_e1rm) over (
          partition by exercise_id
          order by completed_at asc, workout_history_id asc
          rows between unbounded preceding and 1 preceding
        ) as prev_best_e1rm
      from best_set_per_session b
    ),
    prs_only as (
      select
        *,
        (best_e1rm - coalesce(prev_best_e1rm, 0))::numeric as delta_e1rm_abs,
        case
          when prev_best_e1rm is null or prev_best_e1rm <= 0 then null
          else round(((best_e1rm - prev_best_e1rm) / prev_best_e1rm) * 100.0, 1)
        end as delta_e1rm_pct
      from with_prev
      where prev_best_e1rm is null or best_e1rm > prev_best_e1rm + 0.05
    ),
    pr_candidates as (
      select jsonb_agg(
        jsonb_build_object(
          'exercise_id', exercise_id,
          'exercise_name', exercise_name,
          'achieved_at', completed_at,
          'workout_history_id', workout_history_id,
          'weight', best_weight,
          'reps', best_reps,
          'prev_best_e1rm', prev_best_e1rm,
          'new_best_e1rm', best_e1rm,
          'delta_e1rm_abs', delta_e1rm_abs,
          'delta_e1rm_pct', delta_e1rm_pct
        )
        order by completed_at desc, workout_history_id desc
      ) as arr
      from (
        select *
        from prs_only
        order by completed_at desc, workout_history_id desc
        limit greatest(1, least(p_pr_limit, 50))
      ) z
    )

    select jsonb_build_object(
      'meta', jsonb_build_object(
        'generated_at', now(),
        'timezone', v_timezone,
        'unit', 'kg'
      ),
      'workouts', coalesce((select arr from workouts), '[]'::jsonb),
      'pr_candidates', coalesce((select arr from pr_candidates), '[]'::jsonb)
    )
  );
end;$function$

CREATE OR REPLACE FUNCTION public.get_deep_analytics_test_v1(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_can_view_deep_analytics(p_user_id);

  return jsonb_build_object(
    'strengthTrend', jsonb_build_array(),
    'volumeTrend', jsonb_build_array(),
    'weightVsReps', jsonb_build_array(),
    'setContribution', jsonb_build_array()
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.get_entitlements_for_user(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tier text;
  v_status text;
  v_source text;
  v_product_code text;
  v_effective_from timestamptz;
  v_effective_until timestamptz;
  v_next_renewal_at timestamptz;
  v_trial_ends_at timestamptz;
  v_cancelled_at timestamptz;
  v_last_verified_at timestamptz;
  v_capabilities jsonb;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  select
    ue.tier,
    ue.status,
    ue.source,
    ue.product_code,
    ue.effective_from,
    ue.effective_until,
    ue.next_renewal_at,
    ue.trial_ends_at,
    ue.cancelled_at,
    ue.last_verified_at
  into
    v_tier,
    v_status,
    v_source,
    v_product_code,
    v_effective_from,
    v_effective_until,
    v_next_renewal_at,
    v_trial_ends_at,
    v_cancelled_at,
    v_last_verified_at
  from public.user_entitlements ue
  where ue.user_id = p_user_id;

  if v_tier is null or v_status is null then
    v_tier := 'free';
    v_status := 'free';
    v_source := 'none';
    v_product_code := null;
    v_effective_from := null;
    v_effective_until := null;
    v_next_renewal_at := null;
    v_trial_ends_at := null;
    v_cancelled_at := null;
    v_last_verified_at := null;
  end if;

  v_capabilities := jsonb_build_object(
    'canViewDeepAnalytics', true,
    'canUseAdvancedPlanning', true,
    'canUseSmartSuggestions', true,
    'maxActivePlans', 3,
    'maxTemplates', 15,
    'maxGoalsPerPlan', 2147483647
  );

  return jsonb_build_object(
    'tier', v_tier,
    'status', v_status,
    'source', v_source,
    'productCode', v_product_code,
    'effectiveFrom', v_effective_from,
    'effectiveUntil', v_effective_until,
    'nextRenewalAt', v_next_renewal_at,
    'trialEndsAt', v_trial_ends_at,
    'cancelledAt', v_cancelled_at,
    'lastVerifiedAt', v_last_verified_at,
    'capabilities', v_capabilities
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.get_exercise_deep_analytics(p_exercise_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_timezone text := 'UTC';
  v_now timestamptz := now();

  v_exercise_name text := null;
  v_payload jsonb := '{}'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Premium gate
  perform public.assert_can_view_deep_analytics(v_user_id);

  select coalesce(p.timezone, 'UTC')
    into v_timezone
  from public.profiles p
  where p.id = v_user_id;

  select e.name
    into v_exercise_name
  from public.exercises e
  where e.id = p_exercise_id;

  with
  sets as (
    select
      wh.id as workout_history_id,
      wh.completed_at,
      weh.id as weh_id,
      wsh.id as set_id,
      wsh.set_number,
      wsh.reps::int as reps,
      wsh.weight::numeric as weight_kg,
      (wsh.weight * wsh.reps)::numeric as volume,
      (wsh.weight * (1 + (wsh.reps::numeric / 30.0)))::numeric as e1rm
    from public.workout_history wh
    join public.workout_exercise_history weh
      on weh.workout_history_id = wh.id
    join public.workout_set_history wsh
      on wsh.workout_exercise_history_id = weh.id
    where wh.user_id = v_user_id
      and weh.exercise_id = p_exercise_id
      and wh.completed_at >= v_now - interval '365 days'
      and wsh.weight is not null and wsh.weight > 0
      and wsh.reps is not null and wsh.reps > 0
  ),

  latest_session as (
    select
      workout_history_id,
      max(completed_at) as completed_at
    from sets
    group by workout_history_id
    order by max(completed_at) desc
    limit 1
  ),
  latest_session_sets as (
    select s.*
    from sets s
    join latest_session ls using (workout_history_id)
    order by s.set_number asc, s.set_id asc
  ),

  current_card as (
    select
      case
        when (select count(*) from latest_session) = 0 then null
        else jsonb_build_object(
          'completed_at', (select completed_at from latest_session),
          'top_weight', coalesce((select max(weight_kg) from latest_session_sets), 0),
          'top_set',
            (select jsonb_build_object(
              'weight_kg', round(weight_kg, 1),
              'reps', reps,
              'e1rm', round(e1rm, 1)
            )
            from latest_session_sets
            order by e1rm desc, weight_kg desc, reps desc
            limit 1)
        )
      end as j
  ),

  best_set as (
    select *
    from sets
    order by e1rm desc, weight_kg desc, reps desc, completed_at desc
    limit 1
  ),
  best_card as (
    select
      case
        when (select count(*) from best_set) = 0 then null
        else jsonb_build_object(
          'e1rm', round((select e1rm from best_set), 1),
          'weight_kg', round((select weight_kg from best_set), 1),
          'reps', (select reps from best_set),
          'completed_at', (select completed_at from best_set)
        )
      end as j
  ),

  vol_by_session as (
    select
      workout_history_id,
      max(completed_at) as completed_at,
      sum(volume)::numeric as volume
    from sets
    group by workout_history_id
    order by max(completed_at) desc
    limit 6
  ),
  vol_trend as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'date', to_char((completed_at at time zone v_timezone)::date, 'YYYY-MM-DD'),
          'volume', round(volume, 0)
        )
        order by completed_at asc
      ),
      '[]'::jsonb
    ) as j
    from (select * from vol_by_session order by completed_at asc) x
  ),

  scatter as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'reps', reps,
          'weight_kg', round(weight_kg, 1),
          'e1rm', round(e1rm, 1),
          'completed_at', completed_at
        )
        order by completed_at desc, set_id desc
      ),
      '[]'::jsonb
    ) as j
    from (select * from sets order by completed_at desc, set_id desc limit 30) x
  ),

  contrib as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'set_id', set_id,
          'set_number', set_number,
          'volume', round(volume, 0),
          'weight_kg', round(weight_kg, 1),
          'reps', reps
        )
        order by set_number asc, set_id asc
      ),
      '[]'::jsonb
    ) as j
    from latest_session_sets
  ),

  strength_by_session as (
    select
      workout_history_id,
      max(completed_at) as completed_at,
      max(weight_kg) as top_weight,
      max(e1rm) as top_e1rm
    from sets
    group by workout_history_id
    order by max(completed_at) desc
    limit 12
  ),
  strength_over_time as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'date', to_char((completed_at at time zone v_timezone)::date, 'YYYY-MM-DD'),
          'top_weight', round(top_weight, 1),
          'top_e1rm', round(top_e1rm, 1)
        )
        order by completed_at asc
      ),
      '[]'::jsonb
    ) as j
    from (select * from strength_by_session order by completed_at asc) x
  )

  select jsonb_build_object(
    'meta', jsonb_build_object(
      'exercise_id', p_exercise_id,
      'exercise_name', coalesce(v_exercise_name, ''),
      'generated_at', v_now,
      'timezone', v_timezone,
      'unit', 'kg'
    ),
    'cards', jsonb_build_object(
      'current', (select j from current_card),
      'best_set', (select j from best_card),
      'est_1rm', jsonb_build_object(
        'value', coalesce((select round(e1rm, 1) from best_set), 0)
      )
    ),
    'charts', jsonb_build_object(
      'volume_trend', (select j from vol_trend),
      'weight_vs_reps', (select j from scatter),
      'set_contribution', (select j from contrib),
      'strength_over_time', (select j from strength_over_time)
    )
  )
  into v_payload;

  return v_payload;
end;
$function$

CREATE OR REPLACE FUNCTION public.get_exercise_deep_analytics_test_v1(p_user_id uuid, p_exercise_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_timezone text := 'UTC';
  v_now timestamptz := now();

  v_exercise_name text := null;
  v_payload jsonb := '{}'::jsonb;
begin
  perform public.assert_can_view_deep_analytics(p_user_id);

  select coalesce(p.timezone, 'UTC')
    into v_timezone
  from public.profiles p
  where p.id = p_user_id;

  select e.name
    into v_exercise_name
  from public.exercises e
  where e.id = p_exercise_id;

  with
  sets as (
    select
      wh.id as workout_history_id,
      wh.completed_at,
      weh.id as weh_id,
      wsh.id as set_id,
      wsh.set_number,
      wsh.reps::int as reps,
      wsh.weight::numeric as weight_kg,
      (wsh.weight * wsh.reps)::numeric as volume,
      (wsh.weight * (1 + (wsh.reps::numeric / 30.0)))::numeric as e1rm
    from public.workout_history wh
    join public.workout_exercise_history weh
      on weh.workout_history_id = wh.id
    join public.workout_set_history wsh
      on wsh.workout_exercise_history_id = weh.id
    where wh.user_id = p_user_id
      and weh.exercise_id = p_exercise_id
      and wh.completed_at >= v_now - interval '365 days'
      and wsh.weight is not null and wsh.weight > 0
      and wsh.reps is not null and wsh.reps > 0
  ),
  latest_session as (
    select workout_history_id, max(completed_at) as completed_at
    from sets
    group by workout_history_id
    order by max(completed_at) desc
    limit 1
  ),
  latest_session_sets as (
    select s.*
    from sets s
    join latest_session ls using (workout_history_id)
    order by s.set_number asc, s.set_id asc
  ),
  current_card as (
    select
      case
        when (select count(*) from latest_session) = 0 then null
        else jsonb_build_object(
          'completed_at', (select completed_at from latest_session),
          'top_weight', coalesce((select max(weight_kg) from latest_session_sets), 0),
          'top_set',
            (select jsonb_build_object(
              'weight_kg', round(weight_kg, 1),
              'reps', reps,
              'e1rm', round(e1rm, 1)
            )
            from latest_session_sets
            order by e1rm desc, weight_kg desc, reps desc
            limit 1)
        )
      end as j
  ),
  best_set as (
    select *
    from sets
    order by e1rm desc, weight_kg desc, reps desc, completed_at desc
    limit 1
  ),
  best_card as (
    select
      case
        when (select count(*) from best_set) = 0 then null
        else jsonb_build_object(
          'e1rm', round((select e1rm from best_set), 1),
          'weight_kg', round((select weight_kg from best_set), 1),
          'reps', (select reps from best_set),
          'completed_at', (select completed_at from best_set)
        )
      end as j
  ),
  vol_by_session as (
    select
      workout_history_id,
      max(completed_at) as completed_at,
      sum(volume)::numeric as volume
    from sets
    group by workout_history_id
    order by max(completed_at) desc
    limit 6
  ),
  vol_trend as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'date', to_char((completed_at at time zone v_timezone)::date, 'YYYY-MM-DD'),
          'volume', round(volume, 0)
        )
        order by completed_at asc
      ),
      '[]'::jsonb
    ) as j
    from (select * from vol_by_session order by completed_at asc) x
  ),
  scatter as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'reps', reps,
          'weight_kg', round(weight_kg, 1),
          'e1rm', round(e1rm, 1),
          'completed_at', completed_at
        )
        order by completed_at desc, set_id desc
      ),
      '[]'::jsonb
    ) as j
    from (select * from sets order by completed_at desc, set_id desc limit 30) x
  ),
  contrib as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'set_id', set_id,
          'set_number', set_number,
          'volume', round(volume, 0),
          'weight_kg', round(weight_kg, 1),
          'reps', reps
        )
        order by set_number asc, set_id asc
      ),
      '[]'::jsonb
    ) as j
    from latest_session_sets
  ),
  strength_by_session as (
    select
      workout_history_id,
      max(completed_at) as completed_at,
      max(weight_kg) as top_weight,
      max(e1rm) as top_e1rm
    from sets
    group by workout_history_id
    order by max(completed_at) desc
    limit 12
  ),
  strength_over_time as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'date', to_char((completed_at at time zone v_timezone)::date, 'YYYY-MM-DD'),
          'top_weight', round(top_weight, 1),
          'top_e1rm', round(top_e1rm, 1)
        )
        order by completed_at asc
      ),
      '[]'::jsonb
    ) as j
    from (select * from strength_by_session order by completed_at asc) x
  )
  select jsonb_build_object(
    'meta', jsonb_build_object(
      'exercise_id', p_exercise_id,
      'exercise_name', coalesce(v_exercise_name, ''),
      'generated_at', v_now,
      'timezone', v_timezone,
      'unit', 'kg'
    ),
    'cards', jsonb_build_object(
      'current', (select j from current_card),
      'best_set', (select j from best_card),
      'est_1rm', jsonb_build_object(
        'value', coalesce((select round(e1rm, 1) from best_set), 0)
      )
    ),
    'charts', jsonb_build_object(
      'volume_trend', (select j from vol_trend),
      'weight_vs_reps', (select j from scatter),
      'set_contribution', (select j from contrib),
      'strength_over_time', (select j from strength_over_time)
    )
  )
  into v_payload;

  return v_payload;
end;
$function$

CREATE OR REPLACE FUNCTION public.get_exercise_picker_data(p_include_private boolean DEFAULT false)
 RETURNS TABLE(id uuid, name text, type exercise_type, equipment text, level exercise_level, instructions text, muscle_ids smallint[], muscle_names text[], is_favorite boolean, sessions_count integer, sets_count integer, last_used_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'pg_catalog'
AS $function$
  with me as (
    select auth.uid() as user_id
  )
  select
    e.id,
    e.name,
    e.type,
    e.equipment,
    e.level,
    e.instructions,

    -- muscles
    coalesce(
      array_agg(distinct em.muscle_id order by em.muscle_id)
        filter (where em.muscle_id is not null),
      '{}'::smallint[]
    ) as muscle_ids,

    coalesce(
      array_agg(distinct m.name order by m.name)
        filter (where m.name is not null),
      '{}'::text[]
    ) as muscle_names,

    -- favourites
    exists (
      select 1
      from public.exercise_favorites f
      join me on me.user_id = f.user_id
      where f.exercise_id = e.id
    ) as is_favorite,

    -- usage (pre-aggregated table)
    coalesce(u.sessions_count, 0) as sessions_count,
    coalesce(u.sets_count, 0) as sets_count,
    u.last_used_at

  from public.exercises e

  -- muscles
  left join public.exercise_muscles em
    on em.exercise_id = e.id
  left join public.muscles m
    on m.id = em.muscle_id

  -- usage
  left join me on true
  left join public.exercise_usage u
    on u.user_id = me.user_id
   and u.exercise_id = e.id

  where
    -- public exercises OR user-owned exercises (if you support custom)
    (
      e.is_public = true
      or (p_include_private and e.user_id = (select user_id from me))
    )

  group by
    e.id, e.name, e.type, e.equipment, e.level, e.instructions,
    u.sessions_count, u.sets_count, u.last_used_at
  order by e.name asc;
$function$

CREATE OR REPLACE FUNCTION public.get_exercise_pr_events_v1(p_exercise_id uuid, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_timezone text := 'UTC';
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_exercise_id is null then
    raise exception 'exercise_id is required';
  end if;

  select coalesce(p.timezone, 'UTC')
    into v_timezone
  from public.profiles p
  where p.id = v_uid;

  return (
    with
    valid_sets as (
      select
        weh.exercise_id,
        e.name as exercise_name,
        wh.id as workout_history_id,
        wh.completed_at as achieved_at,
        wsh.weight::numeric as weight,
        wsh.reps::int as reps,
        (wsh.weight * (1 + (wsh.reps::numeric / 30.0)))::numeric as estimated_1rm
      from public.workout_history wh
      join public.workout_exercise_history weh
        on weh.workout_history_id = wh.id
      join public.workout_set_history wsh
        on wsh.workout_exercise_history_id = weh.id
      join public.exercises e
        on e.id = weh.exercise_id
      where wh.user_id = v_uid
        and weh.exercise_id = p_exercise_id
        and wsh.weight is not null
        and wsh.weight > 0
        and wsh.reps is not null
        and wsh.reps > 0
    ),

    distinct_lifts as (
      select distinct
        vs.exercise_id,
        vs.exercise_name,
        vs.workout_history_id,
        vs.achieved_at,
        vs.weight,
        vs.reps,
        vs.estimated_1rm
      from valid_sets vs
    ),

    ranked_lifts as (
      select
        dl.*,
        row_number() over (
          order by
            dl.weight desc,
            dl.reps desc,
            dl.achieved_at desc,
            dl.workout_history_id desc
        ) as lift_rank
      from distinct_lifts dl
    ),

    with_previous as (
      select
        rl.*,
        lead(rl.weight) over (
          order by
            rl.weight desc,
            rl.reps desc,
            rl.achieved_at desc,
            rl.workout_history_id desc
        ) as previous_best_weight,
        lead(rl.reps) over (
          order by
            rl.weight desc,
            rl.reps desc,
            rl.achieved_at desc,
            rl.workout_history_id desc
        ) as previous_best_reps
      from ranked_lifts rl
    ),

    items as (
      select
        jsonb_build_object(
          'key', (exercise_id::text || ':' || weight::text || ':' || reps::text || ':' || achieved_at::text),
          'exercise_id', exercise_id,
          'exercise_name', exercise_name,
          'weight', weight,
          'reps', reps,
          'achieved_at', achieved_at,
          'workout_history_id', workout_history_id,
          'estimated_1rm', round(estimated_1rm, 1),
          'previous_best_weight', previous_best_weight,
          'previous_best_reps', previous_best_reps,
          'delta_weight',
            case
              when previous_best_weight is null then null
              else (weight - previous_best_weight)
            end
        ) as item,
        weight,
        reps,
        achieved_at,
        workout_history_id
      from with_previous
      order by
        weight desc,
        reps desc,
        achieved_at desc,
        workout_history_id desc
      limit greatest(1, least(p_limit, 50))
    )

    select jsonb_build_object(
      'meta', jsonb_build_object(
        'generated_at', now(),
        'timezone', v_timezone,
        'unit', 'kg'
      ),
      'items', coalesce(
        (
          select jsonb_agg(
            item
            order by weight desc, reps desc, achieved_at desc, workout_history_id desc
          )
          from items
        ),
        '[]'::jsonb
      )
    )
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.get_feed(p_limit integer DEFAULT 20, p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(post_id uuid, user_id uuid, user_name text, user_username text, post_type text, visibility text, caption text, created_at timestamp with time zone, workout_history_id uuid, workout_snapshot jsonb, exercise_id uuid, exercise_name text, pr_snapshot jsonb, like_count integer, comment_count integer, viewer_liked boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$with base as (
  select p.*
  from public.posts p
  where
    (
      -- 1) my own posts
      p.user_id = auth.uid()

      -- 2) public posts from anyone I’m allowed to view (blocks/privacy)
      or (
        p.visibility = 'public'
        and public.can_view_user(auth.uid(), p.user_id)
      )

      -- 3) followers posts: I must follow the poster (and also not blocked)
      or (
        p.visibility = 'followers'
        and public.can_view_user(auth.uid(), p.user_id)
        and exists (
          select 1
          from public.user_follows f
          where f.follower_id = auth.uid()
            and f.followee_id = p.user_id
        )
      )

      -- 4) private posts: only owner (for now)
      or (
        p.visibility = 'private'
        and p.user_id = auth.uid()
      )
    )
    -- cursor (seek pagination)
    and (
      p_cursor_created_at is null
      or p.created_at < p_cursor_created_at
      or (p.created_at = p_cursor_created_at and p.id < p_cursor_id)
    )
  order by p.created_at desc, p.id desc
  limit greatest(1, least(p_limit, 100))
)
select
  b.id as post_id,
  b.user_id,
  pr.name as user_name,
  pr.username as user_username, -- ✅ add
  b.post_type,
  b.visibility,
  b.caption,
  b.created_at,
  b.workout_history_id,

  -- ✅ workout_snapshot: only meaningful for workout posts (or any post with workout_history_id)
  ws.workout_snapshot,

  b.exercise_id,
  ex.name as exercise_name, -- ✅ add (for PR posts)

  b.pr_snapshot,

  coalesce(lc.cnt, 0)::int as like_count,
  coalesce(cc.cnt, 0)::int as comment_count,
  coalesce(vl.liked, false) as viewer_liked
from base b
join public.profiles pr on pr.id = b.user_id

left join public.exercises ex
  on ex.id = b.exercise_id

-- workout snapshot hydration (safe, single lateral per post row)
left join lateral (
  select
    case
      when b.workout_history_id is null then null
      else jsonb_build_object(
        'workout_history_id', wh.id,
        'workout_id', wh.workout_id,
        'workout_title', w.title,
        'workout_image_key', w.workout_image_key,
        'completed_at', wh.completed_at,
        'duration_seconds', wh.duration_seconds,
        'exercises_count', coalesce(x.exercises_count, 0),
        'sets_count', coalesce(x.sets_count, 0),
        'total_volume', coalesce(x.total_volume, 0)
      )
    end as workout_snapshot
  from public.workout_history wh
  left join public.workouts w
    on w.id = wh.workout_id
  left join lateral (
    select
      count(distinct weh.id)::int as exercises_count,
      count(wsh.id)::int as sets_count,
      coalesce(sum(coalesce(wsh.weight,0) * coalesce(wsh.reps,0)), 0)::numeric as total_volume
    from public.workout_exercise_history weh
    left join public.workout_set_history wsh
      on wsh.workout_exercise_history_id = weh.id
    where weh.workout_history_id = wh.id
  ) x on true
  where wh.id = b.workout_history_id
  limit 1
) ws on true

left join lateral (
  select count(*) as cnt
  from public.post_likes pl
  where pl.post_id = b.id
) lc on true

left join lateral (
  select count(*) as cnt
  from public.post_comments pc
  where pc.post_id = b.id
    and pc.deleted_at is null
) cc on true

left join lateral (
  select true as liked
  from public.post_likes pl
  where pl.post_id = b.id
    and pl.user_id = auth.uid()
  limit 1
) vl on true

order by b.created_at desc, b.id desc;$function$

CREATE OR REPLACE FUNCTION public.get_follow_requests_inbox_v1(p_limit integer DEFAULT 30, p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_requester uuid DEFAULT NULL::uuid)
 RETURNS TABLE(requester_id uuid, requester_name text, requester_is_private boolean, created_at timestamp with time zone, status text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
  with me as (
    select auth.uid() as uid
  )
  select
    r.requester_id,
    pr.name as requester_name,
    pr.is_private as requester_is_private,
    r.created_at,
    r.status
  from public.follow_requests r
  join me on me.uid = r.target_id
  join public.profiles pr on pr.id = r.requester_id
  where r.status = 'pending'
    and (
      p_cursor_created_at is null
      or r.created_at < p_cursor_created_at
      or (r.created_at = p_cursor_created_at and r.requester_id < p_cursor_requester)
    )
  order by r.created_at desc, r.requester_id desc
  limit greatest(1, least(p_limit, 100));
$function$

CREATE OR REPLACE FUNCTION public.get_home_goal_ring(p_user_id uuid)
 RETURNS TABLE(mode text, progress double precision, label text, plan_id uuid)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  p record;
  g record;
  start_num double precision;
  target_num double precision;
  actual_num double precision;
  frac double precision;
  acc double precision := 0;
  n int := 0;

  wk_start date;
  wk_goal int;
  wk_completed int;
begin
  -- 1) Active plan (latest)
  select id, start_date, end_date
    into p
  from public.plans
  where user_id = p_user_id
    and is_completed = false
  order by start_date desc nulls last, created_at desc
  limit 1;

  if p.id is not null then
    -- 2) Up to 3 active goals that point at an exercise
    for g in
      select
        id,
        type,
        target_number,
        notes,
        (case
          when jsonb_typeof(to_jsonb(exercises)) = 'array' then (exercises->0->>'id')::uuid
          else (exercises->>'id')::uuid
        end) as exercise_id
      from public.goals
      where user_id = p_user_id
        and plan_id = p.id
        and is_active = true
        and exercises is not null
      order by created_at asc
      limit 3
    loop
      -- parse start from notes JSON ({"start": number})
      start_num := coalesce(nullif((g.notes::jsonb->>'start')::double precision, null), 0);
      target_num := coalesce(g.target_number::double precision, 0);

      -- find latest workout session for this exercise in plan date window
      -- then compute the goal-specific "actual" inside that session
      with latest_session as (
        select wh.id as workout_history_id
        from public.workout_history wh
        join public.workout_exercise_history weh
          on weh.workout_history_id = wh.id
        where wh.user_id = p_user_id
          and weh.exercise_id = g.exercise_id
          and (p.start_date is null or wh.completed_at >= p.start_date)
          and (p.end_date is null or wh.completed_at <= p.end_date)
        order by wh.completed_at desc
        limit 1
      )
      select
        case g.type
          when 'exercise_weight' then max(wsh.weight)::double precision
          when 'exercise_reps'   then max(wsh.reps)::double precision
          when 'distance'        then sum(wsh.distance)::double precision
          when 'time'            then sum(wsh.time_seconds)::double precision
          else null
        end
      into actual_num
      from latest_session ls
      join public.workout_exercise_history weh
        on weh.workout_history_id = ls.workout_history_id
       and weh.exercise_id = g.exercise_id
      join public.workout_set_history wsh
        on wsh.workout_exercise_history_id = weh.id;

      if actual_num is null then
        actual_num := start_num;
      end if;

      -- progress clamp
      if target_num <= start_num then
        frac := case when actual_num >= target_num then 1 else 0 end;
      else
        frac := (actual_num - start_num) / (target_num - start_num);
        frac := greatest(0, least(1, frac));
      end if;

      acc := acc + frac;
      n := n + 1;
    end loop;

    if n > 0 then
      mode := 'plan';
      progress := acc / n;
      label := (round(progress * 100)::int)::text || '%';
      plan_id := p.id;
      return next;
      return;
    end if;
  end if;

  -- 3) Weekly fallback (Sunday-start week)
  wk_start := (current_date - extract(dow from current_date)::int)::date;

  select goal, completed
    into wk_goal, wk_completed
  from public.user_weekly_workout_stats
  where user_id = p_user_id
    and week_key = wk_start
  limit 1;

  if wk_goal is null then
    select coalesce(weekly_workout_goal, 3)
      into wk_goal
    from public.profiles
    where id = p_user_id;

    wk_completed := 0;
  end if;

  mode := 'weekly';
  progress := case when wk_goal > 0 then greatest(0, least(1, wk_completed::double precision / wk_goal::double precision)) else 0 end;
  label := wk_completed::text || '/' || wk_goal::text;
  plan_id := null;
  return next;
end;
$function$

CREATE OR REPLACE FUNCTION public.get_home_summary()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.get_home_summary(0);
$function$

CREATE OR REPLACE FUNCTION public.get_home_summary(p_month_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$declare
  v_user_id uuid := (select auth.uid());
  v_template_owner uuid := '1ca79b4f-8d37-414e-a123-30622570c7af'::uuid;

  v_name text;
  v_steps_goal int;
  v_weekly_goal int;
  v_active_plan_id uuid;
  v_weekly_streak int := 0;

  v_workouts_total int := 0;
  v_last_workout_at timestamptz := null;
  v_days_since_last_workout int := null;

  v_home_variant text;

  v_transition jsonb := null;

  -- next plan workout
  v_next_plan_workout_id uuid := null;
  v_next_workout_id uuid := null;
  v_next_workout_title text := null;
  v_next_workout_meta jsonb := null;
  v_next_workout_image_key text := null;

  -- ✅ hero meta
  v_next_order_index int := null;
  v_next_exercise_count int := null;
  v_next_avg_duration_seconds int := null;
  v_next_week_workout_number int := null;
  v_next_plan_week_number int := null;

  -- weekly stats
  v_week_done int := 0;
  v_week_target int := 0;
  v_week_status text := 'behind';

  -- legacy streak vars (kept; harmless)
  v_streak_days int := 0;
  v_trained_days_7 jsonb := '[]'::jsonb;

  -- ✅ calendar months payload (this month + past 2 months)
  -- months: [{ month_start: 'YYYY-MM-01', days: [{day,trained,workout_count}...] }, ...]
  v_calendar_months jsonb := '[]'::jsonb;

  -- latest PR
  v_pr jsonb := null;

  -- volume trend
  v_volume jsonb := null;

  -- plan goals
  v_goals jsonb := null;

  -- last workout card
  v_last_workout jsonb := null;

  -- ✅ new-user cards
  v_starter_templates jsonb := null;
  v_unlock_preview jsonb := null;

  v_new_user_progress jsonb := null;

  v_cards jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  /* --------------------------
     Profile
     -------------------------- */
  select
    p.name,
    p.steps_goal,
    p.weekly_workout_goal,
    p.active_plan_id,
    coalesce(p.weekly_streak, 0)
  into
    v_name,
    v_steps_goal,
    v_weekly_goal,
    v_active_plan_id,
    v_weekly_streak
  from public.profiles p
  where p.id = v_user_id;

  /* --------------------------
     Workouts totals + last workout time
     -------------------------- */
  select
    count(*)::int,
    max(completed_at)
  into
    v_workouts_total,
    v_last_workout_at
  from public.workout_history
  where user_id = v_user_id;

  if v_last_workout_at is not null then
    v_days_since_last_workout :=
      floor(extract(epoch from (now() - v_last_workout_at)) / 86400)::int;
  end if;

  /* --------------------------
     home_variant (priority order frozen)
     -------------------------- */
  if coalesce(v_workouts_total, 0) < 5 then
    v_home_variant := 'new_user';
  elsif coalesce(v_days_since_last_workout, 0) >= 10 then
    v_home_variant := 'returning';
  elsif v_active_plan_id is not null then
    v_home_variant := 'experienced_plan';
  else
    v_home_variant := 'experienced_no_plan';
  end if;

  /* --------------------------
     transition event (one pending)
     -------------------------- */
  select
    case when ue.id is null then null else jsonb_build_object(
      'id', ue.id,
      'type', coalesce(ue.payload->>'type',''),
      'created_at', ue.created_at,
      'payload', ue.payload
    ) end
  into v_transition
  from public.user_events ue
  where ue.user_id = v_user_id
    and ue.type = 'home_transition'
    and ue.consumed_at is null
  order by ue.created_at asc
  limit 1;

  /* --------------------------
     Weekly workouts done/goal (Mon-Sun week)
     -------------------------- */
  select count(*)::int
  into v_week_done
  from public.workout_history wh
  where wh.user_id = v_user_id
    and wh.completed_at >= date_trunc('week', now())
    and wh.completed_at <  date_trunc('week', now()) + interval '7 days';

  v_week_target := coalesce(v_weekly_goal, 0);

  if v_week_target <= 0 then
    v_week_status := 'on_track';
  elsif v_week_done >= v_week_target then
    v_week_status := 'complete';
  elsif (v_week_done::numeric / v_week_target::numeric) >= 0.5 then
    v_week_status := 'on_track';
  else
    v_week_status := 'behind';
  end if;

  /* --------------------------
     Next plan workout (if active plan)
     -------------------------- */
  if v_active_plan_id is not null then
    select pw.id, pw.workout_id, pw.title, pw.order_index
    into v_next_plan_workout_id, v_next_workout_id, v_next_workout_title, v_next_order_index
    from public.plan_workouts pw
    where pw.plan_id = v_active_plan_id
      and pw.is_archived = false
    order by
      (case when pw.weekly_complete is false then 0 else 1 end),
      coalesce(pw.order_index, 32767)
    limit 1;

    if v_next_workout_id is not null then
      -- count exercises in the template workout
      select count(*)::int
      into v_next_exercise_count
      from public.workout_exercises we
      where we.workout_id = v_next_workout_id
        and we.is_archived = false;

-- workout image key
              select w.workout_image_key
      into v_next_workout_image_key
      from public.workouts w
      where w.id = v_next_workout_id;


      -- avg duration for THIS user doing THIS workout template (last 12 occurrences)
      select round(avg(x.duration_seconds))::int
      into v_next_avg_duration_seconds
      from (
        select wh.duration_seconds
        from public.workout_history wh
        where wh.user_id = v_user_id
          and wh.workout_id = v_next_workout_id
          and wh.duration_seconds is not null
          and wh.duration_seconds > 0
        order by wh.completed_at desc
        limit 12
      ) x;

      -- workout number in the plan order (1-based)
      select (count(*) + 1)::int
      into v_next_week_workout_number
      from public.plan_workouts pw2
      where pw2.plan_id = v_active_plan_id
        and pw2.is_archived = false
        and coalesce(pw2.order_index, 32767) < coalesce(v_next_order_index, 32767);

      -- derive "plan week" by chunking workouts into groups of weekly_goal (fallback to 1)
      if coalesce(v_weekly_goal, 0) > 0 and coalesce(v_next_week_workout_number, 0) > 0 then
        v_next_plan_week_number :=
          floor((v_next_week_workout_number - 1)::numeric / v_weekly_goal::numeric)::int + 1;
      else
        v_next_plan_week_number := 1;
      end if;

      select jsonb_build_object(
        'workout_id', v_next_workout_id,
        'plan_workout_id', v_next_plan_workout_id,
        'title', v_next_workout_title,
        'workout_image_key', v_next_workout_image_key,
        'exercise_count', v_next_exercise_count,
        'avg_duration_seconds', v_next_avg_duration_seconds,
        'plan_week_number', v_next_plan_week_number,
        'week_workout_number', v_next_week_workout_number,
        'exercise_preview', (
          select coalesce(jsonb_agg(x.name order by x.order_index), '[]'::jsonb)
          from (
            select e.name, we.order_index
            from public.workout_exercises we
            join public.exercises e on e.id = we.exercise_id
            where we.workout_id = v_next_workout_id
              and we.is_archived = false
            order by we.order_index
            limit 4
          ) x
        )
      )
      into v_next_workout_meta;
    end if;
  end if;

  /* --------------------------
     ✅ Starter templates + unlock preview (new_user only)
     - templates marked by notes: [MM_TEMPLATE:starter:%]
     - cloned workouts marked by notes: [MM_SOURCE_TEMPLATE:<template_uuid>]
     -------------------------- */
  if v_home_variant = 'new_user' then
    -- starter templates remaining (not yet cloned)
with templates as (
  select
    w.id as template_workout_id,
    w.title,
    w.notes,
    w.workout_image_key
  from public.workouts w
  where w.user_id = v_template_owner
    and w.notes like '[MM_TEMPLATE:starter:%]'
),

user_clones as (
  select
    c.workout_id as user_workout_id,
    c.template_workout_id
  from public.starter_workout_clones c
  where c.user_id = v_user_id
),

remaining as (
  select
    t.template_workout_id,
    t.title,
    t.notes,
    t.workout_image_key
  from templates t
  where not exists (
    select 1
    from public.starter_workout_clones c
    where c.user_id = v_user_id
      and c.template_workout_id = t.template_workout_id
  )
  order by t.title asc
),

    enriched as (
      select
        r.template_workout_id,
        r.title,
        nullif(split_part(trim(both '[]' from r.notes), ':', 3), '') as template_key,
            r.workout_image_key,
        (select count(*)::int
         from public.workout_exercises we
         where we.workout_id = r.template_workout_id
           and we.is_archived = false
        ) as exercise_count,
        (select coalesce(jsonb_agg(x.name order by x.order_index), '[]'::jsonb)
         from (
           select e.name, we.order_index
           from public.workout_exercises we
           join public.exercises e on e.id = we.exercise_id
           where we.workout_id = r.template_workout_id
             and we.is_archived = false
           order by we.order_index
           limit 4
         ) x
        ) as exercise_preview
      from remaining r
    )
    select jsonb_build_object(
      'type', 'starter_templates',
      'title', 'Starter workouts',
      'subtitle', 'Pick one. Preview it. Start when you’re ready — it’ll save to your workouts.',
      'items', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'template_workout_id', template_workout_id,
            'title', title,
            'template_key', template_key,
    'workout_image_key', workout_image_key,
            'exercise_count', exercise_count,
            'exercise_preview', exercise_preview
          )
          order by title asc
        ),
        '[]'::jsonb
      )
    )
    into v_starter_templates
    from enriched;

    -- unlock preview (always for new_user)
    v_unlock_preview := jsonb_build_object(
      'type', 'unlock_preview',
      'title', 'What you’ll unlock',
      'subtitle', 'Complete 5 workouts to unlock your performance dashboard and goal tracking.',
      'items', jsonb_build_array(
        jsonb_build_object('key','weekly_goal','title','Weekly goal tracker','desc','Stay on track every week'),
        jsonb_build_object('key','latest_pr','title','Latest PR highlights','desc','See your best lifts and improvements'),
        jsonb_build_object('key','streak','title','Consistency calendar','desc','Build your training streak'),
        jsonb_build_object('key','volume','title','Training volume trends','desc','Track weekly workload')
      )
    );
  end if;

  /* --------------------------
     ✅ Calendar markers (last 3 months)
     months: [{month_start, days:[{day,trained,workout_count}]}]
     NOTE: no p_month_offset usage -> month switching is UI-only
     -------------------------- */
  with bounds as (
    select date_trunc('month', now())::date as this_month_start
  ),
  months as (
    select (b.this_month_start - (gs.i || ' months')::interval)::date as month_start
    from bounds b
    cross join generate_series(0, 2, 1) as gs(i)
  ),
  days as (
    select
      m.month_start,
      (m.month_start + (d.i || ' days')::interval)::date as day_date
    from months m
    cross join lateral (
      select generate_series(
        0,
        (date_trunc('month', m.month_start + interval '1 month')::date - m.month_start) - 1,
        1
      ) as i
    ) d
  ),
  counts as (
    select
      wh.completed_at::date as day_date,
      count(*)::int as workout_count
    from public.workout_history wh
    where wh.user_id = v_user_id
      and wh.completed_at::date >= (select min(month_start) from months)
      and wh.completed_at::date <  (select max(month_start) + interval '1 month' from months)
    group by 1
  ),
  joined as (
    select
      d.month_start,
      d.day_date,
      coalesce(c.workout_count, 0) as workout_count,
      (coalesce(c.workout_count, 0) > 0) as trained
    from days d
    left join counts c using (day_date)
  ),
  per_month as (
    select
      month_start,
      jsonb_agg(
        jsonb_build_object(
          'day', to_char(day_date, 'YYYY-MM-DD'),
          'trained', trained,
          'workout_count', workout_count
        )
        order by day_date
      ) as days
    from joined
    group by month_start
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'month_start', to_char(month_start, 'YYYY-MM-01'),
        'days', days
      )
      order by month_start desc
    ),
    '[]'::jsonb
  )
  into v_calendar_months
  from per_month;

  /* --------------------------
     streak_days (consecutive days ending today) - legacy
     -------------------------- */
  with days as (
    select
      (now()::date - offs)::date as d,
      exists (
        select 1
        from public.workout_history wh
        where wh.user_id = v_user_id
          and wh.completed_at::date = (now()::date - offs)::date
      ) as trained
    from generate_series(0, 60, 1) as offs
  ),
  grp as (
    select
      d,
      trained,
      sum(case when trained then 0 else 1 end) over (order by d desc) as break_group
    from days
  )
  select count(*)::int
  into v_streak_days
  from grp
  where break_group = 0
    and trained = true;

  /* --------------------------
     Latest PR from set history (Epley e1RM) - last 180 days
     ✅ Fix: only count TRUE PRs (strictly greater than previous best)
     ✅ Pick: LATEST true PR (most recent), tie-break by strength
     -------------------------- */
  with sets as (
    select
      wsh.id as set_id,
      weh.exercise_id,
      e.name as exercise_name,
      wh.completed_at,
      wsh.weight::numeric as weight_kg,
      wsh.reps::int as reps,
      (wsh.weight * (1 + (wsh.reps::numeric / 30.0))) as e1rm_kg
    from public.workout_set_history wsh
    join public.workout_exercise_history weh on weh.id = wsh.workout_exercise_history_id
    join public.workout_history wh on wh.id = weh.workout_history_id
    join public.exercises e on e.id = weh.exercise_id
    where wh.user_id = v_user_id
      and wsh.weight is not null and wsh.weight > 0
      and wsh.reps is not null and wsh.reps > 0
      and wh.completed_at >= now() - interval '180 days'
  ),
  ranked as (
    select
      s.*,
      -- previous best e1RM BEFORE this set (does NOT include current row)
      max(s.e1rm_kg) over (
        partition by s.exercise_id
        order by s.completed_at, s.set_id
        rows between unbounded preceding and 1 preceding
      ) as prev_best_e1rm_kg
    from sets s
  ),
  true_prs as (
    select
      r.*,
      case
        when r.prev_best_e1rm_kg is null then null
        when r.prev_best_e1rm_kg <= 0 then null
        else round(((r.e1rm_kg - r.prev_best_e1rm_kg) / r.prev_best_e1rm_kg) * 100.0, 1)
      end as delta_pct
    from ranked r
    -- STRICT improvement only (ties excluded)
    where r.prev_best_e1rm_kg is null
       or r.e1rm_kg > r.prev_best_e1rm_kg
  ),
  pick as (
    select *
    from true_prs
    -- If you do NOT want "first ever" PRs to appear (no previous best), uncomment:
    -- where prev_best_e1rm_kg is not null
    order by
      completed_at desc,
      delta_pct desc nulls last,
      e1rm_kg desc,
      weight_kg desc,
      reps desc,
      set_id desc
    limit 1
  )
  select jsonb_build_object(
    'type','latest_pr',
    'exercise_id', p.exercise_id,
    'exercise_name', p.exercise_name,
    'best_weight', p.weight_kg,
    'best_reps', p.reps,
    'display_value', trim(to_char(p.e1rm_kg, 'FM9999990.0')) || ' kg e1RM',
    'delta_pct', p.delta_pct,
    'achieved_at', p.completed_at
  )
  into v_pr
  from pick p;



  /* --------------------------
     Volume trend (THIS WEEK vs LAST WEEK) + 4-week sparkline (Mon–Sun weeks)
     -------------------------- */
  with week_bounds as (
    select date_trunc('week', now())::date as this_week_start
  ),
  weeks as (
    select (wb.this_week_start - (gs.i * interval '7 days'))::date as week_start
    from week_bounds wb
    cross join generate_series(3, 0, -1) as gs(i)
  ),
  base as (
    select
      date_trunc('week', wh.completed_at)::date as week_start,
      sum((wsh.weight * wsh.reps)::numeric) as vol_kg
    from public.workout_set_history wsh
    join public.workout_exercise_history weh on weh.id = wsh.workout_exercise_history_id
    join public.workout_history wh on wh.id = weh.workout_history_id
    where wh.user_id = v_user_id
      and wsh.weight is not null and wsh.weight > 0
      and wsh.reps is not null and wsh.reps > 0
      and wh.completed_at >= (select this_week_start - interval '21 days' from week_bounds)
      and wh.completed_at <  (select this_week_start + interval '7 days'  from week_bounds)
    group by 1
  ),
  joined as (
    select
      w.week_start,
      coalesce(b.vol_kg, 0) as vol_kg
    from weeks w
    left join base b using (week_start)
  ),
  agg as (
    select
      (select this_week_start from week_bounds) as this_week_start,
      (select vol_kg from joined where week_start = (select this_week_start from week_bounds)) as vol_this_week,
      (select vol_kg from joined where week_start = (select this_week_start from week_bounds) - interval '7 days') as vol_last_week,
      jsonb_agg(
        jsonb_build_object(
          'label', to_char(week_start, 'FMDD Mon'),
          'value', round(vol_kg, 0)
        )
        order by week_start asc
      ) as sparkline
    from joined
  )
  select jsonb_build_object(
    'type','volume_trend',
    'label','Volume',
    'value', round(coalesce(a.vol_this_week, 0), 0),
    'unit', 'kg',
    'delta_pct',
      case
        when a.vol_last_week is null or a.vol_last_week <= 0 then null
        else round(((a.vol_this_week - a.vol_last_week) / a.vol_last_week) * 100.0, 1)
      end,
    'sparkline', coalesce(a.sparkline, '[]'::jsonb)
  )
  into v_volume
  from agg a;

/* --------------------------
   Plan goals (top 3 active) with progress_pct
   Supports new flexible metric goals
   -------------------------- */
with g as (
  select
    g.id,
    g.exercise_id,
    e.name as exercise_name,
    coalesce(g.metrics, '[]'::jsonb) as metrics,

    g.start_weight,
    g.start_reps,
    g.start_distance,
    g.start_time_seconds,

    g.target_weight,
    g.target_reps,
    g.target_distance,
    g.target_time_seconds,

    g.goal_summary,
    g.type::text as legacy_goal_type,
    g.target_number::numeric as legacy_target_value
  from public.goals g
  join public.exercises e on e.id = g.exercise_id
  where g.user_id = v_user_id
    and g.is_active = true
    and g.exercise_id is not null
  order by g.created_at desc
  limit 3
),
cur as (
  select
    g.id as goal_id,

    max(wsh.weight)::numeric as current_weight,
    max(wsh.reps)::numeric as current_reps,
    max(wsh.distance)::numeric as current_distance,
    min(wsh.time_seconds)::numeric as current_time_seconds
  from g
  left join public.workout_exercise_history weh
    on weh.exercise_id = g.exercise_id
  left join public.workout_history wh
    on wh.id = weh.workout_history_id
   and wh.user_id = v_user_id
  left join public.workout_set_history wsh
    on wsh.workout_exercise_history_id = weh.id
  group by g.id
),
items as (
  select
    g.id,
    g.exercise_name as title,
    g.metrics,
    g.goal_summary,

    case
      when g.metrics ? 'weight'
        and g.start_weight is not null
        and g.target_weight is not null
        and cur.current_weight is not null
        and g.start_weight <> g.target_weight
      then ((cur.current_weight - g.start_weight) / nullif((g.target_weight - g.start_weight), 0)) * 100

      when g.metrics ? 'reps'
        and g.start_reps is not null
        and g.target_reps is not null
        and cur.current_reps is not null
        and g.start_reps <> g.target_reps
      then ((cur.current_reps - g.start_reps) / nullif((g.target_reps - g.start_reps), 0)) * 100

      when g.metrics ? 'distance'
        and g.start_distance is not null
        and g.target_distance is not null
        and cur.current_distance is not null
        and g.start_distance <> g.target_distance
      then ((cur.current_distance - g.start_distance) / nullif((g.target_distance - g.start_distance), 0)) * 100

      when g.metrics ? 'time'
        and g.start_time_seconds is not null
        and g.target_time_seconds is not null
        and cur.current_time_seconds is not null
        and g.start_time_seconds <> g.target_time_seconds
      then
        case
          when g.target_time_seconds < g.start_time_seconds then
            ((g.start_time_seconds - cur.current_time_seconds)
              / nullif((g.start_time_seconds - g.target_time_seconds), 0)) * 100
          else
            ((cur.current_time_seconds - g.start_time_seconds)
              / nullif((g.target_time_seconds - g.start_time_seconds), 0)) * 100
        end

      else 0
    end as raw_progress_pct
  from g
  left join cur on cur.goal_id = g.id
)
select jsonb_build_object(
  'type','plan_goals',
  'items', coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'title', title,
        'progress_pct', greatest(0, least(100, round(coalesce(raw_progress_pct, 0), 0))),
        'subtitle', coalesce(goal_summary, 'Goal in progress'),
        'metrics', metrics
      )
      order by raw_progress_pct desc nulls last
    ),
    '[]'::jsonb
  )
)
into v_goals
from items;

  /* --------------------------
     Last workout card (for returning)
     -------------------------- */
  select jsonb_build_object(
    'type','last_workout',
    'title', coalesce(w.title, 'Last workout'),
    'completed_at', wh.completed_at,
    'duration_seconds', wh.duration_seconds,
    'sets_completed', (
      select count(*)
      from public.workout_set_history wsh
      join public.workout_exercise_history weh on weh.id = wsh.workout_exercise_history_id
      where weh.workout_history_id = wh.id
    )
  )
  into v_last_workout
  from public.workout_history wh
  left join public.workouts w on w.id = wh.workout_id
  where wh.user_id = v_user_id
  order by wh.completed_at desc
  limit 1;

  /* --------------------------
     Build cards array per variant (<= 6)
     -------------------------- */

  -- HERO card always first
  if v_home_variant = 'new_user' then
    v_cards := v_cards || jsonb_build_array(jsonb_build_object(
      'type','hero',
      'title','Let’s get your first workout in.',
      'subtitle','No pressure. Just hit start and we’ll guide you through every rep.',
      'primary_cta', jsonb_build_object(
        'label','Start Workout',
        'cta', jsonb_build_object('action','quick_log_workout')
      )
    ));

    -- ✅ New user progress card (workouts → experienced unlock)
v_new_user_progress := jsonb_build_object(
  'type', 'new_user_progress',
  'title', 'Unlock your full dashboard',
  'subtitle', 'Complete 5 workouts to unlock advanced insights and goal tracking.',
  'completed', coalesce(v_workouts_total, 0),
  'target', 5
);

-- ✅ Inject progress card directly after hero
if v_new_user_progress is not null then
  v_cards := v_cards || jsonb_build_array(v_new_user_progress);
end if;



    -- ✅ Starter templates: only show if any remaining
    if v_starter_templates is not null
       and jsonb_array_length(coalesce(v_starter_templates->'items','[]'::jsonb)) > 0 then
      v_cards := v_cards || jsonb_build_array(v_starter_templates);
    end if;

    -- ✅ Unlock preview: always for new_user
    if v_unlock_preview is not null then
      v_cards := v_cards || jsonb_build_array(v_unlock_preview);
    end if;

  elsif v_home_variant = 'experienced_no_plan' then
    v_cards := v_cards || jsonb_build_array(jsonb_build_object(
      'type','hero',
      'badge','CURRENTLY UNPLANNED',
      'title','Ready to focus?',
      'subtitle','You’re training hard. Let’s make it smart with a structured plan tailored to your goals.',
      'primary_cta', jsonb_build_object(
        'label','Discover Plans',
        'cta', jsonb_build_object('action','discover_plans')
      ),
      'secondary_cta', jsonb_build_object(
        'label','Quick Log Workout',
        'cta', jsonb_build_object('action','quick_log_workout')
      )
    ));

  elsif v_home_variant = 'experienced_plan' then
    v_cards := v_cards || jsonb_build_array(jsonb_build_object(
      'type','hero',
      'badge','TODAY’S FOCUS',
      'title', coalesce(v_next_workout_title, 'Next Workout'),
      'subtitle', 'Your next planned session is ready.',
      'meta', coalesce(v_next_workout_meta, '{}'::jsonb),
      'primary_cta', jsonb_build_object(
        'label','Start Workout',
        'cta', case
          when v_next_plan_workout_id is not null and v_next_workout_id is not null
            then jsonb_build_object(
              'action','start_plan_workout',
              'plan_workout_id', v_next_plan_workout_id,
              'workout_id', v_next_workout_id
            )
          else jsonb_build_object('action','open_workouts_tab')
        end
      )
    ));

  else -- returning
    v_cards := v_cards || jsonb_build_array(jsonb_build_object(
      'type','hero',
      'title','Fresh start. Fresh gains.',
      'subtitle','Your previous progress is saved. Pick up where you left off.',
      'primary_cta', jsonb_build_object(
        'label', case when v_active_plan_id is not null then 'Resume Training' else 'Choose a Workout' end,
        'cta', case
          when v_active_plan_id is not null and v_next_plan_workout_id is not null and v_next_workout_id is not null
            then jsonb_build_object(
              'action','start_plan_workout',
              'plan_workout_id', v_next_plan_workout_id,
              'workout_id', v_next_workout_id
            )
          else jsonb_build_object('action','open_workouts_tab')
        end
      )
    ));
  end if;

  -- Weekly goal (experienced only)
  if v_home_variant in ('experienced_no_plan','experienced_plan') then
    v_cards := v_cards || jsonb_build_array(jsonb_build_object(
      'type','weekly_goal',
      'title','This Week',
      'value', v_week_done,
      'target', v_week_target,
      'status', v_week_status
    ));
  end if;

  -- Latest PR (experienced + returning)
  if v_home_variant in ('experienced_no_plan','experienced_plan','returning') and v_pr is not null then
    v_cards := v_cards || jsonb_build_array(v_pr);
  end if;

  -- Volume trend (plan only)
  if v_home_variant = 'experienced_plan' and v_volume is not null then
    v_cards := v_cards || jsonb_build_array(v_volume);
  end if;

  -- ✅ Consistency calendar (3 months) + weekly streak (experienced + returning)
  if v_home_variant in ('experienced_no_plan','experienced_plan','returning') then
    v_cards := v_cards || jsonb_build_array(jsonb_build_object(
      'type','streak',
      'label','Consistency',
      'weekly_streak', v_weekly_streak,
      'months', coalesce(v_calendar_months,'[]'::jsonb)
    ));
  end if;

  -- Plan goals (plan only)
  if v_home_variant = 'experienced_plan' and v_goals is not null then
    v_cards := v_cards || jsonb_build_array(v_goals);
  end if;

  -- Last workout (returning only)
  if v_home_variant = 'returning' and v_last_workout is not null then
    v_cards := v_cards || jsonb_build_array(v_last_workout);
  end if;

  -- Enforce hard cap (defensive)
  if jsonb_array_length(v_cards) > 6 then
    v_cards := (
      select jsonb_agg(value)
      from jsonb_array_elements(v_cards) with ordinality t(value, ord)
      where ord <= 6
    );
  end if;

  return jsonb_build_object(
    'server_time', now(),
    'home_variant', v_home_variant,
    'transition', v_transition,
    'user', jsonb_build_object(
      'name', v_name,
      'units', 'kg',
      'steps_goal', v_steps_goal,
      'weekly_workout_goal', v_weekly_goal,
      'active_plan_id', v_active_plan_id,
      'workouts_total', v_workouts_total,
      'days_since_last_workout', v_days_since_last_workout
    ),
    'cards', v_cards
  );
end;$function$

CREATE OR REPLACE FUNCTION public.get_home_summary_debug(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := p_user_id;
begin
  -- TEMP: spoof auth.uid() by directly returning summary for v_uid
  -- easiest: duplicate the function body and replace v_user_id := auth.uid() with v_user_id := p_user_id
  -- (Tell me if you want me to generate the full debug version too.)
  return jsonb_build_object('error', 'use the debug body version');
end;
$function$

CREATE OR REPLACE FUNCTION public.get_last_exercise_best_set(p_user_id uuid, p_exercise_ids uuid[])
 RETURNS TABLE(exercise_id uuid, workout_history_id uuid, completed_at timestamp with time zone, best_reps smallint, best_weight numeric, best_est_1rm numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with last_weh as (
  select distinct on (weh.exercise_id)
    weh.id as workout_exercise_history_id,
    weh.exercise_id,
    wh.id as workout_history_id,
    wh.completed_at
  from workout_exercise_history weh
  join workout_history wh
    on wh.id = weh.workout_history_id
  where wh.user_id = p_user_id
    and (p_exercise_ids is null or weh.exercise_id = any(p_exercise_ids))
  order by weh.exercise_id, wh.completed_at desc
),
best_set as (
  select
    l.exercise_id,
    l.workout_history_id,
    l.completed_at,
    wsh.reps,
    wsh.weight,
    (wsh.weight * (1 + (wsh.reps::numeric / 30.0))) as est_1rm,
    row_number() over (
      partition by l.exercise_id
      order by (wsh.weight * (1 + (wsh.reps::numeric / 30.0))) desc nulls last
    ) as rn
  from last_weh l
  join workout_set_history wsh
    on wsh.workout_exercise_history_id = l.workout_exercise_history_id
  where wsh.weight is not null
    and wsh.reps is not null
    and wsh.reps > 0
)
select
  l.exercise_id,
  l.workout_history_id,
  l.completed_at,
  b.reps  as best_reps,
  b.weight as best_weight,
  b.est_1rm as best_est_1rm
from last_weh l
left join best_set b
  on b.exercise_id = l.exercise_id
 and b.rn = 1
order by l.completed_at desc;
$function$

CREATE OR REPLACE FUNCTION public.get_last_exercise_session_sets(p_user_id uuid, p_exercise_ids uuid[])
 RETURNS TABLE(exercise_id uuid, workout_history_id uuid, completed_at timestamp with time zone, set_number smallint, drop_index smallint, reps smallint, weight numeric, time_seconds integer, distance numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
with last_session as (
  -- pick the latest workout_exercise_history row per exercise_id
  select distinct on (weh.exercise_id)
    weh.exercise_id,
    weh.id as workout_exercise_history_id,
    wh.id as workout_history_id,
    wh.completed_at
  from public.workout_exercise_history weh
  join public.workout_history wh
    on wh.id = weh.workout_history_id
  where wh.user_id = p_user_id
    and weh.exercise_id = any(p_exercise_ids)
  order by weh.exercise_id, wh.completed_at desc
),
max_set as (
  -- max set_number in that last session (at least 1)
  select
    ls.exercise_id,
    ls.workout_history_id,
    ls.completed_at,
    ls.workout_exercise_history_id,
    greatest(coalesce(max(wsh.set_number), 1), 1)::smallint as max_set_number
  from last_session ls
  left join public.workout_set_history wsh
    on wsh.workout_exercise_history_id = ls.workout_exercise_history_id
  group by
    ls.exercise_id,
    ls.workout_history_id,
    ls.completed_at,
    ls.workout_exercise_history_id
),
dense as (
  -- generate 1..max_set_number rows per exercise
  select
    ms.exercise_id,
    ms.workout_history_id,
    ms.completed_at,
    ms.workout_exercise_history_id,
    gs.set_number::smallint as set_number
  from max_set ms
  join lateral generate_series(1, ms.max_set_number::int) as gs(set_number)
    on true
),
rep as (
  -- representative row per (exercise_id, set_number)
  -- choose drop_index = 0 where present so we don't multiply rows for dropsets
  select
    ms.exercise_id,
    wsh.set_number,
    max(wsh.reps)         filter (where coalesce(wsh.drop_index, 0) = 0) as reps,
    max(wsh.weight)       filter (where coalesce(wsh.drop_index, 0) = 0) as weight,
    max(wsh.time_seconds) filter (where coalesce(wsh.drop_index, 0) = 0) as time_seconds,
    max(wsh.distance)     filter (where coalesce(wsh.drop_index, 0) = 0) as distance
  from max_set ms
  join public.workout_set_history wsh
    on wsh.workout_exercise_history_id = ms.workout_exercise_history_id
  group by
    ms.exercise_id,
    wsh.set_number
)
select
  d.exercise_id,
  d.workout_history_id,
  d.completed_at,
  d.set_number,
  0::smallint as drop_index,
  r.reps,
  r.weight,
  r.time_seconds,
  r.distance
from dense d
left join rep r
  on r.exercise_id = d.exercise_id
 and r.set_number = d.set_number
order by
  d.exercise_id,
  d.set_number asc;
$function$

CREATE OR REPLACE FUNCTION public.get_last_exercise_session_summaries(p_user_id uuid, p_exercise_ids uuid[])
 RETURNS TABLE(exercise_id uuid, workout_history_id uuid, completed_at timestamp with time zone, sets_count integer, best_reps integer, best_weight numeric, best_est_1rm numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
with last_session as (
  -- last workout_history per exercise
  select distinct on (weh.exercise_id)
    weh.exercise_id,
    weh.workout_history_id,
    wh.completed_at
  from public.workout_exercise_history weh
  join public.workout_history wh
    on wh.id = weh.workout_history_id
  where wh.user_id = p_user_id
    and weh.exercise_id = any(p_exercise_ids)
  order by weh.exercise_id, wh.completed_at desc
),
sets_in_last as (
  -- all sets for those last sessions
  select
    ls.exercise_id,
    ls.workout_history_id,
    ls.completed_at,
    wsh.reps,
    wsh.weight
  from last_session ls
  join public.workout_exercise_history weh
    on weh.workout_history_id = ls.workout_history_id
   and weh.exercise_id = ls.exercise_id
  join public.workout_set_history wsh
    on wsh.workout_exercise_history_id = weh.id
  where wsh.reps is not null
    and wsh.weight is not null
),
ranked as (
  select
    exercise_id,
    workout_history_id,
    completed_at,
    count(*) over (partition by exercise_id, workout_history_id) as sets_count,
    reps::int as best_reps,
    weight as best_weight,
    (weight * (1 + (reps::numeric / 30))) as best_est_1rm,
    row_number() over (
      partition by exercise_id
      order by (weight * (1 + (reps::numeric / 30))) desc, weight desc, reps desc
    ) as rn
  from sets_in_last
)
select
  exercise_id,
  workout_history_id,
  completed_at,
  sets_count,
  best_reps,
  best_weight,
  best_est_1rm
from ranked
where rn = 1;
$function$

CREATE OR REPLACE FUNCTION public.get_last_workout_onboarding_payload_v1()
 RETURNS TABLE(unit_weight text, workout_history_id uuid, workout_id uuid, workout_title text, workout_image_key text, completed_at timestamp with time zone, duration_seconds integer, sets_logged integer, total_volume_kg numeric, workouts_completed integer, preview_exercise_id uuid, preview_exercise_name text, preview_sets integer, preview_reps integer, preview_weight numeric, tracked_sets jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_unit_weight text;

  v_wh_id uuid;
  v_wh_workout_id uuid;
  v_wh_completed_at timestamptz;
  v_wh_duration int;
begin
  if v_user_id is null then
    raise exception 'auth_missing';
  end if;

  -- unit preference
  select nullif(btrim(coalesce(pr.settings->>'unit_weight','')), '')
    into v_unit_weight
  from public.profiles pr
  where pr.id = v_user_id;

  unit_weight := coalesce(v_unit_weight, 'kg');

  -- latest workout history row
  select wh.id, wh.workout_id, wh.completed_at, wh.duration_seconds
    into v_wh_id, v_wh_workout_id, v_wh_completed_at, v_wh_duration
  from public.workout_history wh
  where wh.user_id = v_user_id
  order by wh.completed_at desc
  limit 1;

  if v_wh_id is null then
    return; -- no workout history yet
  end if;

  workout_history_id := v_wh_id;
  workout_id := v_wh_workout_id;
  completed_at := v_wh_completed_at;
  duration_seconds := v_wh_duration;

  -- workout title + image key
  -- NOTE: user confirmed workout_image_key exists in their DB
  select w.title, w.workout_image_key
    into workout_title, workout_image_key
  from public.workouts w
  where w.id = v_wh_workout_id;

  workout_title := coalesce(workout_title, 'Workout');

  -- sets logged + volume (based on set history)
  select
    count(*)::int,
    coalesce(sum(coalesce(wsh.weight,0) * coalesce(wsh.reps,0)), 0)::numeric
  into sets_logged, total_volume_kg
  from public.workout_set_history wsh
  join public.workout_exercise_history weh
    on weh.id = wsh.workout_exercise_history_id
  where weh.workout_history_id = v_wh_id;

  -- workouts completed (for stage progress)
  select count(*)::int
    into workouts_completed
  from public.workout_history wh
  where wh.user_id = v_user_id;

  -- ✅ all tracked set data for last session (grouped by exercise)
  with per_ex as (
    select
      weh.exercise_id,
      e.name as exercise_name,
      weh.order_index,
      jsonb_agg(
        jsonb_build_object(
          'set_number', wsh.set_number,
          'drop_index', wsh.drop_index,
          'reps', wsh.reps,
          'weight', wsh.weight,
          'time_seconds', wsh.time_seconds,
          'distance', wsh.distance,
          'notes', wsh.notes
        )
        order by wsh.set_number, wsh.drop_index
      ) as sets
    from public.workout_exercise_history weh
    join public.exercises e
      on e.id = weh.exercise_id
    join public.workout_set_history wsh
      on wsh.workout_exercise_history_id = weh.id
    where weh.workout_history_id = v_wh_id
    group by weh.exercise_id, e.name, weh.order_index
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'exercise_id', exercise_id,
          'exercise_name', exercise_name,
          'order_index', order_index,
          'sets', sets
        )
        order by order_index
      ),
      '[]'::jsonb
    )
  into tracked_sets
  from per_ex;

  -- preview exercise: most frequent exercise in last session, then avg weight/reps
  with last_sets as (
    select
      weh.exercise_id,
      wsh.weight,
      wsh.reps
    from public.workout_set_history wsh
    join public.workout_exercise_history weh
      on weh.id = wsh.workout_exercise_history_id
    where weh.workout_history_id = v_wh_id
      and (wsh.weight is not null or wsh.reps is not null)
  ),
  pick_ex as (
    select exercise_id
    from last_sets
    group by exercise_id
    order by count(*) desc
    limit 1
  ),
  agg as (
    select
      ls.exercise_id,
      count(*)::int as sets,
      round(avg(nullif(ls.reps,0)))::int as reps,
      avg(ls.weight)::numeric as weight
    from last_sets ls
    join pick_ex pe on pe.exercise_id = ls.exercise_id
    group by ls.exercise_id
  )
  select
    a.exercise_id,
    e.name,
    a.sets,
    a.reps,
    a.weight
  into
    preview_exercise_id,
    preview_exercise_name,
    preview_sets,
    preview_reps,
    preview_weight
  from agg a
  join public.exercises e on e.id = a.exercise_id;

  return next;
end;
$function$

CREATE OR REPLACE FUNCTION public.get_my_entitlements()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return public.get_entitlements_for_user(v_user_id);
end;
$function$

CREATE OR REPLACE FUNCTION public.get_my_notifications(p_limit integer DEFAULT 20, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(id uuid, recipient_id uuid, actor_id uuid, type text, title text, body text, entity_type text, entity_id uuid, image_url text, is_read boolean, read_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  select
    n.id,
    n.recipient_id,
    n.actor_id,
    n.type,
    n.title,
    n.body,
    n.entity_type,
    n.entity_id,
    n.image_url,
    n.is_read,
    n.read_at,
    n.created_at
  from public.notifications n
  where n.recipient_id = (select auth.uid())
    and (p_before is null or n.created_at < p_before)
  order by n.created_at desc
  limit greatest(p_limit, 1);
$function$

CREATE OR REPLACE FUNCTION public.get_my_unread_notification_count()
 RETURNS integer
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  select count(*)::integer
  from public.notifications n
  where n.recipient_id = (select auth.uid())
    and n.is_read = false;
$function$

CREATE OR REPLACE FUNCTION public.get_notifications_inbox_v1(p_limit integer DEFAULT 30, p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(notification_id uuid, type text, created_at timestamp with time zone, read_at timestamp with time zone, actor_id uuid, actor_name text, post_id uuid, post_type text, post_caption text, comment_id uuid, comment_body text, follow_requester_id uuid, follow_target_id uuid, payload jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with base as (
    select n.*
    from public.notifications n
    where n.user_id = auth.uid()
      and (
        p_cursor_created_at is null
        or n.created_at < p_cursor_created_at
        or (n.created_at = p_cursor_created_at and n.id < p_cursor_id)
      )
    order by n.created_at desc, n.id desc
    limit greatest(1, least(p_limit, 100))
  )
  select
    b.id as notification_id,
    b.type,
    b.created_at,
    b.read_at,

    b.actor_id,
    ap.name as actor_name,

    b.post_id,
    p.post_type,
    p.caption as post_caption,

    b.comment_id,
    pc.body as comment_body,

    b.follow_requester_id,
    b.follow_target_id,

    b.payload
  from base b
  left join public.profiles ap on ap.id = b.actor_id
  left join public.posts p on p.id = b.post_id
  left join public.post_comments pc on pc.id = b.comment_id;
$function$

CREATE OR REPLACE FUNCTION public.get_onboarding_gate_v1()
 RETURNS TABLE(user_id uuid, required_stage text, workouts_completed integer, stage2_triggered_at timestamp with time zone, stage2_completed_at timestamp with time zone, stage3_triggered_at timestamp with time zone, stage3_completed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_count int := 0;

  p record;

  needs_stage2 boolean := false;
  needs_stage3 boolean := false;
begin
  if v_user_id is null then
    raise exception 'auth_missing';
  end if;

  -- profile row
  select
    pr.id,
    pr.onboarding_stage2_triggered_at,
    pr.onboarding_stage2_completed_at,
    pr.onboarding_stage3_triggered_at,
    pr.onboarding_stage3_completed_at
  into p
  from public.profiles pr
  where pr.id = v_user_id;

  if p.id is null then
    user_id := v_user_id;
    required_stage := null;
    workouts_completed := 0;
    stage2_triggered_at := null;
    stage2_completed_at := null;
    stage3_triggered_at := null;
    stage3_completed_at := null;
    return next;
    return;
  end if;

  -- count completed workouts
  select count(*)::int
  into v_count
  from public.workout_history wh
  where wh.user_id = v_user_id;

  -- Stage 2 rule: after first workout exists, and until completed
  needs_stage2 := (v_count >= 1) and (p.onboarding_stage2_completed_at is null);

  -- Stage 3 rule: after 5 workouts exists, until completed
  -- require stage2 completed so ordering is guaranteed
  needs_stage3 := (v_count >= 5)
                  and (p.onboarding_stage3_completed_at is null)
                  and (p.onboarding_stage2_completed_at is not null);

  -- set triggered timestamps once (first time they qualify)
  if needs_stage2 and p.onboarding_stage2_triggered_at is null then
    update public.profiles
    set onboarding_stage2_triggered_at = now()
    where id = v_user_id;

    p.onboarding_stage2_triggered_at := now();
  end if;

  if needs_stage3 and p.onboarding_stage3_triggered_at is null then
    update public.profiles
    set onboarding_stage3_triggered_at = now()
    where id = v_user_id;

    p.onboarding_stage3_triggered_at := now();
  end if;

  user_id := v_user_id;
  workouts_completed := v_count;

  stage2_triggered_at := p.onboarding_stage2_triggered_at;
  stage2_completed_at := p.onboarding_stage2_completed_at;
  stage3_triggered_at := p.onboarding_stage3_triggered_at;
  stage3_completed_at := p.onboarding_stage3_completed_at;

  if needs_stage2 then
    required_stage := 'stage2';
  elsif needs_stage3 then
    required_stage := 'stage3';
  else
    required_stage := null;
  end if;

  return next;
end;
$function$

CREATE OR REPLACE FUNCTION public.get_onboarding_stage2_payload_v1()
 RETURNS TABLE(workout_history_id uuid, workout_id uuid, workout_title text, workout_image_key text, completed_at timestamp with time zone, duration_seconds integer, sets_logged integer, total_volume_kg numeric, preview_exercise_id uuid, preview_exercise_name text, preview_sets integer, preview_reps integer, preview_weight numeric, workouts_completed integer, unit_weight text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_wh record;
  v_unit_weight text;
begin
  if v_user_id is null then
    raise exception 'auth_missing';
  end if;

  -- unit preference
  select nullif(btrim(coalesce(pr.settings->>'unit_weight','')), '')
  into v_unit_weight
  from public.profiles pr
  where pr.id = v_user_id;

  unit_weight := coalesce(v_unit_weight, 'kg');

  -- latest workout history row
  select wh.id, wh.workout_id, wh.completed_at, wh.duration_seconds
  into v_wh
  from public.workout_history wh
  where wh.user_id = v_user_id
  order by wh.completed_at desc
  limit 1;

  if v_wh.id is null then
    -- no workout history yet => return nothing
    return;
  end if;

  workout_history_id := v_wh.id;
  workout_id := v_wh.workout_id;
  completed_at := v_wh.completed_at;
  duration_seconds := v_wh.duration_seconds;

  -- workout title + image key (if present)
  select w.title, w.workout_image_key
  into workout_title, workout_image_key
  from public.workouts w
  where w.id = v_wh.workout_id;

  workout_title := coalesce(workout_title, 'Workout');

  -- sets logged + volume (based on set history)
  select
    count(*)::int,
    coalesce(sum(coalesce(wsh.weight,0) * coalesce(wsh.reps,0)), 0)::numeric
  into sets_logged, total_volume_kg
  from public.workout_set_history wsh
  where wsh.user_id = v_user_id
    and wsh.workout_history_id = v_wh.id;

  -- workouts completed (for screen 3 progress)
  select count(*)::int
  into workouts_completed
  from public.workout_history wh
  where wh.user_id = v_user_id;

  -- preview exercise: pick the most recent exercise from this last session
  -- and use its most common weight/reps in that workout as the preview
  with last_sets as (
    select
      wsh.exercise_id,
      wsh.weight,
      wsh.reps
    from public.workout_set_history wsh
    where wsh.user_id = v_user_id
      and wsh.workout_history_id = v_wh.id
      and (wsh.weight is not null or wsh.reps is not null)
  ),
  pick_ex as (
    select exercise_id
    from last_sets
    group by exercise_id
    order by count(*) desc
    limit 1
  ),
  agg as (
    select
      ls.exercise_id,
      count(*)::int as sets,
      round(avg(coalesce(ls.reps,0)))::int as reps,
      avg(ls.weight)::numeric as weight
    from last_sets ls
    join pick_ex pe on pe.exercise_id = ls.exercise_id
    group by ls.exercise_id
  )
  select
    a.exercise_id,
    e.name,
    a.sets,
    nullif(a.reps,0),
    a.weight
  into
    preview_exercise_id,
    preview_exercise_name,
    preview_sets,
    preview_reps,
    preview_weight
  from agg a
  join public.exercises e on e.id = a.exercise_id;

  return next;
end;
$function$

CREATE OR REPLACE FUNCTION public.get_onboarding_stage3_five_workouts_payload_v1()
 RETURNS TABLE(user_name text, unit_weight text, timezone text, workouts_completed_total integer, window_start timestamp with time zone, window_end timestamp with time zone, window_days integer, strength_change_pct numeric, total_volume numeric, spotlight_exercise_id uuid, spotlight_exercise_name text, spotlight_current_1rm numeric, spotlight_change_pct numeric, spotlight_series jsonb, weekly_goal_target integer, weekly_completed integer, streak_weeks integer, consistency_change_pct numeric, recommended_days_per_week integer, recommended_split_key text, recommended_split_label text, recommended_schedule jsonb, milestone_exercise_id uuid, milestone_exercise_name text, milestone_current_value numeric, milestone_target_value numeric, milestone_progress_pct numeric, milestone_on_track boolean, milestone_eta_weeks integer)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_user_id uuid := auth.uid();

  v_unit_weight text;
  v_timezone text;
  v_user_name text;

  v_total_workouts int;

  v_w_start timestamptz;
  v_w_end   timestamptz;
  v_days    int;

  v_total_volume numeric;

  v_week_key date;
  v_week_goal int;
  v_week_done int;
  v_streak int;

  v_consistency_change numeric;

  v_avg_per_week numeric;
  v_reco_days int;
  v_split_key text;
  v_split_label text;
  v_schedule jsonb;

  v_spot_ex_id uuid;
  v_spot_ex_name text;
  v_spot_series jsonb;
  v_spot_current_1rm numeric;
  v_spot_change_pct numeric;

  v_milestone_target numeric;
  v_milestone_progress numeric;
  v_on_track boolean;
begin
  if v_user_id is null then
    raise exception 'auth_missing';
  end if;

  -- -----------------------------
  -- User prefs / profile context
  -- -----------------------------
  select
    pr.name,
    pr.timezone,
    nullif(btrim(coalesce(pr.settings->>'unit_weight','')), ''),
    pr.weekly_workout_goal,
    pr.weekly_streak
  into
    v_user_name,
    v_timezone,
    v_unit_weight,
    v_week_goal,
    v_streak
  from public.profiles pr
  where pr.id = v_user_id;

  user_name := v_user_name;
  timezone := coalesce(nullif(v_timezone,''), 'UTC');
  unit_weight := coalesce(v_unit_weight, 'kg');

  weekly_goal_target := coalesce(v_week_goal, 3);
  streak_weeks := coalesce(v_streak, 0);

  -- -----------------------------
  -- Total workouts
  -- -----------------------------
  select count(*)::int
  into v_total_workouts
  from public.workout_history wh
  where wh.user_id = v_user_id;

  workouts_completed_total := coalesce(v_total_workouts, 0);

  -- Stage 3 should only trigger at 5+, but don't explode if not.
  -- Window = range covering last 5 workouts (by completed_at).
  with last5 as (
    select wh.completed_at
    from public.workout_history wh
    where wh.user_id = v_user_id
    order by wh.completed_at desc
    limit 5
  )
  select
    min(completed_at),
    max(completed_at)
  into v_w_start, v_w_end
  from last5;

  window_start := v_w_start;
  window_end := v_w_end;

  if v_w_start is not null and v_w_end is not null then
    v_days := greatest(1, (v_w_end::date - v_w_start::date));
  else
    v_days := null;
  end if;

  window_days := v_days;

  -- -----------------------------
  -- Total volume (lifetime)
  -- -----------------------------
  select
    coalesce(sum(coalesce(wsh.weight,0) * coalesce(wsh.reps,0)), 0)::numeric
  into v_total_volume
  from public.workout_history wh
  join public.workout_exercise_history weh on weh.workout_history_id = wh.id
  join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
  where wh.user_id = v_user_id;

  total_volume := v_total_volume;

  -- -----------------------------
  -- Weekly completed (current week)
  -- Prefer user_weekly_workout_stats if populated.
  -- week_key = start of week in user's timezone.
  -- -----------------------------
  v_week_key :=
    (date_trunc('week', (now() at time zone timezone))::date);

  select uws.completed
  into v_week_done
  from public.user_weekly_workout_stats uws
  where uws.user_id = v_user_id
    and uws.week_key = v_week_key;

  if v_week_done is null then
    -- fallback: compute from workout_history in this week window
    select count(*)::int
    into v_week_done
    from public.workout_history wh
    where wh.user_id = v_user_id
      and (wh.completed_at at time zone timezone) >= (v_week_key::timestamp)
      and (wh.completed_at at time zone timezone) <  ((v_week_key + 7)::timestamp);
  end if;

  weekly_completed := coalesce(v_week_done, 0);

  -- -----------------------------
  -- Consistency change % (last 4w vs previous 4w)
  -- uses workouts/week average.
  -- -----------------------------
  with w as (
    select (date_trunc('week', wh.completed_at at time zone timezone))::date as wk
    from public.workout_history wh
    where wh.user_id = v_user_id
      and wh.completed_at >= now() - interval '56 days'
  ),
  a as (
    select
      avg(cnt)::numeric as avg_last4
    from (
      select wk, count(*)::int as cnt
      from w
      where wk >= (date_trunc('week', (now() at time zone timezone))::date - 21)
      group by wk
    ) x
  ),
  b as (
    select
      avg(cnt)::numeric as avg_prev4
    from (
      select wk, count(*)::int as cnt
      from w
      where wk <  (date_trunc('week', (now() at time zone timezone))::date - 21)
        and wk >= (date_trunc('week', (now() at time zone timezone))::date - 49)
      group by wk
    ) y
  )
  select
    case
      when b.avg_prev4 is null or b.avg_prev4 = 0 then null
      else round(((a.avg_last4 - b.avg_prev4) / b.avg_prev4) * 100, 1)
    end
  into v_consistency_change
  from a, b;

  consistency_change_pct := v_consistency_change;

  -- -----------------------------
  -- Spotlight exercise:
  -- Pick most improved estimated 1RM over last 5 sessions (Epley).
  -- Fallback: most sets in last 5 workouts.
  -- -----------------------------

  -- Build per-exercise per-session best Epley 1RM (last ~90d to have enough samples)
  with sess as (
    select wh.id as workout_history_id,
           wh.completed_at
    from public.workout_history wh
    where wh.user_id = v_user_id
      and wh.completed_at >= now() - interval '90 days'
  ),
  per_set as (
    select
      s.workout_history_id,
      s.completed_at,
      weh.exercise_id,
      -- Epley: weight * (1 + reps/30)
      (wsh.weight * (1 + (wsh.reps::numeric / 30.0)))::numeric as e1rm
    from sess s
    join public.workout_exercise_history weh on weh.workout_history_id = s.workout_history_id
    join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
    where wsh.weight is not null
      and wsh.reps is not null
      and wsh.reps > 0
      and wsh.weight > 0
  ),
  per_session_best as (
    select
      workout_history_id,
      completed_at,
      exercise_id,
      max(e1rm) as e1rm_best
    from per_set
    group by workout_history_id, completed_at, exercise_id
  ),
  ranked as (
    select
      psb.*,
      row_number() over (partition by exercise_id order by completed_at desc) as rn_desc
    from per_session_best psb
  ),
  last5_points as (
    select
      exercise_id,
      completed_at,
      e1rm_best,
      row_number() over (partition by exercise_id order by completed_at asc) as idx_asc,
      count(*) over (partition by exercise_id) as n
    from ranked
    where rn_desc <= 5
  ),
  improvements as (
    select
      exercise_id,
      -- first and last point within the last5 window
      max(case when idx_asc = 1 then e1rm_best end) as first_val,
      max(case when idx_asc = n then e1rm_best end) as last_val,
      max(n) as n
    from last5_points
    group by exercise_id
    having max(n) >= 2
  ),
  scored as (
    select
      i.exercise_id,
      i.first_val,
      i.last_val,
      round(((i.last_val - i.first_val) / nullif(i.first_val,0)) * 100, 1) as pct
    from improvements i
    where i.first_val is not null
      and i.last_val is not null
  )
  select
    s.exercise_id,
    e.name,
    s.pct
  into
    v_spot_ex_id,
    v_spot_ex_name,
    v_spot_change_pct
  from scored s
  join public.exercises e on e.id = s.exercise_id
  order by s.pct desc nulls last
  limit 1;

  if v_spot_ex_id is null then
    -- fallback: most set count in last 5 workouts
    with last5w as (
      select wh.id
      from public.workout_history wh
      where wh.user_id = v_user_id
      order by wh.completed_at desc
      limit 5
    ),
    counts as (
      select
        weh.exercise_id,
        count(*)::int as sets
      from last5w
      join public.workout_exercise_history weh on weh.workout_history_id = last5w.id
      join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
      group by weh.exercise_id
    )
    select c.exercise_id, e.name
    into v_spot_ex_id, v_spot_ex_name
    from counts c
    join public.exercises e on e.id = c.exercise_id
    order by c.sets desc
    limit 1;

    v_spot_change_pct := null;
  end if;

  spotlight_exercise_id := v_spot_ex_id;
  spotlight_exercise_name := v_spot_ex_name;
  spotlight_change_pct := v_spot_change_pct;

  -- Build spotlight series json (up to 5 points, oldest -> newest)
  if v_spot_ex_id is not null then
    with sess as (
      select wh.id as workout_history_id,
             wh.completed_at
      from public.workout_history wh
      where wh.user_id = v_user_id
        and wh.completed_at >= now() - interval '90 days'
    ),
    per_set as (
      select
        s.completed_at,
        weh.exercise_id,
        (wsh.weight * (1 + (wsh.reps::numeric / 30.0)))::numeric as e1rm
      from sess s
      join public.workout_exercise_history weh on weh.workout_history_id = s.workout_history_id
      join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
      where weh.exercise_id = v_spot_ex_id
        and wsh.weight is not null
        and wsh.reps is not null
        and wsh.reps > 0
        and wsh.weight > 0
    ),
    per_session_best as (
      select completed_at, max(e1rm) as e1rm_best
      from per_set
      group by completed_at
      order by completed_at desc
      limit 5
    ),
    ordered as (
      select
        completed_at,
        e1rm_best,
        row_number() over (order by completed_at asc) as x
      from per_session_best
      order by completed_at asc
    )
    select
      jsonb_agg(
        jsonb_build_object(
          'x', o.x,
          'y', round(o.e1rm_best, 1),
          'label', to_char(o.completed_at at time zone timezone, 'Mon DD')
        )
        order by o.x
      ),
      (select round(o2.e1rm_best, 1) from ordered o2 order by o2.x desc limit 1)
    into
      v_spot_series,
      v_spot_current_1rm
    from ordered o;

    spotlight_series := coalesce(v_spot_series, '[]'::jsonb);
    spotlight_current_1rm := v_spot_current_1rm;

    -- If we didn't compute change pct earlier (fallback), compute it here if possible
    if spotlight_change_pct is null then
      -- compute from first/last of the series
      declare
        v_first numeric;
        v_last numeric;
      begin
        select
          (spotlight_series->0->>'y')::numeric,
          (spotlight_series->(jsonb_array_length(spotlight_series)-1)->>'y')::numeric
        into v_first, v_last;

        if v_first is not null and v_first > 0 and v_last is not null then
          spotlight_change_pct := round(((v_last - v_first) / v_first) * 100, 1);
        end if;
      exception when others then
        -- ignore
        null;
      end;
    end if;

  else
    spotlight_series := '[]'::jsonb;
    spotlight_current_1rm := null;
    spotlight_change_pct := null;
  end if;

  -- Strength hero stat (use spotlight change pct if we have it)
  strength_change_pct := spotlight_change_pct;

  -- -----------------------------
  -- Recommended days/week:
  -- average workouts per week over last 28 days, clamp 2..5
  -- fallback to profile weekly_workout_goal
  -- -----------------------------
  with w as (
    select (date_trunc('week', wh.completed_at at time zone timezone))::date as wk,
           count(*)::int as cnt
    from public.workout_history wh
    where wh.user_id = v_user_id
      and wh.completed_at >= now() - interval '28 days'
    group by 1
  )
  select avg(cnt)::numeric
  into v_avg_per_week
  from w;

  v_reco_days := coalesce(round(v_avg_per_week)::int, weekly_goal_target);
  v_reco_days := greatest(2, least(5, v_reco_days));

  recommended_days_per_week := v_reco_days;

  if v_reco_days <= 2 then
    v_split_key := 'full_body';
    v_split_label := 'Full Body';
    v_schedule := jsonb_build_array(
      jsonb_build_object('dow','Mon','kind','session'),
      jsonb_build_object('dow','Tue','kind','rest'),
      jsonb_build_object('dow','Wed','kind','rest'),
      jsonb_build_object('dow','Thu','kind','session'),
      jsonb_build_object('dow','Fri','kind','rest')
    );
  elsif v_reco_days = 3 then
    v_split_key := 'ppl';
    v_split_label := 'Push / Pull / Legs';
    v_schedule := jsonb_build_array(
      jsonb_build_object('dow','Mon','kind','session'),
      jsonb_build_object('dow','Tue','kind','rest'),
      jsonb_build_object('dow','Wed','kind','session'),
      jsonb_build_object('dow','Thu','kind','rest'),
      jsonb_build_object('dow','Fri','kind','session')
    );
  elsif v_reco_days = 4 then
    v_split_key := 'upper_lower';
    v_split_label := 'Upper / Lower';
    v_schedule := jsonb_build_array(
      jsonb_build_object('dow','Mon','kind','session'),
      jsonb_build_object('dow','Tue','kind','session'),
      jsonb_build_object('dow','Wed','kind','rest'),
      jsonb_build_object('dow','Thu','kind','session'),
      jsonb_build_object('dow','Fri','kind','session')
    );
  else
    v_split_key := 'ppl_plus';
    v_split_label := 'Push / Pull / Legs + Upper';
    v_schedule := jsonb_build_array(
      jsonb_build_object('dow','Mon','kind','session'),
      jsonb_build_object('dow','Tue','kind','session'),
      jsonb_build_object('dow','Wed','kind','session'),
      jsonb_build_object('dow','Thu','kind','rest'),
      jsonb_build_object('dow','Fri','kind','session')
    );
  end if;

  recommended_split_key := v_split_key;
  recommended_split_label := v_split_label;
  recommended_schedule := v_schedule;

  -- -----------------------------
  -- Milestone preview (use spotlight as milestone candidate for now)
  -- Target = +10%, rounded up to nearest 5
  -- -----------------------------
  milestone_exercise_id := spotlight_exercise_id;
  milestone_exercise_name := spotlight_exercise_name;
  milestone_current_value := spotlight_current_1rm;

  if milestone_current_value is not null and milestone_current_value > 0 then
    v_milestone_target := ceil((milestone_current_value * 1.10) / 5) * 5;
  else
    v_milestone_target := null;
  end if;

  milestone_target_value := v_milestone_target;

  if milestone_current_value is not null and milestone_target_value is not null and milestone_target_value > 0 then
    v_milestone_progress := round((milestone_current_value / milestone_target_value) * 100, 0);
  else
    v_milestone_progress := null;
  end if;

  milestone_progress_pct := v_milestone_progress;

  -- simple on-track heuristic: meeting at least 50% of weekly goal this week OR streak >= 1
  v_on_track :=
    (weekly_goal_target is not null and weekly_goal_target > 0 and weekly_completed::numeric / weekly_goal_target >= 0.5)
    or (streak_weeks >= 1);

  milestone_on_track := v_on_track;

  -- ETA (optional): leave null for now (we can add once you decide a pacing model)
  milestone_eta_weeks := null;

  return next;
end;
$function$

CREATE OR REPLACE FUNCTION public.get_onboarding_stage_status_v1()
 RETURNS TABLE(user_id uuid, workouts_completed integer, show_stage text, stage2_completed_at timestamp with time zone, stage2_dismissed_at timestamp with time zone, stage3_completed_at timestamp with time zone, stage3_dismissed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_count int := 0;

  p record;

  v_stage2_done boolean;
  v_stage3_done boolean;

  v_show text := null;
begin
  if v_user is null then
    raise exception 'auth_missing';
  end if;

  select
    pr.id,
    pr.onboarding_stage2_completed_at,
    pr.onboarding_stage2_dismissed_at,
    pr.onboarding_stage3_completed_at,
    pr.onboarding_stage3_dismissed_at
  into p
  from public.profiles pr
  where pr.id = v_user;

  if p.id is null then
    -- no profile row, treat as none shown (stage1 gate should handle this)
    user_id := v_user;
    workouts_completed := 0;
    show_stage := null;
    stage2_completed_at := null;
    stage2_dismissed_at := null;
    stage3_completed_at := null;
    stage3_dismissed_at := null;
    return next;
    return;
  end if;

  /*
    ✅ IMPORTANT: adjust this WHERE to match your real definition of “completed workout”.
    Option A (most common): completed_at is not null
  */
  select count(*)::int
  into v_count
  from public.workout_history wh
  where wh.user_id = v_user
    and wh.completed_at is not null;

  v_stage2_done := (p.onboarding_stage2_completed_at is not null) or (p.onboarding_stage2_dismissed_at is not null);
  v_stage3_done := (p.onboarding_stage3_completed_at is not null) or (p.onboarding_stage3_dismissed_at is not null);

  /*
    Priority: Stage 3 > Stage 2
    - Stage 3 should appear when workouts >= 5 and not done.
    - Stage 2 should appear when workouts = 1 (or >=1, your choice) and not done.
  */

  if (v_count >= 5) and (not v_stage3_done) then
    v_show := 'stage3';
  elsif (v_count >= 1) and (not v_stage2_done) then
    -- If you want EXACTLY 1 workout for stage2, change to: v_count = 1
    v_show := 'stage2';
  else
    v_show := null;
  end if;

  user_id := v_user;
  workouts_completed := v_count;
  show_stage := v_show;

  stage2_completed_at := p.onboarding_stage2_completed_at;
  stage2_dismissed_at := p.onboarding_stage2_dismissed_at;
  stage3_completed_at := p.onboarding_stage3_completed_at;
  stage3_dismissed_at := p.onboarding_stage3_dismissed_at;

  return next;
end;
$function$

CREATE OR REPLACE FUNCTION public.get_onboarding_status_v1()
 RETURNS TABLE(user_id uuid, is_complete boolean, onboarding_step integer, onboarding_completed_at timestamp with time zone, onboarding_dismissed_at timestamp with time zone, missing_fields text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$declare
  v_uid uuid := auth.uid();
  p record;
  missing text[] := array[]::text[];
begin
  if v_uid is null then
    raise exception 'auth_missing';
  end if;

  select
    pr.id,
    pr.name,
    pr.height,
    pr.weight,
    pr.date_of_birth,
    pr.weekly_workout_goal,
    pr.steps_goal,
    pr.settings,
    pr.onboarding_step,
    pr.onboarding_completed_at,
    pr.onboarding_dismissed_at
  into p
  from public.profiles pr
  where pr.id = v_uid;

  if p.id is null then
    user_id := v_uid;
    is_complete := false;
    onboarding_step := 0;
    onboarding_completed_at := null;
    onboarding_dismissed_at := null;
    missing_fields := array['profile_row_missing'];
    return next;
    return;
  end if;

  if p.name is null or btrim(p.name) = '' then
    missing := array_append(missing, 'name');
  end if;

  if p.height is null or p.height < 100 or p.height > 250 then
    missing := array_append(missing, 'height');
  end if;

  if p.weight is null or p.weight < 30 or p.weight > 300 then
    missing := array_append(missing, 'weight');
  end if;

  if p.weekly_workout_goal is null or p.weekly_workout_goal < 1 or p.weekly_workout_goal > 7 then
    missing := array_append(missing, 'weekly_workout_goal');
  end if;

  if p.steps_goal is null or p.steps_goal < 0 then
    missing := array_append(missing, 'steps_goal');
  end if;

  if p.settings is null or jsonb_typeof(p.settings) <> 'object' then
    missing := array_append(missing, 'settings');
  else
    if nullif(btrim(coalesce(p.settings->>'level','')), '') is null then
      missing := array_append(missing, 'settings.level');
    end if;

    if nullif(btrim(coalesce(p.settings->>'primaryGoal','')), '') is null then
      missing := array_append(missing, 'settings.primaryGoal');
    end if;

    if nullif(btrim(coalesce(p.settings->>'unit_height','')), '') is null then
      missing := array_append(missing, 'settings.unit_height');
    end if;

    if nullif(btrim(coalesce(p.settings->>'unit_weight','')), '') is null then
      missing := array_append(missing, 'settings.unit_weight');
    end if;
  end if;

  user_id := p.id;
  onboarding_step := coalesce(p.onboarding_step, 0);
  onboarding_completed_at := p.onboarding_completed_at;
  onboarding_dismissed_at := p.onboarding_dismissed_at;
  is_complete := (array_length(missing, 1) is null) and (p.onboarding_completed_at is not null);
  missing_fields := missing;

  return next;
end;$function$

CREATE OR REPLACE FUNCTION public.get_plan_share(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_share plan_shares%rowtype;
  v_plan jsonb;
  v_workouts jsonb;
  v_goals jsonb;
begin
  -- find active share
  select * into v_share
  from plan_shares
  where token = p_token
    and is_active
    and (expires_at is null or now() < expires_at)
  limit 1;

  if not found then
    return null;
  end if;

  -- plan
  select to_jsonb(p.*) into v_plan
  from plans p
  where p.id = v_share.plan_id;

  -- workouts with nested exercises
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'plan_workout_id', pw.id,
        'title', coalesce(pw.title, w.title),
        'workout_id', w.id,
        'workout_exercises',
        (
          select jsonb_agg(
            jsonb_build_object(
              'order_index', we.order_index,
              'superset_group', we.superset_group,
              'is_dropset', we.is_dropset,
              'exercise_name', e.name
            )
            order by we.order_index nulls last
          )
          from workout_exercises we
          left join exercises e on e.id = we.exercise_id
          where we.workout_id = w.id
        )
      )
    ),
    '[]'::jsonb
  ) into v_workouts
  from plan_workouts pw
  join workouts w on w.id = pw.workout_id
  where pw.plan_id = v_share.plan_id
  order by pw.order_index;

  -- goals
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'type', g.type,
        'target_number', g.target_number,
        'unit', g.unit,
        'deadline', g.deadline,
        'notes', g.notes,
        'exercise_name', e.name
      )
    ), '[]'::jsonb
  ) into v_goals
  from goals g
  left join exercises e on e.id = g.exercise_id
  where g.plan_id = v_share.plan_id;

  return jsonb_build_object(
    'share', jsonb_build_object(
      'token', v_share.token,
      'created_at', v_share.created_at,
      'expires_at', v_share.expires_at
    ),
    'plan', v_plan,
    'workouts', v_workouts,
    'goals', v_goals
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.get_post_comments(p_post_id uuid, p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, post_id uuid, user_id uuid, user_name text, user_username text, body text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_viewer_id uuid := auth.uid();
  v_post_owner_id uuid;
  v_visibility text;
  v_allowed boolean := false;
begin
  if v_viewer_id is null then
    raise exception 'auth_missing';
  end if;

  if p_post_id is null then
    raise exception 'post_id_required';
  end if;

  select p.user_id, p.visibility
    into v_post_owner_id, v_visibility
  from public.posts p
  where p.id = p_post_id;

  if not found then
    raise exception 'post_not_found';
  end if;

  -- same visibility logic as feed/likes
  if v_post_owner_id = v_viewer_id then
    v_allowed := true;
  elsif v_visibility = 'public'
        and public.can_view_user(v_viewer_id, v_post_owner_id) then
    v_allowed := true;
  elsif v_visibility = 'followers'
        and public.can_view_user(v_viewer_id, v_post_owner_id)
        and exists (
          select 1
          from public.user_follows f
          where f.follower_id = v_viewer_id
            and f.followee_id = v_post_owner_id
        ) then
    v_allowed := true;
  elsif v_visibility = 'private'
        and v_post_owner_id = v_viewer_id then
    v_allowed := true;
  end if;

  if not v_allowed then
    raise exception 'not_allowed';
  end if;

  return query
  select
    c.id,
    c.post_id,
    c.user_id,
    p.name as user_name,
    p.username as user_username,
    c.body,
    c.created_at
  from public.post_comments c
  join public.profiles p
    on p.id = c.user_id
  where c.post_id = p_post_id
    and c.deleted_at is null
  order by c.created_at asc
  limit greatest(coalesce(p_limit, 50), 1);
end;
$function$

CREATE OR REPLACE FUNCTION public.get_post_detail_v1(p_post_id uuid)
 RETURNS TABLE(post_id uuid, user_id uuid, user_name text, user_username text, post_type text, visibility text, caption text, created_at timestamp with time zone, workout_history_id uuid, workout_snapshot jsonb, exercise_id uuid, exercise_name text, pr_snapshot jsonb, like_count integer, comment_count integer, viewer_liked boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with target as (
  select p.*
  from public.posts p
  where p.id = p_post_id
    and (
      -- own post
      p.user_id = auth.uid()

      -- public post I’m allowed to view
      or (
        p.visibility = 'public'
        and public.can_view_user(auth.uid(), p.user_id)
      )

      -- followers-only post where I follow the poster
      or (
        p.visibility = 'followers'
        and public.can_view_user(auth.uid(), p.user_id)
        and exists (
          select 1
          from public.user_follows f
          where f.follower_id = auth.uid()
            and f.followee_id = p.user_id
        )
      )

      -- private: owner only
      or (
        p.visibility = 'private'
        and p.user_id = auth.uid()
      )
    )
  limit 1
)
select
  t.id as post_id,
  t.user_id,
  pr.name as user_name,
  pr.username as user_username,
  t.post_type,
  t.visibility,
  t.caption,
  t.created_at,
  t.workout_history_id,

  ws.workout_snapshot,

  t.exercise_id,
  ex.name as exercise_name,

  t.pr_snapshot,

  coalesce(lc.cnt, 0)::int as like_count,
  coalesce(cc.cnt, 0)::int as comment_count,
  coalesce(vl.liked, false) as viewer_liked
from target t
join public.profiles pr
  on pr.id = t.user_id

left join public.exercises ex
  on ex.id = t.exercise_id

left join lateral (
  select
    case
      when t.workout_history_id is null then null
      else jsonb_build_object(
        'workout_history_id', wh.id,
        'workout_id', wh.workout_id,
        'workout_title', w.title,
        'workout_image_key', w.workout_image_key,
        'completed_at', wh.completed_at,
        'duration_seconds', wh.duration_seconds,
        'exercises_count', coalesce(x.exercises_count, 0),
        'sets_count', coalesce(x.sets_count, 0),
        'total_volume', coalesce(x.total_volume, 0)
      )
    end as workout_snapshot
  from public.workout_history wh
  left join public.workouts w
    on w.id = wh.workout_id
  left join lateral (
    select
      count(distinct weh.id)::int as exercises_count,
      count(wsh.id)::int as sets_count,
      coalesce(sum(coalesce(wsh.weight, 0) * coalesce(wsh.reps, 0)), 0)::numeric as total_volume
    from public.workout_exercise_history weh
    left join public.workout_set_history wsh
      on wsh.workout_exercise_history_id = weh.id
    where weh.workout_history_id = wh.id
  ) x on true
  where wh.id = t.workout_history_id
  limit 1
) ws on true

left join lateral (
  select count(*) as cnt
  from public.post_likes pl
  where pl.post_id = t.id
) lc on true

left join lateral (
  select count(*) as cnt
  from public.post_comments pc
  where pc.post_id = t.id
    and pc.deleted_at is null
) cc on true

left join lateral (
  select true as liked
  from public.post_likes pl
  where pl.post_id = t.id
    and pl.user_id = auth.uid()
  limit 1
) vl on true;
$function$

CREATE OR REPLACE FUNCTION public.get_post_workout_details(p_post_id uuid)
 RETURNS TABLE(workout_history_id uuid, workout_title text, completed_at timestamp with time zone, duration_seconds integer, sets_count integer, volume_kg numeric, workout_image_key text, exercises jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_viewer uuid := auth.uid();
begin
  if v_viewer is null then
    raise exception 'auth_missing';
  end if;

  if p_post_id is null then
    raise exception 'post_id_required';
  end if;

  return query
  with target_post as (
    select
      p.id,
      p.workout_history_id,
      p.workout_snapshot
    from public.posts p
    where p.id = p_post_id
      and p.post_type = 'workout'
      and public.can_view_post(v_viewer, p.id)
    limit 1
  ),
  parsed as (
    select
      tp.workout_history_id,
      tp.workout_snapshot,
      coalesce(tp.workout_snapshot ->> 'title', 'Workout') as workout_title,
      nullif(tp.workout_snapshot ->> 'completed_at', '')::timestamptz as completed_at,
      nullif(tp.workout_snapshot ->> 'duration_seconds', '')::integer as duration_seconds,
      nullif(tp.workout_snapshot ->> 'sets_count', '')::integer as sets_count,
      nullif(tp.workout_snapshot ->> 'volume_kg', '')::numeric as volume_kg,
      nullif(tp.workout_snapshot ->> 'workout_image_key', '') as workout_image_key
    from target_post tp
  )
  select
    p.workout_history_id,
    p.workout_title,
    p.completed_at,
    p.duration_seconds,
    p.sets_count,
    p.volume_kg,
    p.workout_image_key,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'workout_exercise_history_id', concat(p_post_id::text, '_ex_', ex_idx),
          'exercise_id', ex_obj ->> 'exercise_id',
          'exercise_name', ex_obj ->> 'exercise_name',
          'order_index', ex_idx,
          'sets', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', concat(p_post_id::text, '_ex_', ex_idx, '_set_', set_idx),
                'set_index', set_idx,
                'reps', case
                  when set_obj ? 'reps' then nullif(set_obj ->> 'reps', '')::numeric
                  else null
                end,
                'weight', case
                  when set_obj ? 'weight' then nullif(set_obj ->> 'weight', '')::numeric
                  else null
                end,
                'is_done', true
              )
              order by set_idx
            )
            from jsonb_array_elements(coalesce(ex_obj -> 'sets', '[]'::jsonb))
              with ordinality as s(set_obj, set_idx)
          ), '[]'::jsonb)
        )
        order by ex_idx
      )
      from jsonb_array_elements(coalesce(p.workout_snapshot -> 'exercises', '[]'::jsonb))
        with ordinality as e(ex_obj, ex_idx)
    ), '[]'::jsonb) as exercises
  from parsed p;
end;
$function$

CREATE OR REPLACE FUNCTION public.get_pr_exercise_picker_v1(p_limit integer DEFAULT 50)
 RETURNS TABLE(exercise_id uuid, exercise_name text, last_done_at timestamp with time zone, recent_best_weight numeric, prev_best_weight numeric, pr_delta numeric, is_pr boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
  with me as (
    select auth.uid() as uid
  ),

  -- all weighted sets for me (weight-based PR only)
  sets as (
    select
      weh.exercise_id,
      wh.completed_at,
      wsh.weight::numeric as weight
    from public.workout_history wh
    join me on me.uid = wh.user_id
    join public.workout_exercise_history weh
      on weh.workout_history_id = wh.id
    join public.workout_set_history wsh
      on wsh.workout_exercise_history_id = weh.id
    where wsh.weight is not null
  ),

  -- best weight per exercise per session (workout_history)
  per_session as (
    select
      exercise_id,
      completed_at,
      max(weight) as session_best_weight
    from sets
    group by 1,2
  ),

  -- most recent session per exercise
  recent_session as (
    select distinct on (exercise_id)
      exercise_id,
      completed_at as last_done_at,
      session_best_weight as recent_best_weight
    from per_session
    order by exercise_id, completed_at desc
  ),

  -- best weight BEFORE the most recent session (previous best)
  prev_best as (
    select
      r.exercise_id,
      max(p.session_best_weight) as prev_best_weight
    from recent_session r
    join per_session p
      on p.exercise_id = r.exercise_id
     and p.completed_at < r.last_done_at
    group by r.exercise_id
  )

  select
    r.exercise_id,
    e.name as exercise_name,
    r.last_done_at,
    r.recent_best_weight,
    pb.prev_best_weight,
    case
      when pb.prev_best_weight is null then 0::numeric
      else greatest(r.recent_best_weight - pb.prev_best_weight, 0)
    end as pr_delta,
    case
      when pb.prev_best_weight is null then false
      else (r.recent_best_weight > pb.prev_best_weight)
    end as is_pr
  from recent_session r
  join public.exercises e on e.id = r.exercise_id
  left join prev_best pb on pb.exercise_id = r.exercise_id
  order by
    pr_delta desc,
    r.recent_best_weight desc,
    r.last_done_at desc
  limit greatest(1, least(p_limit, 200));
$function$

CREATE OR REPLACE FUNCTION public.get_pr_exercises_v1(p_query text DEFAULT NULL::text, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_timezone text := 'UTC';
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(p.timezone, 'UTC')
    into v_timezone
  from public.profiles p
  where p.id = v_uid;

  return (
    with
    valid_sets as (
      select
        weh.exercise_id,
        e.name as exercise_name,
        wh.id as workout_history_id,
        wh.completed_at,
        wsh.weight::numeric as weight,
        wsh.reps::int as reps,
        (wsh.weight * (1 + (wsh.reps::numeric / 30.0)))::numeric as estimated_1rm
      from public.workout_history wh
      join public.workout_exercise_history weh
        on weh.workout_history_id = wh.id
      join public.workout_set_history wsh
        on wsh.workout_exercise_history_id = weh.id
      join public.exercises e
        on e.id = weh.exercise_id
      where wh.user_id = v_uid
        and wsh.weight is not null
        and wsh.weight > 0
        and wsh.reps is not null
        and wsh.reps > 0
        and (
          p_query is null
          or p_query = ''
          or e.name ilike ('%' || p_query || '%')
        )
    ),

    -- best actual lift per exercise:
    -- heaviest weight wins, then highest reps, then most recent
    ranked_best as (
      select
        vs.*,
        row_number() over (
          partition by vs.exercise_id
          order by
            vs.weight desc,
            vs.reps desc,
            vs.completed_at desc,
            vs.workout_history_id desc
        ) as rn
      from valid_sets vs
    ),

    best_per_exercise as (
      select
        exercise_id,
        exercise_name,
        workout_history_id,
        completed_at as best_achieved_at,
        weight as best_weight,
        reps as best_reps,
        estimated_1rm
      from ranked_best
      where rn = 1
    ),

    -- distinct weight levels per exercise so improvement is based on actual weight
    distinct_weight_levels as (
      select
        vs.exercise_id,
        vs.weight,
        max(vs.reps) as best_reps_at_weight
      from valid_sets vs
      group by vs.exercise_id, vs.weight
    ),

    ranked_weight_levels as (
      select
        d.exercise_id,
        d.weight,
        d.best_reps_at_weight,
        row_number() over (
          partition by d.exercise_id
          order by d.weight desc
        ) as weight_rank
      from distinct_weight_levels d
    ),

    previous_best as (
      select
        exercise_id,
        weight as previous_best_weight,
        best_reps_at_weight as previous_best_reps
      from ranked_weight_levels
      where weight_rank = 2
    ),

    items as (
      select
        jsonb_build_object(
          'exercise_id', b.exercise_id,
          'exercise_name', b.exercise_name,
          'best_weight', b.best_weight,
          'best_reps', b.best_reps,
          'estimated_1rm', round(b.estimated_1rm, 1),
          'best_achieved_at', b.best_achieved_at,
          'workout_history_id', b.workout_history_id,
          'previous_best_weight', p.previous_best_weight,
          'previous_best_reps', p.previous_best_reps,
          'delta_weight',
            case
              when p.previous_best_weight is null then null
              else (b.best_weight - p.previous_best_weight)
            end
        ) as item,
        b.exercise_name,
        b.best_weight,
        b.best_achieved_at
      from best_per_exercise b
      left join previous_best p
        on p.exercise_id = b.exercise_id
      order by b.best_achieved_at desc, b.exercise_name asc
      limit greatest(1, least(p_limit, 100))
    )

    select jsonb_build_object(
      'meta', jsonb_build_object(
        'generated_at', now(),
        'timezone', v_timezone,
        'unit', 'kg'
      ),
      'items', coalesce(
        (select jsonb_agg(item order by best_achieved_at desc, exercise_name asc) from items),
        '[]'::jsonb
      )
    )
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.get_profile_card_v1(p_profile_id uuid)
 RETURNS TABLE(profile_id uuid, name text, username text, is_private boolean, can_view boolean, follow_state text, workouts_completed integer, followers_count integer, following_count integer, recent_posts jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_viewer uuid := auth.uid();
  v_is_private boolean;
  v_can_view boolean := false;
  v_following boolean := false;
  v_requested boolean := false;
begin
  if v_viewer is null then
    raise exception 'auth_missing';
  end if;

  if p_profile_id is null then
    raise exception 'profile_id_required';
  end if;

  -- Block gate (either direction): return no rows if blocked
  if exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = v_viewer and b.blocked_id = p_profile_id)
       or (b.blocker_id = p_profile_id and b.blocked_id = v_viewer)
  ) then
    return;
  end if;

  -- Must exist (also fetch privacy)
  select p.is_private
    into v_is_private
  from public.profiles p
  where p.id = p_profile_id;

  if not found then
    return;
  end if;

  -- follow state + visibility gate
  if p_profile_id = v_viewer then
    v_can_view := true;
    follow_state := 'self';
  else
    v_following := exists (
      select 1
      from public.user_follows f
      where f.follower_id = v_viewer
        and f.followee_id = p_profile_id
    );

    v_requested := exists (
      select 1
      from public.follow_requests r
      where r.requester_id = v_viewer
        and r.target_id = p_profile_id
        and r.status = 'pending'
    );

    if v_following then
      follow_state := 'following';
    elsif v_requested then
      follow_state := 'requested';
    else
      follow_state := 'none';
    end if;

    -- profile visibility gate (mirror profiles_select_visible intent)
    if v_is_private = false then
      v_can_view := true;
    else
      -- private: only followers can view
      v_can_view := v_following;
    end if;
  end if;

  can_view := v_can_view;

  -- Always return top identity bits (for search results / modal)
  select p.id, p.name, p.username, p.is_private
    into profile_id, name, username, is_private
  from public.profiles p
  where p.id = p_profile_id;

  -- If viewer can't view: return minimal card + null stats
  if not v_can_view then
    workouts_completed := null;
    followers_count := null;
    following_count := null;
    recent_posts := '[]'::jsonb;
    return next;
    return;
  end if;

  -- Stats (safe via SECURITY DEFINER + block gate above + can_view)
  select count(*)::int
    into workouts_completed
  from public.workout_history wh
  where wh.user_id = p_profile_id;

  select count(*)::int
    into followers_count
  from public.user_follows f
  where f.followee_id = p_profile_id;

  select count(*)::int
    into following_count
  from public.user_follows f
  where f.follower_id = p_profile_id;

  -- Recent posts (only those viewer is allowed to see)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'post_id', p.id,
        'post_type', p.post_type,
        'visibility', p.visibility,
        'caption', p.caption,
        'created_at', p.created_at
      )
      order by p.created_at desc, p.id desc
    ),
    '[]'::jsonb
  )
  into recent_posts
  from (
    select p.*
    from public.posts p
    where p.user_id = p_profile_id
      and public.can_view_post(v_viewer, p.id)
    order by p.created_at desc, p.id desc
    limit 3
  ) p;

  return next;
end;
$function$

CREATE OR REPLACE FUNCTION public.get_profile_overview()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with
me as (
  select auth.uid() as user_id
),

p as (
  select
    pr.*,
    pr.settings as s
  from public.profiles pr
  join me on me.user_id = pr.id
),

/*
  Week window is ALWAYS Monday -> Sunday (independent of when a plan was created).
  We compute it in the user's timezone, then convert to UTC timestamps for safe
  comparison against timestamptz columns like workout_history.completed_at.
*/
wk as (
  select
    coalesce(p.timezone, 'UTC') as tz,

    -- Monday-based start of week in user's timezone (DATE)
    date_trunc('week', (now() at time zone coalesce(p.timezone, 'UTC')))::date as week_start,

    -- UTC range [start, end) for comparing to timestamptz
    (date_trunc('week', (now() at time zone coalesce(p.timezone, 'UTC')))::timestamp
      at time zone coalesce(p.timezone, 'UTC')) as week_start_utc,

    ((date_trunc('week', (now() at time zone coalesce(p.timezone, 'UTC')))::timestamp + interval '7 days')
      at time zone coalesce(p.timezone, 'UTC')) as week_end_utc
  from p
),

counts as (
  select
    -- workouts
    (select count(*)::int
     from public.workout_history wh
     join me on wh.user_id = me.user_id) as workouts_total,

    -- followers / following
    (select count(*)::int
     from public.user_follows uf
     join me on uf.followee_id = me.user_id) as followers_count,

    (select count(*)::int
     from public.user_follows uf
     join me on uf.follower_id = me.user_id) as following_count
),

onboarding as (
  select
    (
      (p.name is not null and btrim(p.name) <> '')
      and (p.s ? 'level') and coalesce(nullif(p.s->>'level',''), '') <> ''
      and (p.s ? 'primaryGoal') and coalesce(nullif(p.s->>'primaryGoal',''), '') <> ''
    ) as has_saved_details,

    ((select workouts_total from counts) > 0) as has_completed_workout,

    exists (
      select 1
      from public.user_follows uf
      join me on uf.follower_id = me.user_id
      where uf.followee_id = 'edd59ea0-adf0-4a72-bc7c-6d6967cf8eb0'::uuid
    ) as has_followed_official
  from p
),

onboarding_rollup as (
  select
    has_saved_details,
    has_completed_workout,
    has_followed_official,
    (
      (case when has_saved_details then 1 else 0 end) +
      (case when has_completed_workout then 1 else 0 end) +
      (case when has_followed_official then 1 else 0 end)
    )::int as done_count,
    3::int as total_count
  from onboarding
),

profile_variant as (
  select
    case
      when (select workouts_total from counts) < 5 then 'new_user'
      when p.active_plan_id is not null then 'experienced_with_plan'
      else 'experienced_no_plan'
    end as variant
  from p
),

active_plan_base as (
  select
    pl.id as plan_id,
    pl.title,
    pl.start_date,
    pl.end_date,
    coalesce(pl.weekly_target_sessions, p.weekly_workout_goal)::int as weekly_target_sessions
  from p
  left join public.plans pl on pl.id = p.active_plan_id
),

plan_math as (
  select
    ap.*,
    wk.week_start,

    case
      when ap.plan_id is null then null
      when ap.start_date is null or ap.end_date is null then null
      else ceil(((ap.end_date - ap.start_date + 1)::numeric) / 7.0)::int
    end as weeks_total_raw,

    case
      when ap.plan_id is null then null
      when ap.start_date is null then null
      else (floor(((wk.week_start - ap.start_date)::numeric) / 7.0)::int + 1)
    end as week_index_raw
  from active_plan_base ap
  cross join wk
),

plan_math_clamped as (
  select
    pm.plan_id,
    pm.title,
    pm.start_date,
    pm.end_date,
    pm.weekly_target_sessions,
    pm.week_start,

    pm.weeks_total_raw as weeks_total,

    case
      when pm.week_index_raw is null then null
      when pm.weeks_total_raw is null then greatest(pm.week_index_raw, 1)
      else greatest(1, least(pm.week_index_raw, pm.weeks_total_raw))
    end as week_index
  from plan_math pm
),

plan_remaining as (
  select
    pmc.*,

    case
      when pmc.plan_id is null then null
      when pmc.weeks_total is null or pmc.week_index is null then null
      else greatest(pmc.weeks_total - pmc.week_index, 0)
    end as weeks_left_future,

    case
      when pmc.plan_id is null then null
      when pmc.weeks_total is null or pmc.week_index is null then null
      else greatest(pmc.weeks_total - pmc.week_index, 0) * pmc.weekly_target_sessions
    end as planned_workouts_left
  from plan_math_clamped pmc
),

completed_this_week as (
  select
    pr.plan_id,
    coalesce(count(*)::int, 0) as completed_this_week
  from plan_remaining pr
  join me on true
  join wk on true
  join public.workout_history wh
    on wh.user_id = me.user_id
  where pr.plan_id is not null
    and wh.workout_id is not null
    -- Monday->Sunday window, computed in user's timezone, compared in UTC
    and wh.completed_at >= wk.week_start_utc
    and wh.completed_at <  wk.week_end_utc
    and exists (
      select 1
      from public.plan_workouts pw
      where pw.plan_id = pr.plan_id
        and pw.workout_id = wh.workout_id
        and pw.is_archived = false
    )
  group by pr.plan_id
),

activity as (
  select
    p.weekly_streak::int as weekly_streak,
    coalesce(uss.streak_current, 0)::int as steps_streak_days,

    (select count(*)::int
     from public.user_achievements ua
     join me on ua.user_id = me.user_id) as achievements_unlocked,

    (select count(*)::int from public.achievements a) as achievements_total
  from p
  left join public.user_steps_stats uss on uss.user_id = p.id
),

fav_achievement_ids as (
  select
    elems.value::uuid as achievement_id,
    elems.ordinality
  from p
  cross join lateral jsonb_array_elements_text(p.s->'favourite_achievements')
    with ordinality as elems(value, ordinality)
  where p.s ? 'favourite_achievements'
),

favourite_achievements as (
  select jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'title', a.title,
      'category', a.category,
      'difficulty', a.difficulty,
      'description', a.description
    )
    order by f.ordinality
  ) as items
  from (
    select * from fav_achievement_ids order by ordinality limit 3
  ) f
  join public.achievements a on a.id = f.achievement_id
),

recent_plans as (
  select jsonb_agg(
    jsonb_build_object(
      'id', pl.id,
      'title', pl.title,
      'start_date', pl.start_date,
      'end_date', pl.end_date,
      'is_completed', pl.is_completed,
      'completed_at', pl.completed_at
    )
    order by coalesce(pl.completed_at, pl.updated_at, pl.created_at) desc
  ) as items
  from (
    select *
    from public.plans pl
    join me on pl.user_id = me.user_id
    order by coalesce(pl.completed_at, pl.updated_at, pl.created_at) desc
    limit 3
  ) pl
),

recent_history as (
  select jsonb_agg(
    jsonb_build_object(
      'workout_history_id', x.id,
      'completed_at', x.completed_at,
      'duration_seconds', x.duration_seconds,
      'workout_title', x.workout_title,
      'volume', x.volume
    )
    order by x.completed_at desc
  ) as items
  from (
    select
      wh.id,
      wh.completed_at,
      wh.duration_seconds,
      coalesce(w.title, 'Workout') as workout_title,
      coalesce(sum(coalesce(wsh.reps,0)::numeric * coalesce(wsh.weight,0)::numeric), 0)::numeric as volume
    from public.workout_history wh
    join me on wh.user_id = me.user_id
    left join public.workouts w on w.id = wh.workout_id
    left join public.workout_exercise_history weh on weh.workout_history_id = wh.id
    left join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
    group by wh.id, wh.completed_at, wh.duration_seconds, w.title
    order by wh.completed_at desc
    limit 3
  ) x
),

recent_posts as (
  select jsonb_agg(
    jsonb_build_object(
      'post_id', p2.id,
      'post_type', p2.post_type,
      'caption', p2.caption,
      'created_at', p2.created_at,
      'workout_history_id', p2.workout_history_id,
      'exercise_id', p2.exercise_id,
      'pr_snapshot', p2.pr_snapshot,
      'likes_count', p2.likes_count,
      'comments_count', p2.comments_count
    )
    order by p2.created_at desc
  ) as items
  from (
    select
      po.*,
      (select count(*)::int from public.post_likes pl where pl.post_id = po.id) as likes_count,
      (select count(*)::int from public.post_comments pc where pc.post_id = po.id and pc.deleted_at is null) as comments_count
    from public.posts po
    join me on po.user_id = me.user_id
    order by po.created_at desc
    limit 3
  ) p2
)

select jsonb_build_object(
  'profile_variant', (select variant from profile_variant),

  'user', jsonb_build_object(
    'id', (select id from p),
    'name', (select name from p),
    'username', (select username from p),
    'username_lower', (select username_lower from p),
    'joined_at', (select created_at from p),
    'level', (select s->>'level' from p),
    'primary_goal', (select s->>'primaryGoal' from p),

    -- ✅ NEW: visibility replaces is_private
    'visibility', (select visibility from p)
  ),

  'counts', jsonb_build_object(
    'workouts_total', (select workouts_total from counts),
    'followers_count', (select followers_count from counts),
    'following_count', (select following_count from counts)
  ),

  'onboarding', jsonb_build_object(
    'required', jsonb_build_object(
      'has_saved_details', (select has_saved_details from onboarding_rollup),
      'has_completed_workout', (select has_completed_workout from onboarding_rollup),
      'has_followed_official', (select has_followed_official from onboarding_rollup)
    ),
    'done_count', (select done_count from onboarding_rollup),
    'total_count', (select total_count from onboarding_rollup),
    'progress_pct', round(((select done_count from onboarding_rollup)::numeric / 3.0) * 100)::int,
    'next_action_key',
      case
        when not (select has_saved_details from onboarding_rollup) then 'save_details'
        when not (select has_completed_workout from onboarding_rollup) then 'complete_workout'
        when not (select has_followed_official from onboarding_rollup) then 'follow_official'
        else 'done'
      end
  ),

  'active_plan',
    case
      when (select plan_id from plan_remaining) is null then null
      else jsonb_build_object(
        'plan_id', (select plan_id from plan_remaining),
        'title', (select title from plan_remaining),
        'start_date', (select start_date from plan_remaining),
        'end_date', (select end_date from plan_remaining),
        'weekly_target_sessions', (select weekly_target_sessions from plan_remaining),
        'week_start', (select week_start from plan_remaining),
        'week_index', (select week_index from plan_remaining),
        'weeks_total', (select weeks_total from plan_remaining),
        'weeks_left_future', (select weeks_left_future from plan_remaining),
        'planned_workouts_left', (select planned_workouts_left from plan_remaining),
        'completed_this_week', coalesce((select completed_this_week from completed_this_week), 0),
        'weekly_progress_pct',
          case
            when (select weekly_target_sessions from plan_remaining) is null
              or (select weekly_target_sessions from plan_remaining) = 0
              then 0
            else least(
              100,
              round(
                coalesce((select completed_this_week from completed_this_week), 0)::numeric
                / (select weekly_target_sessions from plan_remaining)::numeric
                * 100
              )::int
            )
          end
      )
    end,

  'activity', jsonb_build_object(
    'weekly_streak', (select weekly_streak from activity),
    'steps_streak_days', (select steps_streak_days from activity),
    'achievements_unlocked', (select achievements_unlocked from activity),
    'achievements_total', (select achievements_total from activity),
    'achievements_pct',
      case
        when (select achievements_total from activity) = 0 then 0
        else round(
          (select achievements_unlocked from activity)::numeric
          / (select achievements_total from activity)::numeric
          * 100
        )::int
      end
  ),

  'favourite_achievements', coalesce((select items from favourite_achievements), '[]'::jsonb),
  'recent_plans', coalesce((select items from recent_plans), '[]'::jsonb),
  'recent_history', coalesce((select items from recent_history), '[]'::jsonb),
  'recent_posts', coalesce((select items from recent_posts), '[]'::jsonb)
);
$function$

CREATE OR REPLACE FUNCTION public.get_profile_overview_v1(p_profile_id uuid)
 RETURNS TABLE(profile_id uuid, name text, username text, visibility text, follow_state text, can_view boolean, workouts_completed integer, followers_count integer, following_count integer, recent_posts jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$declare
  v_viewer uuid := auth.uid();
  v_visibility profile_visibility;
  v_can_view boolean := false;
  v_following boolean := false;
  v_requested boolean := false;
begin
  if v_viewer is null then
    raise exception 'auth_missing';
  end if;

  if p_profile_id is null then
    raise exception 'profile_id_required';
  end if;

  -- Block gate (either direction)
  if exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = v_viewer and b.blocked_id = p_profile_id)
       or (b.blocker_id = p_profile_id and b.blocked_id = v_viewer)
  ) then
    return;
  end if;

  -- Must exist + fetch visibility
  select p.visibility
    into v_visibility
  from public.profiles p
  where p.id = p_profile_id;

  if not found then
    return;
  end if;

  -- Follow state logic
  if p_profile_id = v_viewer then
    follow_state := 'self';
    v_can_view := true;
  else
    v_following := exists (
      select 1
      from public.user_follows f
      where f.follower_id = v_viewer
        and f.followee_id = p_profile_id
    );

    v_requested := exists (
      select 1
      from public.follow_requests r
      where r.requester_id = v_viewer
        and r.target_id = p_profile_id
        and r.status = 'pending'
    );

    if v_following then
      follow_state := 'following';
    elsif v_requested then
      follow_state := 'requested';
    else
      follow_state := 'none';
    end if;

    if v_visibility = 'public' then
      v_can_view := true;
    elsif v_visibility = 'followers' then
      v_can_view := v_following;
    elsif v_visibility = 'private' then
      v_can_view := false;
    end if;
  end if;

  can_view := v_can_view;

  -- Always return identity bits
  select p.id, p.name, p.username, p.visibility::text
    into profile_id, name, username, visibility
  from public.profiles p
  where p.id = p_profile_id;

  -- If viewer cannot view full profile → return minimal
  if not v_can_view then
    workouts_completed := null;
    followers_count := null;
    following_count := null;
    recent_posts := '[]'::jsonb;
    return next;
    return;
  end if;

  -- Stats
  select count(*)::int
    into workouts_completed
  from public.workout_history wh
  where wh.user_id = p_profile_id;

  select count(*)::int
    into followers_count
  from public.user_follows f
  where f.followee_id = p_profile_id;

  select count(*)::int
    into following_count
  from public.user_follows f
  where f.follower_id = p_profile_id;

  -- Recent posts (feed-like payload)
  -- NOTE:
  -- Replace public.post_likes / public.post_comments below if your actual table names differ.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'post_id', rp.id,
        'user_id', rp.user_id,
        'user_name', rp.user_name,
        'user_username', rp.user_username,
        'post_type', rp.post_type,
        'visibility', rp.visibility,
        'caption', rp.caption,
        'created_at', rp.created_at,
        'like_count', rp.like_count,
        'comment_count', rp.comment_count,
        'viewer_liked', rp.viewer_liked,
        'workout_history_id', rp.workout_history_id,
        'exercise_id', rp.exercise_id,
        'exercise_name', rp.exercise_name,
        'workout_snapshot', rp.workout_snapshot,
        'pr_snapshot', rp.pr_snapshot
      )
      order by rp.created_at desc, rp.id desc
    ),
    '[]'::jsonb
  )
  into recent_posts
  from (
    select
      p.id,
      p.user_id,
      pr.name as user_name,
      pr.username as user_username,
      p.post_type,
      p.visibility::text as visibility,
      p.caption,
      p.created_at,
      p.workout_history_id,
      p.exercise_id,
      ex.name as exercise_name,
      p.pr_snapshot,

      case
        when p.post_type = 'workout' then jsonb_build_object(
          'workout_title', coalesce(w.title, 'Workout'),
          'total_volume', coalesce(ws.total_volume, 0),
          'sets_count', coalesce(ws.sets_count, 0),
          'exercises_count', coalesce(ws.exercises_count, 0),
          'workout_image_key', w.workout_image_key
        )
        else null
      end as workout_snapshot,

      (
        select count(*)::int
        from public.post_likes pl
        where pl.post_id = p.id
      ) as like_count,

      (
        select count(*)::int
        from public.post_comments pc
        where pc.post_id = p.id
      ) as comment_count,

      exists (
        select 1
        from public.post_likes vpl
        where vpl.post_id = p.id
          and vpl.user_id = v_viewer
      ) as viewer_liked

    from public.posts p
    join public.profiles pr
      on pr.id = p.user_id
    left join public.exercises ex
      on ex.id = p.exercise_id
    left join public.workout_history wh
      on wh.id = p.workout_history_id
    left join public.workouts w
      on w.id = wh.workout_id
    left join lateral (
      select
        coalesce(sum(coalesce(wsh.weight, 0) * coalesce(wsh.reps, 0)), 0)::numeric as total_volume,
        count(*)::int as sets_count,
        count(distinct weh.id)::int as exercises_count
      from public.workout_exercise_history weh
      left join public.workout_set_history wsh
        on wsh.workout_exercise_history_id = weh.id
      where weh.workout_history_id = p.workout_history_id
    ) ws on true
    where p.user_id = p_profile_id
      and public.can_view_post(v_viewer, p.id)
    order by p.created_at desc, p.id desc
    limit 3
  ) rp;

  return next;
end;$function$

CREATE OR REPLACE FUNCTION public.get_progress_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := (select auth.uid());

  v_timezone text := 'UTC';
  v_now timestamptz := now();

  v_workouts_total int := 0;
  v_last_workout_at timestamptz := null;
  v_days_since_last_workout int := null;

  -- consumer features are available to every authenticated user
  v_can_view_deep_analytics boolean := true;

  -- outputs
  v_meta jsonb := '{}'::jsonb;
  v_momentum jsonb := '{}'::jsonb;
  v_consistency jsonb := '{}'::jsonb;
  v_highlights jsonb := '{}'::jsonb;
  v_exercise_summary jsonb := '{}'::jsonb;
  v_recent_activity jsonb := '{}'::jsonb;

  -- tweakable thresholds
  v_pr_eps numeric := 0.05; -- minimum e1RM improvement to count as a "new PR"
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Deep analytics is available to all authenticated users.
  v_can_view_deep_analytics := true;

  /* --------------------------
     Profile meta
     -------------------------- */
  select coalesce(p.timezone, 'UTC')
    into v_timezone
  from public.profiles p
  where p.id = v_user_id;

  /* --------------------------
     Totals + last workout
     -------------------------- */
  select
    count(*)::int,
    max(wh.completed_at)
  into
    v_workouts_total,
    v_last_workout_at
  from public.workout_history wh
  where wh.user_id = v_user_id;

  if v_last_workout_at is not null then
    v_days_since_last_workout :=
      floor(extract(epoch from (v_now - v_last_workout_at)) / 86400)::int;
  end if;

  v_meta := jsonb_build_object(
    'user_id', v_user_id,
    'generated_at', v_now,
    'timezone', v_timezone,
    'unit', 'kg',
    'workouts_total', coalesce(v_workouts_total, 0),
    'last_workout_at', v_last_workout_at,
    'days_since_last_workout', v_days_since_last_workout,
    'can_view_deep_analytics', v_can_view_deep_analytics
  );

  /* --------------------------
     Momentum (30d workouts, streak days, 30d volume + prev 30d comparisons)
     -------------------------- */
  with
  w30 as (
    select count(*)::int as workouts_30d
    from public.workout_history wh
    where wh.user_id = v_user_id
      and wh.completed_at >= (v_now - interval '30 days')
  ),
  w_prev30 as (
    select count(*)::int as workouts_prev_30d
    from public.workout_history wh
    where wh.user_id = v_user_id
      and wh.completed_at <  (v_now - interval '30 days')
      and wh.completed_at >= (v_now - interval '60 days')
  ),
  streak_days as (
    with days as (
      select
        ((v_now at time zone v_timezone)::date - offs)::date as d,
        exists (
          select 1
          from public.workout_history wh
          where wh.user_id = v_user_id
            and (wh.completed_at at time zone v_timezone)::date
              = ((v_now at time zone v_timezone)::date - offs)::date
        ) as trained
      from generate_series(0, 60, 1) as offs
    ),
    grp as (
      select
        d,
        trained,
        sum(case when trained then 0 else 1 end) over (order by d desc) as break_group
      from days
    )
    select count(*)::int as streak_days
    from grp
    where break_group = 0 and trained = true
  ),
  vol30 as (
    select coalesce(sum((wsh.weight * wsh.reps)::numeric), 0)::numeric as volume_30d
    from public.workout_set_history wsh
    join public.workout_exercise_history weh on weh.id = wsh.workout_exercise_history_id
    join public.workout_history wh on wh.id = weh.workout_history_id
    where wh.user_id = v_user_id
      and wh.completed_at >= (v_now - interval '30 days')
      and wsh.weight is not null and wsh.weight > 0
      and wsh.reps is not null and wsh.reps > 0
  ),
  vol_prev30 as (
    select coalesce(sum((wsh.weight * wsh.reps)::numeric), 0)::numeric as volume_prev_30d
    from public.workout_set_history wsh
    join public.workout_exercise_history weh on weh.id = wsh.workout_exercise_history_id
    join public.workout_history wh on wh.id = weh.workout_history_id
    where wh.user_id = v_user_id
      and wh.completed_at <  (v_now - interval '30 days')
      and wh.completed_at >= (v_now - interval '60 days')
      and wsh.weight is not null and wsh.weight > 0
      and wsh.reps is not null and wsh.reps > 0
  ),
  status as (
    select
      case
        when coalesce(v_workouts_total, 0) < 5 then 'new_user'
        when coalesce(v_days_since_last_workout, 0) >= 10 then 'returning'
        when (select workouts_30d from w30) >= 12
          or (select streak_days from streak_days) >= 7 then 'on_fire'
        else 'steady'
      end as status
  )
  select jsonb_build_object(
    'status', (select status from status),
    'headline',
      case (select status from status)
        when 'new_user' then 'Let’s build your momentum.'
        when 'returning' then 'Welcome back — pick up where you left off.'
        when 'on_fire' then 'You’re on fire!'
        else 'Steady progress.'
      end,
    'subhead',
      case (select status from status)
        when 'new_user' then 'Log a few workouts to unlock deeper insights.'
        when 'returning' then 'Your progress is saved. One session gets you rolling again.'
        when 'on_fire' then 'Consistency is compounding.'
        else 'Keep the streak alive and nudge the trend upward.'
      end,
    'workouts_30d', (select workouts_30d from w30),
    'volume_30d', round((select volume_30d from vol30), 0),
    'workouts_prev_30d', (select workouts_prev_30d from w_prev30),
    'volume_prev_30d', round((select volume_prev_30d from vol_prev30), 0),
    'streak_days', (select streak_days from streak_days),
    'unit', 'kg'
  )
  into v_momentum;

  /* --------------------------
     Consistency (last 6 months)
     -------------------------- */
  with
  bounds as (
    select date_trunc('month', (v_now at time zone v_timezone))::date as this_month_start
  ),
  months as (
    select (b.this_month_start - (gs.i || ' months')::interval)::date as month_start
    from bounds b
    cross join generate_series(5, 0, -1) as gs(i)
  ),
  base as (
    select
      date_trunc('month', (wh.completed_at at time zone v_timezone))::date as month_start,
      count(*)::int as workouts_completed
    from public.workout_history wh
    where wh.user_id = v_user_id
      and (wh.completed_at at time zone v_timezone) >= (select min(month_start) from months)
      and (wh.completed_at at time zone v_timezone) <  (select max(month_start) + interval '1 month' from months)
    group by 1
  ),
  joined as (
    select
      m.month_start,
      coalesce(b.workouts_completed, 0) as workouts_completed
    from months m
    left join base b using (month_start)
    order by m.month_start asc
  ),
  last_two as (
    select
      (select workouts_completed from joined order by month_start desc limit 1) as cur_mo,
      (select workouts_completed from joined order by month_start desc offset 1 limit 1) as prev_mo
  ),
  delta as (
    select
      case
        when prev_mo is null or prev_mo = 0 then null
        else round(((cur_mo - prev_mo)::numeric / prev_mo::numeric) * 100.0, 1)
      end as delta_pct,
      case
        when prev_mo is null then 'flat'
        when cur_mo > prev_mo then 'up'
        when cur_mo < prev_mo then 'down'
        else 'flat'
      end as trend
    from last_two
  )
  select jsonb_build_object(
    'period','month',
    'months', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key', to_char(month_start, 'YYYY-MM'),
          'label', upper(to_char(month_start, 'Mon')),
          'workouts_completed', workouts_completed
        )
        order by month_start asc
      ),
      '[]'::jsonb
    ),
    'delta_vs_last_month_pct', (select delta_pct from delta),
    'trend', (select trend from delta)
  )
  into v_consistency
  from joined;

  /* --------------------------
     Strength highlights (STRICT PR improvements only)
     -------------------------- */
  with
  sets as (
    select
      wsh.id as set_id,
      weh.exercise_id,
      e.name as exercise_name,
      wh.completed_at,
      wsh.weight::numeric as weight_kg,
      wsh.reps::int as reps,
      (wsh.weight * (1 + (wsh.reps::numeric / 30.0))) as e1rm_kg
    from public.workout_set_history wsh
    join public.workout_exercise_history weh on weh.id = wsh.workout_exercise_history_id
    join public.workout_history wh on wh.id = weh.workout_history_id
    join public.exercises e on e.id = weh.exercise_id
    where wh.user_id = v_user_id
      and wsh.weight is not null and wsh.weight > 0
      and wsh.reps is not null and wsh.reps > 0
      and wh.completed_at >= v_now - interval '180 days'
  ),
  ranked as (
    select
      *,
      max(e1rm_kg) over (
        partition by exercise_id
        order by completed_at, set_id
        rows between unbounded preceding and 1 preceding
      ) as best_before
    from sets
  ),
  pr_hits as (
    select *
    from ranked
    where best_before is null
       or e1rm_kg >= best_before + v_pr_eps
  ),
  pr_series as (
    select
      exercise_id,
      exercise_name,
      completed_at,
      set_id,
      weight_kg,
      reps,
      e1rm_kg,
      best_before as prev_pr_kg
    from pr_hits
  ),
  latest as (
    select *
    from pr_series
    order by completed_at desc, e1rm_kg desc, set_id desc
    limit 1
  ),
  per_exercise_latest as (
    select distinct on (exercise_id)
      exercise_id,
      exercise_name,
      completed_at,
      weight_kg,
      reps,
      e1rm_kg,
      prev_pr_kg
    from pr_series
    order by exercise_id, completed_at desc, e1rm_kg desc, set_id desc
  ),
  top_recent as (
    select *
    from per_exercise_latest
    order by completed_at desc
    limit 6
  )
  select jsonb_build_object(
    'primary',
      case when (select count(*) from latest) = 0 then null else
        (select jsonb_build_object(
          'type', case when v_workouts_total <= 1 then 'milestone' else 'new_pr' end,
          'title', case when v_workouts_total <= 1 then 'Journey started!' else 'New Personal Best!' end,
          'subtitle', (latest.exercise_name || ': ' || trim(to_char(latest.weight_kg, 'FM9999990.0')) || 'kg × ' || latest.reps),
          'achieved_at', latest.completed_at,
          'exercise_id', latest.exercise_id
        ) from latest)
      end,
    'cards', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'exercise_id', t.exercise_id,
          'exercise_name', t.exercise_name,
          'e1rm', round(t.e1rm_kg, 1),
          'best_weight', round(t.weight_kg, 1),
          'best_reps', t.reps,
          'achieved_at', t.completed_at,
          'delta_abs',
            case
              when t.prev_pr_kg is null then null
              else round((t.e1rm_kg - t.prev_pr_kg), 1)
            end
        )
        order by t.completed_at desc
      ) from top_recent t),
      '[]'::jsonb
    )
  )
  into v_highlights;

  /* --------------------------
     Exercise summary (Deep Analytics picker)
     -------------------------- */
  with
  base_180 as (
    select
      weh.exercise_id,
      max(wh.completed_at) as last_done_at,
      count(distinct wh.id) filter (where wh.completed_at >= v_now - interval '30 days')::int as sessions_30d,
      count(distinct wh.id) filter (where wh.completed_at <  v_now - interval '30 days'
                                    and wh.completed_at >= v_now - interval '60 days')::int as sessions_prev_30d,
      count(distinct wh.id) filter (where wh.completed_at >= v_now - interval '180 days')::int as sessions_180d
    from public.workout_exercise_history weh
    join public.workout_history wh on wh.id = weh.workout_history_id
    where wh.user_id = v_user_id
      and wh.completed_at >= v_now - interval '180 days'
    group by weh.exercise_id
  ),
  eligible as (
    select
      b.exercise_id,
      e.name as exercise_name,
      b.sessions_30d,
      b.sessions_prev_30d,
      b.sessions_180d,
      b.last_done_at,
      case
        when b.sessions_prev_30d is null then 'flat'
        when b.sessions_30d > b.sessions_prev_30d then 'up'
        when b.sessions_30d < b.sessions_prev_30d then 'down'
        else 'flat'
      end as trend
    from base_180 b
    join public.exercises e on e.id = b.exercise_id
    where b.sessions_180d >= 3
  ),
  best_picks as (
    select *
    from eligible
    order by sessions_30d desc, last_done_at desc
    limit 5
  ),
  eligible_sorted as (
    select *
    from eligible
    order by sessions_30d desc, last_done_at desc
  )
  select jsonb_build_object(
    'min_sessions', 3,
    'best_picks',
      case
        when v_can_view_deep_analytics then coalesce(
          (select jsonb_agg(
            jsonb_build_object(
              'exercise_id', x.exercise_id,
              'exercise_name', x.exercise_name,
              'sessions_30d', x.sessions_30d,
              'sessions_180d', x.sessions_180d,
              'last_done_at', x.last_done_at,
              'trend', x.trend
            )
          ) from best_picks x),
          '[]'::jsonb
        )
        else '[]'::jsonb
      end,
    'eligible_exercises',
      case
        when v_can_view_deep_analytics then coalesce(
          (select jsonb_agg(
            jsonb_build_object(
              'exercise_id', x.exercise_id,
              'exercise_name', x.exercise_name,
              'sessions_30d', x.sessions_30d,
              'sessions_180d', x.sessions_180d,
              'last_done_at', x.last_done_at,
              'trend', x.trend
            )
          ) from eligible_sorted x),
          '[]'::jsonb
        )
        else '[]'::jsonb
      end,
    'prompt',
      case
        when v_workouts_total < 5 then jsonb_build_object(
          'title','Your data is building up',
          'subtitle','Complete more workouts to unlock deep analytics.'
        )
        when not v_can_view_deep_analytics then jsonb_build_object(
          'title','Deep analytics available',
          'subtitle','Choose an exercise to explore trends, comparisons, and deeper exercise insights.'
        )
        when (select count(*) from eligible) = 0 then jsonb_build_object(
          'title','Deep analytics locked',
          'subtitle','Repeat an exercise across 3 workouts to unlock trends and projections.'
        )
        else null
      end
  )
  into v_exercise_summary;

  /* --------------------------
     Recent activity (LAST 5)
     -------------------------- */
  with
  last_wh as (
    select wh.*
    from public.workout_history wh
    where wh.user_id = v_user_id
    order by wh.completed_at desc
    limit 5
  ),
  headers as (
    select
      wh.id as workout_history_id,
      wh.workout_id,
      coalesce(
        w.title,
        'Quick Start · ' || to_char((wh.completed_at at time zone v_timezone), 'DD Mon')
      ) as title,
      wh.completed_at,
      wh.duration_seconds
    from last_wh wh
    left join public.workouts w on w.id = wh.workout_id
  ),
  cur_volume as (
    select
      h.workout_history_id,
      coalesce(sum((wsh.weight * wsh.reps)::numeric), 0)::numeric as volume_total
    from headers h
    left join public.workout_exercise_history weh
      on weh.workout_history_id = h.workout_history_id
    left join public.workout_set_history wsh
      on wsh.workout_exercise_history_id = weh.id
      and wsh.weight is not null and wsh.weight > 0
      and wsh.reps is not null and wsh.reps > 0
    group by h.workout_history_id
  ),
  prev_same_workout as (
    select
      h.workout_history_id,
      case
        when h.workout_id is null then null
        else (
          select wh2.id
          from public.workout_history wh2
          where wh2.user_id = v_user_id
            and wh2.workout_id = h.workout_id
            and wh2.completed_at < h.completed_at
          order by wh2.completed_at desc
          limit 1
        )
      end as prev_workout_history_id
    from headers h
  ),
  prev_volume as (
    select
      p.workout_history_id,
      case
        when p.prev_workout_history_id is null then null
        else coalesce(
          (
            select sum((wsh.weight * wsh.reps)::numeric)
            from public.workout_exercise_history weh
            join public.workout_set_history wsh
              on wsh.workout_exercise_history_id = weh.id
            where weh.workout_history_id = p.prev_workout_history_id
              and wsh.weight is not null and wsh.weight > 0
              and wsh.reps is not null and wsh.reps > 0
          ),
          0
        )::numeric
      end as prev_volume_total
    from prev_same_workout p
  ),
  headers_with_insight as (
    select
      h.*,
      round(coalesce(cv.volume_total, 0), 0)::numeric as volume_total,
      pv.prev_volume_total,

      case
        when h.workout_id is null then null
        when pv.prev_volume_total is null or pv.prev_volume_total <= 0 then null
        else round(((cv.volume_total - pv.prev_volume_total) / pv.prev_volume_total) * 100.0, 1)
      end as delta_vs_prev_pct,

      case
        when h.workout_id is null then null
        when pv.prev_volume_total is null or pv.prev_volume_total <= 0 then null
        when cv.volume_total > pv.prev_volume_total then 'up'
        when cv.volume_total < pv.prev_volume_total then 'down'
        else 'flat'
      end as trend,

      case
        when h.workout_id is null then null
        when pv.prev_volume_total is null or pv.prev_volume_total <= 0 then null
        when cv.volume_total > pv.prev_volume_total then
          jsonb_build_object(
            'trend','up',
            'label', ('Lifted ' || trim(to_char(round(((cv.volume_total - pv.prev_volume_total) / pv.prev_volume_total) * 100.0, 1), 'FM999990.0')) || '% more than last time')
          )
        when cv.volume_total < pv.prev_volume_total then
          jsonb_build_object(
            'trend','down',
            'label', ('Lifted ' || trim(to_char(round(abs(((cv.volume_total - pv.prev_volume_total) / pv.prev_volume_total) * 100.0), 1), 'FM999990.0')) || '% less than last time')
          )
        else
          jsonb_build_object(
            'trend','flat',
            'label','Matched last time'
          )
      end as insight

    from headers h
    left join cur_volume cv using (workout_history_id)
    left join prev_volume pv using (workout_history_id)
  ),
  ex_rows as (
    select
      h.workout_history_id,
      weh.id as weh_id,
      weh.exercise_id,
      e.name as exercise_name,
      weh.order_index
    from headers_with_insight h
    join public.workout_exercise_history weh
      on weh.workout_history_id = h.workout_history_id
    join public.exercises e
      on e.id = weh.exercise_id
  ),
  ex_summ as (
    select
      r.workout_history_id,
      r.exercise_id,
      r.exercise_name,
      (
        select count(*)::int
        from public.workout_set_history wsh
        where wsh.workout_exercise_history_id = r.weh_id
      ) as set_count,
      (
        select mode() within group (order by wsh.reps)
        from public.workout_set_history wsh
        where wsh.workout_exercise_history_id = r.weh_id
          and wsh.reps is not null and wsh.reps > 0
      ) as typical_reps,
      r.order_index
    from ex_rows r
  ),
  top_items_per_workout as (
    select
      workout_history_id,
      jsonb_agg(
        jsonb_build_object(
          'exercise_id', exercise_id,
          'exercise_name', exercise_name,
          'summary',
            case
              when set_count is null or set_count = 0 then '—'
              when typical_reps is null then (set_count::text || ' sets')
              else (set_count::text || ' × ' || typical_reps::text)
            end
        )
        order by order_index asc
      ) filter (where rn <= 5) as top_items
    from (
      select
        *,
        row_number() over (partition by workout_history_id order by order_index asc) as rn
      from ex_summ
    ) x
    group by workout_history_id
  ),
  last_workouts as (
    select
      jsonb_agg(
        jsonb_build_object(
          'workout_history_id', h.workout_history_id,
          'workout_id', h.workout_id,
          'title', h.title,
          'completed_at', h.completed_at,
          'duration_seconds', h.duration_seconds,
          'volume_total', h.volume_total,
          'prev_volume_total', h.prev_volume_total,
          'delta_vs_prev_pct', h.delta_vs_prev_pct,
          'insight', h.insight,
          'top_items', coalesce(t.top_items, '[]'::jsonb)
        )
        order by h.completed_at desc
      ) as j
    from headers_with_insight h
    left join top_items_per_workout t using (workout_history_id)
  )
  select jsonb_build_object(
    'last_workouts', coalesce((select j from last_workouts), '[]'::jsonb)
  )
  into v_recent_activity;

  /* --------------------------
     Final payload
     -------------------------- */
  return jsonb_build_object(
    'meta', v_meta,
    'momentum', v_momentum,
    'consistency', v_consistency,
    'highlights', v_highlights,
    'exercise_summary', v_exercise_summary,
    'recent_activity', v_recent_activity
  );
end; 
$function$

CREATE OR REPLACE FUNCTION public.get_settings_overview()
 RETURNS TABLE(user_id uuid, name text, username text, email text, height_cm integer, weight_kg numeric, date_of_birth date, unit_weight text, unit_height text, experience_level text, primary_goal text, visibility text, notif_workout_reminders boolean, notif_goal_progress boolean, notif_social_activity boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    p.id as user_id,
    p.name,
    p.username,
    (auth.jwt() ->> 'email')::text as email,

    p.height::int as height_cm,
    p.weight as weight_kg,
    p.date_of_birth::date,

    -- ✅ keys that actually exist in your settings JSON
    coalesce(p.settings->>'unit_weight', 'kg') as unit_weight,
    coalesce(p.settings->>'unit_height', 'cm') as unit_height,
    nullif(coalesce(p.settings->>'level', p.settings->>'experience_level', ''), '') as experience_level,
    nullif(coalesce(p.settings->>'primaryGoal', p.settings->>'primary_goal', ''), '') as primary_goal,

    p.visibility::text as visibility,

    coalesce((p.settings->>'notif_workout_reminders')::boolean, true) as notif_workout_reminders,
    coalesce((p.settings->>'notif_goal_progress')::boolean, true) as notif_goal_progress,
    coalesce((p.settings->>'notif_social_activity')::boolean, true) as notif_social_activity
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$function$

CREATE OR REPLACE FUNCTION public.get_settings_v1()
 RETURNS TABLE(user_id uuid, name text, username text, username_lower text, is_private boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    p.id as user_id,
    p.name,
    p.username,
    p.username_lower,
    p.is_private
  from public.profiles p
  where p.id = auth.uid();
$function$

CREATE OR REPLACE FUNCTION public.get_starter_template_preview(p_template_workout_id uuid)
 RETURNS TABLE(order_index integer, exercise_name text, target_sets integer, target_reps integer, target_time_seconds integer, notes text, superset_group text, superset_index integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    we.order_index::int,
    e.name::text as exercise_name,
    we.target_sets::int,
    we.target_reps::int,
    we.target_time_seconds::int,
    we.notes::text,
    we.superset_group::text,
    we.superset_index::int
  from public.workout_exercises we
  join public.exercises e on e.id = we.exercise_id
  join public.workouts w on w.id = we.workout_id
  where we.workout_id = p_template_workout_id
    and we.is_archived = false
    -- ✅ only allow preview if it's a starter template (owned by template owner + tag)
    and w.notes like '[MM_TEMPLATE:starter:%]'
  order by we.order_index asc;
$function$

CREATE OR REPLACE FUNCTION public.get_steps_last_synced()
 RETURNS date
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  uid uuid := auth.uid();
  d date;
begin
  if uid is null then
    raise exception 'not logged in';
  end if;

  insert into user_steps_stats (user_id, last_synced_day)
  values (uid, current_date - 1)
  on conflict (user_id) do nothing;

  select last_synced_day into d
  from user_steps_stats
  where user_id = uid;

  return d;
end; $function$

CREATE OR REPLACE FUNCTION public.get_streak_month(p_month_offset integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := (select auth.uid());

  v_month_offset int := greatest(0, least(2, coalesce(p_month_offset, 0)));
  v_month_start date := (date_trunc('month', (now()::date - (v_month_offset || ' months')::interval)))::date;
  v_month_end date := (v_month_start + interval '1 month')::date;

  v_trained_month jsonb := '[]'::jsonb;
begin
  with days as (
    select d::date as day_date
    from generate_series(v_month_start, (v_month_end - interval '1 day')::date, interval '1 day') as d
  ),
  counts as (
    select
      wh.completed_at::date as day_date,
      count(*)::int as workout_count
    from public.workout_history wh
    where wh.user_id = v_user_id
      and wh.completed_at::date >= v_month_start
      and wh.completed_at::date <  v_month_end
    group by 1
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'day', to_char(d.day_date, 'YYYY-MM-DD'),
        'trained', (coalesce(c.workout_count, 0) > 0),
        'workout_count', coalesce(c.workout_count, 0)
      )
      order by d.day_date
    ),
    '[]'::jsonb
  )
  into v_trained_month
  from days d
  left join counts c using (day_date);

  return jsonb_build_object(
    'month_offset', v_month_offset,
    'month_start', to_char(v_month_start, 'YYYY-MM-01'),
    'trained_days_month', v_trained_month
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.get_unread_notifications_count_v1()
 RETURNS TABLE(unread_count integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::int as unread_count
  from public.notifications n
  where n.recipient_id = auth.uid()
    and coalesce(n.is_read, false) = false
    and n.read_at is null;
$function$

CREATE OR REPLACE FUNCTION public.get_user_enforcement_limits(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'tier', 'free',
    'status', 'free',
    'maxActivePlans', 3,
    'maxTemplates', 15,
    'maxGoalsPerPlan', 2147483647
  );
$function$

CREATE OR REPLACE FUNCTION public.get_user_posts_v1(p_user_id uuid, p_limit integer DEFAULT 30, p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(post_id uuid, user_id uuid, user_name text, post_type text, visibility text, caption text, created_at timestamp with time zone, workout_history_id uuid, exercise_id uuid, pr_snapshot jsonb, like_count integer, comment_count integer, viewer_liked boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
  with base as (
    select p.*
    from public.posts p
    where p.user_id = p_user_id

      -- seek pagination
      and (
        p_cursor_created_at is null
        or p.created_at < p_cursor_created_at
        or (p.created_at = p_cursor_created_at and p.id < p_cursor_id)
      )

      -- viewer must be allowed to see the post
      and public.can_view_post(auth.uid(), p.id)

    order by p.created_at desc, p.id desc
    limit greatest(1, least(p_limit, 100))
  )
  select
    b.id as post_id,
    b.user_id,
    pr.name as user_name,
    b.post_type,
    b.visibility,
    b.caption,
    b.created_at,
    b.workout_history_id,
    b.exercise_id,
    b.pr_snapshot,

    coalesce(lc.cnt, 0)::int as like_count,
    coalesce(cc.cnt, 0)::int as comment_count,
    coalesce(vl.liked, false) as viewer_liked

  from base b
  join public.profiles pr on pr.id = b.user_id

  left join lateral (
    select count(*) as cnt
    from public.post_likes pl
    where pl.post_id = b.id
  ) lc on true

  left join lateral (
    select count(*) as cnt
    from public.post_comments pc
    where pc.post_id = b.id
      and pc.deleted_at is null
  ) cc on true

  left join lateral (
    select true as liked
    from public.post_likes pl
    where pl.post_id = b.id
      and pl.user_id = auth.uid()
    limit 1
  ) vl on true;
$function$

CREATE OR REPLACE FUNCTION public.get_user_pr_series(p_user_id uuid, p_exercise_id uuid, p_lookback_days integer DEFAULT 365)
 RETURNS TABLE(day date, e1rm numeric, max_weight numeric, reps_for_max integer, e1rm_src_weight numeric, e1rm_src_reps integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
with sets as (
  select
    (wh.completed_at)::date as day,
    coalesce(wsh.weight, 0)::numeric as weight,
    wsh.reps::int as reps,
    -- simple e1RM: weight * (1 + reps/30)
    (coalesce(wsh.weight,0)::numeric * (1 + wsh.reps::numeric/30.0)) as e1rm,
    wh.completed_at
  from public.workout_history            wh
  join public.workout_exercise_history   weh on weh.workout_history_id = wh.id
  join public.workout_set_history        wsh on wsh.workout_exercise_history_id = weh.id
  join public.exercises                  e   on e.id = weh.exercise_id
  where wh.user_id = p_user_id
    and e.id = p_exercise_id
    and wh.completed_at >= now() - (p_lookback_days || ' days')::interval
),
best_e1rm as (
  -- top e1RM per day (ties broken by most recent set that day)
  select distinct on (day)
    day,
    e1rm,
    weight as e1rm_src_weight,
    reps   as e1rm_src_reps,
    completed_at
  from sets
  order by day, e1rm desc, completed_at desc
),
best_max as (
  -- heaviest single-set load per day (ties broken by most recent)
  select distinct on (day)
    day,
    weight as max_weight,
    reps   as reps_for_max,
    completed_at
  from sets
  order by day, weight desc, completed_at desc
),
days as (
  select day from sets group by day
)
select
  d.day,
  be.e1rm,
  bm.max_weight,
  bm.reps_for_max,
  be.e1rm_src_weight,
  be.e1rm_src_reps
from days d
left join best_e1rm be on be.day = d.day
left join best_max  bm on bm.day = d.day
order by d.day asc;
$function$

CREATE OR REPLACE FUNCTION public.get_user_pr_summaries(p_user_id uuid, p_lookback_days integer DEFAULT 365)
 RETURNS TABLE(exercise_id uuid, exercise_name text, latest_e1rm numeric, latest_day date, prev_e1rm numeric, pct_change numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
with
sets as (
  select
    weh.exercise_id,
    e.name as exercise_name,
    wh.user_id,
    (wh.completed_at)::date as day,
    (coalesce(wsh.weight,0) * (1 + coalesce(wsh.reps,0)::numeric/30.0))::numeric as e1rm
  from public.workout_history            wh
  join public.workout_exercise_history   weh on weh.workout_history_id = wh.id
  join public.workout_set_history        wsh on wsh.workout_exercise_history_id = weh.id
  join public.exercises                  e   on e.id = weh.exercise_id
  where wh.user_id = p_user_id
    and wh.completed_at >= now() - make_interval(days => p_lookback_days)
),
day_best as (
  select
    s.exercise_id,
    s.exercise_name,
    s.day,
    max(s.e1rm) as day_e1rm
  from sets s
  group by s.exercise_id, s.exercise_name, s.day
),
latest_day_cte as (
  select
    d.exercise_id,
    max(d.day) as latest_day
  from day_best d
  group by d.exercise_id
),
latest_val as (
  select
    d.exercise_id,
    d.exercise_name,
    d.day        as latest_day,
    d.day_e1rm   as latest_e1rm
  from day_best d
  join latest_day_cte l
    on l.exercise_id = d.exercise_id
   and l.latest_day  = d.day
),
prev_day as (
  select
    d.exercise_id,
    max(d.day) as prev_day
  from day_best d
  join latest_val lv
    on lv.exercise_id = d.exercise_id
  where d.day < lv.latest_day
  group by d.exercise_id
),
prev_val as (
  select
    d.exercise_id,
    d.day_e1rm as prev_e1rm
  from day_best d
  join prev_day p
    on p.exercise_id = d.exercise_id
   and p.prev_day    = d.day
)
select
  lv.exercise_id      as exercise_id,
  lv.exercise_name    as exercise_name,
  lv.latest_e1rm      as latest_e1rm,
  lv.latest_day       as latest_day,
  pv.prev_e1rm        as prev_e1rm,
  case
    when pv.prev_e1rm is null or pv.prev_e1rm <= 0 then null
    else round(((lv.latest_e1rm - pv.prev_e1rm)/pv.prev_e1rm)*100.0, 1)
  end                 as pct_change
from latest_val lv
left join prev_val pv
  on pv.exercise_id = lv.exercise_id
order by lv.exercise_name asc;
$function$

CREATE OR REPLACE FUNCTION public.get_workout_for_post_v1(p_workout_history_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- ownership gate
  if not exists (
    select 1 from public.workout_history wh
    where wh.id = p_workout_history_id
      and wh.user_id = v_uid
  ) then
    raise exception 'Not found';
  end if;

  return (
    with
    wh as (
      select
        wh.id as workout_history_id,
        wh.workout_id,
        coalesce(w.title, 'Workout') as title,
w.workout_image_key,
        wh.completed_at,
        wh.duration_seconds
      from public.workout_history wh
      left join public.workouts w on w.id = wh.workout_id
      where wh.id = p_workout_history_id
    ),
    ex as (
      select
        weh.id as workout_exercise_history_id,
        weh.workout_history_id,
        weh.exercise_id,
        e.name as exercise_name,
        weh.order_index
      from public.workout_exercise_history weh
      join public.exercises e on e.id = weh.exercise_id
      where weh.workout_history_id = p_workout_history_id
      order by weh.order_index asc
    ),
    sets as (
      select
        wsh.workout_exercise_history_id,
        jsonb_agg(
          jsonb_build_object(
            'set_number', wsh.set_number,
            'weight', wsh.weight,
            'reps', wsh.reps
          )
          order by wsh.set_number asc, wsh.id asc
        ) as sets
      from public.workout_set_history wsh
      join ex on ex.workout_exercise_history_id = wsh.workout_exercise_history_id
      group by 1
    ),
    totals as (
      select
        coalesce(sum((wsh.weight * wsh.reps)::numeric), 0)::numeric as volume_kg,
        count(*)::int as sets_count
      from public.workout_set_history wsh
      join public.workout_exercise_history weh on weh.id = wsh.workout_exercise_history_id
      where weh.workout_history_id = p_workout_history_id
        and wsh.weight is not null and wsh.weight > 0
        and wsh.reps is not null and wsh.reps > 0
    ),
    exercises_json as (
      select jsonb_agg(
        jsonb_build_object(
          'workout_exercise_history_id', ex.workout_exercise_history_id,
          'exercise_id', ex.exercise_id,
          'exercise_name', ex.exercise_name,
          'order_index', ex.order_index,
          'sets', coalesce(s.sets, '[]'::jsonb)
        )
        order by ex.order_index asc
      ) as arr
      from ex
      left join sets s on s.workout_exercise_history_id = ex.workout_exercise_history_id
    )

    select jsonb_build_object(
      'workout_history_id', (select workout_history_id from wh),
      'workout_id', (select workout_id from wh),
      'title', (select title from wh),
      'workout_image_key', (select workout_image_key from wh),
      'completed_at', (select completed_at from wh),
      'duration_seconds', (select duration_seconds from wh),
      'volume_kg', (select volume_kg from totals),
      'sets_count', (select sets_count from totals),
      'exercises', coalesce((select arr from exercises_json), '[]'::jsonb)
    )
  );
end;$function$

CREATE OR REPLACE FUNCTION public.get_workout_history_detail(p_workout_history_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_timezone text := 'UTC';
  v_eps numeric := 0.05;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(p.timezone, 'UTC')
    into v_timezone
  from public.profiles p
  where p.id = v_user_id;

  if not exists (
    select 1
    from public.workout_history wh
    where wh.id = p_workout_history_id
      and wh.user_id = v_user_id
  ) then
    raise exception 'Not found';
  end if;

  return (
    with
    wh as (
      select
        wh.id as workout_history_id,
        wh.workout_id,
        coalesce(w.title, 'Workout') as title,
        wh.completed_at,
        wh.duration_seconds,
        wh.notes
      from public.workout_history wh
      left join public.workouts w on w.id = wh.workout_id
      where wh.id = p_workout_history_id
    ),

    all_sets as (
      select
        weh.id as weh_id,
        weh.exercise_id,
        e.name as exercise_name,
        weh.order_index,
        wsh.id as set_id,
        wsh.set_number,
        wsh.drop_index,
        wsh.reps::int as reps,
        wsh.weight::numeric as weight_kg,
        wsh.time_seconds::int as time_seconds,
        wsh.distance::numeric as distance,
        case
          when wsh.weight is not null and wsh.weight > 0
           and wsh.reps is not null and wsh.reps > 0
          then (wsh.weight * wsh.reps)::numeric
          else 0
        end as volume,
        case
          when wsh.weight is not null and wsh.weight > 0
           and wsh.reps is not null and wsh.reps > 0
          then (wsh.weight * (1 + (wsh.reps::numeric / 30.0)))::numeric
          else null
        end as e1rm
      from public.workout_exercise_history weh
      join public.exercises e on e.id = weh.exercise_id
      join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
      where weh.workout_history_id = p_workout_history_id
    ),

    sets as (
      select *
      from all_sets
      where weight_kg is not null and weight_kg > 0
        and reps is not null and reps > 0
    ),

    totals as (
      select
        coalesce((select sum(volume) from sets), 0)::numeric as volume_kg,
        coalesce((select count(*) from all_sets), 0)::int as sets_count,
        coalesce((select sum(distance) from all_sets where distance is not null), 0)::numeric as distance_total
    ),

    per_ex_best as (
      select distinct on (exercise_id)
        exercise_id,
        set_id as best_set_id
      from sets
      order by exercise_id, e1rm desc, weight_kg desc, reps desc, set_number asc, set_id asc
    ),

    session_best as (
      select
        s.exercise_id,
        s.exercise_name,
        max(s.e1rm)::numeric as best_e1rm,
        (array_agg(s.weight_kg order by s.e1rm desc, s.weight_kg desc, s.reps desc))[1]::numeric as best_weight,
        (array_agg(s.reps order by s.e1rm desc, s.weight_kg desc, s.reps desc))[1]::int as best_reps
      from sets s
      group by 1,2
    ),

    prev_best as (
      select
        sb.exercise_id,
        max((wsh.weight * (1 + (wsh.reps::numeric / 30.0)))::numeric)::numeric as best_before
      from session_best sb
      join public.workout_exercise_history weh on weh.exercise_id = sb.exercise_id
      join public.workout_history wh2 on wh2.id = weh.workout_history_id
      join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
      where wh2.user_id = v_user_id
        and wh2.completed_at < (select completed_at from wh)
        and wsh.weight is not null and wsh.weight > 0
        and wsh.reps is not null and wsh.reps > 0
      group by 1
    ),

    prs as (
      select
        sb.exercise_id,
        sb.exercise_name,
        round(sb.best_e1rm, 1) as e1rm,
        round(sb.best_weight, 1) as weight_kg,
        sb.best_reps as reps,
        round(coalesce(sb.best_e1rm - pb.best_before, sb.best_e1rm), 1) as delta_abs,
        case
          when pb.best_before is null then null
          when pb.best_before <= 0 then null
          else round(((sb.best_e1rm - pb.best_before) / pb.best_before) * 100.0, 1)
        end as delta_pct
      from session_best sb
      left join prev_best pb using (exercise_id)
      where pb.best_before is null
         or sb.best_e1rm > pb.best_before + v_eps
      order by (pb.best_before is null) desc,
               (sb.best_e1rm - coalesce(pb.best_before, 0)) desc
    ),

    best_set_in_session as (
      select distinct on (s.exercise_id)
        s.exercise_id,
        s.set_id as best_set_id
      from sets s
      order by s.exercise_id, s.e1rm desc, s.weight_kg desc, s.reps desc, s.set_number asc, s.set_id asc
    ),

    pr_exercises as (
      select distinct exercise_id from prs
    ),

    prev_same_workout as (
      select
        wh2.id as prev_workout_history_id,
        wh2.completed_at,
        coalesce(sum((wsh.weight * wsh.reps)::numeric), 0)::numeric as prev_volume_kg
      from public.workout_history wh2
      join public.workout_exercise_history weh2 on weh2.workout_history_id = wh2.id
      join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh2.id
      where wh2.user_id = v_user_id
        and wh2.workout_id is not null
        and wh2.workout_id = (select workout_id from wh)
        and wh2.completed_at < (select completed_at from wh)
        and wsh.weight is not null and wsh.weight > 0
        and wsh.reps is not null and wsh.reps > 0
      group by 1,2
      order by wh2.completed_at desc
      limit 1
    ),

    insight as (
      select
        case
          when (select workout_id from wh) is null then null
          when (select prev_volume_kg from prev_same_workout) is null then null
          when (select prev_volume_kg from prev_same_workout) <= 0 then null
          else jsonb_build_object(
            'metric', 'volume',
            'trend',
              case
                when (((select volume_kg from totals) - (select prev_volume_kg from prev_same_workout)) / (select prev_volume_kg from prev_same_workout)) >= 0.02 then 'up'
                when (((select volume_kg from totals) - (select prev_volume_kg from prev_same_workout)) / (select prev_volume_kg from prev_same_workout)) <= -0.02 then 'down'
                else 'flat'
              end,
            'delta_pct',
              round((((select volume_kg from totals) - (select prev_volume_kg from prev_same_workout)) / (select prev_volume_kg from prev_same_workout)) * 100.0, 1),
            'label',
              case
                when (((select volume_kg from totals) - (select prev_volume_kg from prev_same_workout)) / (select prev_volume_kg from prev_same_workout)) >= 0.02
                  then ('Volume up ' || round((((select volume_kg from totals) - (select prev_volume_kg from prev_same_workout)) / (select prev_volume_kg from prev_same_workout)) * 100.0, 1)::text || '% vs last time')
                when (((select volume_kg from totals) - (select prev_volume_kg from prev_same_workout)) / (select prev_volume_kg from prev_same_workout)) <= -0.02
                  then ('Volume down ' || abs(round((((select volume_kg from totals) - (select prev_volume_kg from prev_same_workout)) / (select prev_volume_kg from prev_same_workout)) * 100.0, 1))::text || '% vs last time')
                else 'Volume matched last time'
              end
          )
        end as insight
    ),

    cardio_prs as (
      select
        cp.id,
        cp.exercise_id,
        e.name as exercise_name,
        cp.metric,
        cp.benchmark_distance_km,
        cp.value,
        cp.calculation_method,
        cp.workout_history_id,
        cp.workout_set_history_id,
        cp.achieved_at
      from public.cardio_prs cp
      join public.exercises e on e.id = cp.exercise_id
      where cp.user_id = v_user_id
        and cp.workout_history_id = p_workout_history_id
    ),

    exercises_json as (
      select jsonb_agg(
        jsonb_build_object(
          'exercise_id', x.exercise_id,
          'exercise_name', x.exercise_name,
          'order_index', x.order_index,
          'is_pr', (
            pe.exercise_id is not null
            or exists (
              select 1
              from cardio_prs cp
              where cp.exercise_id = x.exercise_id
            )
          ),
          'is_cardio_pr', exists (
            select 1
            from cardio_prs cp
            where cp.exercise_id = x.exercise_id
          ),
          'sets', x.sets
        )
        order by x.order_index asc
      ) as j
      from (
        select
          s.exercise_id,
          s.exercise_name,
          s.order_index,
          jsonb_agg(
            jsonb_build_object(
              'set_id', s.set_id,
              'set_number', s.set_number,
              'reps', s.reps,
              'weight_kg', round(s.weight_kg, 1),
              'time_seconds', s.time_seconds,
              'distance', round(s.distance, 2),
              'e1rm', round(s.e1rm, 1),
              'is_best', (s.set_id = b.best_set_id),
              'is_pr', (
                (pe.exercise_id is not null and s.set_id = bs.best_set_id)
                or exists (
                  select 1
                  from cardio_prs cp
                  where cp.workout_set_history_id = s.set_id
                )
              ),
              'is_cardio_pr', exists (
                select 1
                from cardio_prs cp
                where cp.workout_set_history_id = s.set_id
              )
            )
            order by s.set_number asc, s.drop_index asc, s.set_id asc
          ) as sets
        from all_sets s
        left join per_ex_best b on b.exercise_id = s.exercise_id
        left join best_set_in_session bs on bs.exercise_id = s.exercise_id
        left join pr_exercises pe on pe.exercise_id = s.exercise_id
        group by 1,2,3, pe.exercise_id, bs.best_set_id, b.best_set_id
      ) x
      left join pr_exercises pe on pe.exercise_id = x.exercise_id
    )

    select jsonb_build_object(
      'meta', jsonb_build_object(
        'timezone', v_timezone,
        'unit', 'kg'
      ),
      'header', jsonb_build_object(
        'workout_history_id', (select workout_history_id from wh),
        'workout_id', (select workout_id from wh),
        'title', (select title from wh),
        'completed_at', (select completed_at from wh),
        'notes', (select notes from wh)
      ),
      'stats', jsonb_build_object(
        'duration_seconds', (select duration_seconds from wh),
        'sets_count', (select sets_count from totals),
        'volume_kg', round((select volume_kg from totals), 0),
        'distance_total', round((select distance_total from totals), 2),
        'insight', (select insight from insight)
      ),
      'prs', coalesce((select jsonb_agg(to_jsonb(prs)) from prs), '[]'::jsonb),
      'cardio_prs', coalesce(
        (select jsonb_agg(to_jsonb(cardio_prs) order by achieved_at desc) from cardio_prs),
        '[]'::jsonb
      ),
      'exercises', coalesce((select j from exercises_json), '[]'::jsonb)
    )
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.get_workout_history_feed(p_limit integer DEFAULT 20, p_cursor_completed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid, p_query text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_timezone text := 'UTC';
  v_eps numeric := 0.05;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(p.timezone, 'UTC')
    into v_timezone
  from public.profiles p
  where p.id = v_user_id;

  return (
    with
    base as (
      select
        wh.id as workout_history_id,
        wh.workout_id,
        coalesce(w.title, 'Workout') as title,
        wh.completed_at,
        wh.duration_seconds
      from public.workout_history wh
      left join public.workouts w on w.id = wh.workout_id
      where wh.user_id = v_user_id
        and (
          p_query is null
          or p_query = ''
          or coalesce(w.title,'') ilike ('%'||p_query||'%')
          or exists (
            select 1
            from public.workout_exercise_history weh
            join public.exercises e on e.id = weh.exercise_id
            where weh.workout_history_id = wh.id
              and e.name ilike ('%'||p_query||'%')
          )
        )
        and (
          -- ✅ cursor guard: only apply tuple comparison if BOTH cursor fields exist
          p_cursor_completed_at is null
          or p_cursor_id is null
          or (wh.completed_at, wh.id) < (p_cursor_completed_at, p_cursor_id)
        )
      order by wh.completed_at desc, wh.id desc
      limit greatest(1, least(p_limit, 50))
    ),

    -- per-session totals (volume, sets)
    session_totals as (
      select
        b.workout_history_id,
        coalesce(sum((wsh.weight * wsh.reps)::numeric), 0)::numeric as volume_kg,
        count(*)::int as sets_count
      from base b
      join public.workout_exercise_history weh on weh.workout_history_id = b.workout_history_id
      join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
      where wsh.weight is not null and wsh.weight > 0
        and wsh.reps is not null and wsh.reps > 0
      group by 1
    ),

    -- top 5 exercises preview per workout (name + "3 × 10" style)
    ex_rows as (
      select
        b.workout_history_id,
        weh.id as weh_id,
        weh.exercise_id,
        e.name as exercise_name,
        weh.order_index
      from base b
      join public.workout_exercise_history weh on weh.workout_history_id = b.workout_history_id
      join public.exercises e on e.id = weh.exercise_id
    ),
    ex_summ as (
      select
        r.workout_history_id,
        r.exercise_id,
        r.exercise_name,
        r.order_index,
        (select count(*)::int
         from public.workout_set_history wsh
         where wsh.workout_exercise_history_id = r.weh_id
        ) as set_count,
        (select mode() within group (order by wsh.reps)
         from public.workout_set_history wsh
         where wsh.workout_exercise_history_id = r.weh_id
           and wsh.reps is not null and wsh.reps > 0
        ) as typical_reps
      from ex_rows r
    ),
    top_items_per_workout as (
      select
        workout_history_id,
        jsonb_agg(
          jsonb_build_object(
            'exercise_id', exercise_id,
            'exercise_name', exercise_name,
            'summary',
              case
                when set_count is null or set_count = 0 then '—'
                when typical_reps is null then (set_count::text || ' sets')
                else (set_count::text || ' × ' || typical_reps::text)
              end
          )
          order by order_index asc
        ) filter (where rn <= 5) as top_items
      from (
        select
          *,
          row_number() over (partition by workout_history_id order by order_index asc) as rn
        from ex_summ
      ) x
      group by workout_history_id
    ),

    -- PR count per workout session
    sets_for_pr as (
      select
        b.workout_history_id,
        b.completed_at,
        weh.exercise_id,
        (wsh.weight * (1 + (wsh.reps::numeric / 30.0)))::numeric as e1rm
      from base b
      join public.workout_exercise_history weh on weh.workout_history_id = b.workout_history_id
      join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
      where wsh.weight is not null and wsh.weight > 0
        and wsh.reps is not null and wsh.reps > 0
    ),
    session_best as (
      select
        workout_history_id,
        completed_at,
        exercise_id,
        max(e1rm)::numeric as best_e1rm
      from sets_for_pr
      group by 1,2,3
    ),
    with_prev as (
      select
        sb.*,
        max(best_e1rm) over (
          partition by exercise_id
          order by completed_at, workout_history_id
          rows between unbounded preceding and 1 preceding
        ) as best_before
      from session_best sb
    ),
    pr_count as (
      select
        workout_history_id,
        count(*)::int as prs
      from with_prev
      where best_before is null
         or best_e1rm >= best_before + v_eps
      group by 1
    ),

    -- Insight chip: compare volume to previous time this workout_id was completed
    hist_with_volume as (
      select
        wh.id as workout_history_id,
        wh.workout_id,
        wh.completed_at,
        coalesce(sum((wsh.weight * wsh.reps)::numeric), 0)::numeric as volume_kg
      from public.workout_history wh
      join public.workout_exercise_history weh on weh.workout_history_id = wh.id
      join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
      where wh.user_id = v_user_id
        and wh.workout_id is not null
        and wsh.weight is not null and wsh.weight > 0
        and wsh.reps is not null and wsh.reps > 0
      group by 1,2,3
    ),
    insight_prev as (
      select
        hv.workout_history_id,
        lag(hv.volume_kg) over (
          partition by hv.workout_id
          order by hv.completed_at asc, hv.workout_history_id asc
        ) as prev_volume_kg
      from hist_with_volume hv
    ),
    insight as (
      select
        b.workout_history_id,
        case
          when b.workout_id is null then null
          when ip.prev_volume_kg is null or ip.prev_volume_kg <= 0 then null
          else jsonb_build_object(
            'metric','volume',
            'trend',
              case
                when ((st.volume_kg - ip.prev_volume_kg) / ip.prev_volume_kg) >= 0.02 then 'up'
                when ((st.volume_kg - ip.prev_volume_kg) / ip.prev_volume_kg) <= -0.02 then 'down'
                else 'flat'
              end,
            'delta_pct', round(((st.volume_kg - ip.prev_volume_kg) / ip.prev_volume_kg) * 100.0, 1),
            'label',
              case
                when ((st.volume_kg - ip.prev_volume_kg) / ip.prev_volume_kg) >= 0.02
                  then ('Lifted ' || round(((st.volume_kg - ip.prev_volume_kg) / ip.prev_volume_kg) * 100.0, 1)::text || '% more than last time')
                when ((st.volume_kg - ip.prev_volume_kg) / ip.prev_volume_kg) <= -0.02
                  then ('Lifted ' || abs(round(((st.volume_kg - ip.prev_volume_kg) / ip.prev_volume_kg) * 100.0, 1))::text || '% less than last time')
                else 'Matched last time'
              end
          )
        end as insight
      from base b
      left join session_totals st on st.workout_history_id = b.workout_history_id
      left join insight_prev ip on ip.workout_history_id = b.workout_history_id
    ),

    items as (
      select
        jsonb_build_object(
          'workout_history_id', b.workout_history_id,
          'workout_id', b.workout_id,
          'title', b.title,
          'completed_at', b.completed_at,
          'duration_seconds', b.duration_seconds,
          'volume_kg', coalesce(st.volume_kg, 0),
          'sets_count', coalesce(st.sets_count, 0),
          'pr_count', coalesce(pc.prs, 0),
          'top_items', coalesce(ti.top_items, '[]'::jsonb),
          'insight', ins.insight
        ) as item,
        date_trunc('month', (b.completed_at at time zone v_timezone))::date as month_start,
        b.completed_at,
        b.workout_history_id
      from base b
      left join session_totals st on st.workout_history_id = b.workout_history_id
      left join pr_count pc on pc.workout_history_id = b.workout_history_id
      left join top_items_per_workout ti on ti.workout_history_id = b.workout_history_id
      left join insight ins on ins.workout_history_id = b.workout_history_id
    ),

    groups as (
      select
        to_char(month_start, 'YYYY-MM') as key,
        upper(to_char(month_start, 'Mon YYYY')) as title,
        jsonb_agg(item order by completed_at desc, workout_history_id desc) as items,
        month_start
      from items
      group by month_start
    )

    select jsonb_build_object(
      'meta', jsonb_build_object(
        'generated_at', now(),
        'timezone', v_timezone,
        'unit', 'kg'
      ),

      -- ✅ keep legacy field so you don't break anything
      'items', coalesce(
        (select jsonb_agg(item order by completed_at desc, workout_history_id desc) from items),
        '[]'::jsonb
      ),

      -- ✅ new field your list screen wants
      'groups', coalesce(
        (select jsonb_agg(
          jsonb_build_object('key', key, 'title', title, 'items', items)
          order by month_start desc
        ) from groups),
        '[]'::jsonb
      )
    )
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.get_workout_session_bootstrap(p_workout_id uuid, p_plan_workout_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with me as (
  select auth.uid() as user_id
),

-- validate workout ownership
w as (
  select
    wo.id,
    wo.user_id,
    wo.title,
    wo.notes,
    wo.workout_image_key
  from public.workouts wo
  join me on me.user_id = wo.user_id
  where wo.id = p_workout_id
),

-- validate plan workout (optional) belongs to me
pw as (
  select
    pww.id as plan_workout_id,
    pww.plan_id,
    pww.workout_id,
    pww.title as plan_workout_title,
    pww.order_index
  from public.plan_workouts pww
  join public.plans p on p.id = pww.plan_id
  join me on me.user_id = p.user_id
  where p_plan_workout_id is not null
    and pww.id = p_plan_workout_id
),

-- base exercise list for this workout (ignore archived workout_exercises)
wx as (
  select
    we.id as workout_exercise_id,
    we.workout_id,
    we.exercise_id,
    we.order_index,
    we.target_sets,
    we.target_reps,
    we.target_weight,
    we.target_time_seconds,
    we.target_distance,
    we.notes as workout_exercise_notes,
    we.superset_group,
    we.superset_index,
    we.is_dropset
  from public.workout_exercises we
  join w on w.id = we.workout_id
  where we.is_archived = false
),

-- join exercise metadata
ex as (
  select
    wx.*,
    e.name,
    e.equipment,
    e.type,
    e.level,
    e.video_url,
    e.instructions
  from wx
  join public.exercises e on e.id = wx.exercise_id
),

-- history for THIS workout only
hist_workouts as (
  select
    wh.id as workout_history_id,
    wh.completed_at,
    wh.duration_seconds
  from public.workout_history wh
  join me on me.user_id = wh.user_id
  where wh.workout_id = p_workout_id
),

-- workout-level last completion
last_workout as (
  select max(completed_at) as last_completed_at
  from hist_workouts
),

-- total volume per workout_history_id (sum reps*weight)
hist_volume as (
  select
    hw.workout_history_id,
    sum(coalesce(wsh.reps,0) * coalesce(wsh.weight,0))::numeric as total_volume
  from hist_workouts hw
  join public.workout_exercise_history weh
    on weh.workout_history_id = hw.workout_history_id
  join public.workout_set_history wsh
    on wsh.workout_exercise_history_id = weh.id
  group by hw.workout_history_id
),

header_stats as (
  select
    round(avg(hw.duration_seconds)::numeric, 0)::int as avg_duration_seconds,
    round(avg(hv.total_volume)::numeric, 0)::numeric as avg_total_volume
  from hist_workouts hw
  left join hist_volume hv
    on hv.workout_history_id = hw.workout_history_id
),

-- goals: only if this is a plan workout -> use plan_id; filter to exercises in this workout (or exercise_id null)
g as (
  select
    g.id,
    g.type,
    g.target_number,
    g.unit,
    g.deadline,
    g.exercise_id,
    g.notes
  from public.goals g
  join me on me.user_id = g.user_id
  join pw on pw.plan_id = g.plan_id
  where g.is_active = true
    and (
      g.exercise_id is null
      or g.exercise_id in (select exercise_id from ex)
    )
),

-- ---------------------------
-- Today’s goal (per-session target for exercise_weight goals)
-- ---------------------------

pr as (
  select
    p.id,
    coalesce(p.timezone, 'UTC') as timezone
  from public.profiles p
  join me on me.user_id = p.id
),

pl as (
  select
    pl.id as plan_id,
    pl.start_date,
    pl.end_date
  from public.plans pl
  join pw on pw.plan_id = pl.id
),

plan_calendar as (
  select
    greatest(
      1,
      ceil(((pl.end_date - pl.start_date + 1)::numeric) / 7)::int
    ) as total_weeks,

    greatest(
      1,
      least(
        ( (((now() at time zone (select timezone from pr))::date - pl.start_date) / 7) + 1 )::int,
        greatest(1, ceil(((pl.end_date - pl.start_date + 1)::numeric) / 7)::int)
      )
    ) as current_week
  from pl
),

g_weight as (
  select
    g.id as goal_id,
    g.exercise_id,
    g.target_number::numeric as goal_weight,
    coalesce(nullif(g.unit,''), 'kg') as unit,
    g.notes
  from g
  where g.exercise_id is not null
    and g.type::text = 'exercise_weight'
),

-- Which plan workouts include this goal exercise?
plan_exercise_occurrences as (
  select
    gw.goal_id,
    gw.exercise_id,
    pw2.id as plan_workout_id,
    pw2.order_index,
    pw2.workout_id
  from g_weight gw
  join public.plan_workouts pw2
    on pw2.plan_id = (select plan_id from pw)
   and pw2.is_archived = false
  join public.workout_exercises we2
    on we2.workout_id = pw2.workout_id
   and we2.is_archived = false
   and we2.exercise_id = gw.exercise_id
),

exercise_schedule_stats as (
  select
    x.goal_id,
    x.exercise_id,
    count(*)::int as sessions_per_week,
    max(
      case
        when x.plan_workout_id = (select plan_workout_id from pw)
        then x.rn
        else null
      end
    )::int as occurrence_in_week
  from (
    select
      peo.*,
      row_number() over (
        partition by peo.goal_id
        order by peo.order_index asc nulls last, peo.plan_workout_id
      ) as rn
    from plan_exercise_occurrences peo
  ) x
  group by x.goal_id, x.exercise_id
),

-- Parse {"start": 20} from notes if present
goal_notes_start as (
  select
    gw.goal_id,
    nullif(
      (regexp_match(coalesce(gw.notes,''), '\"start\"\s*:\s*([0-9]+(\.[0-9]+)?)'))[1],
      ''
    )::numeric as start_weight_from_notes
  from g_weight gw
),

-- last pre-plan session per exercise (across ALL workouts)
preplan_last_session as (
  select distinct on (weh.exercise_id)
    weh.exercise_id,
    wh.id as workout_history_id,
    wh.completed_at
  from public.workout_exercise_history weh
  join public.workout_history wh on wh.id = weh.workout_history_id
  join me on me.user_id = wh.user_id
  where weh.exercise_id in (select exercise_id from g_weight)
    and (select start_date from pl) is not null
    and (wh.completed_at at time zone (select timezone from pr))::date < (select start_date from pl)
  order by weh.exercise_id, wh.completed_at desc
),

preplan_baseline_weight as (
  select
    p.exercise_id,
    max(wsh.weight)::numeric as start_weight
  from preplan_last_session p
  join public.workout_exercise_history weh
    on weh.exercise_id = p.exercise_id
   and weh.workout_history_id = p.workout_history_id
  join public.workout_set_history wsh
    on wsh.workout_exercise_history_id = weh.id
  where wsh.weight is not null
  group by p.exercise_id
),

-- fallback baseline from THIS workout prescription
workout_prescription_baseline as (
  select
    ex.exercise_id,
    max(ex.target_weight)::numeric as start_weight
  from ex
  where ex.target_weight is not null
  group by ex.exercise_id
),

todays_goals as (
  select
    gw.goal_id,
    gw.exercise_id,
    e.name as exercise_name,
    gw.unit,

    coalesce(
      (select start_weight_from_notes from goal_notes_start ns where ns.goal_id = gw.goal_id),
      (select start_weight from preplan_baseline_weight pb where pb.exercise_id = gw.exercise_id),
      (select start_weight from workout_prescription_baseline wb where wb.exercise_id = gw.exercise_id),
      0::numeric
    ) as start_weight,

    gw.goal_weight,

    greatest(1, coalesce(ss.sessions_per_week, 1)) as sessions_per_week,

    ((select total_weeks from plan_calendar) * greatest(1, coalesce(ss.sessions_per_week, 1)))::int as total_sessions,

    (
      ((select current_week from plan_calendar) - 1) * greatest(1, coalesce(ss.sessions_per_week, 1))
      + greatest(1, coalesce(ss.occurrence_in_week, 1))
    )::int as session_number,

    case
      when ((select total_weeks from plan_calendar) * greatest(1, coalesce(ss.sessions_per_week, 1))) <= 1
        then gw.goal_weight
      else
        (
          coalesce(
            (select start_weight_from_notes from goal_notes_start ns where ns.goal_id = gw.goal_id),
            (select start_weight from preplan_baseline_weight pb where pb.exercise_id = gw.exercise_id),
            (select start_weight from workout_prescription_baseline wb where wb.exercise_id = gw.exercise_id),
            0::numeric
          )
          +
          (
            (gw.goal_weight - coalesce(
              (select start_weight_from_notes from goal_notes_start ns where ns.goal_id = gw.goal_id),
              (select start_weight from preplan_baseline_weight pb where pb.exercise_id = gw.exercise_id),
              (select start_weight from workout_prescription_baseline wb where wb.exercise_id = gw.exercise_id),
              0::numeric
            ))
            *
            (
              (
                (
                  (
                    ((select current_week from plan_calendar) - 1) * greatest(1, coalesce(ss.sessions_per_week, 1))
                    + greatest(1, coalesce(ss.occurrence_in_week, 1))
                  )::numeric - 1
                )
                /
                nullif(
                  (((select total_weeks from plan_calendar) * greatest(1, coalesce(ss.sessions_per_week, 1)) - 1))::numeric,
                  0
                )
              )
            )
          )
        )
    end as target_this_session
  from g_weight gw
  join public.exercises e on e.id = gw.exercise_id
  left join exercise_schedule_stats ss
    on ss.goal_id = gw.goal_id
   and ss.exercise_id = gw.exercise_id
),

-- last session per exercise, scoped to THIS workout only
last_session_key as (
  select distinct on (weh.exercise_id)
    weh.exercise_id,
    wh.id as workout_history_id,
    wh.completed_at
  from public.workout_exercise_history weh
  join public.workout_history wh on wh.id = weh.workout_history_id
  join me on me.user_id = wh.user_id
  where weh.exercise_id in (select exercise_id from ex)
    and wh.workout_id = p_workout_id
  order by weh.exercise_id, wh.completed_at desc
),

last_sets as (
  select
    l.exercise_id,
    jsonb_agg(
      jsonb_build_object(
        'setNumber', wsh.set_number,
        'dropIndex', wsh.drop_index,
        'reps', wsh.reps,
        'weight', wsh.weight,
        'timeSeconds', wsh.time_seconds,
        'distance', wsh.distance,
        'notes', wsh.notes
      )
      order by wsh.set_number asc, wsh.drop_index asc
    ) as sets
  from last_session_key l
  join public.workout_exercise_history weh
    on weh.exercise_id = l.exercise_id
   and weh.workout_history_id = l.workout_history_id
  join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
  group by l.exercise_id
),

-- best e1rm per exercise (LAST 6 MONTHS across ALL workouts)
e1rm_6m_sets as (
  select
    weh.exercise_id,
    wh.completed_at,
    wsh.weight,
    wsh.reps,
    (wsh.weight * (1 + (wsh.reps::numeric / 30.0))) as e1rm
  from public.workout_exercise_history weh
  join public.workout_history wh on wh.id = weh.workout_history_id
  join me on me.user_id = wh.user_id
  join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
  where weh.exercise_id in (select exercise_id from ex)
    and wh.completed_at >= (now() - interval '6 months')
    and wsh.weight is not null
    and wsh.reps is not null
    and wsh.reps > 0
),

best_e1rm_6m as (
  select
    exercise_id,
    max(e1rm) as best_e1rm_6m
  from e1rm_6m_sets
  group by exercise_id
),

best_set_6m as (
  select distinct on (exercise_id)
    exercise_id,
    completed_at,
    weight,
    reps,
    e1rm
  from e1rm_6m_sets
  order by exercise_id, e1rm desc, completed_at desc
),

-- volume per exercise (within THIS workout only)
exercise_volume as (
  select
    weh.exercise_id,
    sum(coalesce(wsh.reps,0) * coalesce(wsh.weight,0))::numeric as total_volume_all_time
  from public.workout_exercise_history weh
  join public.workout_history wh on wh.id = weh.workout_history_id
  join me on me.user_id = wh.user_id
  join public.workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
  where weh.exercise_id in (select exercise_id from ex)
    and wh.workout_id = p_workout_id
  group by weh.exercise_id
)

select jsonb_build_object(
  'workout',
    jsonb_build_object(
      'workoutId', w.id,
      'title', w.title,
      'notes', w.notes,
      'imageKey', w.workout_image_key,
      'isPlanWorkout', (p_plan_workout_id is not null),
      'planWorkoutId', (select plan_workout_id from pw),
      'lastCompletedAt', (select last_completed_at from last_workout)
    ),

  'headerStats',
    jsonb_build_object(
      'avgDurationSeconds', (select avg_duration_seconds from header_stats),
      'avgTotalVolume', (select avg_total_volume from header_stats)
    ),

  -- keep your existing goals array
  'goals',
    coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'type', g.type,
          'targetNumber', g.target_number,
          'unit', g.unit,
          'deadline', g.deadline,
          'exerciseId', g.exercise_id,
          'notes', g.notes
        )
      ) from g),
      '[]'::jsonb
    ),

  -- ✅ new, purpose-built payload for the "Today’s goal" UI
  'todaysGoals',
    coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'goalId', tg.goal_id,
          'exerciseId', tg.exercise_id,
          'exerciseName', tg.exercise_name,
          'unit', tg.unit,
          'startWeight', tg.start_weight,
          'goalWeight', tg.goal_weight,
          'sessionsPerWeek', tg.sessions_per_week,
          'sessionNumber', tg.session_number,
          'totalSessions', tg.total_sessions,
          'targetThisSession', tg.target_this_session
        )
        order by tg.exercise_name asc
      ) from todays_goals tg),
      '[]'::jsonb
    ),

  'exercises',
    coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'workoutExerciseId', ex.workout_exercise_id,
          'exerciseId', ex.exercise_id,
          'orderIndex', ex.order_index,

          'name', ex.name,
          'equipment', ex.equipment,
          'type', ex.type,
          'level', ex.level,
          'videoUrl', ex.video_url,
          'instructions', ex.instructions,

          'prescription', jsonb_build_object(
            'targetSets', ex.target_sets,
            'targetReps', ex.target_reps,
            'targetWeight', ex.target_weight,
            'targetTimeSeconds', ex.target_time_seconds,
            'targetDistance', ex.target_distance,
            'notes', ex.workout_exercise_notes,
            'supersetGroup', ex.superset_group,
            'supersetIndex', ex.superset_index,
            'isDropset', ex.is_dropset
          ),

          'lastSession', jsonb_build_object(
            'completedAt', (select completed_at from last_session_key l where l.exercise_id = ex.exercise_id),
            'sets', coalesce((select sets from last_sets ls where ls.exercise_id = ex.exercise_id), '[]'::jsonb)
          ),

          'bestE1rm6m', (select best_e1rm_6m from best_e1rm_6m b where b.exercise_id = ex.exercise_id),

          'bestSet6m', jsonb_build_object(
            'completedAt', (select completed_at from best_set_6m s where s.exercise_id = ex.exercise_id),
            'weight', (select weight from best_set_6m s where s.exercise_id = ex.exercise_id),
            'reps', (select reps from best_set_6m s where s.exercise_id = ex.exercise_id),
            'e1rm', (select e1rm from best_set_6m s where s.exercise_id = ex.exercise_id)
          ),

          'totalVolumeAllTime', (select total_volume_all_time from exercise_volume v where v.exercise_id = ex.exercise_id)
        )
        order by ex.order_index asc
      ) from ex),
      '[]'::jsonb
    )
)
from w;
$function$

CREATE OR REPLACE FUNCTION public.get_workouts_on_day(p_day date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$declare
  v_user_id uuid := (select auth.uid());
begin
  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'workout_history_id', wh.id,
          'workout_id', wh.workout_id,
          'title', coalesce(w.title, 'Workout'),
          'completed_at', wh.completed_at,
          'duration_seconds', wh.duration_seconds,
          'sets_completed', (
            select count(*)
            from public.workout_set_history wsh
            join public.workout_exercise_history weh
              on weh.id = wsh.workout_exercise_history_id
            where weh.workout_history_id = wh.id
          ),
          'volume_kg', (
            select coalesce(sum((wsh.weight * wsh.reps)::numeric), 0)
            from public.workout_set_history wsh
            join public.workout_exercise_history weh
              on weh.id = wsh.workout_exercise_history_id
            where weh.workout_history_id = wh.id
              and wsh.weight is not null and wsh.weight > 0
              and wsh.reps is not null and wsh.reps > 0
          )
        )
        order by wh.completed_at desc
      ),
      '[]'::jsonb
    )
    from public.workout_history wh
    left join public.workouts w on w.id = wh.workout_id
    where wh.user_id = v_user_id
      and wh.completed_at::date = p_day
  );
end;$function$

CREATE OR REPLACE FUNCTION public.get_workouts_tab_payload()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$with
me as (
  select auth.uid() as user_id
),

p as (
  select pr.id, pr.timezone
  from public.profiles pr
  join me on me.user_id = pr.id
),

today_local as (
  select (now() at time zone coalesce((select timezone from p), 'UTC'))::date as d
),

-- user library workouts
my_w as (
  select
    w.id as workout_id,
    w.title,
    w.workout_image_key,
    w.created_at
  from public.workouts w
  join me on me.user_id = w.user_id
  where w.deleted_at is null
),

my_w_count as (
  select count(*)::int as n from my_w
),

-- total completed workouts (lifetime)
workouts_total as (
  select count(*)::int as n
  from public.workout_history wh
  join me on me.user_id = wh.user_id
),

-- active plans now come from plans table directly
active_plans_base as (
  select
    pl.id,
    pl.user_id,
    pl.title,
    pl.start_date,
    pl.end_date,
    pl.created_at,
    pl.updated_at,
    pl.weekly_target_sessions
  from public.plans pl
  join me on me.user_id = pl.user_id
  cross join today_local t
  where pl.is_completed = false
    and pl.completed_at is null
    and pl.end_date is not null
    and pl.end_date >= t.d
),

active_plans_count as (
  select count(*)::int as n
  from active_plans_base
),

state as (
  select
    case
      when (select n from active_plans_count) > 0 then 'with_plan'
      when (select n from my_w_count) > 0 then 'no_plan'
      else 'new_user'
    end as state
),

-- reusable: last done per workout
last_done as (
  select
    wh.workout_id,
    max(wh.completed_at) as last_done_at
  from public.workout_history wh
  join me on me.user_id = wh.user_id
  where wh.workout_id is not null
  group by wh.workout_id
),

-- reusable: counts + preview text per workout
workout_meta as (
  select
    w.id as workout_id,
    count(we.id)::int as exercise_count,
    coalesce(
      (
        select string_agg(x.name, ', ' order by x.order_index)
        from (
          select e.name, we2.order_index
          from public.workout_exercises we2
          join public.exercises e on e.id = we2.exercise_id
          where we2.workout_id = w.id
            and we2.is_archived = false
          order by we2.order_index asc
          limit 3
        ) x
      ),
      ''
    ) as preview_text
  from public.workouts w
  left join public.workout_exercises we
    on we.workout_id = w.id
   and we.is_archived = false
  where w.deleted_at is null
  group by w.id
),

-- My Workouts payload items
my_workouts_payload as (
  select jsonb_agg(
    jsonb_build_object(
      'workoutId', mw.workout_id,
      'title', mw.title,
      'imageKey', mw.workout_image_key,
      'exerciseCount', wm.exercise_count,
      'previewText', wm.preview_text,
      'lastDoneAt', to_jsonb(ld.last_done_at)
    )
    order by coalesce(ld.last_done_at, mw.created_at) desc, mw.title asc
  ) as items
  from my_w mw
  left join workout_meta wm on wm.workout_id = mw.workout_id
  left join last_done ld on ld.workout_id = mw.workout_id
),

-- Template suggestions (new_user only)
template_w as (
  select
    w.id as workout_id,
    w.title,
    w.workout_image_key,
    w.created_at
  from public.workouts w
  where w.user_id = '1ca79b4f-8d37-414e-a123-30622570c7af'::uuid
    and w.deleted_at is null
  order by w.created_at asc
),

template_w_count as (
  select count(*)::int as n from template_w
),

suggested_payload as (
  select jsonb_build_object(
    'title', 'Suggested for You',
    'seeAll', ((select n from template_w_count) > 7),
    'items',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'workoutId', tw.workout_id,
              'title', tw.title,
              'imageKey', tw.workout_image_key,
              'previewText', wm.preview_text,
              'tapAction', 'preview'
            )
            order by tw.created_at asc
          )
          from (
            select * from template_w
            limit 7
          ) tw
          left join workout_meta wm on wm.workout_id = tw.workout_id
        ),
        '[]'::jsonb
      )
  ) as block
),

-- all plan_workouts for all active plans
plan_items as (
  select
    ap.id as plan_id,
    pw.id as plan_workout_id,
    pw.workout_id,
    pw.title as plan_workout_title,
    pw.order_index,
    pw.weekly_complete,
    pw.is_archived,
    w.workout_image_key
  from active_plans_base ap
  join public.plan_workouts pw on pw.plan_id = ap.id
  join public.workouts w on w.id = pw.workout_id
  where pw.is_archived = false
    and w.deleted_at is null
),

plan_progress as (
  select
    pi.plan_id,
    count(*)::int as total_count,
    count(*) filter (where pi.weekly_complete = true)::int as completed_count
  from plan_items pi
  group by pi.plan_id
),

next_plan_workout as (
  select distinct on (pi.plan_id)
    pi.plan_id,
    pi.plan_workout_id,
    pi.workout_id,
    pi.plan_workout_title,
    pi.workout_image_key
  from plan_items pi
  where pi.weekly_complete = false
  order by pi.plan_id, pi.order_index asc nulls last
),

plan_schedule_payloads as (
  select
    ap.id as plan_id,
    jsonb_build_object(
      'title', 'Plan Schedule',
      'actions', jsonb_build_object('viewAll', true, 'edit', true),
      'items',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'planWorkoutId', pi.plan_workout_id,
                'workoutId', pi.workout_id,
                'title', pi.plan_workout_title,
                'orderIndex', pi.order_index,
                'weeklyComplete', pi.weekly_complete,
                'imageKey', pi.workout_image_key,
                'previewText', wm.preview_text,
                'lastDoneAt', to_jsonb(ld.last_done_at)
              )
              order by pi.order_index asc nulls last
            )
            from plan_items pi
            left join workout_meta wm on wm.workout_id = pi.workout_id
            left join last_done ld on ld.workout_id = pi.workout_id
            where pi.plan_id = ap.id
          ),
          '[]'::jsonb
        )
    ) as block
  from active_plans_base ap
),

active_plan_payloads as (
  select
    ap.id as plan_id,
    jsonb_build_object(
      'planId', ap.id,
      'title', ap.title,
      'metaLine',
        case
          when ap.start_date is null or ap.end_date is null then null
          else (
            'Week ' ||
            greatest(
              1,
              least(
                ((((select d from today_local) - ap.start_date) / 7) + 1)::int,
                greatest(1, ceil(((ap.end_date - ap.start_date + 1)::numeric) / 7)::int)
              )
            ) ||
            ' of ' ||
            greatest(1, ceil(((ap.end_date - ap.start_date + 1)::numeric) / 7)::int) ||
            ' • ' ||
            greatest(0, (ap.end_date - (select d from today_local)))::int ||
            ' Days Left'
          )
        end,
      'progress', jsonb_build_object(
        'completedCount', coalesce(pp.completed_count, 0),
        'totalCount', coalesce(pp.total_count, 0),
        'pct',
          case
            when ap.start_date is null or ap.end_date is null then 0
            when ap.end_date <= ap.start_date then 100
            else least(
              100,
              greatest(
                0,
                round(
                  (
                    (((select d from today_local) - ap.start_date)::numeric)
                    /
                    nullif((ap.end_date - ap.start_date)::numeric, 0)
                  ) * 100
                )::int
              )
            )
          end
      ),
      'nextWorkout',
        case
          when np.plan_workout_id is null then null
          else jsonb_build_object(
            'planWorkoutId', np.plan_workout_id,
            'workoutId', np.workout_id,
            'title', np.plan_workout_title,
            'imageKey', np.workout_image_key
          )
        end,
      'primaryCta', jsonb_build_object(
        'label',
          case
            when np.plan_workout_id is null then 'Start Workout'
            else ('Start: ' || np.plan_workout_title)
          end,
        'action', 'start_workout'
      )
    ) as block
  from active_plans_base ap
  left join plan_progress pp on pp.plan_id = ap.id
  left join next_plan_workout np on np.plan_id = ap.id
),

active_plans_payload as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'activePlan', app.block,
        'planSchedule', psp.block
      )
      order by ap.start_date asc nulls last, ap.created_at asc, ap.id
    ),
    '[]'::jsonb
  ) as items
  from active_plans_base ap
  join active_plan_payloads app on app.plan_id = ap.id
  left join plan_schedule_payloads psp on psp.plan_id = ap.id
),

-- workouts archived in any of the user's plans
archived_workouts as (
  select distinct pw.workout_id
  from public.plan_workouts pw
  join public.plans pl on pl.id = pw.plan_id
  join me on me.user_id = pl.user_id
  where pw.is_archived = true
),

-- workouts already used in any active plan
active_plan_workout_ids as (
  select distinct pi.workout_id
  from plan_items pi
),

optional_sessions_payload as (
  select jsonb_build_object(
    'title', 'Optional Sessions',
    'actionCreate', true,
    'items',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'workoutId', mw.workout_id,
              'title', mw.title,
              'imageKey', mw.workout_image_key,
              'previewText', wm.preview_text,
              'lastDoneAt', to_jsonb(ld.last_done_at)
            )
            order by coalesce(ld.last_done_at, mw.created_at) desc, mw.title asc
          )
          from my_w mw
          left join active_plan_workout_ids api on api.workout_id = mw.workout_id
          left join archived_workouts aw on aw.workout_id = mw.workout_id
          left join workout_meta wm on wm.workout_id = mw.workout_id
          left join last_done ld on ld.workout_id = mw.workout_id
          where api.workout_id is null
            and aw.workout_id is null
          limit 12
        ),
        '[]'::jsonb
      )
  ) as block
),

final as (
  select
    (select state from state) as st,
    (select n from my_w_count) as my_count,
    (select n from workouts_total) as workouts_total
)

select jsonb_build_object(
  'state', (select st from final),

  'workoutsTotal', (select workouts_total from final),

  'header', jsonb_build_object(
    'title', 'Workouts',
    'actions', jsonb_build_object(
      'showSearch', ((select st from final) <> 'new_user')
    )
  ),

  'setup',
    case
      when (select st from final) = 'new_user' then jsonb_build_object(
        'title', 'Let’s build your first workout',
        'subtitle', 'You’re just one step away from starting your fitness journey.',
        'progressPct', 0,
        'cta', jsonb_build_object('label', 'Create First Workout', 'action', 'create_first_workout')
      )
      else null
    end,

  'suggested',
    case
      when (select st from final) = 'new_user' then (select block from suggested_payload)
      else null
    end,

  'myWorkouts', jsonb_build_object(
    'title', 'My Workouts',
    'seeAll', ((select my_count from final) > 0),
    'emptyState',
      case
        when (select my_count from final) = 0 then jsonb_build_object(
          'title', 'Your personal library is empty',
          'subtitle', 'Start your journey by creating a workout from scratch or try one of our suggestions above!',
          'ctaPrimary', jsonb_build_object('label', 'Create Workout', 'action', 'create_workout'),
          'ctaSecondary', jsonb_build_object('label', 'Explore Plans', 'action', 'explore_plans')
        )
        else null
      end,
    'items', coalesce((select items from my_workouts_payload), '[]'::jsonb)
  ),

  'activePlans',
    case
      when (select st from final) = 'with_plan' then (select items from active_plans_payload)
      else '[]'::jsonb
    end,

  'optionalSessions',
    case
      when (select st from final) = 'with_plan' then (select block from optional_sessions_payload)
      else null
    end,

  'fab', jsonb_build_object(
    'visible', true,
    'action',
      case
        when (select st from final) = 'new_user' then 'create_workout'
        else 'create_menu'
      end
  )
);$function$

CREATE OR REPLACE FUNCTION public.handle_follow_notification_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_name text;
  v_notification_id uuid;
begin
  -- block self notifications just in case
  if new.follower_id = new.followee_id then
    return new;
  end if;

  select coalesce(p.username, p.name, 'Someone')
    into v_actor_name
  from public.profiles p
  where p.id = new.follower_id;

  v_notification_id := public.create_notification_v1(
    p_recipient_id := new.followee_id,
    p_actor_id := new.follower_id,
    p_type := 'followed_you',
    p_title := 'New follower',
    p_body := v_actor_name || ' started following you.',
    p_entity_type := 'profile',
    p_entity_id := new.follower_id,
    p_dedupe_key := 'followed_you:' || new.follower_id::text || ':' || new.followee_id::text
  );

  perform public.enqueue_notification_push_v1(v_notification_id, new.followee_id);

  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.handle_follow_request_accepted_notification_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_name text;
  v_notification_id uuid;
begin
  if old.status is not distinct from 'accepted' then
    return new;
  end if;

  if new.status is distinct from 'accepted' then
    return new;
  end if;

  select coalesce(p.username, p.name, 'Someone')
    into v_actor_name
  from public.profiles p
  where p.id = new.target_id;

  v_notification_id := public.create_notification_v1(
    p_recipient_id := new.requester_id,
    p_actor_id := new.target_id,
    p_type := 'follow_request_accepted',
    p_title := 'Follow request accepted',
    p_body := v_actor_name || ' accepted your follow request.',
    p_entity_type := 'profile',
    p_entity_id := new.target_id,
    p_dedupe_key := 'follow_request_accepted:' || new.requester_id::text || ':' || new.target_id::text
  );

  perform public.enqueue_notification_push_v1(v_notification_id, new.requester_id);

  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.handle_follow_request_created_notification_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_name text;
  v_notification_id uuid;
begin
  if new.requester_id = new.target_id then
    return new;
  end if;

  if new.status is distinct from 'pending' then
    return new;
  end if;

  select coalesce(p.username, p.name, 'Someone')
    into v_actor_name
  from public.profiles p
  where p.id = new.requester_id;

  v_notification_id := public.create_notification_v1(
    p_recipient_id := new.target_id,
    p_actor_id := new.requester_id,
    p_type := 'follow_request_received',
    p_title := 'Follow request',
    p_body := v_actor_name || ' requested to follow you.',
    p_entity_type := 'follow_request',
    p_entity_id := new.requester_id,
    p_dedupe_key := 'follow_request_received:' || new.requester_id::text || ':' || new.target_id::text
  );

  perform public.enqueue_notification_push_v1(v_notification_id, new.target_id);

  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.handle_new_notification_preferences()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.handle_post_commented_notification_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_post_owner_id uuid;
  v_actor_name text;
  v_notification_id uuid;
begin
  -- ignore soft-deleted comments just in case
  if new.deleted_at is not null then
    return new;
  end if;

  select p.user_id
    into v_post_owner_id
  from public.posts p
  where p.id = new.post_id;

  -- post missing
  if v_post_owner_id is null then
    return new;
  end if;

  -- no self notifications
  if new.user_id = v_post_owner_id then
    return new;
  end if;

  select coalesce(pr.username, pr.name, 'Someone')
    into v_actor_name
  from public.profiles pr
  where pr.id = new.user_id;

  v_notification_id := public.create_notification_v1(
    p_recipient_id := v_post_owner_id,
    p_actor_id := new.user_id,
    p_type := 'post_commented',
    p_title := 'New comment',
    p_body := v_actor_name || ' commented on your post.',
    p_entity_type := 'post',
    p_entity_id := new.post_id,
    p_dedupe_key := 'post_commented:' || new.id::text
  );

  perform public.enqueue_notification_push_v1(v_notification_id, v_post_owner_id);

  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.handle_post_liked_notification_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_post_owner_id uuid;
  v_actor_name text;
  v_notification_id uuid;
begin
  select p.user_id
    into v_post_owner_id
  from public.posts p
  where p.id = new.post_id;

  -- post missing
  if v_post_owner_id is null then
    return new;
  end if;

  -- no self notifications
  if new.user_id = v_post_owner_id then
    return new;
  end if;

  select coalesce(pr.username, pr.name, 'Someone')
    into v_actor_name
  from public.profiles pr
  where pr.id = new.user_id;

  v_notification_id := public.create_notification_v1(
    p_recipient_id := v_post_owner_id,
    p_actor_id := new.user_id,
    p_type := 'post_liked',
    p_title := 'Someone liked your post',
    p_body := v_actor_name || ' liked your post.',
    p_entity_type := 'post',
    p_entity_id := new.post_id,
    p_dedupe_key := 'post_liked:' || new.post_id::text || ':' || new.user_id::text || ':' || v_post_owner_id::text
  );

  perform public.enqueue_notification_push_v1(v_notification_id, v_post_owner_id);

  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.increment_weekly_completed(p_user_id uuid, p_week_key text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  v_goal int;
begin
  -- Look up the user's weekly target (fallback to 3 if null)
  select coalesce(weekly_workout_goal, 3)
  into v_goal
  from public.profiles
  where id = p_user_id;

  v_goal := coalesce(v_goal, 3);

  insert into public.user_weekly_workout_stats (user_id, week_key, goal, completed, met)
  values (p_user_id, p_week_key, v_goal, 1, 1 >= v_goal)
  on conflict (user_id, week_key)
  do update set
    completed  = public.user_weekly_workout_stats.completed + 1,
    goal       = excluded.goal, -- keep goal in sync with profile
    met        = (public.user_weekly_workout_stats.completed + 1)
                 >= excluded.goal,
    updated_at = now();
end;
$function$

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$function$

CREATE OR REPLACE FUNCTION public.is_allowed_username(p_username text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v text := lower(btrim(coalesce(p_username,'')));
begin
  if v = '' then
    return false;
  end if;

  -- reject if matches denylist
  if exists (
    select 1
    from public.username_denylist d
    where
      (d.match_mode = 'exact' and v = d.term)
      or
      (d.match_mode = 'substring' and v like '%' || d.term || '%')
  ) then
    return false;
  end if;

  return true;
end;
$function$

CREATE OR REPLACE FUNCTION public.is_blocked_either(a uuid, b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1
    from public.user_blocks ub
    where (ub.blocker_id = a and ub.blocked_id = b)
       or (ub.blocker_id = b and ub.blocked_id = a)
  );
$function$

CREATE OR REPLACE FUNCTION public.is_valid_username(p_username text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    p_username is not null
    and length(btrim(p_username)) between 3 and 10
    and btrim(p_username) ~ '^[A-Za-z0-9](?:[A-Za-z0-9._]*[A-Za-z0-9])$'
    and btrim(p_username) !~ '[._]{2,}'  -- no ".." "__" "._" "_."
$function$

CREATE OR REPLACE FUNCTION public.local_date_for(p_ts timestamp with time zone, p_tz text)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select (p_ts at time zone p_tz)::date
$function$

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_updated integer;
begin
  update public.notifications
  set
    is_read = true,
    read_at = coalesce(read_at, now())
  where recipient_id = (select auth.uid())
    and is_read = false;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$function$

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read_v1()
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  update public.notifications
  set read_at = coalesce(read_at, now())
  where user_id = auth.uid()
    and read_at is null;
$function$

CREATE OR REPLACE FUNCTION public.mark_expired_plans_completed()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_today    date := current_date;
  v_affected integer := 0;
begin
  /*
    Step 1: mark all plans whose end_date has passed as completed.
    "End on the 20th if end_date = 19th" is implemented by:
      end_date < current_date
  */
  with updated_plans as (
    update plans p
    set
      is_completed = true,
      updated_at   = now()
    where
      p.is_completed = false
      and p.end_date is not null
      and p.end_date < v_today
    returning p.id
  ),
  cleared_active as (
    -- Step 2: clear active_plan_id for any profile whose active plan just ended
    update profiles prof
    set active_plan_id = null
    where prof.active_plan_id in (select id from updated_plans)
    returning 1
  )
  select count(*)::int
  into v_affected
  from updated_plans;

  return v_affected;
end;
$function$

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_updated integer;
begin
  update public.notifications
  set
    is_read = true,
    read_at = coalesce(read_at, now())
  where id = p_notification_id
    and recipient_id = (select auth.uid())
    and is_read = false;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$function$

CREATE OR REPLACE FUNCTION public.mark_notifications_read_v1(p_ids uuid[])
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  update public.notifications
  set read_at = coalesce(read_at, now())
  where user_id = auth.uid()
    and id = any(p_ids);
$function$

CREATE OR REPLACE FUNCTION public.mark_onboarding_stage_v1(p_stage text, p_action text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'auth_missing';
  end if;

  if p_stage not in ('stage2','stage3') then
    raise exception 'invalid_stage';
  end if;

  if p_action not in ('complete','dismiss') then
    raise exception 'invalid_action';
  end if;

  if p_stage = 'stage2' then
    update public.profiles
    set
      onboarding_stage2_completed_at = case when p_action = 'complete' then now() else onboarding_stage2_completed_at end,
      onboarding_stage2_dismissed_at = case when p_action = 'dismiss' then now() else onboarding_stage2_dismissed_at end,
      updated_at = now()
    where id = v_user;

  else
    update public.profiles
    set
      onboarding_stage3_completed_at = case when p_action = 'complete' then now() else onboarding_stage3_completed_at end,
      onboarding_stage3_dismissed_at = case when p_action = 'dismiss' then now() else onboarding_stage3_dismissed_at end,
      updated_at = now()
    where id = v_user;
  end if;
end;
$function$

CREATE OR REPLACE FUNCTION public.maybe_trigger_onboarding_stages_v1()
 RETURNS TABLE(workouts_completed integer, stage2_triggered boolean, stage3_triggered boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_count int;
  p record;
  did2 boolean := false;
  did3 boolean := false;
begin
  if v_user is null then
    raise exception 'auth_missing';
  end if;

  select
    pr.onboarding_stage2_triggered_at as s2_trig,
    pr.onboarding_stage3_triggered_at as s3_trig
  into p
  from public.profiles pr
  where pr.id = v_user;

  if p is null then
    raise exception 'profile_missing';
  end if;

  -- ✅ “completed workout” definition matches your row: completed_at not null
  select count(*)::int
  into v_count
  from public.workout_history wh
  where wh.user_id = v_user
    and wh.completed_at is not null;

  -- Stage 2 triggers at EXACTLY 1, only once
  if v_count = 1 and p.s2_trig is null then
    update public.profiles
      set onboarding_stage2_triggered_at = now(),
          updated_at = now()
    where id = v_user;
    did2 := true;
  end if;

  -- Stage 3 triggers at EXACTLY 5, only once
  if v_count = 5 and p.s3_trig is null then
    update public.profiles
      set onboarding_stage3_triggered_at = now(),
          updated_at = now()
    where id = v_user;
    did3 := true;
  end if;

  workouts_completed := v_count;
  stage2_triggered := did2;
  stage3_triggered := did3;
  return next;
end;
$function$

CREATE OR REPLACE FUNCTION public.muscle_id_by_name(p_name text)
 RETURNS smallint
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT id FROM public.muscles WHERE name = p_name LIMIT 1
$function$

CREATE OR REPLACE FUNCTION public.muscle_sets_last7d(p_user_id uuid, p_muscle_name text)
 RETURNS TABLE(completed_at timestamp with time zone, exercise_name text, reps integer, weight numeric, volume numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with recent as (
    select
      wh.user_id,
      wh.completed_at,
      wexh.exercise_id,
      ws.reps, ws.weight,
      (coalesce(ws.reps,0) * coalesce(ws.weight,0))::numeric as volume
    from workout_history wh
    join workout_exercise_history wexh on wexh.workout_history_id = wh.id
    join workout_set_history ws on ws.workout_exercise_history_id = wexh.id
    where wh.user_id = p_user_id
      and wh.completed_at >= now() - interval '7 days'
      and (coalesce(ws.reps,0) > 0 and coalesce(ws.weight,0) > 0)
  ),
  primary_muscle as (
    select em.exercise_id, m.name as muscle_name
    from exercise_muscles em
    join muscles m on m.id = em.muscle_id
    where em.contribution = (
      select max(contribution) from exercise_muscles em2
      where em2.exercise_id = em.exercise_id
    )
  )
  select
    r.completed_at,
    e.name as exercise_name,
    r.reps, r.weight, r.volume
  from recent r
  join primary_muscle pm on pm.exercise_id = r.exercise_id
  join exercises e on e.id = r.exercise_id
  where pm.muscle_name = p_muscle_name
  order by r.completed_at desc, e.name asc;
$function$

CREATE OR REPLACE FUNCTION public.prev_week_bounds_sunday(tz text, ref_ts timestamp with time zone DEFAULT now())
 RETURNS TABLE(start_utc timestamp with time zone, end_utc timestamp with time zone)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH local_now AS (
    SELECT timezone(tz, ref_ts) AS ln   -- timestamp without tz in that zone
  ),
  last_sunday AS (
    -- Sunday = 0. Cast to date drops time, then subtract DOW to get local Sunday 00:00.
    SELECT (ln::date - EXTRACT(DOW FROM ln)::int)::timestamp AS sun
    FROM local_now
  )
  SELECT
    (sun - interval '7 days') AT TIME ZONE tz AS start_utc,   -- convert back to UTC
    sun AT TIME ZONE tz AS end_utc
  FROM last_sunday;
$function$

CREATE OR REPLACE FUNCTION public.process_cardio_prs_for_workout(p_workout_history_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_result jsonb := '[]'::jsonb;
begin
  select coalesce(auth.uid(), wh.user_id)
    into v_user_id
  from public.workout_history wh
  where wh.id = p_workout_history_id;

  if v_user_id is null then
    raise exception 'Workout history not found';
  end if;

  with
  cardio_sets as (
    select
      wh.user_id,
      wh.completed_at,
      weh.exercise_id,
      wsh.id as workout_set_history_id,
      wsh.time_seconds::numeric as time_seconds,
      wsh.distance::numeric as distance
    from public.workout_history wh
    join public.workout_exercise_history weh
      on weh.workout_history_id = wh.id
    join public.workout_set_history wsh
      on wsh.workout_exercise_history_id = weh.id
    where wh.id = p_workout_history_id
      and wh.user_id = v_user_id
      and wsh.time_seconds is not null
      and wsh.time_seconds > 0
      and wsh.distance is not null
      and wsh.distance > 0
  ),

  metric_candidates as (
    select
      user_id,
      exercise_id,
      'longest_distance'::text as metric,
      null::numeric as benchmark_distance_km,
      distance as value,
      'average_pace'::text as calculation_method,
      p_workout_history_id as workout_history_id,
      workout_set_history_id,
      completed_at as achieved_at
    from cardio_sets

    union all

    select
      user_id,
      exercise_id,
      'best_pace'::text as metric,
      null::numeric as benchmark_distance_km,
      time_seconds / nullif(distance, 0) as value,
      'average_pace'::text as calculation_method,
      p_workout_history_id as workout_history_id,
      workout_set_history_id,
      completed_at as achieved_at
    from cardio_sets

    union all

    select
      cs.user_id,
      cs.exercise_id,
      b.metric,
      b.distance_km as benchmark_distance_km,
      (cs.time_seconds / nullif(cs.distance, 0)) * b.distance_km as value,
      'average_pace'::text as calculation_method,
      p_workout_history_id as workout_history_id,
      cs.workout_set_history_id,
      cs.completed_at as achieved_at
    from cardio_sets cs
    join (
      values
        ('fastest_1k'::text, 1::numeric),
        ('fastest_3k'::text, 3::numeric),
        ('fastest_5k'::text, 5::numeric),
        ('fastest_10k'::text, 10::numeric),
        ('fastest_15k'::text, 15::numeric),
        ('fastest_20k'::text, 20::numeric),
        ('fastest_half_marathon'::text, 21.0975::numeric),
        ('fastest_marathon'::text, 42.195::numeric)
    ) as b(metric, distance_km)
      on cs.distance >= b.distance_km
  ),

  best_candidate_per_metric as (
    select distinct on (exercise_id, metric)
      *
    from metric_candidates
    order by
      exercise_id,
      metric,
      case
        when metric = 'longest_distance' then value * -1
        else value
      end asc,
      workout_set_history_id asc
  ),

  new_prs as (
    select bc.*
    from best_candidate_per_metric bc
    where not exists (
      select 1
      from public.cardio_prs old
      where old.user_id = bc.user_id
        and old.exercise_id = bc.exercise_id
        and old.metric = bc.metric
        and old.achieved_at < bc.achieved_at
        and (
          (
            bc.metric = 'longest_distance'
            and old.value >= bc.value
          )
          or
          (
            bc.metric <> 'longest_distance'
            and old.value <= bc.value
          )
        )
    )
  ),

  inserted as (
    insert into public.cardio_prs (
      user_id,
      exercise_id,
      metric,
      benchmark_distance_km,
      value,
      calculation_method,
      workout_history_id,
      workout_set_history_id,
      achieved_at
    )
    select
      user_id,
      exercise_id,
      metric,
      benchmark_distance_km,
      case
        when metric = 'longest_distance' then round(value, 2)
        else round(value, 0)
      end as value,
      calculation_method,
      workout_history_id,
      workout_set_history_id,
      achieved_at
    from new_prs
    where not exists (
      select 1
      from public.cardio_prs existing
      where existing.user_id = new_prs.user_id
        and existing.exercise_id = new_prs.exercise_id
        and existing.metric = new_prs.metric
        and existing.workout_history_id = new_prs.workout_history_id
        and existing.workout_set_history_id = new_prs.workout_set_history_id
    )
    returning *
  )

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', inserted.id,
        'exercise_id', inserted.exercise_id,
        'metric', inserted.metric,
        'benchmark_distance_km', inserted.benchmark_distance_km,
        'value', inserted.value,
        'calculation_method', inserted.calculation_method,
        'workout_history_id', inserted.workout_history_id,
        'workout_set_history_id', inserted.workout_set_history_id,
        'achieved_at', inserted.achieved_at
      )
      order by inserted.created_at asc
    ),
    '[]'::jsonb
  )
  into v_result
  from inserted;

  return v_result;
end;
$function$

CREATE OR REPLACE FUNCTION public.recompute_all_step_stats()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  u record;
begin
  for u in select id from public.profiles loop
    perform public.recompute_step_stats(u.id);
  end loop;
end
$function$

CREATE OR REPLACE FUNCTION public.recompute_step_stats(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  g integer;
  tz text;
  local_today date;
  met_total integer := 0;
  met_30 integer := 0;
  met_90 integer := 0;
  current_streak integer := 0;
  best_prev integer := 0;
  r record;
begin
  select steps_goal, timezone into g, tz from public.profiles where id = p_user_id;
  if g is null then g := 10000; end if;
  if tz is null or tz = '' then tz := 'UTC'; end if;

  local_today := public.local_date_for(now(), tz);

  select coalesce(streak_best, 0) into best_prev
  from public.user_steps_stats where user_id = p_user_id;

  -- We'll generate a calendar of the last 365 local days
  -- and left join with daily_steps to detect "met" days.
  create temporary table tmp_days on commit drop as
  with days as (
    select generate_series(
      (local_today - interval '365 days')::date, local_today, interval '1 day'
    )::date as day
  )
  select d.day,
         coalesce(ds.steps, 0) as steps,
         (coalesce(ds.steps, 0) >= g) as met
  from days d
  left join public.daily_steps ds
    on ds.user_id = p_user_id and ds.day = d.day;

  -- Rolling counts
  select count(*) into met_total from tmp_days where met;
  select count(*) into met_30 from tmp_days where day >= (local_today - interval '30 days')::date and met;
  select count(*) into met_90 from tmp_days where day >= (local_today - interval '90 days')::date and met;

  -- Current streak: walk backward from local_today until a miss
  for r in
    select day, met from tmp_days
    where day <= local_today
    order by day desc
  loop
    if r.met then
      current_streak := current_streak + 1;
    else
      exit; -- first miss breaks the streak
    end if;
  end loop;

  insert into public.user_steps_stats (
    user_id, days_met_total, days_met_30, days_met_90, streak_current, streak_best, updated_at
  )
  values (
    p_user_id, met_total, met_30, met_90, current_streak, greatest(best_prev, current_streak), now()
  )
  on conflict (user_id) do update set
    days_met_total = excluded.days_met_total,
    days_met_30 = excluded.days_met_30,
    days_met_90 = excluded.days_met_90,
    streak_current = excluded.streak_current,
    streak_best = greatest(public.user_steps_stats.streak_best, excluded.streak_best),
    updated_at = now();
end
$function$

CREATE OR REPLACE FUNCTION public.recompute_user_entitlement(p_user_id uuid, p_reason text DEFAULT NULL::text, p_event_source text DEFAULT 'manual_refresh'::text)
 RETURNS TABLE(tier text, status text, source text, product_code text, effective_from timestamp with time zone, effective_until timestamp with time zone, next_renewal_at timestamp with time zone, trial_ends_at timestamp with time zone, cancelled_at timestamp with time zone, last_verified_at timestamp with time zone, provider_environment text, manual_grant boolean, capabilities_version text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_old public.user_entitlements%rowtype;
  v_new record;
  v_provider_for_event text := 'manual';
  v_event_type text := 'entitlement_refreshed';
begin
  select *
  into v_old
  from public.user_entitlements ue
  where ue.user_id = p_user_id;

  select *
  into v_new
  from public.resolve_user_entitlement(p_user_id)
  limit 1;

  insert into public.user_entitlements (
    user_id,
    tier,
    status,
    source,
    product_code,
    effective_from,
    effective_until,
    next_renewal_at,
    trial_ends_at,
    cancelled_at,
    last_verified_at,
    provider_environment,
    manual_grant,
    capabilities_version,
    created_at,
    updated_at
  ) values (
    p_user_id,
    v_new.tier,
    v_new.status,
    v_new.source,
    v_new.product_code,
    v_new.effective_from,
    v_new.effective_until,
    v_new.next_renewal_at,
    v_new.trial_ends_at,
    v_new.cancelled_at,
    coalesce(v_new.last_verified_at, now()),
    v_new.provider_environment,
    v_new.manual_grant,
    v_new.capabilities_version,
    now(),
    now()
  )
  on conflict (user_id) do update
  set
    tier = excluded.tier,
    status = excluded.status,
    source = excluded.source,
    product_code = excluded.product_code,
    effective_from = excluded.effective_from,
    effective_until = excluded.effective_until,
    next_renewal_at = excluded.next_renewal_at,
    trial_ends_at = excluded.trial_ends_at,
    cancelled_at = excluded.cancelled_at,
    last_verified_at = excluded.last_verified_at,
    provider_environment = excluded.provider_environment,
    manual_grant = excluded.manual_grant,
    capabilities_version = excluded.capabilities_version,
    updated_at = now();

  if v_new.source in ('apple', 'google', 'stripe', 'manual') then
    v_provider_for_event := v_new.source;
  else
    v_provider_for_event := 'manual';
  end if;

  if v_old.user_id is null then
    v_event_type := 'entitlement_initialized';
  elsif v_old.status is distinct from v_new.status then
    v_event_type := case v_new.status
      when 'trial' then 'trial_started'
      when 'active' then 'subscription_activated'
      when 'cancelled_active' then 'subscription_cancelled'
      when 'grace' then 'subscription_grace_started'
      when 'expired' then 'subscription_expired'
      when 'revoked' then 'subscription_revoked'
      when 'free' then 'entitlement_returned_to_free'
      else 'entitlement_refreshed'
    end;
  elsif v_old.tier is distinct from v_new.tier then
    v_event_type := 'entitlement_tier_changed';
  elsif v_old.source is distinct from v_new.source then
    v_event_type := 'entitlement_source_changed';
  elsif v_old.product_code is distinct from v_new.product_code then
    v_event_type := 'entitlement_product_changed';
  end if;

  if v_old.user_id is null
     or v_old.tier is distinct from v_new.tier
     or v_old.status is distinct from v_new.status
     or v_old.source is distinct from v_new.source
     or v_old.product_code is distinct from v_new.product_code
     or v_old.manual_grant is distinct from v_new.manual_grant
     or v_old.effective_until is distinct from v_new.effective_until
  then
    insert into public.billing_events (
      user_id,
      provider,
      event_type,
      event_source,
      provider_event_ref,
      old_status,
      new_status,
      old_tier,
      new_tier,
      reason,
      payload
    ) values (
      p_user_id,
      v_provider_for_event,
      v_event_type,
      p_event_source,
      null,
      v_old.status,
      v_new.status,
      v_old.tier,
      v_new.tier,
      coalesce(p_reason, 'recompute_user_entitlement'),
      jsonb_build_object(
        'old_source', v_old.source,
        'new_source', v_new.source,
        'old_product_code', v_old.product_code,
        'new_product_code', v_new.product_code,
        'old_manual_grant', v_old.manual_grant,
        'new_manual_grant', v_new.manual_grant,
        'old_effective_until', v_old.effective_until,
        'new_effective_until', v_new.effective_until
      )
    );
  end if;

  return query
  select
    v_new.tier,
    v_new.status,
    v_new.source,
    v_new.product_code,
    v_new.effective_from,
    v_new.effective_until,
    v_new.next_renewal_at,
    v_new.trial_ends_at,
    v_new.cancelled_at,
    coalesce(v_new.last_verified_at, now()),
    v_new.provider_environment,
    v_new.manual_grant,
    v_new.capabilities_version;
end;
$function$

CREATE OR REPLACE FUNCTION public.record_daily_steps_on(p_day date, p_steps integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.daily_steps (user_id, day, steps, last_reported_at)
  values (v_uid, p_day, greatest(0, coalesce(p_steps, 0)), now())
  on conflict (user_id, day)
  do update set
    steps = greatest(public.daily_steps.steps, excluded.steps),
    last_reported_at = now();
end
$function$

CREATE OR REPLACE FUNCTION public.reject_follow_request(p_requester uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  v_target uuid := auth.uid();
begin
  if v_target is null then
    raise exception 'Not authenticated';
  end if;

  if p_requester is null or p_requester = v_target then
    raise exception 'Invalid requester';
  end if;

  update public.follow_requests
  set status = 'rejected',
      responded_at = now()
  where requester_id = p_requester
    and target_id = v_target
    and status = 'pending';

  if not found then
    raise exception 'No pending request found';
  end if;
end;
$function$

CREATE OR REPLACE FUNCTION public.request_account_deletion_v1()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'auth_missing';
  end if;

  insert into public.account_deletion_requests(user_id)
  values (auth.uid());
end;
$function$

CREATE OR REPLACE FUNCTION public.request_follow(p_target uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me uuid := auth.uid();
  v_visibility profile_visibility;
  v_existing_status text;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  if p_target is null or p_target = v_me then
    raise exception 'Invalid target';
  end if;

  -- block check (either direction)
  if exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = v_me and b.blocked_id = p_target)
       or (b.blocker_id = p_target and b.blocked_id = v_me)
  ) then
    raise exception 'Cannot follow due to block';
  end if;

  -- if already following, do nothing
  if exists (
    select 1
    from public.user_follows f
    where f.follower_id = v_me
      and f.followee_id = p_target
  ) then
    return 'following';
  end if;

  -- get visibility of target (must exist)
  select p.visibility
    into v_visibility
  from public.profiles p
  where p.id = p_target;

  if not found then
    raise exception 'Target user not found';
  end if;

  -- PUBLIC or FOLLOWERS: follow immediately
  if v_visibility in ('public', 'followers') then
    insert into public.user_follows (follower_id, followee_id)
    values (v_me, p_target)
    on conflict do nothing;

    -- (optional) clear any stale pending request
    update public.follow_requests
      set status = 'accepted',
          responded_at = now()
    where requester_id = v_me
      and target_id = p_target
      and status = 'pending';

    return 'following';
  end if;

  -- PRIVATE: request flow
  -- if your enum includes 'private' only, this is enough
  -- (self case is blocked earlier)
  select fr.status
    into v_existing_status
  from public.follow_requests fr
  where fr.requester_id = v_me
    and fr.target_id = p_target;

  -- No request yet -> create pending
  if v_existing_status is null then
    insert into public.follow_requests (requester_id, target_id, status, created_at)
    values (v_me, p_target, 'pending', now());
    return 'requested';
  end if;

  -- Pending already -> requested
  if v_existing_status = 'pending' then
    return 'requested';
  end if;

  -- IMPORTANT CHANGE (kept from your original):
  -- If previously accepted but NOT currently following, require a NEW approval for private targets.
  if v_existing_status = 'accepted' then
    update public.follow_requests
      set status = 'pending',
          responded_at = null
    where requester_id = v_me
      and target_id = p_target;

    return 'requested';
  end if;

  -- revive cancelled/rejected -> pending
  update public.follow_requests
    set status = 'pending',
        responded_at = null
  where requester_id = v_me
    and target_id = p_target;

  return 'requested';
end;
$function$

CREATE OR REPLACE FUNCTION public.resolve_user_entitlement(p_user_id uuid)
 RETURNS TABLE(tier text, status text, source text, product_code text, effective_from timestamp with time zone, effective_until timestamp with time zone, next_renewal_at timestamp with time zone, trial_ends_at timestamp with time zone, cancelled_at timestamp with time zone, last_verified_at timestamp with time zone, provider_environment text, manual_grant boolean, capabilities_version text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_manual public.manual_entitlement_grants%rowtype;
  v_provider public.billing_subscriptions%rowtype;
begin
  -- 1. Active manual grant overrides everything.
  select mg.*
  into v_manual
  from public.manual_entitlement_grants mg
  where mg.user_id = p_user_id
    and mg.is_active = true
    and mg.revoked_at is null
    and mg.starts_at <= now()
    and (mg.ends_at is null or mg.ends_at > now())
  order by mg.starts_at desc, mg.created_at desc
  limit 1;

  if found then
    return query
    select
      v_manual.tier,
      'active'::text,
      'manual'::text,
      null::text,
      v_manual.starts_at,
      v_manual.ends_at,
      null::timestamptz,
      null::timestamptz,
      null::timestamptz,
      now(),
      'n/a'::text,
      true,
      'v1'::text;
    return;
  end if;

  -- 2. Best provider row wins using status relevance, then freshest useful dates.
  select bs.*
  into v_provider
  from public.billing_subscriptions bs
  where bs.user_id = p_user_id
  order by
    case bs.status
      when 'trial' then 1
      when 'active' then 2
      when 'cancelled_active' then 3
      when 'grace' then 4
      when 'revoked' then 5
      when 'expired' then 6
      when 'free' then 7
      else 99
    end,
    coalesce(bs.current_period_ends_at, bs.trial_ends_at, bs.updated_at, bs.created_at) desc,
    bs.updated_at desc,
    bs.created_at desc
  limit 1;

  if found then
    if v_provider.status in ('trial', 'active', 'cancelled_active', 'grace') then
      return query
      select
        v_provider.tier,
        v_provider.status,
        v_provider.provider,
        v_provider.product_code,
        coalesce(v_provider.started_at, v_provider.created_at),
        v_provider.current_period_ends_at,
        v_provider.current_period_ends_at,
        v_provider.trial_ends_at,
        v_provider.cancelled_at,
        v_provider.last_verified_at,
        v_provider.environment,
        false,
        'v1'::text;
      return;
    elsif v_provider.status = 'revoked' then
      return query
      select
        'free'::text,
        'revoked'::text,
        v_provider.provider,
        v_provider.product_code,
        coalesce(v_provider.started_at, v_provider.created_at),
        v_provider.revoked_at,
        null::timestamptz,
        v_provider.trial_ends_at,
        v_provider.cancelled_at,
        v_provider.last_verified_at,
        v_provider.environment,
        false,
        'v1'::text;
      return;
    elsif v_provider.status = 'expired' then
      return query
      select
        'free'::text,
        'expired'::text,
        v_provider.provider,
        v_provider.product_code,
        coalesce(v_provider.started_at, v_provider.created_at),
        coalesce(v_provider.current_period_ends_at, v_provider.updated_at, now()),
        null::timestamptz,
        v_provider.trial_ends_at,
        v_provider.cancelled_at,
        v_provider.last_verified_at,
        v_provider.environment,
        false,
        'v1'::text;
      return;
    end if;
  end if;

  -- 3. Fallback free state.
  return query
  select
    'free'::text,
    'free'::text,
    'none'::text,
    null::text,
    null::timestamptz,
    null::timestamptz,
    null::timestamptz,
    null::timestamptz,
    null::timestamptz,
    null::timestamptz,
    'n/a'::text,
    false,
    'v1'::text;
end;
$function$

CREATE OR REPLACE FUNCTION public.rpc_progress_overview(p_user uuid, p_search text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  result jsonb;
begin
  with recent as (
    select wh.id, wh.completed_at, wh.duration_seconds, wh.notes,
           coalesce(w.title, 'Workout') as title
    from workout_history wh
    left join workouts w on w.id = wh.workout_id
    where wh.user_id = p_user
    order by wh.completed_at desc
    limit 5
  ),
  workout_items as (
    select weh.workout_history_id as hid,
           e.id as exercise_id, e.name, e.type,
           count(wsh.*) as sets,
           max(wsh.reps) filter (where wsh.reps is not null) as last_reps,
           coalesce(sum(wsh.distance),0)::numeric as total_distance
    from workout_exercise_history weh
    join exercises e on e.id = weh.exercise_id
    join workout_set_history wsh on wsh.workout_exercise_history_id = weh.id
    where weh.workout_history_id in (select id from recent)
    group by weh.workout_history_id, e.id, e.name, e.type
  ),
  recent_json as (
    select jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'completed_at', r.completed_at,
        'duration_seconds', r.duration_seconds,
        'notes', r.notes,
        'title', r.title,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'exercise_id', wi.exercise_id,
            'name', wi.name,
            'type', wi.type,
            'sets', wi.sets,
            'last_reps', wi.last_reps,
            'total_distance', wi.total_distance
          ) order by wi.sets desc)
          from workout_items wi
          where wi.hid = r.id
        ), '[]'::jsonb)
      )
    ) as j
    from recent r
  ),
  ex_list as (
    select e.id, e.name, e.type, max(wh.completed_at) as last_completed_at
    from workout_exercise_history weh
    join exercises e on e.id = weh.exercise_id
    join workout_history wh on wh.id = weh.workout_history_id
    where wh.user_id = p_user
      and (p_search is null or e.name ilike '%'||p_search||'%')
    group by e.id, e.name, e.type
    order by last_completed_at desc
    limit 250
  )
  select jsonb_build_object(
    'recent_workouts', coalesce((select j from recent_json), '[]'::jsonb),
    'exercise_list', coalesce((select jsonb_agg(to_jsonb(ex_list)) from ex_list), '[]'::jsonb)
  )
  into result;

  return result;
end $function$

CREATE OR REPLACE FUNCTION public.save_completed_workout_v1(p_workout jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$declare
  v_user_id uuid;
  v_wh_id uuid;
  v_existing uuid;

  v_client_save_id uuid;

  e jsonb;
  v_weh_id uuid;

  u jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'auth_missing';
  end if;

  -- Required for idempotency
  v_client_save_id := nullif(p_workout->>'client_save_id', '')::uuid;
  if v_client_save_id is null then
    raise exception 'client_save_id_missing';
  end if;

  -- Idempotency: if we've already saved this client_save_id for this user, return existing row
  select wh.id
    into v_existing
  from public.workout_history wh
  where wh.user_id = v_user_id
    and wh.client_save_id = v_client_save_id
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  -- 1) workout_history (atomic parent)
  insert into public.workout_history (
    user_id,
    workout_id,
    completed_at,
    duration_seconds,
    notes,
    client_save_id
  )
  values (
    v_user_id,
    (p_workout->>'workout_id')::uuid,
    (p_workout->>'completed_at')::timestamptz,
    coalesce((p_workout->>'duration_seconds')::int, 0),
    nullif(p_workout->>'notes',''),
    v_client_save_id
  )
  returning id into v_wh_id;

  -- 2) workout_exercise_history + 3) workout_set_history
  for e in
    select * from jsonb_array_elements(coalesce(p_workout->'exercise_history','[]'::jsonb))
  loop
    insert into public.workout_exercise_history (
      workout_history_id,
      exercise_id,
      order_index,
      notes,
      workout_exercise_id,
      is_dropset,
      superset_group,
      superset_index
    )
    values (
      v_wh_id,
      (e->>'exercise_id')::uuid,
      coalesce((e->>'order_index')::int, 0),
      nullif(e->>'notes',''),
      nullif(e->>'workout_exercise_id','')::uuid,
      (e->>'is_dropset')::boolean,
      nullif(e->>'superset_group',''),
      case
        when (e ? 'superset_index') and (e->>'superset_index') <> '' then (e->>'superset_index')::int
        else null
      end
    )
    returning id into v_weh_id;

    insert into public.workout_set_history (
      workout_exercise_history_id,
      set_number,
      drop_index,
      reps,
      weight,
      time_seconds,
      distance,
      notes
    )
    select
      v_weh_id,
      s.set_number,
      coalesce(s.drop_index, 0),
      s.reps,
      s.weight,
      s.time_seconds,
      s.distance,
      s.notes
    from jsonb_to_recordset(coalesce(e->'sets','[]'::jsonb)) as s(
      set_number int,
      drop_index int,
      reps numeric,
      weight numeric,
      time_seconds int,
      distance numeric,
      notes text
    );
  end loop;

  -- 4) plan_workouts weekly_complete (optional) WITH ownership guard
  if (p_workout ? 'plan_workout_id') and (p_workout->>'plan_workout_id') <> '' then
    update public.plan_workouts pw
      set weekly_complete = true
    where pw.id = (p_workout->>'plan_workout_id')::uuid
      and exists (
        select 1
        from public.plans p
        where p.id = pw.plan_id
          and p.user_id = v_user_id
      );
  end if;

  -- 5) workout_exercises target updates (optional) WITH ownership guard
  for u in
    select * from jsonb_array_elements(coalesce(p_workout->'workout_exercise_updates','[]'::jsonb))
  loop
    update public.workout_exercises we
    set
      target_sets = coalesce((u->>'target_sets')::int, we.target_sets),
      target_reps = coalesce((u->>'target_reps')::int, we.target_reps),
      target_weight = coalesce((u->>'target_weight')::numeric, we.target_weight),
      target_time_seconds = coalesce((u->>'target_time_seconds')::int, we.target_time_seconds),
      target_distance = coalesce((u->>'target_distance')::numeric, we.target_distance)
    where we.id = (u->>'id')::uuid
      and exists (
        select 1
        from public.workouts w
        where w.id = we.workout_id
          and w.user_id = v_user_id
      );
  end loop;

    -- 6) process cardio PRs after all history rows are saved
  perform public.process_cardio_prs_for_workout(v_wh_id);

  return v_wh_id;

exception
  when unique_violation then
    -- If two requests race, the unique index wins; return the already-created row.
    select wh.id
      into v_existing
    from public.workout_history wh
    where wh.user_id = v_user_id
      and wh.client_save_id = v_client_save_id
    limit 1;

    if v_existing is not null then
      return v_existing;
    end if;

    raise;
end;$function$

CREATE OR REPLACE FUNCTION public.save_full_plan(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_plan_id uuid;
  v_workout_ids uuid[];
  w jsonb;
  idx int := 0;
begin
  -- Start
  perform pg_advisory_xact_lock(123456789); -- cheap guard, optional

  -- 1) plan
  insert into public.plans (user_id, title, start_date, end_date, is_completed)
  values (
    (p->>'user_id')::uuid,
    p->>'title',
    (p->>'start_date')::date,
    (p->>'end_date')::date,
    false
  )
  returning id into v_plan_id;

  -- 2) workouts
  v_workout_ids := array[]::uuid[];
  for w in select jsonb_array_elements(p->'workouts')
  loop
    insert into public.workouts (user_id, title, notes)
    values (
      (p->>'user_id')::uuid,
      w->>'title',
      null
    )
    returning id into v_workout_ids[idx];
    idx := idx + 1;
  end loop;

  -- 3) plan_workouts + 4) workout_exercises
  idx := 0;
  for w in select jsonb_array_elements(p->'workouts')
  loop
    insert into public.plan_workouts (plan_id, workout_id, title, weekly_complete, order_index)
    values (v_plan_id, v_workout_ids[idx], w->>'title', false, idx);

    -- exercises for this workout
    insert into public.workout_exercises (
      workout_id, exercise_id, order_index,
      target_sets, target_reps, target_weight,
      target_time_seconds, target_distance, notes,
      superset_group, superset_index, is_dropset
    )
    select
      v_workout_ids[idx],
      (ex->>'exercise_id')::uuid,
      (ex->>'order_index')::int,
      nullif(ex->>'target_sets','')::smallint,
      nullif(ex->>'target_reps','')::smallint,
      nullif(ex->>'target_weight','')::numeric,
      nullif(ex->>'target_time_seconds','')::int,
      nullif(ex->>'target_distance','')::numeric,
      nullif(ex->>'notes',''),
      nullif(ex->>'superset_group',''),
      nullif(ex->>'superset_index','')::smallint,
      coalesce((ex->>'is_dropset')::boolean, false)
    from jsonb_array_elements(w->'exercises') ex;

    idx := idx + 1;
  end loop;

  -- 5) goals
  if jsonb_array_length(coalesce(p->'goals','[]'::jsonb)) > 0 then
    insert into public.goals(
      user_id, plan_id, exercise_id, type, target_number, unit, deadline, is_active, notes
    )
    select
      (p->>'user_id')::uuid,
      v_plan_id,
      (g->>'exercise_id')::uuid,
      g->>'type',
      (g->>'target_number')::numeric,
      nullif(g->>'unit',''),
      (p->>'end_date')::date,
      true,
      nullif(g->>'notes','')
    from jsonb_array_elements(p->'goals') g;
  end if;

  return jsonb_build_object('plan_id', v_plan_id, 'workout_ids', v_workout_ids);
exception
  when others then
    -- Any failure aborts the tx automatically; bubble error back
    raise;
end;
$function$

CREATE OR REPLACE FUNCTION public.search_users_social_v1(q text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(user_id uuid, name text, is_private boolean, created_at timestamp with time zone, viewer_follows boolean, request_status text, viewer_blocked boolean, blocked_by_target boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
  with me as (select auth.uid() as uid),
  base as (
    select
      p.id,
      p.name,
      p.is_private,
      p.created_at
    from public.profiles p
    join me on true
    where p.id <> me.uid
      and (
        q is null
        or btrim(q) = ''
        or p.name ilike ('%' || q || '%')
        or p.email ilike ('%' || q || '%')
      )
      and not exists (
        select 1 from public.user_blocks b
        where (b.blocker_id = me.uid and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = me.uid)
      )
    order by p.created_at desc
    limit greatest(1, least(p_limit, 100))
    offset greatest(0, p_offset)
  )
  select
    b.id as user_id,
    b.name,
    b.is_private,
    b.created_at,
    exists(
      select 1 from public.user_follows f
      join me on true
      where f.follower_id = me.uid and f.followee_id = b.id
    ) as viewer_follows,
    (
      select r.status
      from public.follow_requests r
      join me on true
      where r.requester_id = me.uid and r.target_id = b.id
      limit 1
    ) as request_status,
    exists(
      select 1 from public.user_blocks ub
      join me on true
      where ub.blocker_id = me.uid and ub.blocked_id = b.id
    ) as viewer_blocked,
    exists(
      select 1 from public.user_blocks ub
      join me on true
      where ub.blocker_id = b.id and ub.blocked_id = me.uid
    ) as blocked_by_target
  from base b;
$function$

CREATE OR REPLACE FUNCTION public.search_users_v1(q text, p_limit integer DEFAULT 25)
 RETURNS TABLE(user_id uuid, name text, username text, username_lower text, visibility text, workouts_completed integer, followers_count integer, following_count integer, follow_state text, recent_posts jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with me as (
  select auth.uid() as viewer_id
),

base_profiles as (
  select
    p.id as user_id,
    p.name,
    p.username,
    p.username_lower,
    p.visibility
  from public.profiles p, me
  where
    (
      coalesce(nullif(trim(q), ''), '') = ''
      or p.username_lower ilike ('%' || lower(trim(q)) || '%')
    )
    and p.username_lower is not null
    and p.username is not null

    -- exclude blocked users (either direction)
    and not exists (
      select 1
      from public.user_blocks b
      where (b.blocker_id = p.id and b.blocked_id = me.viewer_id)
         or (b.blocker_id = me.viewer_id and b.blocked_id = p.id)
    )

  order by
    case when p.username_lower like (lower(trim(q)) || '%') then 0 else 1 end,
    p.username_lower asc nulls last

  limit greatest(1, least(p_limit, 50))
),

counts as (
  select
    bp.user_id,

    (select count(*)::int
     from public.workout_history wh
     where wh.user_id = bp.user_id) as workouts_completed,

    (select count(*)::int
     from public.user_follows f
     where f.followee_id = bp.user_id) as followers_count,

    (select count(*)::int
     from public.user_follows f
     where f.follower_id = bp.user_id) as following_count

  from base_profiles bp
),

rels as (
  select
    bp.user_id,
    case
      when bp.user_id = (select viewer_id from me) then 'self'
      when exists (
        select 1
        from public.user_follows f, me
        where f.follower_id = me.viewer_id
          and f.followee_id = bp.user_id
      ) then 'following'
      when exists (
        select 1
        from public.follow_requests r, me
        where r.requester_id = me.viewer_id
          and r.target_id = bp.user_id
          and r.status = 'pending'
      ) then 'requested'
      else 'none'
    end as follow_state
  from base_profiles bp
),

post_preview as (
  select
    bp.user_id,

    case
      -- show previews only if profile is public
      when bp.visibility = 'public' then (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', p.id,
              'post_type', p.post_type,
              'caption', p.caption,
              'created_at', p.created_at
            )
            order by p.created_at desc, p.id desc
          ),
          '[]'::jsonb
        )
        from (
          select p.*
          from public.posts p
          where p.user_id = bp.user_id
          order by p.created_at desc, p.id desc
          limit 3
        ) p
      )
      else '[]'::jsonb
    end as recent_posts

  from base_profiles bp
)

select
  bp.user_id,
  bp.name,
  bp.username,
  bp.username_lower,
  bp.visibility::text,   -- ✅ cast enum to text
  c.workouts_completed,
  c.followers_count,
  c.following_count,
  r.follow_state,
  pp.recent_posts
from base_profiles bp
join counts c on c.user_id = bp.user_id
join rels r on r.user_id = bp.user_id
join post_preview pp on pp.user_id = bp.user_id;
$function$

CREATE OR REPLACE FUNCTION public.set_notification_pref_v1(p_key text, p_value boolean)
 RETURNS TABLE(key text, value boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'auth_missing';
  end if;

  -- strict allow-list so users can't write arbitrary keys into settings
  if p_key not in (
    'notif_workout_reminders',
    'notif_goal_progress',
    'notif_social_activity'
  ) then
    raise exception 'invalid_key';
  end if;

  update public.profiles p
  set settings = coalesce(p.settings, '{}'::jsonb) || jsonb_build_object(p_key, p_value),
      updated_at = now()
  where p.id = auth.uid();

  return query
  select p_key, p_value;
end;
$function$

CREATE OR REPLACE FUNCTION public.set_personal_info_v1(p_name text, p_height_cm integer, p_weight_kg numeric, p_date_of_birth text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'auth_missing';
  end if;

  update public.profiles p
  set
    name = p_name,
    height = p_height_cm,
    weight = p_weight_kg,
    date_of_birth = case
      when p_date_of_birth is null or btrim(p_date_of_birth) = '' then null
      else p_date_of_birth::date
    end,
    updated_at = now()
  where p.id = auth.uid();
end;
$function$

CREATE OR REPLACE FUNCTION public.set_privacy_v1(p_is_private boolean)
 RETURNS TABLE(is_private boolean)
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  update public.profiles
  set is_private = coalesce(p_is_private, false),
      updated_at = now()
  where id = auth.uid()
  returning is_private;
$function$

CREATE OR REPLACE FUNCTION public.set_profile_visibility_v1(p_visibility text)
 RETURNS TABLE(visibility text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_vis public.profile_visibility;
begin
  if auth.uid() is null then
    raise exception 'auth_missing';
  end if;

  begin
    v_vis := p_visibility::public.profile_visibility;
  exception when others then
    raise exception 'invalid_visibility';
  end;

  update public.profiles p
  set visibility = v_vis,
      updated_at = now()
  where p.id = auth.uid();

  return query
  select (v_vis::text);
end;
$function$

CREATE OR REPLACE FUNCTION public.set_steps_last_synced(p_day date)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  update user_steps_stats
  set last_synced_day = p_day
  where user_id = auth.uid();
$function$

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.set_username_v1(p_username text)
 RETURNS TABLE(username text, username_lower text)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$declare
  v_display text := trim(coalesce(p_username, ''));
  v_norm text := lower(v_display);
  v_len int := length(v_norm);
  v_taken boolean;
begin
  if auth.uid() is null then
    raise exception 'auth_missing';
  end if;

  if v_len < 3 then raise exception 'username_too_short'; end if;
  if v_len > 13 then raise exception 'username_too_long'; end if;
  if v_norm ~ '\s' then raise exception 'username_no_spaces'; end if;
  if v_norm !~ '^[a-z0-9_]+$' then raise exception 'username_invalid_chars'; end if;

  select exists(
    select 1 from public.profiles p
    where p.username_lower = v_norm
      and p.id <> auth.uid()
  ) into v_taken;

  if v_taken then
    raise exception 'username_taken';
  end if;

  update public.profiles
  set username = v_display,
      updated_at = now()
  where id = auth.uid();

  return query
  select p.username, p.username_lower
  from public.profiles p
  where p.id = auth.uid();
end;$function$

CREATE OR REPLACE FUNCTION public.sync_username_lower()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.username is null then
    new.username_lower := null;
  else
    new.username_lower := lower(new.username);
  end if;
  return new;
end;
$function$

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END $function$

CREATE OR REPLACE FUNCTION public.toggle_post_like(p_post_id uuid)
 RETURNS TABLE(liked boolean, like_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_post_user_id uuid;
  v_visibility text;
  v_post_type text;
  v_exists boolean;
  v_allowed boolean := false;
begin
  if v_user_id is null then
    raise exception 'auth_missing';
  end if;

  if p_post_id is null then
    raise exception 'post_id_required';
  end if;

  -- fetch post
  select p.user_id, p.visibility, p.post_type
    into v_post_user_id, v_visibility, v_post_type
  from public.posts p
  where p.id = p_post_id;

  if not found then
    raise exception 'post_not_found';
  end if;

  -- visibility gate
  if v_post_user_id = v_user_id then
    v_allowed := true;
  elsif v_visibility = 'public' and public.can_view_user(v_user_id, v_post_user_id) then
    v_allowed := true;
  elsif v_visibility = 'followers'
        and public.can_view_user(v_user_id, v_post_user_id)
        and exists (
          select 1
          from public.user_follows f
          where f.follower_id = v_user_id
            and f.followee_id = v_post_user_id
        ) then
    v_allowed := true;
  elsif v_visibility = 'private' and v_post_user_id = v_user_id then
    v_allowed := true;
  end if;

  if not v_allowed then
    raise exception 'not_allowed';
  end if;

  -- toggle
  select exists(
    select 1
    from public.post_likes pl
    where pl.post_id = p_post_id
      and pl.user_id = v_user_id
  )
  into v_exists;

  if v_exists then
    delete from public.post_likes pl
    where pl.post_id = p_post_id
      and pl.user_id = v_user_id;

    liked := false;
  else
    insert into public.post_likes (post_id, user_id, created_at)
    values (p_post_id, v_user_id, now())
    on conflict do nothing;

    liked := true;
  end if;

  select count(*)::int
    into like_count
  from public.post_likes pl
  where pl.post_id = p_post_id;

  return next;
end;
$function$

CREATE OR REPLACE FUNCTION public.unfollow(p_target uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  if p_target is null or p_target = v_me then
    raise exception 'Invalid target';
  end if;

  delete from public.user_follows
  where follower_id = v_me and followee_id = p_target;
end;
$function$

CREATE OR REPLACE FUNCTION public.update_full_plan(p_plan_id uuid, p_user_id uuid, p_title text, p_end_date date, p_workouts jsonb, p_goals jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  -- workouts
  w              jsonb;
  we             jsonb;
  w_id           uuid;        -- plan_workouts.id
  wk_id          uuid;        -- workouts.id
  payload_pw_ids uuid[];
  i              int := 0;

  -- exercises
  payload_we_ids uuid[];
  we_id          uuid;
  supg           text;
  ord            int;
  dropb          boolean;
  ex_id          uuid;

BEGIN
  -- 0) Auth + shape guards
  if p_user_id <> auth.uid() then
    raise exception 'Not allowed (user mismatch)';
  end if;

  if p_workouts is not null and jsonb_typeof(p_workouts) <> 'array' then
    raise exception 'p_workouts must be a jsonb array';
  end if;

  if p_goals is not null and jsonb_typeof(p_goals) <> 'array' then
    raise exception 'p_goals must be a jsonb array';
  end if;

  -- 1) Ownership guard
  IF NOT EXISTS (
    SELECT 1
    FROM public.plans
    WHERE id = p_plan_id
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Plan not found or not owned by user';
  END IF;

  -- 2) Goals are not quota-limited. Ownership and payload validation remain enforced.

  -- 3) Plan meta
  UPDATE public.plans
     SET title      = COALESCE(p_title, title),
         end_date   = p_end_date,
         updated_at = now()
   WHERE id = p_plan_id;

  payload_pw_ids := '{}'::uuid[];

  -- 4) Bump existing plan_workouts indices to avoid collisions during rewrite
  UPDATE public.plan_workouts
     SET order_index = order_index + 10000
   WHERE plan_id = p_plan_id
     AND is_archived = false;

  -- 5) Upsert plan_workouts + exercises
  FOR w IN
    SELECT *
    FROM jsonb_array_elements(COALESCE(p_workouts, '[]'::jsonb))
  LOOP
    i := i + 1;

    -- parse plan_workouts.id
    BEGIN
      w_id := NULLIF((w->>'id')::uuid, NULL);
    EXCEPTION WHEN others THEN
      w_id := NULL;
    END;

    IF w_id IS NULL THEN
      -- New workout created inside a plan edit must NOT count toward template quota
      INSERT INTO public.workouts (
        user_id,
        title,
        created_source,
        counts_toward_template_limit,
        archived_at,
        deleted_at
      )
      VALUES (
        p_user_id,
        COALESCE(w->>'title', 'Workout'),
        'plan_clone',
        false,
        null,
        null
      )
      RETURNING id INTO wk_id;

      INSERT INTO public.plan_workouts (
        plan_id,
        workout_id,
        title,
        order_index,
        is_archived
      )
      VALUES (
        p_plan_id,
        wk_id,
        COALESCE(w->>'title', 'Workout'),
        COALESCE((w->>'order_index')::int, i - 1),
        false
      )
      RETURNING id INTO w_id;
    ELSE
      UPDATE public.plan_workouts
         SET title       = COALESCE(w->>'title', title),
             order_index = COALESCE((w->>'order_index')::int, order_index),
             is_archived = false
       WHERE id = w_id
         AND plan_id = p_plan_id;

      SELECT workout_id
        INTO wk_id
      FROM public.plan_workouts
      WHERE id = w_id
        AND plan_id = p_plan_id
      LIMIT 1;
    END IF;

    payload_pw_ids := payload_pw_ids || w_id;

    -- bump existing workout_exercises indices to avoid collisions during rewrite
    UPDATE public.workout_exercises
       SET order_index = order_index + 10000
     WHERE workout_id = wk_id
       AND is_archived = false;

    -- upsert exercises for this workout
    payload_we_ids := '{}'::uuid[];

    FOR we IN
      SELECT *
      FROM jsonb_array_elements(COALESCE(w->'exercises', '[]'::jsonb))
    LOOP
      BEGIN
        we_id := NULLIF((we->>'id')::uuid, NULL);
      EXCEPTION WHEN others THEN
        we_id := NULL;
      END;

      ord   := COALESCE((we->>'order_index')::int, 0);
      dropb := COALESCE((we->>'isDropset')::boolean, false);
      supg  := NULLIF(we->>'supersetGroup', '');
      ex_id := (we->>'exerciseId')::uuid;

      IF we_id IS NULL THEN
        INSERT INTO public.workout_exercises (
          workout_id,
          exercise_id,
          order_index,
          superset_group,
          is_dropset,
          is_archived
        )
        VALUES (
          wk_id,
          ex_id,
          ord,
          supg,
          dropb,
          false
        )
        RETURNING id INTO we_id;
      ELSE
        UPDATE public.workout_exercises
           SET exercise_id    = ex_id,
               order_index    = ord,
               superset_group = supg,
               is_dropset     = dropb,
               is_archived    = false
         WHERE id = we_id
           AND workout_id = wk_id;
      END IF;

      payload_we_ids := payload_we_ids || we_id;
    END LOOP;

    -- archive exercises not present in payload
    UPDATE public.workout_exercises
       SET is_archived = true
     WHERE workout_id = wk_id
       AND is_archived = false
       AND (payload_we_ids IS NULL OR NOT (id = ANY(payload_we_ids)));

    -- normalize exercise order
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY order_index, id) - 1 AS rn
      FROM public.workout_exercises
      WHERE workout_id = wk_id
        AND is_archived = false
    )
    UPDATE public.workout_exercises we2
       SET order_index = r.rn
      FROM ranked r
     WHERE we2.id = r.id;
  END LOOP;

  -- 6) Archive plan_workouts not present in payload
  UPDATE public.plan_workouts
     SET is_archived = true
   WHERE plan_id = p_plan_id
     AND is_archived = false
     AND (payload_pw_ids IS NULL OR NOT (id = ANY(payload_pw_ids)));

  -- 7) Normalize plan_workouts order
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY order_index, id) - 1 AS rn
    FROM public.plan_workouts
    WHERE plan_id = p_plan_id
      AND is_archived = false
  )
  UPDATE public.plan_workouts pw
     SET order_index = r.rn
    FROM ranked r
   WHERE pw.id = r.id;

  -- =======================
  -- 8) GOALS: upsert + archive (preserve IDs & history)
  -- =======================

  -- Archive goals not present in payload (by id when provided, else natural key)
  WITH incoming AS (
    SELECT
      NULLIF(g->>'id','')::uuid           AS id,
      (g->>'exerciseId')::uuid            AS exercise_id,
      (g->>'mode')::public.goal_type      AS type,
      NULLIF(g->>'target','')::numeric    AS target_number,
      NULLIF(g->>'unit','')               AS unit,
      CASE
        WHEN (g ? 'start') AND g->>'start' <> ''
          THEN jsonb_build_object('start', (g->>'start')::numeric)::text
        ELSE NULL
      END                                 AS notes
    FROM jsonb_array_elements(COALESCE(p_goals, '[]'::jsonb)) g
  )
  UPDATE public.goals old
     SET is_active = false,
         updated_at = now()
   WHERE old.plan_id = p_plan_id
     AND old.user_id = p_user_id
     AND old.is_active = true
     AND NOT EXISTS (
       SELECT 1
       FROM incoming i
       WHERE (i.id IS NOT NULL AND old.id = i.id)
          OR (i.id IS NULL
              AND old.exercise_id = i.exercise_id
              AND old.type = i.type)
     );

  -- Upsert active goals by natural key
  WITH incoming AS (
    SELECT
      NULLIF(g->>'id','')::uuid           AS id,
      (g->>'exerciseId')::uuid            AS exercise_id,
      (g->>'mode')::public.goal_type      AS type,
      NULLIF(g->>'target','')::numeric    AS target_number,
      NULLIF(g->>'unit','')               AS unit,
      CASE
        WHEN (g ? 'start') AND g->>'start' <> ''
          THEN jsonb_build_object('start', (g->>'start')::numeric)::text
        ELSE NULL
      END                                 AS notes
    FROM jsonb_array_elements(COALESCE(p_goals, '[]'::jsonb)) g
  )
  INSERT INTO public.goals (
    id,
    user_id,
    plan_id,
    exercise_id,
    type,
    target_number,
    unit,
    notes,
    is_active,
    updated_at
  )
  SELECT
    COALESCE(i.id, gen_random_uuid()),
    p_user_id,
    p_plan_id,
    i.exercise_id,
    i.type,
    COALESCE(i.target_number, 0),
    i.unit,
    i.notes,
    true,
    now()
  FROM incoming i
  ON CONFLICT (plan_id, exercise_id, type) WHERE is_active = true
  DO UPDATE SET
    target_number = EXCLUDED.target_number,
    unit          = EXCLUDED.unit,
    notes         = EXCLUDED.notes,
    is_active     = true,
    updated_at    = now();

  -- Reactivate archived goals when explicit ids are provided
  WITH incoming AS (
    SELECT
      NULLIF(g->>'id','')::uuid           AS id,
      (g->>'exerciseId')::uuid            AS exercise_id,
      (g->>'mode')::public.goal_type      AS type,
      NULLIF(g->>'target','')::numeric    AS target_number,
      NULLIF(g->>'unit','')               AS unit,
      CASE
        WHEN (g ? 'start') AND g->>'start' <> ''
          THEN jsonb_build_object('start', (g->>'start')::numeric)::text
        ELSE NULL
      END                                 AS notes
    FROM jsonb_array_elements(COALESCE(p_goals, '[]'::jsonb)) g
  )
  UPDATE public.goals g
     SET target_number = COALESCE(i.target_number, g.target_number),
         unit          = COALESCE(i.unit, g.unit),
         notes         = COALESCE(i.notes, g.notes),
         is_active     = true,
         updated_at    = now()
    FROM incoming i
   WHERE i.id IS NOT NULL
     AND g.id = i.id
     AND g.user_id = p_user_id
     AND g.plan_id = p_plan_id
     AND g.is_active = false;

END;
$function$

CREATE OR REPLACE FUNCTION public.update_full_plan_test_v1(p_plan_id uuid, p_user_id uuid, p_title text, p_end_date date, p_workouts jsonb, p_goals jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  -- workouts
  w              jsonb;
  we             jsonb;
  w_id           uuid;
  wk_id          uuid;
  payload_pw_ids uuid[];
  i              int := 0;

  -- exercises
  payload_we_ids uuid[];
  we_id          uuid;
  supg           text;
  ord            int;
  dropb          boolean;
  ex_id          uuid;

  -- billing / entitlement
  v_limits       jsonb;
  v_max_goals    integer;
  v_goal_count   integer;
BEGIN
  if p_workouts is not null and jsonb_typeof(p_workouts) <> 'array' then
    raise exception 'p_workouts must be a jsonb array';
  end if;

  if p_goals is not null and jsonb_typeof(p_goals) <> 'array' then
    raise exception 'p_goals must be a jsonb array';
  end if;

  IF NOT EXISTS (
    SELECT 1
    FROM public.plans
    WHERE id = p_plan_id
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Plan not found or not owned by user';
  END IF;

  v_limits := public.get_user_enforcement_limits(p_user_id);
  v_max_goals := coalesce((v_limits->>'maxGoalsPerPlan')::integer, 2);
  v_goal_count := jsonb_array_length(coalesce(p_goals, '[]'::jsonb));

  if v_goal_count > v_max_goals then
    raise exception using
      errcode = 'P0001',
      message = 'GOAL_LIMIT_REACHED',
      detail = format(
        'Goal limit reached for this plan. Current=%s Max=%s',
        v_goal_count,
        v_max_goals
      );
  end if;

  UPDATE public.plans
     SET title      = COALESCE(p_title, title),
         end_date   = p_end_date,
         updated_at = now()
   WHERE id = p_plan_id;

  payload_pw_ids := '{}'::uuid[];

  UPDATE public.plan_workouts
     SET order_index = order_index + 10000
   WHERE plan_id = p_plan_id
     AND is_archived = false;

  FOR w IN
    SELECT * FROM jsonb_array_elements(COALESCE(p_workouts, '[]'::jsonb))
  LOOP
    i := i + 1;

    BEGIN
      w_id := NULLIF((w->>'id')::uuid, NULL);
    EXCEPTION WHEN others THEN
      w_id := NULL;
    END;

    IF w_id IS NULL THEN
      INSERT INTO public.workouts (
        user_id,
        title,
        created_source,
        counts_toward_template_limit,
        archived_at,
        deleted_at
      )
      VALUES (
        p_user_id,
        COALESCE(w->>'title', 'Workout'),
        'plan_clone',
        false,
        null,
        null
      )
      RETURNING id INTO wk_id;

      INSERT INTO public.plan_workouts (
        plan_id,
        workout_id,
        title,
        order_index,
        is_archived
      )
      VALUES (
        p_plan_id,
        wk_id,
        COALESCE(w->>'title', 'Workout'),
        COALESCE((w->>'order_index')::int, i - 1),
        false
      )
      RETURNING id INTO w_id;
    ELSE
      UPDATE public.plan_workouts
         SET title       = COALESCE(w->>'title', title),
             order_index = COALESCE((w->>'order_index')::int, order_index),
             is_archived = false
       WHERE id = w_id
         AND plan_id = p_plan_id;

      SELECT workout_id
        INTO wk_id
      FROM public.plan_workouts
      WHERE id = w_id
        AND plan_id = p_plan_id
      LIMIT 1;
    END IF;

    payload_pw_ids := payload_pw_ids || w_id;
    payload_we_ids := '{}'::uuid[];

    UPDATE public.workout_exercises
       SET order_index = order_index + 10000
     WHERE workout_id = wk_id
       AND is_archived = false;

    FOR we IN
      SELECT * FROM jsonb_array_elements(COALESCE(w->'exercises', '[]'::jsonb))
    LOOP
      BEGIN
        we_id := NULLIF((we->>'id')::uuid, NULL);
      EXCEPTION WHEN others THEN
        we_id := NULL;
      END;

      ord   := COALESCE((we->>'order_index')::int, 0);
      dropb := COALESCE((we->>'isDropset')::boolean, false);
      supg  := NULLIF(we->>'supersetGroup', '');
      ex_id := (we->>'exerciseId')::uuid;

      IF we_id IS NULL THEN
        INSERT INTO public.workout_exercises (
          workout_id,
          exercise_id,
          order_index,
          superset_group,
          is_dropset,
          is_archived
        )
        VALUES (
          wk_id,
          ex_id,
          ord,
          supg,
          dropb,
          false
        )
        RETURNING id INTO we_id;
      ELSE
        UPDATE public.workout_exercises
           SET exercise_id    = ex_id,
               order_index    = ord,
               superset_group = supg,
               is_dropset     = dropb,
               is_archived    = false
         WHERE id = we_id
           AND workout_id = wk_id;
      END IF;

      payload_we_ids := payload_we_ids || we_id;
    END LOOP;

    UPDATE public.workout_exercises
       SET is_archived = true
     WHERE workout_id = wk_id
       AND is_archived = false
       AND (payload_we_ids IS NULL OR NOT (id = ANY(payload_we_ids)));

    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY order_index, id) - 1 AS rn
      FROM public.workout_exercises
      WHERE workout_id = wk_id
        AND is_archived = false
    )
    UPDATE public.workout_exercises we2
       SET order_index = r.rn
      FROM ranked r
     WHERE we2.id = r.id;
  END LOOP;

  UPDATE public.plan_workouts
     SET is_archived = true
   WHERE plan_id = p_plan_id
     AND is_archived = false
     AND (payload_pw_ids IS NULL OR NOT (id = ANY(payload_pw_ids)));

  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY order_index, id) - 1 AS rn
    FROM public.plan_workouts
    WHERE plan_id = p_plan_id
      AND is_archived = false
  )
  UPDATE public.plan_workouts pw
     SET order_index = r.rn
    FROM ranked r
   WHERE pw.id = r.id;

  WITH incoming AS (
    SELECT
      NULLIF(g->>'id','')::uuid        AS id,
      (g->>'exerciseId')::uuid         AS exercise_id,
      (g->>'mode')::public.goal_type   AS type,
      NULLIF(g->>'target','')::numeric AS target_number,
      NULLIF(g->>'unit','')            AS unit,
      CASE
        WHEN (g ? 'start') AND g->>'start' <> ''
          THEN jsonb_build_object('start', (g->>'start')::numeric)::text
        ELSE NULL
      END AS notes
    FROM jsonb_array_elements(COALESCE(p_goals, '[]'::jsonb)) g
  )
  UPDATE public.goals old
     SET is_active = false,
         updated_at = now()
   WHERE old.plan_id = p_plan_id
     AND old.user_id = p_user_id
     AND old.is_active = true
     AND NOT EXISTS (
       SELECT 1
       FROM incoming i
       WHERE (i.id IS NOT NULL AND old.id = i.id)
          OR (i.id IS NULL AND old.exercise_id = i.exercise_id AND old.type = i.type)
     );

  WITH incoming AS (
    SELECT
      NULLIF(g->>'id','')::uuid        AS id,
      (g->>'exerciseId')::uuid         AS exercise_id,
      (g->>'mode')::public.goal_type   AS type,
      NULLIF(g->>'target','')::numeric AS target_number,
      NULLIF(g->>'unit','')            AS unit,
      CASE
        WHEN (g ? 'start') AND g->>'start' <> ''
          THEN jsonb_build_object('start', (g->>'start')::numeric)::text
        ELSE NULL
      END AS notes
    FROM jsonb_array_elements(COALESCE(p_goals, '[]'::jsonb)) g
  )
  INSERT INTO public.goals (
    id,
    user_id,
    plan_id,
    exercise_id,
    type,
    target_number,
    unit,
    notes,
    is_active,
    updated_at
  )
  SELECT
    COALESCE(i.id, gen_random_uuid()),
    p_user_id,
    p_plan_id,
    i.exercise_id,
    i.type,
    COALESCE(i.target_number, 0),
    i.unit,
    i.notes,
    true,
    now()
  FROM incoming i
  ON CONFLICT (plan_id, exercise_id, type) WHERE is_active = true
  DO UPDATE SET
    target_number = EXCLUDED.target_number,
    unit          = EXCLUDED.unit,
    notes         = EXCLUDED.notes,
    is_active     = true,
    updated_at    = now();

  WITH incoming AS (
    SELECT
      NULLIF(g->>'id','')::uuid        AS id,
      (g->>'exerciseId')::uuid         AS exercise_id,
      (g->>'mode')::public.goal_type   AS type,
      NULLIF(g->>'target','')::numeric AS target_number,
      NULLIF(g->>'unit','')            AS unit,
      CASE
        WHEN (g ? 'start') AND g->>'start' <> ''
          THEN jsonb_build_object('start', (g->>'start')::numeric)::text
        ELSE NULL
      END AS notes
    FROM jsonb_array_elements(COALESCE(p_goals, '[]'::jsonb)) g
  )
  UPDATE public.goals g
     SET target_number = COALESCE(i.target_number, g.target_number),
         unit          = COALESCE(i.unit, g.unit),
         notes         = COALESCE(i.notes, g.notes),
         is_active     = true,
         updated_at    = now()
    FROM incoming i
   WHERE i.id IS NOT NULL
     AND g.id = i.id
     AND g.user_id = p_user_id
     AND g.plan_id = p_plan_id
     AND g.is_active = false;
END;
$function$

CREATE OR REPLACE FUNCTION public.update_weekly_goal_stats(p_user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  r record;
  ws date;
  we date;
  wcount int;
BEGIN
  FOR r IN
    SELECT id AS user_id,
           COALESCE(timezone, 'UTC') AS tz,
           weekly_workout_goal AS goal
    FROM public.profiles
    WHERE p_user_id IS NULL OR id = p_user_id
  LOOP
    -- Previous-week [start,end) in UTC for this user's timezone
    SELECT (start_utc::date), (end_utc::date)
      INTO ws, we
      FROM public.prev_week_bounds_sunday(r.tz);

    -- Count completed workouts in that window
    SELECT COUNT(*)
      INTO wcount
      FROM public.workout_history wh
     WHERE wh.user_id = r.user_id
       AND wh.completed_at >= ws
       AND wh.completed_at <  we;

    -- Upsert snapshot
    INSERT INTO public.user_weekly_goal_stats (user_id, week_start, week_end, goal, workouts_completed, met_goal)
    VALUES (r.user_id, ws, we, r.goal, wcount, wcount >= r.goal)
    ON CONFLICT (user_id, week_start)
    DO UPDATE SET
      goal = EXCLUDED.goal,
      workouts_completed = EXCLUDED.workouts_completed,
      met_goal = EXCLUDED.met_goal,
      created_at = now();
  END LOOP;
END;
$function$

CREATE OR REPLACE FUNCTION public.update_weekly_streak_and_reset_plans(p_user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  u record;
  last_stats record;
  v_new_streak int;
begin
  -- Loop over profiles (all or just one)
  for u in
    select id, weekly_streak
    from public.profiles
    where p_user_id is null or id = p_user_id
  loop
    -- Most recent weekly stats row for this user
    select *
    into last_stats
    from public.user_weekly_workout_stats
    where user_id = u.id
    order by week_key desc
    limit 1;

    if not found then
      -- No weekly data yet → reset streak
      v_new_streak := 0;
    else
      -- Make sure 'met' is correct on that row
      update public.user_weekly_workout_stats
      set
        met        = (coalesce(completed, 0)
                      >= greatest(1, coalesce(goal, 0))),
        updated_at = now()
      where user_id = u.id
        and week_key = last_stats.week_key;

      -- Decide new streak:
      if coalesce(last_stats.completed, 0)
         >= greatest(1, coalesce(last_stats.goal, 0)) then
        v_new_streak := coalesce(u.weekly_streak, 0) + 1;
      else
        v_new_streak := 0;
      end if;
    end if;

    -- Update profile with new weekly streak
    update public.profiles
    set weekly_streak = v_new_streak
    where id = u.id;

    -- Reset plan_workouts.weekly_complete for this user's active plans
    update public.plan_workouts pw
    set weekly_complete = false
    from public.plans p
    where pw.plan_id = p.id
      and p.user_id = u.id
      and coalesce(p.is_completed, false) = false;
      -- if you want to reset even completed plans, drop the last line
  end loop;
end;
$function$

CREATE OR REPLACE FUNCTION public.update_workout_v1(p_workout jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_workout_id uuid := (p_workout->>'workout_id')::uuid;
  v_title text := btrim(coalesce(p_workout->>'title',''));
  v_notes text := nullif(btrim(coalesce(p_workout->>'notes','')), '');
  v_now timestamptz := now();
  v_image_key text;
begin
  -- -------- Guards --------
  if v_user_id is null then
    raise exception 'auth_missing';
  end if;

  if v_workout_id is null then
    raise exception 'workout_id_missing';
  end if;

  if length(v_title) = 0 then
    raise exception 'title_required';
  end if;

  if not exists (
    select 1
    from public.workouts
    where id = v_workout_id
      and user_id = v_user_id
      and deleted_at is null
      and created_source in ('user', 'starter_clone', 'plan_clone')
  ) then
    raise exception 'not_found_or_forbidden';
  end if;

  -- -------- Update workout --------
  update public.workouts
  set
    title = v_title,
    notes = v_notes,
    updated_at = v_now
  where id = v_workout_id;

  -- -------- Temp incoming exercises --------
  create temp table tmp_incoming_we (
    id uuid,
    exercise_id uuid not null,
    order_index smallint not null,
    notes text,
    is_dropset boolean,
    superset_group text,
    superset_index smallint
  ) on commit drop;

  insert into tmp_incoming_we
  select
    nullif(btrim(coalesce(x->>'id','')), '')::uuid,
    (x->>'exercise_id')::uuid,
    (x->>'order_index')::smallint,
    nullif(btrim(coalesce(x->>'notes','')), ''),
    coalesce((x->>'is_dropset')::boolean, false),
    nullif(upper(btrim(coalesce(x->>'superset_group',''))), ''),
    nullif((x->>'superset_index')::smallint, null)
  from jsonb_array_elements(coalesce(p_workout->'exercises','[]'::jsonb)) x;

  if (select count(*) from tmp_incoming_we) = 0 then
    raise exception 'exercises_required';
  end if;

  update public.workout_exercises we
  set
    order_index = we.order_index + 1000,
    updated_at = v_now
  where we.workout_id = v_workout_id
    and coalesce(we.is_archived, false) = false
    and exists (
      select 1
      from tmp_incoming_we i
      where i.id is not null
        and i.id = we.id
    );

  update public.workout_exercises we
  set
    is_archived = true,
    updated_at = v_now
  where we.workout_id = v_workout_id
    and coalesce(we.is_archived, false) = false
    and not exists (
      select 1
      from tmp_incoming_we i
      where i.id is not null
        and i.id = we.id
    );

  if exists (
    select 1
    from tmp_incoming_we i
    join public.workout_exercises we on we.id = i.id
    where we.workout_id = v_workout_id
      and we.exercise_id <> i.exercise_id
  ) then
    raise exception 'exercise_id_mismatch_for_existing_row';
  end if;

  update public.workout_exercises we
  set
    order_index = i.order_index,
    notes = i.notes,
    is_dropset = coalesce(i.is_dropset, false),
    superset_group = i.superset_group,
    superset_index = i.superset_index,
    is_archived = false,
    updated_at = v_now
  from tmp_incoming_we i
  where i.id is not null
    and we.id = i.id
    and we.workout_id = v_workout_id;

  insert into public.workout_exercises (
    workout_id,
    exercise_id,
    order_index,
    notes,
    is_dropset,
    superset_group,
    superset_index,
    is_archived,
    created_at,
    updated_at
  )
  select
    v_workout_id,
    i.exercise_id,
    i.order_index,
    i.notes,
    coalesce(i.is_dropset, false),
    i.superset_group,
    i.superset_index,
    false,
    v_now,
    v_now
  from tmp_incoming_we i
  where i.id is null;

  v_image_key := public.compute_workout_image_key_v1(v_workout_id);

  update public.workouts
  set workout_image_key = v_image_key,
      updated_at = v_now
  where id = v_workout_id;

  return v_workout_id;
end;
$function$

CREATE OR REPLACE FUNCTION public.user_trained_days(p_user_id uuid, p_days_back integer DEFAULT 120)
 RETURNS TABLE(day_key text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
  select distinct to_char((wh.completed_at at time zone 'UTC')::date, 'YYYY-MM-DD') as day_key
  from public.workout_history wh
  where wh.user_id = p_user_id
    and wh.completed_at >= now() - make_interval(days => p_days_back)
  order by day_key;
$function$

CREATE OR REPLACE FUNCTION public.workout_session_checkpoint_latest_active()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
select to_jsonb(c)
from public.workout_session_checkpoints c
where c.user_id = auth.uid()
  and c.status = 'active'
order by c.updated_at desc
limit 1;
$function$

CREATE OR REPLACE FUNCTION public.workout_session_checkpoint_upsert(p_session_id uuid, p_workout_id uuid, p_plan_workout_id uuid DEFAULT NULL::uuid, p_status text DEFAULT 'active'::text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions', 'pg_catalog'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_row public.workout_session_checkpoints%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- ensure the workout is owned by the user (prevents writing checkpoints for others)
  if not exists (
    select 1 from public.workouts w
    where w.id = p_workout_id and w.user_id = v_user_id
  ) then
    raise exception 'Workout not found / not owned';
  end if;

  insert into public.workout_session_checkpoints (
    user_id, session_id, workout_id, plan_workout_id, status, payload, updated_at
  )
  values (
    v_user_id, p_session_id, p_workout_id, p_plan_workout_id, p_status, p_payload, now()
  )
  on conflict (user_id, session_id)
  do update set
    workout_id = excluded.workout_id,
    plan_workout_id = excluded.plan_workout_id,
    status = excluded.status,
    payload = excluded.payload,
    updated_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'sessionId', v_row.session_id,
    'status', v_row.status,
    'updatedAt', v_row.updated_at
  );
end;
$function$
