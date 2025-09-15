import { createClient } from "@supabase/supabase-js";
import { ensureForQuery } from "../lib/schema.js";
import logger from "../lib/logger.js";

export default async function investmentExposure(req, res) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "No token provided" });

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return res.status(401).json({ error: "Invalid token" });

    try { await ensureForQuery('investment_positions') } catch (e) { logger.error('[api/investmentExposure.ensure]', e) }
    const { data: rows, error } = await supabase
      .from("investment_positions")
      .select("asset, balance")
      .eq("user_id", user.id);
    if (error) throw error;

    const hasSP = (rows || []).some(r => String(r.asset || "").toLowerCase().includes("s&p"))
      || (rows || []).some(r => String(r.asset || "").toLowerCase().includes("sp500"))
      || (rows || []).some(r => String(r.asset || "").toLowerCase().includes("s&p500"));

    const alerts = [];
    if (!hasSP) alerts.push({ type: "growth", message: "0% in S&P = missing 10% annual growth." });

    try { await ensureForQuery('logs'); await supabase.from('logs').insert({ user_id: user.id, action: 'view_investment_exposure', payload: { count: (rows||[]).length } }) } catch {}
    return res.json({ ok: true, alerts, positions: rows || [] });
  } catch (e) {
    logger.error("[api/investmentExposure]", e);
    return res.status(500).json({ error: "Failed to load exposure" });
  }
}
