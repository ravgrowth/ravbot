import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import dotenv from "dotenv";

dotenv.config({ path: ".env.server" });

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

export default async function linkTokenHandler(req, res) {
  try {
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
    res.status(400).json({ error: err.response?.data || err.message });
  }
}
