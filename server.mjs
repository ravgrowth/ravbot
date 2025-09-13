import express from "express";
import dotenv from "dotenv";
import linkTokenHandler from "./api/linkToken.js";
import cancelSubscriptionHandler from "./api/cancelSubscription.js";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.server" });

const app = express();
app.use(express.json());

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

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// linkToken endpoint
app.post("/api/linkToken", linkTokenHandler);
// cancel subscription endpoint (MVP)
app.post("/api/cancelSubscription", cancelSubscriptionHandler);

// ---------------------------
// Exchange Public Token
// ---------------------------
app.post("/api/exchangePublicToken", async (req, res) => {
  try {
    const { public_token, bankName, bankId, userId } = req.body;
    console.log('[exchangePublicToken] start', { userId, bankName, bankId });
    const exchange = await client.itemPublicTokenExchange({ public_token });
    const access_token = exchange.data.access_token;

    // Save connection in Supabase
    const { data, error } = await supabase
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

    console.log('[exchangePublicToken] success, saved bank_connection', { userId, bankId: data?.id });
    res.json({ success: true, bank: data });
  } catch (e) {
    console.error('[exchangePublicToken] failed', e?.response?.data || e?.stack || e);
    res.status(500).json({ error: "Exchange failed" });
  }
});

// ---------------------------
// Get Accounts (secure lookup)
// ---------------------------
app.post("/api/getAccounts", async (req, res) => {
  const { userId, bankConnectionId } = req.body;

  try {
    console.log('[getAccounts] start', { userId, bank_connection_id: bankConnectionId });
    // Lookup access_token securely
    const { data, error } = await supabase
      .from("bank_connections")
      .select("access_token")
      .eq("id", bankConnectionId)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Bank connection not found" });
    }
    const access_token = data.access_token;

    // Audit log
    await supabase.from("money_actions").insert({
      user_id: userId,
      action: "check_balance",
      details: { bankConnectionId },
      status: "pending",
    });

    console.log('[getAccounts] calling Plaid accountsGet');
    const response = await client.accountsGet({ access_token });
    const accounts = response.data.accounts;
    console.log('[getAccounts] success', { count: accounts.length });

    // Mark log complete
    await supabase.from("money_actions")
      .update({ status: "completed", details: { count: accounts.length } })
      .eq("action", "check_balance")
      .eq("user_id", userId);

    res.json({ accounts });
  } catch (err) {
    console.error('[getAccounts] failed', err?.response?.data || err?.stack || err);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

// ---------------------------
// Get Transactions (secure lookup)
// ---------------------------
app.post("/api/getTransactions", async (req, res) => {
  const { userId, bankConnectionId } = req.body;

  try {
    console.log('[getTransactions] start', { userId, bank_connection_id: bankConnectionId });
    // Lookup access_token securely
    const { data, error } = await supabase
      .from("bank_connections")
      .select("access_token")
      .eq("id", bankConnectionId)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Bank connection not found" });
    }
    const access_token = data.access_token;

    // Audit log
    await supabase.from("money_actions").insert({
      user_id: userId,
      action: "fetch_transactions",
      details: { bankConnectionId },
      status: "pending",
    });

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    console.log('[getTransactions] calling Plaid transactionsGet');
    const response = await client.transactionsGet({
      access_token,
      start_date: thirtyDaysAgo.toISOString().split("T")[0],
      end_date: now.toISOString().split("T")[0],
    });
    const txns = response.data.transactions;
    console.log('[getTransactions] success', { transactions: txns.length });

    // Mark log complete
    await supabase.from("money_actions")
      .update({ status: "completed", details: { count: txns.length } })
      .eq("action", "fetch_transactions")
      .eq("user_id", userId);

    res.json({ transactions: txns });
  } catch (err) {
    console.error('[getTransactions] failed', err?.response?.data || err?.stack || err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// ---------------------------
// Detect & Save Subscriptions
// ---------------------------
app.post("/api/syncSubscriptions", async (req, res) => {
  const { userId, bankConnectionId } = req.body;

  try {
    console.log('[syncSubscriptions] start', { userId, bank_connection_id: bankConnectionId });
    // Lookup access_token
    const { data: conn, error: connErr } = await supabase
      .from("bank_connections")
      .select("access_token")
      .eq("id", bankConnectionId)
      .eq("user_id", userId)
      .single();

    if (connErr || !conn) return res.status(404).json({ error: "Bank connection not found" });
    const access_token = conn.access_token;

    // Fetch last 90 days of transactions
    const now = new Date();
    const ninety = new Date();
    ninety.setDate(now.getDate() - 90);

    console.log('[syncSubscriptions] calling Plaid transactionsGet');
    const plaidRes = await client.transactionsGet({
      access_token,
      start_date: ninety.toISOString().split("T")[0],
      end_date: now.toISOString().split("T")[0],
    });
    const txns = plaidRes.data.transactions;
    console.log('[syncSubscriptions] transactions fetched', { count: txns.length });

    // Naive recurring detection: group by merchant_name
    const merchants = {};
    txns.forEach((t) => {
      if (!t.merchant_name) return;
      merchants[t.merchant_name] = merchants[t.merchant_name] || [];
      merchants[t.merchant_name].push(t);
    });

    const recurring = Object.entries(merchants).filter(([_, list]) => list.length >= 3);
    console.log('[syncSubscriptions] recurring detected', { merchants: recurring.map(([m]) => m) });

    // Save into subscriptions table (columns that exist)
    let inserted = 0;
    if (recurring.length === 0) {
      console.log('[syncSubscriptions] NO SUBSCRIPTIONS DETECTED', { reason: 'No recurring merchants found' });
    } else {
      const rows = recurring.map(([merchant]) => ({ user_id: userId, merchant_name: merchant, status: 'detected' }));
      const { data: upData, error: upErr } = await supabase
        .from('subscriptions')
        .upsert(rows)
        .select();
      if (upErr) {
        console.error('[syncSubscriptions] upsert error', upErr);
      } else {
        inserted = (upData || []).length;
        console.log('[syncSubscriptions] INSERTED', { count: inserted, userId });
      }
    }

    res.json({ ok: true, found: recurring.map(([m]) => m), inserted });
  } catch (err) {
    console.error('[syncSubscriptions] failed', err?.response?.data || err?.stack || err);
    res.status(500).json({ error: "Subscription sync failed" });
  }
});

// Additional scan route for debugging with explicit logs
app.post('/api/subscriptions/scan', async (req, res) => {
  const { userId, bankConnectionId } = req.body || {};
  try {
    console.log('[subscriptions/scan] start', { userId, bank_connection_id: bankConnectionId });
    const { data: conn, error: connErr } = await supabase
      .from('bank_connections')
      .select('access_token')
      .eq('id', bankConnectionId)
      .eq('user_id', userId)
      .single();
    if (connErr || !conn) {
      console.error('[subscriptions/scan] bank connection lookup failed', connErr || 'not found');
      return res.status(404).json({ error: 'Bank connection not found' });
    }
    const access_token = conn.access_token;

    const now = new Date();
    const ninety = new Date();
    ninety.setDate(now.getDate() - 90);
    console.log('[subscriptions/scan] calling Plaid transactionsGet');
    const plaidRes = await client.transactionsGet({
      access_token,
      start_date: ninety.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
    });
    const txns = plaidRes.data.transactions || [];
    console.log('[subscriptions/scan] transactions fetched', { count: txns.length });

    const merchants = {};
    txns.forEach((t) => {
      const name = t.merchant_name || t.name || null;
      if (!name) return;
      merchants[name] = merchants[name] || [];
      merchants[name].push(t);
    });
    const recurring = Object.entries(merchants).filter(([_, list]) => list.length >= 3);
    if (recurring.length === 0) {
      console.log('NO SUBSCRIPTIONS DETECTED', { reason: 'No recurring merchants found' });
      return res.json({ ok: true, found: [], inserted: 0 });
    }

    const rows = recurring.map(([merchant]) => ({ user_id: userId, merchant_name: merchant, status: 'detected' }));
    const { data: upData, error: upErr } = await supabase
      .from('subscriptions')
      .upsert(rows)
      .select();
    if (upErr) {
      console.error('[subscriptions/scan] upsert error', upErr);
      return res.status(500).json({ error: 'Upsert failed' });
    }
    const inserted = (upData || []).length;
    console.log(`INSERTED ${inserted} subscriptions for user ${userId}`);
    return res.json({ ok: true, found: recurring.map(([m]) => m), inserted });
  } catch (err) {
    console.error('[subscriptions/scan] failed', err?.response?.data || err?.stack || err);
    return res.status(500).json({ error: 'Scan failed' });
  }
});

app.listen(3000, () => console.log("✅ API running on :3000"));
