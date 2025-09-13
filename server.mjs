import express from "express";
import dotenv from "dotenv";
import linkTokenHandler from "./api/linkToken.js";
import * as subsApi from "./api/cancelSubscription.js";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { createClient } from "@supabase/supabase-js";

// Load server env (contains Supabase URL, keys, Plaid creds)
dotenv.config({ path: ".env.server" });

const app = express();
app.use(express.json());

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

// ---------------------------
// Exchange Public Token
// ---------------------------
app.post("/api/exchangePublicToken", async (req, res) => {
  try {
    const { public_token, bankName, bankId, userId } = req.body;
    const { supabase, token } = userClientFromRequest(req);
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    console.log("[exchangePublicToken] start", { userId, bankName, bankId });
    const exchange = await client.itemPublicTokenExchange({ public_token });
    const access_token = exchange.data.access_token;

    // Use service-role client for inserting bank connection to bypass RLS
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
    console.log("[exchangePublicToken] success", { userId, bankConnectionId: data?.id });
    res.json({ success: true, bank: data });
  } catch (e) {
    console.error("[exchangePublicToken] failed", e?.response?.data || e?.stack || e);
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

app.listen(3000, () => console.log("API running on :3000"));
