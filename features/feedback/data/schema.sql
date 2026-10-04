create table public.app_feedback (
id uuid primary key default gen_random_uuid(),
user_id uuid not null references public.profiles(id) on delete cascade,
feedback_type text not null check(feedback_type in ('issue','improvement','rating')),
source_screen text check(source_screen is null or char_length(source_screen)<=100),
category text check(category is null or category in ('workout_logging','plans_goals','progress_analytics','social','account_settings','other')),
message text check(message is null or char_length(message)<=500),
additional_context text check(additional_context is null or char_length(additional_context)<=500),
impact text check(impact is null or impact in ('minor','annoying','blocked')),
rating smallint check(rating is null or rating between 1 and 5),
rating_tags text[] not null default '{}',
app_version text check(app_version is null or char_length(app_version)<=50),
platform text check(platform is null or platform in ('ios','android','web')),
os_version text check(os_version is null or char_length(os_version)<=100),
device_model text check(device_model is null or char_length(device_model)<=150),
metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=4096),
created_at timestamptz not null default now(),
constraint app_feedback_tags_check check(cardinality(rating_tags)<=5 and array_position(rating_tags,null) is null and rating_tags <@ array['easy_to_use','helpful_analytics','motivating','clean_design','workout_tracking','confusing','missing_features','too_buggy','slow','hard_to_use']::text[]),
constraint app_feedback_content_check check(
(feedback_type in ('issue','improvement') and category is not null and message is not null and char_length(btrim(message))>0 and rating is null and cardinality(rating_tags)=0)
or (feedback_type='rating' and rating is not null and category is null and impact is null and additional_context is null)),
constraint app_feedback_impact_type_check check(feedback_type='issue' or impact is null)
);
alter table public.app_feedback enable row level security;
revoke all privileges on table public.app_feedback from public,anon,authenticated;
grant insert(user_id,feedback_type,source_screen,category,message,additional_context,impact,rating,rating_tags,app_version,platform,os_version,device_model,metadata) on public.app_feedback to authenticated;
grant all privileges on table public.app_feedback to service_role;
create policy app_feedback_insert_own on public.app_feedback for insert to authenticated with check(user_id=(select auth.uid()));
create index app_feedback_created_at_idx on public.app_feedback(created_at desc);
create index app_feedback_type_created_at_idx on public.app_feedback(feedback_type,created_at desc);
create index app_feedback_user_id_idx on public.app_feedback(user_id);
notify pgrst,'reload schema';
