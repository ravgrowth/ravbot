import { createClient } from "@supabase/supabase-js";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const config = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
      "PLAID-SECRET": process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(config);

export default async function handler(req, res) {
  try {
    const { userId, bankConnectionId } = req.body;
    console.log("[api/syncSubscriptions] start", { userId, bankConnectionId });

    const { data: bankRow, error: bankErr } = await supabase
      .from("bank_connections")
      .select("access_token")
      .eq("id", bankConnectionId)
      .single();

    if (bankErr || !bankRow) {
      console.error("[api/syncSubscriptions] bankErr", bankErr);
      return res.status(400).json({ error: "No bank connection found" });
    }
    console.log("[api/syncSubscriptions] found bankRow", bankRow);

    const accessToken = bankRow.access_token;

    const startDate = "2025-07-01";
    const endDate = new Date().toISOString().split("T")[0];
    console.log("[api/syncSubscriptions] calling Plaid", { startDate, endDate });

    const plaidResp = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
    });
    console.log("[api/syncSubscriptions] plaidResp length", plaidResp.data.transactions.length);

    const txns = plaidResp.data.transactions;

    const counts = {};
    txns.forEach((t) => {
      const name = t.merchant_name || t.name;
      counts[name] = (counts[name] || 0) + 1;
    });

    const recurring = Object.keys(counts).filter((m) => counts[m] > 1);
    console.log("[api/syncSubscriptions] recurring", recurring);

    for (let merchant of recurring) {
      const { error } = await supabase.from("subscriptions").upsert({
        user_id: userId,
        merchant_name: merchant,
        interval: "monthly",
        amount: 10,
        status: "detected",
        updated_at: new Date().toISOString(),
      });
      if (error) console.error("[api/syncSubscriptions] upsert error", error);
    }

    res.json({ success: true, inserted: recurring });
  } catch (err) {
    console.error("[api/syncSubscriptions] error", err.response?.data || err.message);
    res.status(500).json({ error: "Subscription sync failed" });
  }
}
