import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import dotenv from "dotenv";

dotenv.config({ path: ".env.server" });

let client;
try {
  const id = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!id || !secret) {
    throw new Error("Missing PLAID_CLIENT_ID or PLAID_SECRET in .env.server");
  }
  const env = (process.env.PLAID_ENV || "sandbox").toLowerCase();
  const basePath =
    env === "production" ? PlaidEnvironments.production :
    env === "development" ? PlaidEnvironments.development :
    PlaidEnvironments.sandbox;
  const config = new Configuration({
    basePath,
    baseOptions: { headers: { "PLAID-CLIENT-ID": id, "PLAID-SECRET": secret } },
  });
  client = new PlaidApi(config);
  console.log(`[Plaid] Initialized for env=${env}`);
} catch (e) {
  console.error("[Plaid] init failed:", e?.message || e);
}

export default async function linkTokenHandler(req, res) {
  try {
    if (!client) throw new Error("Plaid client not initialized");
    console.log('[linkToken] linkTokenCreate start');
    const response = await client.linkTokenCreate({
      user: { client_user_id: "test-user" }, // required
      client_name: "RavBot",
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
      // ⚠️ remove redirect_uri unless you’ve whitelisted http://localhost:5173
    });
    console.log('[linkToken] linkTokenCreate success');
    res.json(response.data);
  } catch (err) {
    console.error('[linkToken] Plaid error', err?.response?.data || err?.stack || err);
    res.status(500).json({ error: err.response?.data || err.message || 'Link token failed' });
  }
}
