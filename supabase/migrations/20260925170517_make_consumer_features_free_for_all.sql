-- MuscleMetric database baseline
-- Reconstructed from the live Supabase project on 2026-10-07.
--
-- IMPORTANT:
-- The production project already records migration version 20260925170517 as applied.
-- This file is part of a squashed baseline aligned to the existing remote migration
-- history. It is intentionally a current-state reconstruction, not the original
-- historical contents of that migration.
--
-- Do not edit this baseline to make future schema changes. Add a new migration.

CREATE SCHEMA IF NOT EXISTS admin AUTHORIZATION postgres;

CREATE TYPE public.achievement_category AS ENUM ('strength', 'endurance', 'consistency', 'skill', 'general');

CREATE TYPE public.achievement_difficulty AS ENUM ('easy', 'medium', 'hard', 'elite', 'legendary');

CREATE TYPE public.app_role AS ENUM ('user', 'pt', 'admin');

CREATE TYPE public.exercise_level AS ENUM ('beginner', 'intermediate', 'advanced');

CREATE TYPE public.exercise_type AS ENUM ('strength', 'cardio', 'mobility');

CREATE TYPE public.goal_cmp AS ENUM ('>=', '<=', '=');

CREATE TYPE public.goal_period AS ENUM ('day', 'week', 'month', 'total');

CREATE TYPE public.goal_type AS ENUM ('weight', 'reps', 'volume', 'frequency', 'time', 'distance', 'workout_frequency', 'exercise_weight', 'exercise_reps', 'exercise_1rm', 'steps_daily', 'body_weight', 'custom_numeric');

CREATE TYPE public.profile_visibility AS ENUM ('public', 'followers', 'private');

CREATE SEQUENCE admin.job_runs_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;

CREATE SEQUENCE admin.weekly_reset_log_id_seq AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;

CREATE SEQUENCE public.muscles_id_seq AS smallint INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1 NO CYCLE;

CREATE TABLE admin.job_runs (
  id bigint DEFAULT nextval('admin.job_runs_id_seq'::regclass) NOT NULL,
  job_name text NOT NULL,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  finished_at timestamp with time zone,
  ok boolean,
  note text,
  meta jsonb
);

CREATE TABLE admin.user_weekly_volume (
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  volume numeric DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE admin.weekly_reset_log (
  id bigint DEFAULT nextval('admin.weekly_reset_log_id_seq'::regclass) NOT NULL,
  ran_at timestamp with time zone DEFAULT now() NOT NULL,
  affected_pw integer NOT NULL,
  note text,
  affected_streaks integer,
  volume_rows integer
);

CREATE TABLE public.account_deletion_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  processed_at timestamp with time zone,
  status text DEFAULT 'requested'::text NOT NULL
);

CREATE TABLE public.achievements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  code text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category achievement_category NOT NULL,
  difficulty achievement_difficulty NOT NULL,
  rule jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.admin_error_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  source text NOT NULL,
  level text DEFAULT 'error'::text NOT NULL,
  event_key text NOT NULL,
  message text NOT NULL,
  user_id uuid,
  meta jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.admin_job_definitions (
  job_key text NOT NULL,
  title text NOT NULL,
  description text,
  expected_every_minutes integer NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  alert_after_minutes integer DEFAULT 120 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.admin_job_runs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  job_key text NOT NULL,
  job_source text DEFAULT 'db'::text NOT NULL,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  finished_at timestamp with time zone,
  status text DEFAULT 'running'::text NOT NULL,
  duration_ms integer,
  rows_processed integer,
  rows_updated integer,
  rows_inserted integer,
  error_message text,
  error_detail jsonb,
  triggered_by uuid,
  meta jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.admin_rpc_audit (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  rpc_name text NOT NULL,
  user_id uuid,
  duration_ms integer,
  status text DEFAULT 'success'::text NOT NULL,
  error_message text,
  meta jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public.app_feedback (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  feedback_type text NOT NULL,
  source_screen text,
  category text,
  message text,
  additional_context text,
  impact text,
  rating smallint,
  rating_tags text[] DEFAULT '{}'::text[] NOT NULL,
  app_version text,
  platform text,
  os_version text,
  device_model text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.billing_account_links (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  provider text NOT NULL,
  provider_original_transaction_ref text NOT NULL,
  user_id uuid NOT NULL,
  linked_at timestamp with time zone DEFAULT now() NOT NULL,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  is_active boolean DEFAULT true NOT NULL
);

CREATE TABLE public.billing_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  provider text NOT NULL,
  event_type text NOT NULL,
  event_source text NOT NULL,
  provider_event_ref text,
  old_status text,
  new_status text,
  old_tier text,
  new_tier text,
  reason text,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.billing_subscriptions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  provider text NOT NULL,
  environment text NOT NULL,
  product_code text NOT NULL,
  tier text NOT NULL,
  provider_customer_ref text,
  provider_subscription_ref text,
  provider_original_transaction_ref text,
  provider_transaction_ref text,
  status text NOT NULL,
  started_at timestamp with time zone,
  trial_started_at timestamp with time zone,
  trial_ends_at timestamp with time zone,
  current_period_started_at timestamp with time zone,
  current_period_ends_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  grace_ends_at timestamp with time zone,
  revoked_at timestamp with time zone,
  last_verified_at timestamp with time zone,
  is_auto_renewing boolean,
  raw_last_event jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.cardio_prs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  exercise_id uuid NOT NULL,
  metric text NOT NULL,
  benchmark_distance_km numeric,
  value numeric NOT NULL,
  calculation_method text DEFAULT 'average_pace'::text NOT NULL,
  workout_history_id uuid NOT NULL,
  workout_set_history_id uuid,
  achieved_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.daily_steps (
  user_id uuid NOT NULL,
  day date NOT NULL,
  steps integer DEFAULT 0 NOT NULL,
  last_reported_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.device_tokens (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  token text NOT NULL,
  platform text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  last_error text
);

CREATE TABLE public.exercise_favorites (
  user_id uuid NOT NULL,
  exercise_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.exercise_muscles (
  exercise_id uuid NOT NULL,
  muscle_id smallint NOT NULL,
  contribution smallint NOT NULL
);

CREATE TABLE public.exercise_usage (
  user_id uuid NOT NULL,
  exercise_id uuid NOT NULL,
  sessions_count integer DEFAULT 0 NOT NULL,
  sets_count integer DEFAULT 0 NOT NULL,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.exercises (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  equipment text,
  type exercise_type,
  level exercise_level DEFAULT 'beginner'::exercise_level,
  popularity integer DEFAULT 0,
  video_url text,
  instructions text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone,
  is_compound boolean,
  user_id uuid,
  is_public boolean DEFAULT true NOT NULL
);

CREATE TABLE public.follow_requests (
  requester_id uuid NOT NULL,
  target_id uuid NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  responded_at timestamp with time zone
);

CREATE TABLE public.goals (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  plan_id uuid,
  exercise_id uuid,
  type goal_type NOT NULL,
  target_number numeric(10,3) NOT NULL,
  unit text,
  deadline date,
  is_active boolean DEFAULT true NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone,
  metrics jsonb DEFAULT '[]'::jsonb NOT NULL,
  start_weight numeric,
  start_reps integer,
  start_distance numeric,
  start_time_seconds integer,
  target_weight numeric,
  target_reps integer,
  target_distance numeric,
  target_time_seconds integer,
  goal_summary text
);

CREATE TABLE public.live_workout_drafts (
  user_id uuid NOT NULL,
  workout_id uuid,
  plan_workout_id uuid,
  draft jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.manual_entitlement_grants (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  tier text NOT NULL,
  reason text NOT NULL,
  granted_by uuid NOT NULL,
  starts_at timestamp with time zone DEFAULT now() NOT NULL,
  ends_at timestamp with time zone,
  is_active boolean DEFAULT true NOT NULL,
  revoked_at timestamp with time zone,
  revoked_by uuid,
  revoked_reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.muscles (
  id smallint DEFAULT nextval('muscles_id_seq'::regclass) NOT NULL,
  name text NOT NULL
);

CREATE TABLE public.notification_preferences (
  user_id uuid NOT NULL,
  in_app_enabled boolean DEFAULT true NOT NULL,
  push_enabled boolean DEFAULT true NOT NULL,
  follows_enabled boolean DEFAULT true NOT NULL,
  follow_requests_enabled boolean DEFAULT true NOT NULL,
  likes_enabled boolean DEFAULT true NOT NULL,
  comments_enabled boolean DEFAULT true NOT NULL,
  following_posts_enabled boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.notification_push_jobs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  notification_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  attempts integer DEFAULT 0 NOT NULL,
  last_error text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  processed_at timestamp with time zone
);

CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  recipient_id uuid NOT NULL,
  actor_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  image_url text,
  is_read boolean DEFAULT false NOT NULL,
  read_at timestamp with time zone,
  dedupe_key text,
  push_sent_at timestamp with time zone,
  push_status text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.plan_shares (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  token text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone,
  is_active boolean DEFAULT true NOT NULL
);

CREATE TABLE public.plan_workouts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  plan_id uuid NOT NULL,
  workout_id uuid NOT NULL,
  title text NOT NULL,
  weekly_complete boolean DEFAULT false,
  order_index smallint,
  is_archived boolean DEFAULT false NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.plans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  start_date date,
  end_date date,
  is_completed boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone,
  weekly_target_sessions integer,
  completed_at timestamp with time zone
);

CREATE TABLE public.post_comments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);

CREATE TABLE public.post_likes (
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.posts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  post_type text NOT NULL,
  visibility text DEFAULT 'followers'::text NOT NULL,
  workout_history_id uuid,
  exercise_id uuid,
  pr_snapshot jsonb,
  caption text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone,
  workout_snapshot jsonb
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  name text,
  email text,
  height numeric,
  weight numeric,
  date_of_birth date,
  settings jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  steps_goal integer DEFAULT 10000,
  timezone text DEFAULT 'UTC'::text NOT NULL,
  weekly_workout_goal integer DEFAULT 3 NOT NULL,
  active_plan_id uuid,
  weekly_streak integer DEFAULT 0 NOT NULL,
  volume_target_next_week numeric DEFAULT 0 NOT NULL,
  role app_role DEFAULT 'user'::app_role NOT NULL,
  onboarding_step integer DEFAULT 0 NOT NULL,
  onboarding_completed_at timestamp with time zone,
  onboarding_dismissed_at timestamp with time zone,
  onboarding_stage2_completed_at timestamp with time zone,
  onboarding_stage2_dismissed_at timestamp with time zone,
  onboarding_stage3_completed_at timestamp with time zone,
  onboarding_stage3_dismissed_at timestamp with time zone,
  onboarding_stage2_triggered_at timestamp with time zone,
  onboarding_stage3_triggered_at timestamp with time zone,
  username text,
  username_lower text,
  visibility profile_visibility DEFAULT 'public'::profile_visibility NOT NULL
);

CREATE TABLE public.starter_workout_clones (
  user_id uuid NOT NULL,
  template_workout_id uuid NOT NULL,
  workout_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_achievement_progress (
  user_id uuid NOT NULL,
  achievement_id uuid NOT NULL,
  progress numeric(6,3) DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_achievements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  achievement_id uuid NOT NULL,
  achieved_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_entitlements (
  user_id uuid NOT NULL,
  tier text NOT NULL,
  status text NOT NULL,
  source text NOT NULL,
  product_code text,
  effective_from timestamp with time zone,
  effective_until timestamp with time zone,
  next_renewal_at timestamp with time zone,
  trial_ends_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  last_verified_at timestamp with time zone,
  provider_environment text,
  manual_grant boolean DEFAULT false NOT NULL,
  capabilities_version text DEFAULT 'v1'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  consumed_at timestamp with time zone
);

CREATE TABLE public.user_follows (
  follower_id uuid NOT NULL,
  followee_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_steps_stats (
  user_id uuid NOT NULL,
  days_met_total integer DEFAULT 0 NOT NULL,
  days_met_30 integer DEFAULT 0 NOT NULL,
  days_met_90 integer DEFAULT 0 NOT NULL,
  streak_current integer DEFAULT 0 NOT NULL,
  streak_best integer DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  last_synced_day date
);

CREATE TABLE public.user_weekly_goal_stats (
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  goal integer NOT NULL,
  workouts_completed integer NOT NULL,
  met_goal boolean NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_weekly_workout_stats (
  user_id uuid NOT NULL,
  week_key date NOT NULL,
  goal integer DEFAULT 0 NOT NULL,
  completed integer DEFAULT 0 NOT NULL,
  met boolean DEFAULT false NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.username_denylist (
  term text NOT NULL,
  match_mode text DEFAULT 'substring'::text NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.workout_exercise_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workout_history_id uuid NOT NULL,
  exercise_id uuid NOT NULL,
  order_index smallint NOT NULL,
  workout_exercise_id uuid,
  notes text,
  is_dropset boolean,
  superset_group text,
  superset_index smallint
);

CREATE TABLE public.workout_exercises (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workout_id uuid NOT NULL,
  exercise_id uuid NOT NULL,
  order_index smallint NOT NULL,
  target_sets smallint,
  target_reps smallint,
  target_weight numeric(7,2),
  target_time_seconds integer,
  target_distance numeric(7,3),
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone,
  superset_group text,
  superset_index smallint,
  is_dropset boolean DEFAULT false,
  is_archived boolean DEFAULT false NOT NULL
);

CREATE TABLE public.workout_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  workout_id uuid,
  completed_at timestamp with time zone DEFAULT now() NOT NULL,
  duration_seconds integer,
  notes text,
  client_save_id uuid
);

CREATE TABLE public.workout_session_checkpoints (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  workout_id uuid NOT NULL,
  plan_workout_id uuid,
  status text DEFAULT 'active'::text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.workout_set_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workout_exercise_history_id uuid NOT NULL,
  set_number smallint NOT NULL,
  reps smallint,
  weight numeric(7,2),
  time_seconds integer,
  distance numeric(7,3),
  notes text,
  drop_index smallint DEFAULT 0 NOT NULL
);

CREATE TABLE public.workouts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone,
  workout_image_key text,
  created_source text DEFAULT 'user'::text NOT NULL,
  counts_toward_template_limit boolean DEFAULT true NOT NULL,
  archived_at timestamp with time zone,
  deleted_at timestamp with time zone
);

ALTER TABLE ONLY admin.job_runs ADD CONSTRAINT job_runs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY admin.user_weekly_volume ADD CONSTRAINT user_weekly_volume_pkey PRIMARY KEY (user_id, week_start);

ALTER TABLE ONLY admin.weekly_reset_log ADD CONSTRAINT weekly_reset_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.account_deletion_requests ADD CONSTRAINT account_deletion_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.achievements ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.admin_error_events ADD CONSTRAINT admin_error_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.admin_job_definitions ADD CONSTRAINT admin_job_definitions_pkey PRIMARY KEY (job_key);

ALTER TABLE ONLY public.admin_job_runs ADD CONSTRAINT admin_job_runs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.admin_rpc_audit ADD CONSTRAINT admin_rpc_audit_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.app_feedback ADD CONSTRAINT app_feedback_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.billing_account_links ADD CONSTRAINT billing_account_links_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.billing_events ADD CONSTRAINT billing_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.billing_subscriptions ADD CONSTRAINT billing_subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cardio_prs ADD CONSTRAINT cardio_prs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.daily_steps ADD CONSTRAINT daily_steps_pkey PRIMARY KEY (user_id, day);

ALTER TABLE ONLY public.device_tokens ADD CONSTRAINT device_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.exercise_favorites ADD CONSTRAINT exercise_favorites_pkey PRIMARY KEY (user_id, exercise_id);

ALTER TABLE ONLY public.exercise_muscles ADD CONSTRAINT exercise_muscles_pkey PRIMARY KEY (exercise_id, muscle_id);

ALTER TABLE ONLY public.exercise_usage ADD CONSTRAINT exercise_usage_pkey PRIMARY KEY (user_id, exercise_id);

ALTER TABLE ONLY public.exercises ADD CONSTRAINT exercises_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.follow_requests ADD CONSTRAINT follow_requests_pkey PRIMARY KEY (requester_id, target_id);

ALTER TABLE ONLY public.goals ADD CONSTRAINT goals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.live_workout_drafts ADD CONSTRAINT live_workout_drafts_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.manual_entitlement_grants ADD CONSTRAINT manual_entitlement_grants_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.muscles ADD CONSTRAINT muscles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notification_preferences ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.notification_push_jobs ADD CONSTRAINT notification_push_jobs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.plan_shares ADD CONSTRAINT plan_shares_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.plan_workouts ADD CONSTRAINT plan_workouts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.plans ADD CONSTRAINT plans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.post_comments ADD CONSTRAINT post_comments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.post_likes ADD CONSTRAINT post_likes_pkey PRIMARY KEY (post_id, user_id);

ALTER TABLE ONLY public.posts ADD CONSTRAINT posts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.starter_workout_clones ADD CONSTRAINT starter_workout_clones_pkey PRIMARY KEY (user_id, template_workout_id);

ALTER TABLE ONLY public.user_achievement_progress ADD CONSTRAINT user_achievement_progress_pkey PRIMARY KEY (user_id, achievement_id);

ALTER TABLE ONLY public.user_achievements ADD CONSTRAINT user_achievements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_blocks ADD CONSTRAINT user_blocks_pkey PRIMARY KEY (blocker_id, blocked_id);

ALTER TABLE ONLY public.user_entitlements ADD CONSTRAINT user_entitlements_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.user_events ADD CONSTRAINT user_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_follows ADD CONSTRAINT user_follows_pkey PRIMARY KEY (follower_id, followee_id);

ALTER TABLE ONLY public.user_steps_stats ADD CONSTRAINT user_steps_stats_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.user_weekly_goal_stats ADD CONSTRAINT user_weekly_goal_stats_pkey PRIMARY KEY (user_id, week_start);

ALTER TABLE ONLY public.user_weekly_workout_stats ADD CONSTRAINT user_weekly_workout_stats_pkey PRIMARY KEY (user_id, week_key);

ALTER TABLE ONLY public.username_denylist ADD CONSTRAINT username_denylist_pkey PRIMARY KEY (term);

ALTER TABLE ONLY public.workout_exercise_history ADD CONSTRAINT workout_exercise_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workout_exercises ADD CONSTRAINT workout_exercises_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workout_history ADD CONSTRAINT workout_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workout_session_checkpoints ADD CONSTRAINT workout_session_checkpoints_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workout_set_history ADD CONSTRAINT workout_set_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workouts ADD CONSTRAINT workouts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.achievements ADD CONSTRAINT achievements_code_key UNIQUE (code);

ALTER TABLE ONLY public.billing_subscriptions ADD CONSTRAINT billing_subscriptions_provider_original_transaction_unique UNIQUE (provider, provider_original_transaction_ref);

ALTER TABLE ONLY public.device_tokens ADD CONSTRAINT device_tokens_token_key UNIQUE (token);

ALTER TABLE ONLY public.muscles ADD CONSTRAINT muscles_name_key UNIQUE (name);

ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_dedupe_key_unique UNIQUE (dedupe_key);

ALTER TABLE ONLY public.plan_shares ADD CONSTRAINT plan_shares_token_key UNIQUE (token);

ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);

ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_username_lower_unique UNIQUE (username_lower);

ALTER TABLE ONLY public.starter_workout_clones ADD CONSTRAINT starter_workout_clones_workout_id_unique UNIQUE (workout_id);

ALTER TABLE ONLY public.user_achievements ADD CONSTRAINT user_achievements_user_id_achievement_id_key UNIQUE (user_id, achievement_id);

ALTER TABLE ONLY public.workout_session_checkpoints ADD CONSTRAINT workout_session_checkpoints_user_id_session_id_key UNIQUE (user_id, session_id);

ALTER TABLE ONLY public.workout_set_history ADD CONSTRAINT workout_set_history_wxh_set_drop_unique UNIQUE (workout_exercise_history_id, set_number, drop_index);

ALTER TABLE ONLY public.app_feedback ADD CONSTRAINT app_feedback_additional_context_check CHECK (additional_context IS NULL OR char_length(additional_context) <= 500);

ALTER TABLE ONLY public.app_feedback ADD CONSTRAINT app_feedback_app_version_check CHECK (app_version IS NULL OR char_length(app_version) <= 50);

ALTER TABLE ONLY public.app_feedback ADD CONSTRAINT app_feedback_category_check CHECK (category IS NULL OR (category = ANY (ARRAY['workout_logging'::text, 'plans_goals'::text, 'progress_analytics'::text, 'social'::text, 'account_settings'::text, 'other'::text])));

ALTER TABLE ONLY public.app_feedback ADD CONSTRAINT app_feedback_content_check CHECK ((feedback_type = ANY (ARRAY['issue'::text, 'improvement'::text])) AND category IS NOT NULL AND message IS NOT NULL AND char_length(btrim(message)) > 0 AND rating IS NULL AND cardinality(rating_tags) = 0 OR feedback_type = 'rating'::text AND rating IS NOT NULL AND category IS NULL AND impact IS NULL AND additional_context IS NULL);

ALTER TABLE ONLY public.app_feedback ADD CONSTRAINT app_feedback_device_model_check CHECK (device_model IS NULL OR char_length(device_model) <= 150);

ALTER TABLE ONLY public.app_feedback ADD CONSTRAINT app_feedback_feedback_type_check CHECK (feedback_type = ANY (ARRAY['issue'::text, 'improvement'::text, 'rating'::text]));

ALTER TABLE ONLY public.app_feedback ADD CONSTRAINT app_feedback_impact_check CHECK (impact IS NULL OR (impact = ANY (ARRAY['minor'::text, 'annoying'::text, 'blocked'::text])));

ALTER TABLE ONLY public.app_feedback ADD CONSTRAINT app_feedback_impact_type_check CHECK (feedback_type = 'issue'::text OR impact IS NULL);

ALTER TABLE ONLY public.app_feedback ADD CONSTRAINT app_feedback_message_check CHECK (message IS NULL OR char_length(message) <= 500);

ALTER TABLE ONLY public.app_feedback ADD CONSTRAINT app_feedback_metadata_check CHECK (jsonb_typeof(metadata) = 'object'::text AND octet_length(metadata::text) <= 4096);

ALTER TABLE ONLY public.app_feedback ADD CONSTRAINT app_feedback_os_version_check CHECK (os_version IS NULL OR char_length(os_version) <= 100);

ALTER TABLE ONLY public.app_feedback ADD CONSTRAINT app_feedback_platform_check CHECK (platform IS NULL OR (platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text])));

ALTER TABLE ONLY public.app_feedback ADD CONSTRAINT app_feedback_rating_check CHECK (rating IS NULL OR rating >= 1 AND rating <= 5);

ALTER TABLE ONLY public.app_feedback ADD CONSTRAINT app_feedback_source_screen_check CHECK (source_screen IS NULL OR char_length(source_screen) <= 100);

ALTER TABLE ONLY public.app_feedback ADD CONSTRAINT app_feedback_tags_check CHECK (cardinality(rating_tags) <= 5 AND array_position(rating_tags, NULL::text) IS NULL AND rating_tags <@ ARRAY['easy_to_use'::text, 'helpful_analytics'::text, 'motivating'::text, 'clean_design'::text, 'workout_tracking'::text, 'confusing'::text, 'missing_features'::text, 'too_buggy'::text, 'slow'::text, 'hard_to_use'::text]);

ALTER TABLE ONLY public.billing_account_links ADD CONSTRAINT billing_account_links_provider_check CHECK (provider = ANY (ARRAY['apple'::text, 'google'::text, 'stripe'::text]));

ALTER TABLE ONLY public.billing_events ADD CONSTRAINT billing_events_event_source_check CHECK (event_source = ANY (ARRAY['server_notification'::text, 'purchase_sync'::text, 'restore_sync'::text, 'admin_action'::text, 'manual_refresh'::text, 'reconcile_job'::text]));

ALTER TABLE ONLY public.billing_events ADD CONSTRAINT billing_events_new_status_check CHECK (new_status IS NULL OR (new_status = ANY (ARRAY['free'::text, 'trial'::text, 'active'::text, 'cancelled_active'::text, 'grace'::text, 'expired'::text, 'revoked'::text])));

ALTER TABLE ONLY public.billing_events ADD CONSTRAINT billing_events_new_tier_check CHECK (new_tier IS NULL OR (new_tier = ANY (ARRAY['free'::text, 'pro'::text])));

ALTER TABLE ONLY public.billing_events ADD CONSTRAINT billing_events_old_status_check CHECK (old_status IS NULL OR (old_status = ANY (ARRAY['free'::text, 'trial'::text, 'active'::text, 'cancelled_active'::text, 'grace'::text, 'expired'::text, 'revoked'::text])));

ALTER TABLE ONLY public.billing_events ADD CONSTRAINT billing_events_old_tier_check CHECK (old_tier IS NULL OR (old_tier = ANY (ARRAY['free'::text, 'pro'::text])));

ALTER TABLE ONLY public.billing_events ADD CONSTRAINT billing_events_provider_check CHECK (provider = ANY (ARRAY['apple'::text, 'google'::text, 'stripe'::text, 'manual'::text]));

ALTER TABLE ONLY public.billing_subscriptions ADD CONSTRAINT billing_subscriptions_environment_check CHECK (environment = ANY (ARRAY['sandbox'::text, 'production'::text, 'n/a'::text]));

ALTER TABLE ONLY public.billing_subscriptions ADD CONSTRAINT billing_subscriptions_provider_check CHECK (provider = ANY (ARRAY['apple'::text, 'google'::text, 'stripe'::text, 'manual'::text]));

ALTER TABLE ONLY public.billing_subscriptions ADD CONSTRAINT billing_subscriptions_status_check CHECK (status = ANY (ARRAY['free'::text, 'trial'::text, 'active'::text, 'cancelled_active'::text, 'grace'::text, 'expired'::text, 'revoked'::text]));

ALTER TABLE ONLY public.billing_subscriptions ADD CONSTRAINT billing_subscriptions_tier_check CHECK (tier = ANY (ARRAY['free'::text, 'pro'::text]));

ALTER TABLE ONLY public.cardio_prs ADD CONSTRAINT cardio_prs_calculation_method_check CHECK (calculation_method = ANY (ARRAY['average_pace'::text, 'exact_split'::text, 'manual'::text]));

ALTER TABLE ONLY public.cardio_prs ADD CONSTRAINT cardio_prs_metric_check CHECK (metric = ANY (ARRAY['fastest_1k'::text, 'fastest_3k'::text, 'fastest_5k'::text, 'fastest_10k'::text, 'fastest_15k'::text, 'fastest_20k'::text, 'fastest_half_marathon'::text, 'fastest_marathon'::text, 'longest_distance'::text, 'best_pace'::text]));

ALTER TABLE ONLY public.cardio_prs ADD CONSTRAINT cardio_prs_metric_distance_check CHECK ((metric = ANY (ARRAY['fastest_1k'::text, 'fastest_3k'::text, 'fastest_5k'::text, 'fastest_10k'::text, 'fastest_15k'::text, 'fastest_20k'::text, 'fastest_half_marathon'::text, 'fastest_marathon'::text])) AND benchmark_distance_km IS NOT NULL OR (metric = ANY (ARRAY['longest_distance'::text, 'best_pace'::text])) AND benchmark_distance_km IS NULL);

ALTER TABLE ONLY public.daily_steps ADD CONSTRAINT daily_steps_steps_check CHECK (steps >= 0);

ALTER TABLE ONLY public.device_tokens ADD CONSTRAINT device_tokens_platform_check CHECK (platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text]));

ALTER TABLE ONLY public.exercise_muscles ADD CONSTRAINT exercise_muscles_contribution_check CHECK (contribution >= 0 AND contribution <= 100);

ALTER TABLE ONLY public.exercise_usage ADD CONSTRAINT exercise_usage_sessions_count_check CHECK (sessions_count >= 0);

ALTER TABLE ONLY public.exercise_usage ADD CONSTRAINT exercise_usage_sets_count_check CHECK (sets_count >= 0);

ALTER TABLE ONLY public.follow_requests ADD CONSTRAINT follow_requests_status_check CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'cancelled'::text]));

ALTER TABLE ONLY public.follow_requests ADD CONSTRAINT no_self_request CHECK (requester_id <> target_id);

ALTER TABLE ONLY public.manual_entitlement_grants ADD CONSTRAINT manual_entitlement_grants_revoked_consistency_check CHECK (revoked_at IS NULL AND revoked_by IS NULL AND revoked_reason IS NULL OR revoked_at IS NOT NULL AND revoked_by IS NOT NULL);

ALTER TABLE ONLY public.manual_entitlement_grants ADD CONSTRAINT manual_entitlement_grants_tier_check CHECK (tier = 'pro'::text);

ALTER TABLE ONLY public.notification_push_jobs ADD CONSTRAINT notification_push_jobs_status_check CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'skipped'::text]));

ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_entity_type_check CHECK (entity_type = ANY (ARRAY['profile'::text, 'follow_request'::text, 'post'::text, 'comment'::text]));

ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_push_status_check CHECK (push_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text]));

ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY['followed_you'::text, 'follow_request_received'::text, 'follow_request_accepted'::text, 'post_liked'::text, 'post_commented'::text, 'following_posted_pr'::text, 'following_posted_workout'::text]));

ALTER TABLE ONLY public.plans ADD CONSTRAINT plans_completed_at_consistency CHECK (is_completed = false AND completed_at IS NULL OR is_completed = true AND completed_at IS NOT NULL);

ALTER TABLE ONLY public.post_comments ADD CONSTRAINT post_comments_body_check CHECK (char_length(body) <= 1000);

ALTER TABLE ONLY public.posts ADD CONSTRAINT posts_post_type_check CHECK (post_type = ANY (ARRAY['workout'::text, 'pr'::text, 'text'::text]));

ALTER TABLE ONLY public.posts ADD CONSTRAINT posts_visibility_check CHECK (visibility = ANY (ARRAY['public'::text, 'followers'::text, 'private'::text]));

ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_height_check CHECK (height IS NULL OR height >= 80::numeric AND height <= 260::numeric);

ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_steps_goal_check CHECK (steps_goal IS NULL OR steps_goal >= 0 AND steps_goal <= 50000);

ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_weight_check CHECK (weight IS NULL OR weight >= 25::numeric AND weight <= 400::numeric);

ALTER TABLE ONLY public.user_blocks ADD CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id);

ALTER TABLE ONLY public.user_entitlements ADD CONSTRAINT user_entitlements_provider_environment_check CHECK (provider_environment = ANY (ARRAY['sandbox'::text, 'production'::text, 'n/a'::text]));

ALTER TABLE ONLY public.user_entitlements ADD CONSTRAINT user_entitlements_source_check CHECK (source = ANY (ARRAY['none'::text, 'apple'::text, 'google'::text, 'stripe'::text, 'manual'::text]));

ALTER TABLE ONLY public.user_entitlements ADD CONSTRAINT user_entitlements_status_check CHECK (status = ANY (ARRAY['free'::text, 'trial'::text, 'active'::text, 'cancelled_active'::text, 'grace'::text, 'expired'::text, 'revoked'::text]));

ALTER TABLE ONLY public.user_entitlements ADD CONSTRAINT user_entitlements_tier_check CHECK (tier = ANY (ARRAY['free'::text, 'pro'::text]));

ALTER TABLE ONLY public.user_follows ADD CONSTRAINT no_self_follow CHECK (follower_id <> followee_id);

ALTER TABLE ONLY public.username_denylist ADD CONSTRAINT username_denylist_match_mode_check CHECK (match_mode = ANY (ARRAY['exact'::text, 'substring'::text]));

ALTER TABLE ONLY public.workout_exercises ADD CONSTRAINT workout_exercises_target_reps_check CHECK (target_reps >= 0 AND target_reps <= 200);

ALTER TABLE ONLY public.workout_exercises ADD CONSTRAINT workout_exercises_target_sets_check CHECK (target_sets >= 0 AND target_sets <= 20);

ALTER TABLE ONLY public.workout_exercises ADD CONSTRAINT workout_exercises_target_weight_check CHECK (target_weight IS NULL OR target_weight >= 0::numeric);

ALTER TABLE ONLY public.workout_session_checkpoints ADD CONSTRAINT workout_session_checkpoints_status_check CHECK (status = ANY (ARRAY['active'::text, 'discarded'::text, 'completed'::text]));

ALTER TABLE ONLY public.workout_set_history ADD CONSTRAINT workout_set_history_has_values_chk CHECK (reps IS NOT NULL OR weight IS NOT NULL OR time_seconds IS NOT NULL OR distance IS NOT NULL);

ALTER TABLE ONLY public.workout_set_history ADD CONSTRAINT workout_set_history_reps_check CHECK (reps >= 0);

ALTER TABLE ONLY public.workout_set_history ADD CONSTRAINT workout_set_history_weight_check CHECK (weight IS NULL OR weight >= 0::numeric);

ALTER TABLE ONLY public.workouts ADD CONSTRAINT workouts_created_source_check CHECK (created_source = ANY (ARRAY['user'::text, 'starter_clone'::text, 'plan_clone'::text, 'system'::text]));

ALTER TABLE ONLY public.workouts ADD CONSTRAINT workouts_workout_image_key_check CHECK (workout_image_key IS NULL OR (workout_image_key = ANY (ARRAY['push'::text, 'pull'::text, 'upper_body'::text, 'legs'::text, 'lower_body'::text, 'full_body'::text, 'cardio'::text])));

ALTER TABLE ONLY admin.user_weekly_volume ADD CONSTRAINT user_weekly_volume_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.admin_error_events ADD CONSTRAINT admin_error_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.admin_job_runs ADD CONSTRAINT admin_job_runs_triggered_by_fkey FOREIGN KEY (triggered_by) REFERENCES auth.users(id);

ALTER TABLE ONLY public.admin_rpc_audit ADD CONSTRAINT admin_rpc_audit_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE ONLY public.app_feedback ADD CONSTRAINT app_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.billing_account_links ADD CONSTRAINT billing_account_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.billing_events ADD CONSTRAINT billing_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.billing_subscriptions ADD CONSTRAINT billing_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cardio_prs ADD CONSTRAINT cardio_prs_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id);

ALTER TABLE ONLY public.cardio_prs ADD CONSTRAINT cardio_prs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cardio_prs ADD CONSTRAINT cardio_prs_workout_history_id_fkey FOREIGN KEY (workout_history_id) REFERENCES workout_history(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cardio_prs ADD CONSTRAINT cardio_prs_workout_set_history_id_fkey FOREIGN KEY (workout_set_history_id) REFERENCES workout_set_history(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.daily_steps ADD CONSTRAINT daily_steps_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.device_tokens ADD CONSTRAINT device_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.exercise_favorites ADD CONSTRAINT exercise_favorites_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.exercise_favorites ADD CONSTRAINT exercise_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.exercise_muscles ADD CONSTRAINT exercise_muscles_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.exercise_muscles ADD CONSTRAINT exercise_muscles_muscle_id_fkey FOREIGN KEY (muscle_id) REFERENCES muscles(id);

ALTER TABLE ONLY public.exercise_usage ADD CONSTRAINT exercise_usage_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.exercise_usage ADD CONSTRAINT exercise_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.exercises ADD CONSTRAINT exercises_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.follow_requests ADD CONSTRAINT follow_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.follow_requests ADD CONSTRAINT follow_requests_target_id_fkey FOREIGN KEY (target_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.goals ADD CONSTRAINT goals_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id);

ALTER TABLE ONLY public.goals ADD CONSTRAINT goals_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.goals ADD CONSTRAINT goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.live_workout_drafts ADD CONSTRAINT live_workout_drafts_plan_workout_id_fkey FOREIGN KEY (plan_workout_id) REFERENCES plan_workouts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.live_workout_drafts ADD CONSTRAINT live_workout_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.live_workout_drafts ADD CONSTRAINT live_workout_drafts_workout_id_fkey FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.manual_entitlement_grants ADD CONSTRAINT manual_entitlement_grants_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES profiles(id);

ALTER TABLE ONLY public.manual_entitlement_grants ADD CONSTRAINT manual_entitlement_grants_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES profiles(id);

ALTER TABLE ONLY public.manual_entitlement_grants ADD CONSTRAINT manual_entitlement_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notification_preferences ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notification_push_jobs ADD CONSTRAINT notification_push_jobs_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notification_push_jobs ADD CONSTRAINT notification_push_jobs_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.plan_shares ADD CONSTRAINT plan_shares_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.plan_shares ADD CONSTRAINT plan_shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.plan_workouts ADD CONSTRAINT plan_workouts_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.plan_workouts ADD CONSTRAINT plan_workouts_workout_id_fkey FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.plans ADD CONSTRAINT plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.post_comments ADD CONSTRAINT post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.post_comments ADD CONSTRAINT post_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.post_likes ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.post_likes ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.posts ADD CONSTRAINT posts_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.posts ADD CONSTRAINT posts_workout_history_id_fkey FOREIGN KEY (workout_history_id) REFERENCES workout_history(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_active_plan_id_fkey FOREIGN KEY (active_plan_id) REFERENCES plans(id);

ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.starter_workout_clones ADD CONSTRAINT starter_workout_clones_workout_fk FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_achievement_progress ADD CONSTRAINT user_achievement_progress_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_achievement_progress ADD CONSTRAINT user_achievement_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_achievements ADD CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_achievements ADD CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_blocks ADD CONSTRAINT user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_blocks ADD CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_entitlements ADD CONSTRAINT user_entitlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_events ADD CONSTRAINT user_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_follows ADD CONSTRAINT user_follows_followee_id_fkey FOREIGN KEY (followee_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_follows ADD CONSTRAINT user_follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_steps_stats ADD CONSTRAINT user_steps_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_weekly_goal_stats ADD CONSTRAINT user_weekly_goal_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_weekly_workout_stats ADD CONSTRAINT user_weekly_workout_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workout_exercise_history ADD CONSTRAINT workout_exercise_history_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id);

ALTER TABLE ONLY public.workout_exercise_history ADD CONSTRAINT workout_exercise_history_workout_exercise_id_fkey FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.workout_exercise_history ADD CONSTRAINT workout_exercise_history_workout_history_id_fkey FOREIGN KEY (workout_history_id) REFERENCES workout_history(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workout_exercises ADD CONSTRAINT workout_exercises_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES exercises(id);

ALTER TABLE ONLY public.workout_exercises ADD CONSTRAINT workout_exercises_workout_id_fkey FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workout_history ADD CONSTRAINT workout_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workout_history ADD CONSTRAINT workout_history_workout_id_fkey FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.workout_session_checkpoints ADD CONSTRAINT workout_session_checkpoints_plan_workout_id_fkey FOREIGN KEY (plan_workout_id) REFERENCES plan_workouts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.workout_session_checkpoints ADD CONSTRAINT workout_session_checkpoints_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workout_session_checkpoints ADD CONSTRAINT workout_session_checkpoints_workout_id_fkey FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workout_set_history ADD CONSTRAINT workout_set_history_workout_exercise_history_id_fkey FOREIGN KEY (workout_exercise_history_id) REFERENCES workout_exercise_history(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workouts ADD CONSTRAINT workouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER SEQUENCE admin.job_runs_id_seq OWNED BY admin.job_runs.id;

ALTER SEQUENCE admin.weekly_reset_log_id_seq OWNED BY admin.weekly_reset_log.id;

ALTER SEQUENCE public.muscles_id_seq OWNED BY public.muscles.id;

CREATE INDEX admin_error_events_created_at_idx ON public.admin_error_events USING btree (created_at DESC);

CREATE INDEX admin_error_events_event_key_idx ON public.admin_error_events USING btree (event_key);

CREATE INDEX admin_job_runs_job_key_started_at_idx ON public.admin_job_runs USING btree (job_key, started_at DESC);

CREATE INDEX admin_job_runs_status_started_at_idx ON public.admin_job_runs USING btree (status, started_at DESC);

CREATE INDEX admin_rpc_audit_created_at_idx ON public.admin_rpc_audit USING btree (created_at DESC);

CREATE INDEX admin_rpc_audit_rpc_name_idx ON public.admin_rpc_audit USING btree (rpc_name, created_at DESC);

CREATE INDEX app_feedback_created_at_idx ON public.app_feedback USING btree (created_at DESC);

CREATE INDEX app_feedback_type_created_at_idx ON public.app_feedback USING btree (feedback_type, created_at DESC);

CREATE INDEX app_feedback_user_id_idx ON public.app_feedback USING btree (user_id);

CREATE INDEX billing_account_links_user_idx ON public.billing_account_links USING btree (user_id);

CREATE INDEX billing_events_provider_event_ref_idx ON public.billing_events USING btree (provider_event_ref);

CREATE INDEX billing_events_user_created_idx ON public.billing_events USING btree (user_id, created_at DESC);

CREATE INDEX billing_subscriptions_environment_idx ON public.billing_subscriptions USING btree (environment);

CREATE INDEX billing_subscriptions_original_tx_idx ON public.billing_subscriptions USING btree (provider, provider_original_transaction_ref);

CREATE INDEX billing_subscriptions_provider_idx ON public.billing_subscriptions USING btree (provider);

CREATE INDEX billing_subscriptions_status_idx ON public.billing_subscriptions USING btree (status);

CREATE INDEX billing_subscriptions_user_id_idx ON public.billing_subscriptions USING btree (user_id);

CREATE INDEX cardio_prs_user_exercise_metric_idx ON public.cardio_prs USING btree (user_id, exercise_id, metric, achieved_at DESC);

CREATE INDEX cardio_prs_user_metric_idx ON public.cardio_prs USING btree (user_id, metric, achieved_at DESC);

CREATE INDEX cardio_prs_workout_history_idx ON public.cardio_prs USING btree (workout_history_id);

CREATE INDEX device_tokens_user_active_idx ON public.device_tokens USING btree (user_id, is_active);

CREATE INDEX exercise_favorites_user_exercise_idx ON public.exercise_favorites USING btree (user_id, exercise_id);

CREATE INDEX exercise_muscles_exercise_idx ON public.exercise_muscles USING btree (exercise_id);

CREATE INDEX exercise_usage_user_exercise_idx ON public.exercise_usage USING btree (user_id, exercise_id);

CREATE INDEX exercise_usage_user_last_used_idx ON public.exercise_usage USING btree (user_id, last_used_at DESC);

CREATE INDEX exercise_usage_user_sessions_idx ON public.exercise_usage USING btree (user_id, sessions_count DESC);

CREATE INDEX exercises_name_idx ON public.exercises USING btree (name);

CREATE INDEX exercises_user_id_idx ON public.exercises USING btree (user_id);

CREATE INDEX exercises_visibility_idx ON public.exercises USING btree (is_public, user_id);

CREATE INDEX follow_requests_target_idx ON public.follow_requests USING btree (target_id, created_at DESC);

CREATE INDEX goals_user_active_created ON public.goals USING btree (user_id, is_active, created_at DESC);

CREATE INDEX idx_device_tokens_user ON public.device_tokens USING btree (user_id);

CREATE INDEX idx_exercise_muscles_primary ON public.exercise_muscles USING btree (exercise_id, contribution DESC);

CREATE INDEX idx_exercises_name_trgm ON public.exercises USING gin (name gin_trgm_ops);

CREATE INDEX idx_follow_requests_requester ON public.follow_requests USING btree (requester_id, target_id);

CREATE INDEX idx_follow_requests_target ON public.follow_requests USING btree (target_id, requester_id);

CREATE INDEX idx_goals_plan ON public.goals USING btree (plan_id);

CREATE INDEX idx_goals_user ON public.goals USING btree (user_id);

CREATE INDEX idx_plan_workouts_plan ON public.plan_workouts USING btree (plan_id);

CREATE INDEX idx_plans_user ON public.plans USING btree (user_id);

CREATE INDEX idx_post_comments_post ON public.post_comments USING btree (post_id) WHERE (deleted_at IS NULL);

CREATE INDEX idx_post_likes_post ON public.post_likes USING btree (post_id);

CREATE INDEX idx_posts_user_created ON public.posts USING btree (user_id, created_at DESC, id DESC);

CREATE INDEX idx_user_blocks_blocked ON public.user_blocks USING btree (blocked_id, blocker_id);

CREATE INDEX idx_user_blocks_blocker ON public.user_blocks USING btree (blocker_id, blocked_id);

CREATE INDEX idx_user_follows_followee ON public.user_follows USING btree (followee_id, follower_id);

CREATE INDEX idx_user_follows_follower ON public.user_follows USING btree (follower_id, followee_id);

CREATE INDEX idx_user_weekly_goal_stats_user ON public.user_weekly_goal_stats USING btree (user_id);

CREATE INDEX idx_uwws_user_week ON public.user_weekly_workout_stats USING btree (user_id, week_key);

CREATE INDEX idx_weh_exercise_workouthistory ON public.workout_exercise_history USING btree (exercise_id, workout_history_id);

CREATE INDEX idx_weh_history ON public.workout_exercise_history USING btree (workout_history_id);

CREATE INDEX idx_wexh_exercise ON public.workout_exercise_history USING btree (exercise_id);

CREATE INDEX idx_workout_exercises_workout ON public.workout_exercises USING btree (workout_id);

CREATE INDEX idx_workout_history_user ON public.workout_history USING btree (user_id);

CREATE INDEX idx_workout_history_user_completed ON public.workout_history USING btree (user_id, completed_at DESC);

CREATE INDEX idx_workouts_user ON public.workouts USING btree (user_id);

CREATE INDEX idx_wsh_exercise_history ON public.workout_set_history USING btree (workout_exercise_history_id);

CREATE INDEX idx_wsh_set_drop ON public.workout_set_history USING btree (workout_exercise_history_id, set_number, drop_index);

CREATE INDEX live_workout_drafts_updated_at_idx ON public.live_workout_drafts USING btree (updated_at DESC);

CREATE INDEX manual_entitlement_grants_active_idx ON public.manual_entitlement_grants USING btree (is_active);

CREATE INDEX manual_entitlement_grants_user_idx ON public.manual_entitlement_grants USING btree (user_id);

CREATE INDEX notifications_actor_idx ON public.notifications USING btree (actor_id);

CREATE INDEX notifications_entity_idx ON public.notifications USING btree (entity_type, entity_id);

CREATE INDEX notifications_recipient_created_idx ON public.notifications USING btree (recipient_id, created_at DESC);

CREATE INDEX notifications_recipient_unread_idx ON public.notifications USING btree (recipient_id, is_read, created_at DESC);

CREATE INDEX plan_workouts_plan_id_active_idx ON public.plan_workouts USING btree (plan_id) WHERE (is_archived = false);

CREATE INDEX post_comments_post_idx ON public.post_comments USING btree (post_id, created_at);

CREATE INDEX post_likes_post_idx ON public.post_likes USING btree (post_id, created_at DESC);

CREATE INDEX posts_created_idx ON public.posts USING btree (created_at DESC);

CREATE INDEX posts_user_created_idx ON public.posts USING btree (user_id, created_at DESC);

CREATE INDEX posts_workout_history_idx ON public.posts USING btree (workout_history_id);

CREATE INDEX profiles_username_lower_idx ON public.profiles USING btree (username_lower);

CREATE INDEX user_blocks_blocked_idx ON public.user_blocks USING btree (blocked_id);

CREATE INDEX user_events_user_type_consumed ON public.user_events USING btree (user_id, type, consumed_at, created_at);

CREATE INDEX user_events_user_type_consumed_created ON public.user_events USING btree (user_id, type, consumed_at, created_at);

CREATE INDEX user_events_user_unconsumed_idx ON public.user_events USING btree (user_id, created_at DESC) WHERE (consumed_at IS NULL);

CREATE INDEX user_follows_followee_idx ON public.user_follows USING btree (followee_id, created_at DESC);

CREATE INDEX user_follows_follower_idx ON public.user_follows USING btree (follower_id, created_at DESC);

CREATE INDEX workout_ex_hist_whid_exid ON public.workout_exercise_history USING btree (workout_history_id, exercise_id);

CREATE INDEX workout_exercises_workout_id_active_idx ON public.workout_exercises USING btree (workout_id) WHERE (is_archived = false);

CREATE INDEX workout_history_user_completed_at ON public.workout_history USING btree (user_id, completed_at DESC);

CREATE INDEX workout_session_checkpoints_user_updated_idx ON public.workout_session_checkpoints USING btree (user_id, updated_at DESC);

CREATE INDEX workout_set_hist_wehid ON public.workout_set_history USING btree (workout_exercise_history_id);

CREATE INDEX workouts_template_count_idx ON public.workouts USING btree (user_id, counts_toward_template_limit, archived_at, deleted_at);

CREATE UNIQUE INDEX billing_account_links_active_unique ON public.billing_account_links USING btree (provider, provider_original_transaction_ref) WHERE (is_active = true);

CREATE UNIQUE INDEX billing_subscriptions_provider_tx_unique ON public.billing_subscriptions USING btree (provider, environment, provider_transaction_ref) WHERE (provider_transaction_ref IS NOT NULL);

CREATE UNIQUE INDEX device_tokens_user_token_unique_idx ON public.device_tokens USING btree (user_id, token);

CREATE UNIQUE INDEX goals_plan_exercise_type_active_unq ON public.goals USING btree (plan_id, exercise_id, type) WHERE (is_active = true);

CREATE UNIQUE INDEX notification_push_jobs_notification_unique ON public.notification_push_jobs USING btree (notification_id);

CREATE UNIQUE INDEX plan_workouts_plan_id_order_index_unq ON public.plan_workouts USING btree (plan_id, order_index) WHERE (is_archived = false);

CREATE UNIQUE INDEX post_likes_post_user_ux ON public.post_likes USING btree (post_id, user_id);

CREATE UNIQUE INDEX profiles_username_lower_uniq ON public.profiles USING btree (lower(username)) WHERE (username IS NOT NULL);

CREATE UNIQUE INDEX uniq_exercises_lower_name ON public.exercises USING btree (lower(name));

CREATE UNIQUE INDEX workout_exercises_workout_id_order_index_unq ON public.workout_exercises USING btree (workout_id, order_index) WHERE (is_archived = false);

CREATE UNIQUE INDEX workout_history_user_client_save_id_ux ON public.workout_history USING btree (user_id, client_save_id);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_error_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_job_definitions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_job_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_rpc_audit ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_account_links ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cardio_prs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.daily_steps ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.exercise_favorites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.exercise_muscles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.exercise_usage ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.live_workout_drafts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.manual_entitlement_grants ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.muscles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notification_push_jobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.plan_shares ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.plan_workouts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.starter_workout_clones ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_achievement_progress ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_events FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_steps_stats ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_weekly_goal_stats ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_weekly_workout_stats ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.username_denylist ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workout_exercise_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workout_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workout_session_checkpoints ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workout_set_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
