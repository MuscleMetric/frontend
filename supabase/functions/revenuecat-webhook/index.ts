// @ts-ignore
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// @ts-ignore
import { createClient } from "jsr:@supabase/supabase-js@2";

type RevenueCatWebhookBody = {
  event?: {
    id?: string;
    type?: string;
    app_user_id?: string;
    original_app_user_id?: string;
    product_id?: string;
    environment?: string;
    transaction_id?: string;
    original_transaction_id?: string;
    purchased_at_ms?: number;
    expiration_at_ms?: number;
    store?: string;
    period_type?: string;
    cancel_reason?: string;
  };
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REVENUECAT_WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function msToIso(ms?: number | null) {
  return typeof ms === "number" ? new Date(ms).toISOString() : null;
}

function productToCode(productId?: string | null) {
  if (productId === "mm_pro_monthly") return "mm_pro_monthly";
  if (productId === "mm_pro_annual") return "mm_pro_annual";
  return productId ?? null;
}

function eventToStatus(type?: string, periodType?: string) {
  if (periodType === "TRIAL") return "trial";

  switch (type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
      return "active";

    case "CANCELLATION":
      return "cancelled_active";

    case "BILLING_ISSUE":
      return "grace";

    case "EXPIRATION":
      return "expired";

    case "REFUND":
    case "TRANSFER":
      return "revoked";

    default:
      return "active";
  }
}

function isProStatus(status: string) {
  return ["trial", "active", "cancelled_active", "grace"].includes(status);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("authorization");
  const expectedHeader = `Bearer ${REVENUECAT_WEBHOOK_SECRET}`;

  if (!REVENUECAT_WEBHOOK_SECRET || authHeader !== expectedHeader) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: RevenueCatWebhookBody;

  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const event = body.event;

  if (!event) {
    return new Response("Missing event", { status: 400 });
  }

  const userId = event.app_user_id ?? event.original_app_user_id;

  if (!userId) {
    return new Response("Missing app_user_id", { status: 400 });
  }

  const eventType = event.type ?? "UNKNOWN";
  const productCode = productToCode(event.product_id);
  const status = eventToStatus(eventType, event.period_type);
  const tier = isProStatus(status) ? "pro" : "free";
  const environment =
    event.environment?.toLowerCase() === "production" ? "production" : "sandbox";

  const startedAt = msToIso(event.purchased_at_ms);
  const expiresAt = msToIso(event.expiration_at_ms);

  const { data: existingEntitlement } = await supabase
    .from("user_entitlements")
    .select("status,tier")
    .eq("user_id", userId)
    .maybeSingle();

  const { error: subscriptionError } = await supabase
    .from("billing_subscriptions")
    .upsert(
      {
        user_id: userId,
        provider: "apple",
        environment,
        product_code: productCode ?? "unknown",
        tier,
        provider_customer_ref: userId,
        provider_subscription_ref: event.original_transaction_id ?? event.transaction_id ?? null,
        provider_original_transaction_ref: event.original_transaction_id ?? null,
        provider_transaction_ref: event.transaction_id ?? null,
        status,
        started_at: startedAt,
        trial_started_at: event.period_type === "TRIAL" ? startedAt : null,
        trial_ends_at: event.period_type === "TRIAL" ? expiresAt : null,
        current_period_started_at: startedAt,
        current_period_ends_at: expiresAt,
        cancelled_at: eventType === "CANCELLATION" ? new Date().toISOString() : null,
        revoked_at: ["REFUND", "TRANSFER"].includes(eventType)
          ? new Date().toISOString()
          : null,
        last_verified_at: new Date().toISOString(),
        is_auto_renewing: !["EXPIRATION", "REFUND", "TRANSFER"].includes(eventType),
        raw_last_event: body,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "provider,provider_original_transaction_ref",
      },
    );

  if (subscriptionError) {
    console.error("billing_subscriptions upsert failed", subscriptionError);
    return new Response(JSON.stringify({ error: subscriptionError.message }), {
      status: 500,
    });
  }

  const { error: entitlementError } = await supabase
    .from("user_entitlements")
    .upsert(
      {
        user_id: userId,
        tier,
        status,
        source: tier === "pro" ? "apple" : "none",
        product_code: productCode,
        effective_from: startedAt,
        effective_until: expiresAt,
        next_renewal_at: expiresAt,
        trial_ends_at: event.period_type === "TRIAL" ? expiresAt : null,
        cancelled_at: eventType === "CANCELLATION" ? new Date().toISOString() : null,
        last_verified_at: new Date().toISOString(),
        provider_environment: environment,
        manual_grant: false,
        capabilities_version: "v1",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      },
    );

  if (entitlementError) {
    console.error("user_entitlements upsert failed", entitlementError);
    return new Response(JSON.stringify({ error: entitlementError.message }), {
      status: 500,
    });
  }

  await supabase.from("billing_events").insert({
    user_id: userId,
    provider: "apple",
    event_type: eventType,
    event_source: "server_notification",
    provider_event_ref: event.id ?? event.transaction_id ?? null,
    old_status: existingEntitlement?.status ?? null,
    new_status: status,
    old_tier: existingEntitlement?.tier ?? null,
    new_tier: tier,
    reason: event.cancel_reason ?? null,
    payload: body,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});