import express from "express";
import dotenv from "dotenv";
import linkTokenHandler from "./api/linkToken.js";
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

// ---------------------------
// Exchange Public Token
// ---------------------------
app.post("/api/exchangePublicToken", async (req, res) => {
  try {
    const { public_token, bankName, bankId, userId } = req.body;

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

    res.json({ success: true, bank: data });
  } catch (e) {
    console.error("Plaid exchange failed:", e.response?.data || e.message);
    res.status(500).json({ error: "Exchange failed" });
  }
});

// ---------------------------
// Get Accounts (secure lookup)
// ---------------------------
app.post("/api/getAccounts", async (req, res) => {
  const { userId, bankConnectionId } = req.body;

  try {
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

    const response = await client.accountsGet({ access_token });
    const accounts = response.data.accounts;

    // Mark log complete
    await supabase.from("money_actions")
      .update({ status: "completed", details: { count: accounts.length } })
      .eq("action", "check_balance")
      .eq("user_id", userId);

    res.json({ accounts });
  } catch (err) {
    console.error("accountsGet failed:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

// ---------------------------
// Get Transactions (secure lookup)
// ---------------------------
app.post("/api/getTransactions", async (req, res) => {
  const { userId, bankConnectionId } = req.body;

  try {
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

    const response = await client.transactionsGet({
      access_token,
      start_date: thirtyDaysAgo.toISOString().split("T")[0],
      end_date: now.toISOString().split("T")[0],
    });
    const txns = response.data.transactions;

    // Mark log complete
    await supabase.from("money_actions")
      .update({ status: "completed", details: { count: txns.length } })
      .eq("action", "fetch_transactions")
      .eq("user_id", userId);

    res.json({ transactions: txns });
  } catch (err) {
    console.error("transactionsGet failed:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

app.listen(3000, () => console.log("✅ API running on :3000"));
