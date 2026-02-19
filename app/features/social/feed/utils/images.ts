// app/features/social/feed/utils/images.ts
import { supabase } from "@/lib/supabase";

export function workoutImageUrlFromKey(key: string) {
  // ✅ replace "workout-images" with your actual bucket name
  const { data } = supabase.storage.from("workout-images").getPublicUrl(key);
  return data.publicUrl;
}