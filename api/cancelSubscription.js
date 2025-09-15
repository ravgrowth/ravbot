/* eslint-env node */
import { createClient } from "@supabase/supabase-js";
import { assertEnv } from "../lib/env.js";
import logger from "../lib/logger.js";
import { ensureForQuery } from "../lib/schema.js";
import { cancelSubscription as cancelSubHelper } from "../lib/subscriptions.js";

assertEnv(["SUPABASE_URL", "SUPABASE_ANON_KEY"]);

const TAG_LIST = "[api/cancelSubscription] list";
const TAG_CANCEL = "[api/cancelSubscription] cancel";

export async function listSubscriptions(req, res) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "No token provided" });

    // RLS-safe user client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
    );

    logger.debug(`${TAG_LIST} auth.getUser start`);
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    logger.debug(`${TAG_LIST} auth.getUser result`, { userId: user?.id, error: userErr });
    if (userErr || !user) return res.status(401).json({ error: "Invalid token" });

    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, merchant_name, amount, interval, status")
      .eq("user_id", user.id);
    if (error) throw error;
    return res.json({ ok: true, subscriptions: data || [] });
  } catch (e) {
    logger.error(`${TAG_LIST} error`, e);
    const status = e.status && Number.isInteger(e.status) ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}

export async function cancelSubscription(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "No token provided" });

    // RLS-safe user client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
    );

    logger.debug(`${TAG_CANCEL} auth.getUser start`);
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    logger.debug(`${TAG_CANCEL} auth.getUser result`, { userId: user?.id, error: userErr });
    if (userErr || !user) return res.status(401).json({ error: "Invalid token" });

    const { userId, subscriptionId } = req.body || {};
    if (!subscriptionId) return res.status(400).json({ error: "Missing subscriptionId" });
    if (userId && userId !== user.id) return res.status(403).json({ error: "Forbidden" });

    logger.debug(`${TAG_CANCEL} helper start`, { user_id: user.id, subscription_id: subscriptionId });
    const result = await cancelSubHelper(supabase, user.id, subscriptionId);
    try { await ensureForQuery('logs'); } catch {}
    try { await supabase.from('logs').insert({ user_id: user.id, action: 'cancel_subscription', payload: { subscriptionId } }) } catch {}
    logger.debug(`${TAG_CANCEL} helper result`, result);
    return res.json({ ok: true, status: result.status });
  } catch (e) {
    logger.error(`${TAG_CANCEL} error`, e);
    const status = e.status && Number.isInteger(e.status) ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}
