-- MuscleMetric database baseline: views, triggers and RLS policies
-- Current-state reconstruction from production on 2026-10-07.
-- Remote migration version 20260925170744 is already marked applied.
-- Future changes belong in new migrations.

CREATE VIEW public.v_week_boundaries_london WITH (security_invoker=true) AS  SELECT (date_trunc('week'::text, (now() AT TIME ZONE 'Europe/London'::text)) AT TIME ZONE 'Europe/London'::text) AS week_start_london,
    ((date_trunc('week'::text, (now() AT TIME ZONE 'Europe/London'::text)) - '7 days'::interval) AT TIME ZONE 'Europe/London'::text) AS last_week_start_london;;

CREATE VIEW admin.v_user_workout_history_header_all AS  SELECT wh.user_id,
    wh.id,
    wh.completed_at,
    wh.duration_seconds,
    wh.notes,
    w.title AS workout_title
   FROM workout_history wh
     LEFT JOIN workouts w ON w.id = wh.workout_id;;

CREATE VIEW public.v_exercises_compact WITH (security_invoker=true) AS  SELECT id,
    name,
    type,
    popularity,
    ( SELECT m.name
           FROM exercise_muscles em
             JOIN muscles m ON m.id = em.muscle_id
          WHERE em.exercise_id = e.id
          ORDER BY em.contribution DESC NULLS LAST
         LIMIT 1) AS primary_muscle
   FROM exercises e;;

CREATE VIEW public.v_user_daily_volume WITH (security_invoker=true) AS  SELECT wh.user_id,
    date_trunc('day'::text, wh.completed_at) AS day,
    COALESCE(sum(wsh.reps::numeric * COALESCE(wsh.weight, 0::numeric)), 0::numeric) AS volume
   FROM workout_history wh
     JOIN workout_exercise_history weh ON weh.workout_history_id = wh.id
     JOIN workout_set_history wsh ON wsh.workout_exercise_history_id = weh.id
  WHERE wh.user_id = auth.uid()
  GROUP BY wh.user_id, (date_trunc('day'::text, wh.completed_at));;

CREATE VIEW public.v_user_exercise_last_trained WITH (security_invoker=true) AS  SELECT wh.user_id,
    weh.exercise_id,
    max(wh.completed_at) AS last_completed_at
   FROM workout_exercise_history weh
     JOIN workout_history wh ON wh.id = weh.workout_history_id
  GROUP BY wh.user_id, weh.exercise_id;;

CREATE VIEW public.v_user_latest_pr WITH (security_invoker=true) AS  WITH sets_join AS (
         SELECT wh.user_id,
            COALESCE(ex.name, 'Exercise'::text) AS exercise_name,
            wsh.weight::numeric AS weight,
            wsh.reps::integer AS reps,
            wh.completed_at
           FROM workout_history wh
             JOIN workout_exercise_history wexh ON wexh.workout_history_id = wh.id
             JOIN workout_set_history wsh ON wsh.workout_exercise_history_id = wexh.id
             LEFT JOIN exercises ex ON ex.id = wexh.exercise_id
          WHERE COALESCE(wsh.weight, 0::numeric) > 0::numeric AND COALESCE(wsh.reps::integer, 0) > 0
        ), ranked AS (
         SELECT sets_join.user_id,
            sets_join.exercise_name,
            sets_join.weight,
            sets_join.reps,
            sets_join.completed_at,
            row_number() OVER (PARTITION BY sets_join.user_id ORDER BY sets_join.weight DESC, sets_join.reps DESC, sets_join.completed_at DESC) AS rn
           FROM sets_join
        )
 SELECT user_id,
    exercise_name,
    weight::numeric(10,2) AS weight,
    reps,
    completed_at
   FROM ranked
  WHERE rn = 1;;

CREATE VIEW public.v_user_latest_pr_v2 WITH (security_invoker=true) AS  WITH sets AS (
         SELECT wh.user_id,
            e.name AS exercise_name,
            wsh.weight::numeric(10,2) AS weight,
            wsh.reps::integer AS reps,
            wh.completed_at
           FROM workout_set_history wsh
             JOIN workout_exercise_history wexh ON wexh.id = wsh.workout_exercise_history_id
             JOIN workout_history wh ON wh.id = wexh.workout_history_id
             JOIN exercises e ON e.id = wexh.exercise_id
          WHERE COALESCE(wsh.weight, 0::numeric) > 0::numeric AND COALESCE(wsh.reps::integer, 0) > 0
        ), by_ex AS (
         SELECT s.user_id,
            s.exercise_name,
            s.weight,
            s.reps,
            s.completed_at,
            max(s.weight) OVER (PARTITION BY s.user_id, s.exercise_name) AS max_w
           FROM sets s
        ), latest_user_pr AS (
         SELECT DISTINCT ON (by_ex.user_id) by_ex.user_id,
            by_ex.exercise_name,
            by_ex.weight,
            by_ex.reps,
            by_ex.completed_at
           FROM by_ex
          WHERE by_ex.weight = by_ex.max_w
          ORDER BY by_ex.user_id, by_ex.completed_at DESC
        ), prev_best AS (
         SELECT l_1.user_id,
            max(s.weight)::numeric(10,2) AS prev_weight
           FROM latest_user_pr l_1
             JOIN sets s ON s.user_id = l_1.user_id AND s.exercise_name = l_1.exercise_name AND s.weight < l_1.weight
          GROUP BY l_1.user_id
        )
 SELECT l.user_id,
    l.exercise_name,
    l.weight,
    l.reps,
    l.completed_at,
    p.prev_weight,
        CASE
            WHEN p.prev_weight IS NULL OR p.prev_weight = 0::numeric THEN NULL::numeric
            ELSE round((l.weight - p.prev_weight) / p.prev_weight * 100.0, 1)
        END AS pct_increase
   FROM latest_user_pr l
     LEFT JOIN prev_best p ON p.user_id = l.user_id;;

CREATE VIEW public.v_user_muscle_breakdown_last7d WITH (security_invoker=true) AS  WITH recent_sets AS (
         SELECT wh.user_id,
            we.exercise_id,
            sum(COALESCE(ws.reps::integer, 0)::numeric * COALESCE(ws.weight, 0::numeric)) AS volume,
            (wh.completed_at AT TIME ZONE 'Europe/London'::text) AS completed_london
           FROM workout_history wh
             JOIN workout_exercise_history we ON we.workout_history_id = wh.id
             JOIN workout_set_history ws ON ws.workout_exercise_history_id = we.id
          WHERE COALESCE(ws.reps::integer, 0) > 0 AND COALESCE(ws.weight, 0::numeric) > 0::numeric AND wh.completed_at >= ((now() AT TIME ZONE 'Europe/London'::text) - '7 days'::interval)
          GROUP BY wh.user_id, we.exercise_id, wh.completed_at
        ), primary_muscle_map AS (
         SELECT em.exercise_id,
            m.name AS muscle_name
           FROM exercise_muscles em
             JOIN muscles m ON m.id = em.muscle_id
          WHERE em.contribution = (( SELECT max(em2.contribution) AS max
                   FROM exercise_muscles em2
                  WHERE em2.exercise_id = em.exercise_id))
        ), muscle_volume AS (
         SELECT r.user_id,
            pm.muscle_name,
            sum(r.volume) AS muscle_volume
           FROM recent_sets r
             JOIN primary_muscle_map pm ON pm.exercise_id = r.exercise_id
          GROUP BY r.user_id, pm.muscle_name
        ), totals AS (
         SELECT muscle_volume.user_id,
            sum(muscle_volume.muscle_volume) AS total_volume
           FROM muscle_volume
          GROUP BY muscle_volume.user_id
        )
 SELECT mv.user_id,
    mv.muscle_name,
    mv.muscle_volume,
    round(mv.muscle_volume / NULLIF(t.total_volume, 0::numeric) * 100::numeric, 2) AS pct_of_week
   FROM muscle_volume mv
     JOIN totals t ON t.user_id = mv.user_id;;

CREATE VIEW public.v_user_next_workout WITH (security_invoker=true) AS  WITH ap AS (
         SELECT pr.id AS user_id,
            pr.active_plan_id
           FROM profiles pr
        ), incomplete AS (
         SELECT ap.user_id,
            pw.title,
            pw.order_index,
            1 AS pref_order
           FROM ap
             JOIN plan_workouts pw ON pw.plan_id = ap.active_plan_id
          WHERE pw.weekly_complete = false
        ), all_first AS (
         SELECT ap.user_id,
            pw.title,
            pw.order_index,
            2 AS pref_order
           FROM ap
             JOIN plan_workouts pw ON pw.plan_id = ap.active_plan_id
        ), unioned AS (
         SELECT incomplete.user_id,
            incomplete.title,
            incomplete.order_index,
            incomplete.pref_order
           FROM incomplete
        UNION ALL
         SELECT all_first.user_id,
            all_first.title,
            all_first.order_index,
            all_first.pref_order
           FROM all_first
        )
 SELECT DISTINCT ON (user_id) user_id,
    title AS next_workout_title
   FROM unioned
  ORDER BY user_id, pref_order, order_index;;

CREATE VIEW public.v_user_pr_timeseries WITH (security_invoker=true) AS  SELECT wh.user_id,
    weh.exercise_id,
    e.name AS exercise_name,
    date_trunc('day'::text, wh.completed_at)::date AS day,
    max(COALESCE(wsh.weight, 0::numeric) * (1::numeric + COALESCE(wsh.reps::integer, 0)::numeric / 30.0)) AS e1rm,
    max(COALESCE(wsh.weight, 0::numeric)) AS max_weight
   FROM workout_history wh
     JOIN workout_exercise_history weh ON weh.workout_history_id = wh.id
     JOIN workout_set_history wsh ON wsh.workout_exercise_history_id = weh.id
     JOIN exercises e ON e.id = weh.exercise_id
  GROUP BY wh.user_id, weh.exercise_id, e.name, (date_trunc('day'::text, wh.completed_at));;

CREATE VIEW public.v_user_top_muscle_last7d WITH (security_invoker=true) AS  WITH bounds AS (
         SELECT (now() AT TIME ZONE 'Europe/London'::text)::date - '6 days'::interval AS start_london,
            (now() AT TIME ZONE 'Europe/London'::text)::date + '1 day'::interval AS end_london
        ), sets_join AS (
         SELECT wh.user_id,
            wexh.exercise_id,
            wsh.reps,
            wsh.weight,
            wsh.time_seconds,
            wsh.distance,
            wh.completed_at
           FROM workout_history wh
             JOIN workout_exercise_history wexh ON wexh.workout_history_id = wh.id
             JOIN workout_set_history wsh ON wsh.workout_exercise_history_id = wexh.id
        ), tw AS (
         SELECT sj.user_id,
            sj.exercise_id,
            sj.reps,
            sj.weight,
            sj.time_seconds,
            sj.distance,
            sj.completed_at
           FROM sets_join sj
             CROSS JOIN bounds b
          WHERE (sj.completed_at AT TIME ZONE 'Europe/London'::text) >= b.start_london AND (sj.completed_at AT TIME ZONE 'Europe/London'::text) < b.end_london
        ), vol_rows AS (
         SELECT tw.user_id,
            tw.exercise_id,
            tw.reps::numeric * tw.weight::numeric AS vol
           FROM tw
          WHERE COALESCE(tw.reps::integer, 0) > 0 AND COALESCE(tw.weight, 0::numeric) > 0::numeric
        ), em_rank AS (
         SELECT em.exercise_id,
            em.muscle_id,
            em.contribution,
            row_number() OVER (PARTITION BY em.exercise_id ORDER BY em.contribution DESC, em.muscle_id) AS rn
           FROM exercise_muscles em
        ), em_primary_one AS (
         SELECT em_rank.exercise_id,
            em_rank.muscle_id
           FROM em_rank
          WHERE em_rank.rn = 1
        ), vol_primary AS (
         SELECT v.user_id,
            m.name AS muscle_name,
            sum(v.vol) AS vol
           FROM vol_rows v
             JOIN em_primary_one p ON p.exercise_id = v.exercise_id
             JOIN muscles m ON m.id = p.muscle_id
          GROUP BY v.user_id, m.name
        ), totals AS (
         SELECT vol_primary.user_id,
            sum(vol_primary.vol) AS vol_total
           FROM vol_primary
          GROUP BY vol_primary.user_id
        ), ranked AS (
         SELECT vp.user_id,
            vp.muscle_name,
            vp.vol,
            t.vol_total,
                CASE
                    WHEN COALESCE(t.vol_total, 0::numeric) = 0::numeric THEN 0::numeric
                    ELSE round(vp.vol / t.vol_total, 4)
                END AS pct,
            row_number() OVER (PARTITION BY vp.user_id ORDER BY vp.vol DESC) AS rn
           FROM vol_primary vp
             JOIN totals t ON t.user_id = vp.user_id
        )
 SELECT user_id,
    muscle_name,
    vol::bigint AS muscle_volume,
    (pct * 100.0)::numeric(5,2) AS pct_of_week
   FROM ranked
  WHERE rn = 1;;

CREATE VIEW public.v_user_top_muscle_last_week WITH (security_invoker=true) AS  WITH bounds AS (
         SELECT v_week_boundaries_london.week_start_london - '7 days'::interval AS wk_start,
            v_week_boundaries_london.week_start_london AS wk_end
           FROM v_week_boundaries_london
        ), sets_join AS (
         SELECT wh.user_id,
            wexh.exercise_id,
            wsh.reps,
            wsh.weight,
            wsh.time_seconds,
            wsh.distance,
            wh.completed_at
           FROM workout_history wh
             JOIN workout_exercise_history wexh ON wexh.workout_history_id = wh.id
             JOIN workout_set_history wsh ON wsh.workout_exercise_history_id = wexh.id
        ), tw AS (
         SELECT sj.user_id,
            sj.exercise_id,
            sj.reps,
            sj.weight,
            sj.time_seconds,
            sj.distance,
            sj.completed_at
           FROM sets_join sj
             CROSS JOIN bounds b
          WHERE (sj.completed_at AT TIME ZONE 'Europe/London'::text) >= b.wk_start AND (sj.completed_at AT TIME ZONE 'Europe/London'::text) < b.wk_end
        ), vol_rows AS (
         SELECT tw.user_id,
            tw.exercise_id,
            tw.reps::numeric * tw.weight::numeric AS vol
           FROM tw
          WHERE COALESCE(tw.reps::integer, 0) > 0 AND COALESCE(tw.weight, 0::numeric) > 0::numeric
        ), vol_primary AS (
         SELECT v.user_id,
            m.name AS muscle_name,
            sum(v.vol) AS vol
           FROM vol_rows v
             JOIN exercise_muscles em ON em.exercise_id = v.exercise_id
             JOIN muscles m ON m.id = em.muscle_id
          WHERE em.contribution = 100
          GROUP BY v.user_id, m.name
        ), totals AS (
         SELECT vol_primary.user_id,
            sum(vol_primary.vol) AS vol_total
           FROM vol_primary
          GROUP BY vol_primary.user_id
        ), ranked AS (
         SELECT vp.user_id,
            vp.muscle_name,
            vp.vol,
            t.vol_total,
                CASE
                    WHEN COALESCE(t.vol_total, 0::numeric) = 0::numeric THEN 0::numeric
                    ELSE round(vp.vol / t.vol_total, 4)
                END AS pct,
            row_number() OVER (PARTITION BY vp.user_id ORDER BY (
                CASE
                    WHEN t.vol_total = 0::numeric THEN 0::numeric
                    ELSE vp.vol / t.vol_total
                END) DESC, vp.vol DESC) AS rn
           FROM vol_primary vp
             JOIN totals t ON t.user_id = vp.user_id
        )
 SELECT user_id,
    muscle_name,
    vol::bigint AS muscle_volume,
    (pct * 100.0)::numeric(5,2) AS pct_of_week
   FROM ranked
  WHERE rn = 1;;

CREATE VIEW public.v_user_top_muscle_this_week WITH (security_invoker=true) AS  WITH bounds AS (
         SELECT v_week_boundaries_london.week_start_london,
            v_week_boundaries_london.week_start_london + '7 days'::interval AS week_end_london
           FROM v_week_boundaries_london
        ), sets_join AS (
         SELECT wh.user_id,
            wexh.exercise_id,
            wsh.reps,
            wsh.weight,
            wsh.time_seconds,
            wsh.distance,
            wh.completed_at
           FROM workout_history wh
             JOIN workout_exercise_history wexh ON wexh.workout_history_id = wh.id
             JOIN workout_set_history wsh ON wsh.workout_exercise_history_id = wexh.id
        ), tw AS (
         SELECT sets_join.user_id,
            sets_join.exercise_id,
            sets_join.reps,
            sets_join.weight,
            sets_join.time_seconds,
            sets_join.distance,
            sets_join.completed_at,
            b.week_start_london,
            b.week_end_london
           FROM sets_join,
            bounds b
          WHERE (sets_join.completed_at AT TIME ZONE 'Europe/London'::text) >= b.week_start_london AND (sets_join.completed_at AT TIME ZONE 'Europe/London'::text) < b.week_end_london
        ), vol_rows AS (
         SELECT tw.user_id,
            tw.exercise_id,
            tw.reps::numeric * tw.weight::numeric AS vol
           FROM tw
          WHERE COALESCE(tw.reps::integer, 0) > 0 AND COALESCE(tw.weight, 0::numeric) > 0::numeric
        ), cardio_rows AS (
         SELECT tw.user_id,
            1::numeric AS cardio_score
           FROM tw
          WHERE (COALESCE(tw.reps::integer, 0) = 0 OR COALESCE(tw.weight, 0::numeric) = 0::numeric) AND (COALESCE(tw.time_seconds, 0) > 0 OR COALESCE(tw.distance, 0::numeric) > 0::numeric)
        ), primary_map AS (
         SELECT em.exercise_id,
            em.muscle_id
           FROM exercise_muscles em
             JOIN ( SELECT exercise_muscles.exercise_id,
                    max(exercise_muscles.contribution) AS max_c
                   FROM exercise_muscles
                  GROUP BY exercise_muscles.exercise_id) mx ON mx.exercise_id = em.exercise_id AND em.contribution = mx.max_c
        ), vol_primary AS (
         SELECT v.user_id,
            m.name AS muscle_name,
            sum(v.vol) AS vol
           FROM vol_rows v
             JOIN primary_map pm ON pm.exercise_id = v.exercise_id
             JOIN muscles m ON m.id = pm.muscle_id
          GROUP BY v.user_id, m.name
        ), totals AS (
         SELECT vol_primary.user_id,
            sum(vol_primary.vol) AS vol_total
           FROM vol_primary
          GROUP BY vol_primary.user_id
        ), ranked AS (
         SELECT vp.user_id,
            vp.muscle_name,
            vp.vol,
            t.vol_total,
                CASE
                    WHEN COALESCE(t.vol_total, 0::numeric) = 0::numeric THEN 0::numeric
                    ELSE round(vp.vol / t.vol_total, 4)
                END AS pct,
            row_number() OVER (PARTITION BY vp.user_id ORDER BY vp.vol DESC) AS rn
           FROM vol_primary vp
             JOIN totals t ON t.user_id = vp.user_id
        ), cardio AS (
         SELECT cardio_rows.user_id,
            sum(cardio_rows.cardio_score) AS cardio_sessions_this_week
           FROM cardio_rows
          GROUP BY cardio_rows.user_id
        )
 SELECT r.user_id,
    r.muscle_name,
    r.vol::bigint AS muscle_volume,
    (r.pct * 100.0)::numeric(5,2) AS pct_of_week,
    COALESCE(c.cardio_sessions_this_week, 0::numeric) AS cardio_sessions_this_week
   FROM ranked r
     LEFT JOIN cardio c ON c.user_id = r.user_id
  WHERE r.rn = 1;;

CREATE VIEW public.v_user_totals WITH (security_invoker=true) AS  SELECT user_id,
    count(*) AS workouts_completed
   FROM workout_history wh
  WHERE user_id = auth.uid()
  GROUP BY user_id;;

CREATE VIEW public.v_user_trained_days_utc WITH (security_invoker=true) AS  SELECT user_id,
    completed_at::date::text AS day_key
   FROM workout_history
  GROUP BY user_id, (completed_at::date);;

CREATE VIEW public.v_user_weekly_basics WITH (security_invoker=true) AS  WITH bounds AS (
         SELECT v_week_boundaries_london.week_start_london,
            v_week_boundaries_london.week_start_london + '7 days'::interval AS week_end_london,
            v_week_boundaries_london.last_week_start_london,
            v_week_boundaries_london.last_week_start_london + '7 days'::interval AS last_week_end_london
           FROM v_week_boundaries_london
        ), active_plan AS (
         SELECT pr_1.id AS user_id,
            pr_1.active_plan_id,
            pl.weekly_target_sessions AS plan_weekly_goal
           FROM profiles pr_1
             LEFT JOIN plans pl ON pl.id = pr_1.active_plan_id
        ), wh_this AS (
         SELECT wh_1.user_id,
            count(*)::integer AS workouts_this_week
           FROM workout_history wh_1,
            bounds b
          WHERE (wh_1.completed_at AT TIME ZONE 'Europe/London'::text) >= b.week_start_london AND (wh_1.completed_at AT TIME ZONE 'Europe/London'::text) < b.week_end_london
          GROUP BY wh_1.user_id
        ), sets_join AS (
         SELECT wh_1.user_id,
            wexh.exercise_id,
            wsh.reps,
            wsh.weight,
            wsh.time_seconds,
            wsh.distance,
            wh_1.completed_at
           FROM workout_history wh_1
             JOIN workout_exercise_history wexh ON wexh.workout_history_id = wh_1.id
             JOIN workout_set_history wsh ON wsh.workout_exercise_history_id = wexh.id
        ), vol_this AS (
         SELECT sj.user_id,
            COALESCE(sum(sj.reps::numeric * sj.weight::numeric), 0::numeric) AS volume_this_week
           FROM sets_join sj,
            bounds b
          WHERE (sj.completed_at AT TIME ZONE 'Europe/London'::text) >= b.week_start_london AND (sj.completed_at AT TIME ZONE 'Europe/London'::text) < b.week_end_london
          GROUP BY sj.user_id
        ), vol_last AS (
         SELECT sj.user_id,
            COALESCE(sum(sj.reps::numeric * sj.weight::numeric), 0::numeric) AS volume_last_week
           FROM sets_join sj,
            bounds b
          WHERE (sj.completed_at AT TIME ZONE 'Europe/London'::text) >= b.last_week_start_london AND (sj.completed_at AT TIME ZONE 'Europe/London'::text) < b.last_week_end_london
          GROUP BY sj.user_id
        )
 SELECT pr.id AS user_id,
    COALESCE(wh.workouts_this_week, 0) AS workouts_this_week,
    COALESCE(ap.plan_weekly_goal, pr.weekly_workout_goal, NULLIF(pr.settings ->> 'weekly_workout_goal'::text, ''::text)::integer, 3) AS weekly_workout_goal,
    COALESCE(vt.volume_this_week, 0::numeric)::bigint AS volume_this_week,
    COALESCE(vl.volume_last_week, 0::numeric)::bigint AS volume_last_week,
        CASE
            WHEN COALESCE(vl.volume_last_week, 0::numeric) = 0::numeric THEN NULL::numeric
            ELSE round(COALESCE(vt.volume_this_week, 0::numeric) / NULLIF(vl.volume_last_week, 0::numeric), 4)
        END AS volume_vs_last_week_ratio
   FROM profiles pr
     LEFT JOIN active_plan ap ON ap.user_id = pr.id
     LEFT JOIN wh_this wh ON wh.user_id = pr.id
     LEFT JOIN vol_this vt ON vt.user_id = pr.id
     LEFT JOIN vol_last vl ON vl.user_id = pr.id;;

CREATE VIEW public.v_user_workout_history_header WITH (security_invoker=true) AS  SELECT wh.user_id,
    wh.id,
    wh.completed_at,
    wh.duration_seconds,
    wh.notes,
    w.title AS workout_title
   FROM workout_history wh
     LEFT JOIN workouts w ON w.id = wh.workout_id
  WHERE wh.user_id = auth.uid();;

CREATE VIEW public.v_user_workout_history_list WITH (security_invoker=true) AS  SELECT wh.user_id,
    wh.id,
    wh.completed_at,
    wh.duration_seconds,
    wh.notes,
    w.title AS workout_title,
    ( SELECT jsonb_agg(x.* ORDER BY x.sets DESC, x.name) AS jsonb_agg
           FROM ( SELECT e.name,
                    count(*)::integer AS sets,
                    max(wsh.reps)::integer AS reps
                   FROM workout_set_history wsh
                     JOIN workout_exercise_history weh ON weh.id = wsh.workout_exercise_history_id
                     JOIN exercises e ON e.id = weh.exercise_id
                  WHERE weh.workout_history_id = wh.id
                  GROUP BY e.name
                  ORDER BY (count(*)) DESC, e.name
                 LIMIT 5) x) AS preview_items
   FROM workout_history wh
     LEFT JOIN workouts w ON w.id = wh.workout_id;;

CREATE TRIGGER trg_billing_subscriptions_updated_at BEFORE UPDATE ON billing_subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_device_tokens_updated_at BEFORE UPDATE ON device_tokens FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_exercises_updated BEFORE UPDATE ON exercises FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_follow_requests_accepted_notification_v1 AFTER UPDATE ON follow_requests FOR EACH ROW EXECUTE FUNCTION handle_follow_request_accepted_notification_v1();

CREATE TRIGGER trg_follow_requests_created_notification_v1 AFTER INSERT ON follow_requests FOR EACH ROW EXECUTE FUNCTION handle_follow_request_created_notification_v1();

CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_notification_preferences_updated_at BEFORE UPDATE ON notification_preferences FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_plan_workouts BEFORE UPDATE ON plan_workouts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_plans BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_post_comments_notification_v1 AFTER INSERT ON post_comments FOR EACH ROW EXECUTE FUNCTION handle_post_commented_notification_v1();

CREATE TRIGGER trg_post_likes_notification_v1 AFTER INSERT ON post_likes FOR EACH ROW EXECUTE FUNCTION handle_post_liked_notification_v1();

CREATE TRIGGER trg_profiles_create_notification_preferences AFTER INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION handle_new_notification_preferences();

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sync_username_lower BEFORE INSERT OR UPDATE OF username ON profiles FOR EACH ROW EXECUTE FUNCTION sync_username_lower();

CREATE TRIGGER trg_user_entitlements_updated_at BEFORE UPDATE ON user_entitlements FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_user_follows_notification_v1 AFTER INSERT ON user_follows FOR EACH ROW EXECUTE FUNCTION handle_follow_notification_v1();

CREATE TRIGGER trg_bump_exercise_usage_session AFTER INSERT ON workout_exercise_history FOR EACH ROW EXECUTE FUNCTION bump_exercise_usage_session();

CREATE TRIGGER set_updated_at_workout_exercises BEFORE UPDATE ON workout_exercises FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_workout_exercises_updated BEFORE UPDATE ON workout_exercises FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_bump_exercise_usage_set AFTER INSERT ON workout_set_history FOR EACH ROW EXECUTE FUNCTION bump_exercise_usage_set();

CREATE TRIGGER trg_workouts_updated BEFORE UPDATE ON workouts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE POLICY "deletion_requests: insert own" ON public.account_deletion_requests AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "deletion_requests: read own" ON public.account_deletion_requests AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY "read achievements" ON public.achievements AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "admin insert error events" ON public.admin_error_events AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::app_role)))));

CREATE POLICY "admin read error events" ON public.admin_error_events AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::app_role)))));

CREATE POLICY "admin read job definitions" ON public.admin_job_definitions AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::app_role)))));

CREATE POLICY "admin write job definitions" ON public.admin_job_definitions AS PERMISSIVE FOR ALL TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::app_role))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::app_role)))));

CREATE POLICY "admin read job runs" ON public.admin_job_runs AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::app_role)))));

CREATE POLICY "admin update job runs" ON public.admin_job_runs AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::app_role)))));

CREATE POLICY "admin write job runs" ON public.admin_job_runs AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::app_role)))));

CREATE POLICY "admin insert rpc audit" ON public.admin_rpc_audit AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::app_role)))));

CREATE POLICY "admin read rpc audit" ON public.admin_rpc_audit AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::app_role)))));

CREATE POLICY app_feedback_insert_own ON public.app_feedback AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "daily_steps: select own" ON public.daily_steps AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "daily_steps: update own" ON public.daily_steps AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "daily_steps: upsert own" ON public.daily_steps AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "device tokens own" ON public.device_tokens AS PERMISSIVE FOR ALL TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY device_tokens_delete_own ON public.device_tokens AS PERMISSIVE FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY device_tokens_insert_own ON public.device_tokens AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY device_tokens_select_own ON public.device_tokens AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY device_tokens_update_own ON public.device_tokens AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "favorites delete own" ON public.exercise_favorites AS PERMISSIVE FOR DELETE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "favorites insert own" ON public.exercise_favorites AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "favorites read own" ON public.exercise_favorites AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "read exercise_muscles" ON public.exercise_muscles AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "exercise_usage insert own" ON public.exercise_usage AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "exercise_usage select own" ON public.exercise_usage AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "exercise_usage update own" ON public.exercise_usage AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "exercises: user can create private" ON public.exercises AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (is_public = false)));

CREATE POLICY "insert own exercises" ON public.exercises AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (is_public = false)));

CREATE POLICY "read exercises" ON public.exercises AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "read public or own exercises" ON public.exercises AS PERMISSIVE FOR SELECT TO PUBLIC USING (((is_public = true) OR (user_id = ( SELECT auth.uid() AS uid))));

CREATE POLICY "update own exercises" ON public.exercises AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "follow_requests: requester can create" ON public.follow_requests AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((requester_id = auth.uid()) AND (NOT (EXISTS ( SELECT 1
   FROM user_blocks b
  WHERE (((b.blocker_id = follow_requests.target_id) AND (b.blocked_id = auth.uid())) OR ((b.blocker_id = auth.uid()) AND (b.blocked_id = follow_requests.target_id))))))));

CREATE POLICY "follow_requests: requester can read own" ON public.follow_requests AS PERMISSIVE FOR SELECT TO authenticated USING ((requester_id = auth.uid()));

CREATE POLICY "follow_requests: target can read incoming" ON public.follow_requests AS PERMISSIVE FOR SELECT TO authenticated USING ((target_id = auth.uid()));

CREATE POLICY "follow_requests: target can respond" ON public.follow_requests AS PERMISSIVE FOR UPDATE TO authenticated USING ((target_id = auth.uid())) WITH CHECK (((target_id = auth.uid()) AND (status = ANY (ARRAY['accepted'::text, 'rejected'::text]))));

CREATE POLICY "goals delete own" ON public.goals AS PERMISSIVE FOR DELETE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "goals insert own" ON public.goals AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "goals select own" ON public.goals AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "goals update own" ON public.goals AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "live drafts: delete own" ON public.live_workout_drafts AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY "live drafts: read own" ON public.live_workout_drafts AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY "live drafts: update own" ON public.live_workout_drafts AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "live drafts: upsert own" ON public.live_workout_drafts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "read muscles" ON public.muscles AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);

CREATE POLICY notification_preferences_select_own ON public.notification_preferences AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY notification_preferences_update_own ON public.notification_preferences AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY notifications_select_own ON public.notifications AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = recipient_id));

CREATE POLICY notifications_update_own_read_state ON public.notifications AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = recipient_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = recipient_id));

CREATE POLICY "owner can insert plan_shares" ON public.plan_shares AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "owner can read own plan_shares" ON public.plan_shares AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "owner can update plan_shares" ON public.plan_shares AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "pw delete via parent" ON public.plan_workouts AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM plans p
  WHERE ((p.id = plan_workouts.plan_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "pw insert via parent" ON public.plan_workouts AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM plans p
  WHERE ((p.id = plan_workouts.plan_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "pw select via parent" ON public.plan_workouts AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM plans p
  WHERE ((p.id = plan_workouts.plan_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "pw update via parent" ON public.plan_workouts AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM plans p
  WHERE ((p.id = plan_workouts.plan_id) AND (p.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM plans p
  WHERE ((p.id = plan_workouts.plan_id) AND (p.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "plans delete own" ON public.plans AS PERMISSIVE FOR DELETE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "plans insert own" ON public.plans AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "plans select own" ON public.plans AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "plans update own" ON public.plans AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "comments: add if can view post" ON public.post_comments AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((user_id = auth.uid()) AND (deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM posts p
  WHERE ((p.id = post_comments.post_id) AND ((p.user_id = auth.uid()) OR ((p.visibility = 'public'::text) AND can_view_user(auth.uid(), p.user_id)) OR ((p.visibility = 'followers'::text) AND can_view_user(auth.uid(), p.user_id) AND (EXISTS ( SELECT 1
           FROM user_follows f
          WHERE ((f.follower_id = auth.uid()) AND (f.followee_id = p.user_id)))))))))));

CREATE POLICY "comments: delete own" ON public.post_comments AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY "comments: read if can view post" ON public.post_comments AS PERMISSIVE FOR SELECT TO PUBLIC USING (((deleted_at IS NULL) AND (EXISTS ( SELECT 1
   FROM posts p
  WHERE ((p.id = post_comments.post_id) AND ((p.user_id = auth.uid()) OR ((p.visibility = 'public'::text) AND can_view_user(auth.uid(), p.user_id)) OR ((p.visibility = 'followers'::text) AND can_view_user(auth.uid(), p.user_id) AND (EXISTS ( SELECT 1
           FROM user_follows f
          WHERE ((f.follower_id = auth.uid()) AND (f.followee_id = p.user_id)))))))))));

CREATE POLICY "comments: update own" ON public.post_comments AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "likes: add if can view post" ON public.post_likes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND can_interact_with_post_v1(( SELECT auth.uid() AS uid), post_id)));

CREATE POLICY "likes: read if can view post" ON public.post_likes AS PERMISSIVE FOR SELECT TO authenticated USING (can_interact_with_post_v1(( SELECT auth.uid() AS uid), post_id));

CREATE POLICY "likes: remove own" ON public.post_likes AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "posts: owner can delete" ON public.posts AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY "posts: owner can update" ON public.posts AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "posts: read allowed" ON public.posts AS PERMISSIVE FOR SELECT TO PUBLIC USING (((user_id = auth.uid()) OR ((visibility = 'public'::text) AND can_view_user(auth.uid(), user_id)) OR ((visibility = 'followers'::text) AND can_view_user(auth.uid(), user_id) AND (EXISTS ( SELECT 1
   FROM user_follows f
  WHERE ((f.follower_id = auth.uid()) AND (f.followee_id = posts.user_id)))))));

CREATE POLICY "posts: user can create" ON public.posts AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_id = auth.uid()));

CREATE POLICY profiles_insert_own ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((id = ( SELECT auth.uid() AS uid)));

CREATE POLICY profiles_select_own ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((id = ( SELECT auth.uid() AS uid)));

CREATE POLICY profiles_select_visible ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (true);

CREATE POLICY profiles_update_own ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((id = ( SELECT auth.uid() AS uid))) WITH CHECK ((id = ( SELECT auth.uid() AS uid)));

CREATE POLICY starter_clones_insert_own ON public.starter_workout_clones AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_id = auth.uid()));

CREATE POLICY starter_clones_select_own ON public.starter_workout_clones AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = auth.uid()));

CREATE POLICY "uap read own" ON public.user_achievement_progress AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "uap write own delete" ON public.user_achievement_progress AS PERMISSIVE FOR DELETE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "uap write own insert" ON public.user_achievement_progress AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "uap write own update" ON public.user_achievement_progress AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "ua read own" ON public.user_achievements AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "ua write own delete" ON public.user_achievements AS PERMISSIVE FOR DELETE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "ua write own insert" ON public.user_achievements AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "ua write own update" ON public.user_achievements AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "blocks: blocker can create" ON public.user_blocks AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((blocker_id = auth.uid()));

CREATE POLICY "blocks: blocker can delete" ON public.user_blocks AS PERMISSIVE FOR DELETE TO authenticated USING ((blocker_id = auth.uid()));

CREATE POLICY "blocks: blocker can read" ON public.user_blocks AS PERMISSIVE FOR SELECT TO authenticated USING ((blocker_id = auth.uid()));

CREATE POLICY users_can_read_own_entitlement ON public.user_entitlements AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY user_events_delete_own ON public.user_events AS PERMISSIVE FOR DELETE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY user_events_insert_own ON public.user_events AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY user_events_select_own ON public.user_events AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY user_events_update_own ON public.user_events AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "follows: user can follow if allowed" ON public.user_follows AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (((follower_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = user_follows.followee_id) AND (p.visibility = ANY (ARRAY['public'::profile_visibility, 'followers'::profile_visibility])) AND can_view_user(auth.uid(), p.id))))));

CREATE POLICY "follows: user can read own follows" ON public.user_follows AS PERMISSIVE FOR SELECT TO authenticated USING (((follower_id = auth.uid()) OR (followee_id = auth.uid())));

CREATE POLICY "follows: user can unfollow" ON public.user_follows AS PERMISSIVE FOR DELETE TO authenticated USING ((follower_id = auth.uid()));

CREATE POLICY "user_steps_stats: select own" ON public.user_steps_stats AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can read their own weekly goal stats" ON public.user_weekly_goal_stats AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can insert their own weekly workout stats" ON public.user_weekly_workout_stats AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can read their own weekly workout stats" ON public.user_weekly_workout_stats AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can update their own weekly workout stats" ON public.user_weekly_workout_stats AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "weh delete via parent" ON public.workout_exercise_history AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM workout_history wh
  WHERE ((wh.id = workout_exercise_history.workout_history_id) AND (wh.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "weh insert via parent" ON public.workout_exercise_history AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM workout_history wh
  WHERE ((wh.id = workout_exercise_history.workout_history_id) AND (wh.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "weh select via parent" ON public.workout_exercise_history AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM workout_history wh
  WHERE ((wh.id = workout_exercise_history.workout_history_id) AND (wh.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "weh update via parent" ON public.workout_exercise_history AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM workout_history wh
  WHERE ((wh.id = workout_exercise_history.workout_history_id) AND (wh.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM workout_history wh
  WHERE ((wh.id = workout_exercise_history.workout_history_id) AND (wh.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "we delete via parent" ON public.workout_exercises AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = workout_exercises.workout_id) AND (w.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "we insert via parent" ON public.workout_exercises AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = workout_exercises.workout_id) AND (w.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "we select via parent" ON public.workout_exercises AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = workout_exercises.workout_id) AND (w.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "we update via parent" ON public.workout_exercises AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = workout_exercises.workout_id) AND (w.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM workouts w
  WHERE ((w.id = workout_exercises.workout_id) AND (w.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "wh delete own" ON public.workout_history AS PERMISSIVE FOR DELETE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "wh insert own" ON public.workout_history AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "wh select own" ON public.workout_history AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "wh update own" ON public.workout_history AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "checkpoint: read own" ON public.workout_session_checkpoints AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY "checkpoint: update own" ON public.workout_session_checkpoints AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "checkpoint: upsert own" ON public.workout_session_checkpoints AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "wsh delete via parent" ON public.workout_set_history AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM (workout_exercise_history weh
     JOIN workout_history wh ON ((wh.id = weh.workout_history_id)))
  WHERE ((weh.id = workout_set_history.workout_exercise_history_id) AND (wh.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "wsh insert via parent" ON public.workout_set_history AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM (workout_exercise_history weh
     JOIN workout_history wh ON ((wh.id = weh.workout_history_id)))
  WHERE ((weh.id = workout_set_history.workout_exercise_history_id) AND (wh.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "wsh select via parent" ON public.workout_set_history AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM (workout_exercise_history weh
     JOIN workout_history wh ON ((wh.id = weh.workout_history_id)))
  WHERE ((weh.id = workout_set_history.workout_exercise_history_id) AND (wh.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "wsh update via parent" ON public.workout_set_history AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM (workout_exercise_history weh
     JOIN workout_history wh ON ((wh.id = weh.workout_history_id)))
  WHERE ((weh.id = workout_set_history.workout_exercise_history_id) AND (wh.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (workout_exercise_history weh
     JOIN workout_history wh ON ((wh.id = weh.workout_history_id)))
  WHERE ((weh.id = workout_set_history.workout_exercise_history_id) AND (wh.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "workouts delete own" ON public.workouts AS PERMISSIVE FOR DELETE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "workouts insert own" ON public.workouts AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "workouts select own" ON public.workouts AS PERMISSIVE FOR SELECT TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "workouts update own" ON public.workouts AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
