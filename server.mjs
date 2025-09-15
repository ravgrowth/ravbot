import express from "express";
import dotenv from "dotenv";
import linkTokenHandler from "./api/linkToken.js";
import * as subsApi from "./api/cancelSubscription.js";
import investmentExposure from "./api/investmentExposure.js";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { createClient } from "@supabase/supabase-js";
import logger from "./lib/logger.js";
import { ensureCoreTables, ensureForQuery } from "./lib/schema.js";

// Load server env (contains Supabase URL, keys, Plaid creds)
dotenv.config({ path: ".env.server" });

const app = express();
app.use(express.json());

// Extreme verbose request logging
app.use((req, res, next) => {
  const { iso, human } = logger.stamp();
  const start = Date.now();
  logger.debug('[req]', `${req.method} ${req.url}`, { iso, human, headers: req.headers });
  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.info('[res]', `${req.method} ${req.url} -> ${res.statusCode} in ${ms}ms`);
  });
  next();
});

// Ensure schema before handling each request (idempotent, additive only)
app.use(async (req, res, next) => {
  try { await ensureCoreTables() } catch (e) { logger.error('[schema.ensurePerRequest]', e) }
  next()
})

// Health check
app.get("/ping", (req, res) => res.json({ ok: true }));

// Plaid client
const config = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});
const client = new PlaidApi(config);

// Ensure core DB tables exist on startup
(async () => {
  try {
    await ensureCoreTables();
    logger.info('[startup]', 'Core tables ensured');
  } catch (e) {
    logger.error('[startup]', e, { step: 'ensureCoreTables' });
  }
})();

// Per-request Supabase client (RLS-safe)
function userClientFromRequest(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, anonKey, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    auth: { persistSession: false },
  });
  return { supabase, token };
}

// Service-role Supabase client (bypasses RLS) for backend mutations
const serviceSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// linkToken endpoint (no auth required)
app.post("/api/linkToken", linkTokenHandler);

// subscriptions endpoints (MVP)
app.get("/api/subscriptions/list", subsApi.listSubscriptions);
app.post("/api/subscriptions/cancel", subsApi.cancelSubscription);
app.get("/api/investmentExposure", investmentExposure);

// ---------------------------
// Exchange Public Token
// ---------------------------
app.post("/api/exchangePublicToken", async (req, res) => {
  try {
    const { public_token, bankName, bankId, userId } = req.body;
    const { supabase, token } = userClientFromRequest(req);
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    logger.debug('[exchangePublicToken]', 'start', { userId, bankName, bankId });
    const exchange = await client.itemPublicTokenExchange({ public_token });
    const access_token = exchange.data.access_token;

    // Use service-role client for inserting bank connection to bypass RLS
    await ensureForQuery('logs');
    const { data, error } = await serviceSupabase
      .from("bank_connections")
      .insert({
        user_id: userId,
        institution_name: bankName,
        institution_id: bankId,
        access_token,
        is_test: true,
      })
      .select("id, institution_name, institution_id")
      .single();

    if (error) throw error;
    try { await serviceSupabase.from('logs').insert({ user_id: userId, action: 'exchange_public_token', payload: { bankName, bankId } }); } catch {}
    logger.info('[exchangePublicToken]', 'success', { userId, bankConnectionId: data?.id });
    res.json({ success: true, bank: data });
  } catch (e) {
    logger.error('[exchangePublicToken]', e, { payload: req.body });
    res.status(500).json({ error: "Exchange failed" });
  }
});

// ---------------------------
// Get Accounts (secure lookup)
// ---------------------------
app.post("/api/getAccounts", async (req, res) => {
  const { userId, bankConnectionId } = req.body;
  const { supabase, token } = userClientFromRequest(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    console.log("[getAccounts] start", { userId, bank_connection_id: bankConnectionId });
    const { data, error } = await supabase
      .from("bank_connections")
      .select("access_token")
      .eq("id", bankConnectionId)
      .eq("user_id", userId)
      .single();

    if (error || !data) return res.status(404).json({ error: "Bank connection not found" });
    const access_token = data.access_token;

    await serviceSupabase.from("money_actions").insert({
      user_id: userId,
      action: "check_balance",
      details: { bankConnectionId },
      status: "pending",
    });

    const response = await client.accountsGet({ access_token });
    const accounts = response.data.accounts;

    await serviceSupabase
      .from("money_actions")
      .update({ status: "completed", details: { count: accounts.length } })
      .eq("action", "check_balance")
      .eq("user_id", userId);

    res.json({ accounts });
  } catch (err) {
    console.error("[getAccounts] failed", err?.response?.data || err?.stack || err);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

// ---------------------------
// Get Transactions (secure lookup)
// ---------------------------
app.post("/api/getTransactions", async (req, res) => {
  const { userId, bankConnectionId } = req.body;
  const { supabase, token } = userClientFromRequest(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    console.log("[getTransactions] start", { userId, bank_connection_id: bankConnectionId });
    const { data, error } = await supabase
      .from("bank_connections")
      .select("access_token")
      .eq("id", bankConnectionId)
      .eq("user_id", userId)
      .single();

    if (error || !data) return res.status(404).json({ error: "Bank connection not found" });
    const access_token = data.access_token;

    await serviceSupabase.from("money_actions").insert({
      user_id: userId,
      action: "fetch_transactions",
      details: { bankConnectionId },
      status: "pending",
    });

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const response = await client.transactionsGet({
      access_token,
      start_date: thirtyDaysAgo.toISOString().split("T")[0],
      end_date: now.toISOString().split("T")[0],
    });
    const txns = response.data.transactions;

    await serviceSupabase
      .from("money_actions")
      .update({ status: "completed", details: { count: txns.length } })
      .eq("action", "fetch_transactions")
      .eq("user_id", userId);

    res.json({ transactions: txns });
  } catch (err) {
    console.error("[getTransactions] failed", err?.response?.data || err?.stack || err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// ---------------------------
// Detect & Save Subscriptions
// ---------------------------
app.post("/api/syncSubscriptions", async (req, res) => {
  const { userId, bankConnectionId } = req.body;
  const { supabase, token } = userClientFromRequest(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    console.log("[syncSubscriptions] start", { userId, bank_connection_id: bankConnectionId });
    const { data: conn, error: connErr } = await supabase
      .from("bank_connections")
      .select("access_token")
      .eq("id", bankConnectionId)
      .eq("user_id", userId)
      .single();

    if (connErr || !conn) return res.status(404).json({ error: "Bank connection not found" });
    const access_token = conn.access_token;

    const now = new Date();
    const ninety = new Date();
    ninety.setDate(now.getDate() - 90);

    const plaidRes = await client.transactionsGet({
      access_token,
      start_date: ninety.toISOString().split("T")[0],
      end_date: now.toISOString().split("T")[0],
    });
    const txns = plaidRes.data.transactions || [];

    const merchants = {};
    txns.forEach((t) => {
      const name = t.merchant_name || t.name;
      if (!name) return;
      merchants[name] = merchants[name] || [];
      merchants[name].push(t);
    });

    const recurring = Object.entries(merchants).filter(([_, list]) => list.length >= 3);

    let inserted = 0;
    if (recurring.length > 0) {
      const rows = recurring.map(([merchant]) => ({ user_id: userId, merchant_name: merchant, status: "detected" }));
      const { data: upData, error: upErr } = await serviceSupabase.from("subscriptions").upsert(rows).select();
      if (upErr) console.error("[syncSubscriptions] upsert error", upErr);
      else inserted = (upData || []).length;
    }

    res.json({ ok: true, found: recurring.map(([m]) => m), inserted });
  } catch (err) {
    console.error("[syncSubscriptions] failed", err?.response?.data || err?.stack || err);
    res.status(500).json({ error: "Subscription sync failed" });
  }
});

// Force Sandbox Transactions (Plaid testing)
app.post("/api/sandbox/fireTransactions", async (req, res) => {
  try {
    const { access_token } = req.body;
    const resp = await client.sandboxTransactionsFire({
      access_token,
      webhook: "https://example.com/plaid-webhook",
    });
    res.json({ success: true, data: resp.data });
  } catch (err) {
    console.error("[sandbox/fireTransactions] failed", err?.response?.data || err);
    res.status(500).json({ error: "sandbox fire failed" });
  }
});

// Additional scan route (explicit logs)
app.post("/api/subscriptions/scan", async (req, res) => {
  const { userId, bankConnectionId } = req.body || {};
  const { supabase, token } = userClientFromRequest(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { data: conn, error: connErr } = await supabase
      .from("bank_connections")
      .select("access_token")
      .eq("id", bankConnectionId)
      .eq("user_id", userId)
      .single();
    if (connErr || !conn) return res.status(404).json({ error: "Bank connection not found" });
    const access_token = conn.access_token;

    const now = new Date();
    const ninety = new Date();
    ninety.setDate(now.getDate() - 90);

    const plaidRes = await client.transactionsGet({
      access_token,
      start_date: ninety.toISOString().split("T")[0],
      end_date: now.toISOString().split("T")[0],
    });
    const txns = plaidRes.data.transactions || [];

    const merchants = {};
    txns.forEach((t) => {
      const name = t.merchant_name || t.name || null;
      if (!name) return;
      merchants[name] = merchants[name] || [];
      merchants[name].push(t);
    });
    const recurring = Object.entries(merchants).filter(([_, list]) => list.length >= 3);
    if (recurring.length === 0) return res.json({ ok: true, found: [], inserted: 0 });

    const rows = recurring.map(([merchant]) => ({ user_id: userId, merchant_name: merchant, status: "detected" }));
    const { data: upData, error: upErr } = await serviceSupabase.from("subscriptions").upsert(rows).select();
    if (upErr) return res.status(500).json({ error: "Upsert failed" });
    const inserted = (upData || []).length;
    return res.json({ ok: true, found: recurring.map(([m]) => m), inserted });
  } catch (err) {
    console.error("[subscriptions/scan] failed", err?.response?.data || err?.stack || err);
    return res.status(500).json({ error: "Scan failed" });
  }
});

// ---------------------------
// Scan My Money (unified summary)
// ---------------------------
app.get("/api/scanMoney", async (req, res) => {
  try {
    const { supabase, token } = userClientFromRequest(req);
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return res.status(401).json({ error: "Invalid token" });

    // Fetch subscriptions (RLS filters to requesting user)
    const { data: subs, error: subsErr } = await supabase
      .from("subscriptions")
      .select("id, merchant_name, status, interval, amount");
    if (subsErr) throw subsErr;

    // Consider active/detected subscriptions as leaks
    const leakIntervals = {
      monthly: 12,
      yearly: 1,
      annually: 1,
      weekly: 52,
      daily: 365,
    };
    const leaks = (subs || [])
      .filter((s) => ["active", "detected", "cancel_pending"].includes(String(s.status || "").toLowerCase()))
      .map((s) => {
        const mult = leakIntervals[String(s.interval || "monthly").toLowerCase()] ?? 12;
        const yearly = Number(s.amount || 0) * mult;
        return {
          id: s.id,
          merchant: s.merchant_name || "Subscription",
          amount: Number(s.amount || 0),
          interval: s.interval || "monthly",
          yearly_amount: yearly,
          status: s.status || "active",
        };
      });
    const leaks_yearly = leaks.reduce((acc, r) => acc + Number(r.yearly_amount || 0), 0);

    // Fetch idle cash recommendations (v1 + v2)
    const [idleV1, idleV2] = await Promise.all([
      supabase.from("idle_cash_recommendations").select("idle_amount, account_name, institution_name, bank_name, suggested_target, est_apy, recommendation, apy, account_id"),
      supabase
        .from("idle_cash_recommendations_v2")
        .select("balance, estimated_yearly_gain, account_name, institution_name, bank_name, suggested_target, est_apy, recommendation, apy, account_id"),
    ]);
    if (idleV1.error) throw idleV1.error;
    if (idleV2.error) throw idleV2.error;

    const idle_rows = [...(idleV1.data || []), ...(idleV2.data || [])];
    const idle_cash = idle_rows
      .map((r) => ({
        amount: Number(r.idle_amount ?? r.balance ?? 0),
        account: r.account_name || r.account_id || "Account",
        bank: r.institution_name || r.bank_name || "Bank",
        target: r.suggested_target || r.recommendation || "High-Yield Savings",
        apy: r.est_apy ?? r.apy ?? null,
        estimated_yearly_gain: r.estimated_yearly_gain != null ? Number(r.estimated_yearly_gain) : null,
      }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const total_idle_amount = idle_cash.reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const idle_yearly = idle_cash.reduce((acc, r) => {
      if (r.estimated_yearly_gain != null) return acc + r.estimated_yearly_gain;
      const assumed = 0.055; // assume 5.5% APY benefit if missing
      return acc + Number(r.amount || 0) * assumed;
    }, 0);

    // Growth gap: check if any investment/brokerage accounts exist
    const { data: accts, error: acctErr } = await supabase
      .from("accounts")
      .select("id, account_type, subtype");
    if (acctErr) throw acctErr;
    const hasMarket = (accts || []).some((a) => {
      const t = String(a.account_type || "").toLowerCase();
      const s = String(a.subtype || "").toLowerCase();
      return t.includes("investment") || t.includes("brokerage") || s.includes("investment") || s.includes("brokerage") || s.includes("securities");
    });

    // If no exposure, consider 10% opportunity on idle deployable capital
    const betterRate = 0.10;
    const currentRate = 0.0;
    const growth_opportunity = total_idle_amount * Math.max(betterRate - currentRate, 0);
    const growth = [
      hasMarket
        ? { message: "Has market exposure", note: "Good diversification helps long-term growth.", missing_rate: null }
        : { message: "No S&P exposure", note: "Consider broad index funds (e.g., VOO)", missing_rate: 0.10 },
    ];

    // Update lifetime savings tracker (increment with new opportunities)
    try {
      const inc = Number(idle_yearly || 0); // conservative: use idle opportunity only
      if (inc > 0) {
        const { data: row, error: fetchErr } = await serviceSupabase
          .from("lifetime_savings")
          .select("id, saved_amount")
          .eq("user_id", user.id)
          .single();
        if (fetchErr || !row) {
          await serviceSupabase
            .from("lifetime_savings")
            .insert({ user_id: user.id, saved_amount: inc, updated_at: new Date().toISOString() });
        } else {
          await serviceSupabase
            .from("lifetime_savings")
            .update({ saved_amount: Number(row.saved_amount || 0) + inc, updated_at: new Date().toISOString() })
            .eq("id", row.id);
        }
      }
    } catch (e) {
      console.warn("[scanMoney lifetime_savings] update failed", e?.message || e);
    }

    // ---------------------------
    // Recurring detection engine
    // ---------------------------
    try {
      // Fetch Plaid transactions for last 90 days across user bank connections
      const { data: conns, error: connErr } = await supabase
        .from("bank_connections")
        .select("id, access_token")
        .eq("user_id", user.id);
      if (connErr) throw connErr;

      const now = new Date();
      const ninety = new Date();
      ninety.setDate(now.getDate() - 90);
      const start_date = ninety.toISOString().split("T")[0];
      const end_date = now.toISOString().split("T")[0];

      const allTxns = [];
      for (const c of conns || []) {
        try {
          const resp = await client.transactionsGet({
            access_token: c.access_token,
            start_date,
            end_date,
          });
          (resp?.data?.transactions || []).forEach((t) => allTxns.push(t));
        } catch (e) {
          console.warn("[scanMoney recurring] plaid fetch failed for conn", c?.id, e?.response?.data || e?.message);
        }
      }

      const groups = {};
      for (const t of allTxns) {
        const name = t.merchant_name || t.name;
        if (!name) continue;
        const amt = Math.abs(Number(t.amount || 0));
        const date = new Date(t.date);
        const key = name.trim();
        if (!groups[key]) groups[key] = [];
        groups[key].push({ amt, date });
      }

      const seriesRows = [];
      const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      for (const [merchant, list] of Object.entries(groups)) {
        const sorted = list.sort((a, b) => a.date - b.date);
        if (sorted.length < 2) continue;
        const gaps = [];
        for (let i = 1; i < sorted.length; i++) {
          const days = Math.round((sorted[i].date - sorted[i - 1].date) / (1000 * 60 * 60 * 24));
          gaps.push(days);
        }
        const median = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] || 0;
        let cadence = "unknown";
        if (median >= 5 && median <= 10) cadence = "weekly";
        else if (median >= 20 && median <= 40) cadence = "monthly";
        const avg_amount = sorted.reduce((acc, r) => acc + r.amt, 0) / sorted.length;
        const last_charge = sorted[sorted.length - 1].date.toISOString().slice(0, 10);
        let next_estimated = null;
        if (cadence === "weekly") {
          const d = new Date(sorted[sorted.length - 1].date);
          d.setDate(d.getDate() + 7);
          next_estimated = d.toISOString().slice(0, 10);
        } else if (cadence === "monthly") {
          const d = new Date(sorted[sorted.length - 1].date);
          d.setMonth(d.getMonth() + 1);
          next_estimated = d.toISOString().slice(0, 10);
        }
        const confidence = sorted.length >= 3 ? 0.9 : 0.6;
        seriesRows.push({
          user_id: user.id,
          merchant_display: merchant,
          merchant_slug: slugify(merchant),
          cadence,
          avg_amount,
          confidence,
          last_charge,
          next_estimated,
          features: { count_90d: sorted.length, median_days: median },
        });
      }

      if (seriesRows.length > 0) {
        // Replace existing rows for these slugs to avoid duplication
        const slugs = seriesRows.map((r) => r.merchant_slug);
        try {
          await serviceSupabase
            .from("recurring_series")
            .delete()
            .eq("user_id", user.id)
            .in("merchant_slug", slugs);
        } catch (e) {
          console.warn("[scanMoney recurring] delete existing failed", e?.message || e);
        }
        const { error: insErr } = await serviceSupabase.from("recurring_series").insert(seriesRows);
        if (insErr) console.warn("[scanMoney recurring] insert failed", insErr);
      }
    } catch (e) {
      console.warn("[scanMoney recurring] compute failed", e?.response?.data || e?.message || e);
    }

    return res.json({
      leaks,
      idle_cash,
      growth,
      totals: {
        leaks_yearly,
        idle_yearly,
        growth_opportunity,
      },
    });
  } catch (err) {
    console.error("[scanMoney] failed", err?.response?.data || err?.stack || err);
    return res.status(500).json({ error: "Scan failed" });
  }
});

// Developer: insert test data for debugging UI quickly
app.post('/api/dev/insertTestData', async (req, res) => {
  try {
    const { userId } = req.body || {}
    if (!userId) return res.status(400).json({ error: 'Missing userId' })
    await ensureForQuery('logs')
    await ensureForQuery('idle_cash_recommendations_v2')
    const inserted = []
    const { error: e1 } = await serviceSupabase.from('idle_cash_recommendations_v2').insert({ user_id: userId, balance: 9876.54, estimated_yearly_gain: 543.21, account_name: 'Test Checking' })
    if (!e1) inserted.push('idle_cash_recommendations_v2')
    try { await serviceSupabase.from('logs').insert({ user_id: userId, action: 'dev_insert_test_data', payload: { inserted } }) } catch {}
    res.json({ ok: true, inserted })
  } catch (e) {
    logger.error('[dev/insertTestData]', e, { body: req.body })
    res.status(500).json({ error: 'Failed to insert test data' })
  }
})

// Recent logs for dashboard transparency
app.get('/api/logs/recent', async (req, res) => {
  try {
    const { supabase, token } = userClientFromRequest(req)
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const { data: { user } } = await supabase.auth.getUser()
    await ensureForQuery('logs')
    const { data, error } = await serviceSupabase
      .from('logs')
      .select('action, payload, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    res.json({ ok: true, logs: data || [] })
  } catch (e) {
    logger.error('[logs/recent]', e)
    res.status(500).json({ error: 'Failed to load logs' })
  }
})

app.listen(3000, () => console.log("API running on :3000"));
