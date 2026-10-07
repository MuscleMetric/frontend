// supabase/functions/close-expired-plans/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async () => {
  const { data, error } = await supabase.rpc(
    "mark_expired_plans_completed"
  );

  if (error) {
    console.error("mark_expired_plans_completed error", error);
    return new Response(JSON.stringify({ ok: false, error }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ ok: true, affected: data }), {
    headers: { "Content-Type": "application/json" },
  });
});
