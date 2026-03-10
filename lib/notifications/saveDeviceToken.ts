import { supabase } from "@/lib/supabase";

export async function saveDeviceToken(params: {
  userId: string;
  token: string;
  platform: "ios" | "android";
}) {
  const { userId, token, platform } = params;

  const { error } = await supabase
    .from("device_tokens")
    .upsert(
      {
        user_id: userId,
        token,
        platform,
        is_active: true,
        last_seen_at: new Date().toISOString(),
        last_error: null,
      },
      {
        onConflict: "user_id,token",
      }
    );

  if (error) throw error;
}