-- Allow signed-in users to submit feedback through the app's normal
-- Supabase client. Row-level security still restricts inserts to auth.uid().
--
-- Keep feedback write-only for app users: no SELECT/UPDATE/DELETE grants are
-- added here, and anonymous clients remain unable to insert.

grant insert on table public.app_feedback to authenticated;
