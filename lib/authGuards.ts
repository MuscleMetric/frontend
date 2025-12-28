// lib/authGuards.ts
import { supabase } from "./supabase";

export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error("auth_session_error");
  const userId = data.session?.user?.id;
  if (!userId) throw new Error("auth_missing");
  return userId;
}
