import "server-only";

import webpush from "web-push";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { deliverClaimedPush, type Delivery } from "./sender.server";

function validateImportedRecipe(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const recipe = value as Record<string, unknown>;
  return recipe.schemaVersion === "recipe-v1" && typeof recipe.title === "string" && recipe.title.trim().length > 0 && recipe.title.length <= 200
    && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 && recipe.ingredients.length <= 200
    && recipe.ingredients.every((item: unknown) => item && typeof item === "object" && "name" in item && typeof item.name === "string" && item.name.trim().length > 0)
    && Array.isArray(recipe.steps) && recipe.steps.length > 0 && recipe.steps.length <= 100 && recipe.steps.every((step: unknown) => typeof step === "string" && step.trim().length > 0)
    && recipe.source !== null && typeof recipe.source === "object" && "type" in recipe.source && typeof recipe.source.type === "string"
    && recipe.provenance !== null && typeof recipe.provenance === "object" && "sourceType" in recipe.provenance && typeof recipe.provenance.sourceType === "string";
}

function vapidConfigured(): boolean {
  return Boolean(process.env.VAPID_SUBJECT && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function dispatchPushBatch(limit = 20): Promise<number> {
  if (process.env.PUSH_ENABLED === "false") return 0;
  if (!vapidConfigured()) throw new Error("PUSH_CONFIGURATION_MISSING");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const db = createAdminSupabaseClient();
  let processed = 0;

  for (; processed < limit; processed += 1) {
    const { data, error } = await db.rpc("claim_push_delivery" as never);
    if (error) throw new Error("PUSH_CLAIM_FAILED");
    if (!data) break;
    const delivery = data as Delivery;
    const [{ data: job, error: jobError }, { data: subscription, error: subscriptionError }] = await Promise.all([
      db.from("recipe_import_jobs").select("state,result,completed_version,user_id").eq("id", delivery.job_id).single(),
      db.from("push_subscriptions" as never).select("user_id,revoked_at").eq("id", delivery.subscription_id).single(),
    ]);
    const activeSubscription = subscription as { user_id: string; revoked_at: string | null } | null;
    if (jobError || subscriptionError || !job || !activeSubscription || job.user_id !== activeSubscription.user_id || activeSubscription.revoked_at || job.state !== "completed" || job.completed_version !== delivery.completed_version || !validateImportedRecipe(job.result)) {
      await db.rpc("finish_push_delivery" as never, { p_delivery_id: delivery.id, p_status: "terminal", p_error_code: "CANONICAL_STATE_CHANGED", p_next_attempt_at: null, p_revoke_subscription: false } as never);
      continue;
    }
    await deliverClaimedPush(db, delivery, async (subscription, payload) => {
      try {
        const response = await webpush.sendNotification(subscription, payload, { TTL: 3600, timeout: 10000 });
        return { status: response.statusCode };
      } catch (cause) {
        const status = typeof cause === "object" && cause && "statusCode" in cause ? cause.statusCode : undefined;
        if (typeof status === "number") return { status };
        throw new Error("PUSH_TRANSPORT_FAILED");
      }
    });
  }
  return processed;
}
