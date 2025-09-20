import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import dotenv from "dotenv";

dotenv.config({ path: ".env.server" });

const TAG = "[api/linkToken]";
const SANDBOX_HINT = "Sandbox creds -> user_good / pass_good / 123456";

function resolveEnvironment(name = "sandbox") {
  const normalized = String(name || "").toLowerCase();
  if (normalized.startsWith("prod")) return PlaidEnvironments.production;
  if (normalized.startsWith("dev")) return PlaidEnvironments.development;
  return PlaidEnvironments.sandbox;
}

function buildMockPayload(reason) {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  return {
    link_token: `plink-mock-${Math.random().toString(36).slice(2)}`,
    expiration: expiresAt,
    request_id: `mock-${Date.now()}`,
    is_mock: true,
    sandbox_hint: SANDBOX_HINT,
    mock_banks: [
      { id: "mock-bank-1", institution_name: "Ally Bank (Mock)", last4: "1234" },
      { id: "mock-bank-2", institution_name: "Capital One (Mock)", last4: "5678" },
    ],
    reason,
  };
}

let plaidClient = null;
if (process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET) {
  try {
    const config = new Configuration({
      basePath: resolveEnvironment(process.env.PLAID_ENV),
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
          "PLAID-SECRET": process.env.PLAID_SECRET,
        },
      },
    });
    plaidClient = new PlaidApi(config);
    console.log(`${TAG} initialized for env=${process.env.PLAID_ENV || "sandbox"}`);
  } catch (err) {
    plaidClient = null;
    console.error(`${TAG} init failed`, err?.message || err);
  }
} else {
  console.warn(`${TAG} missing Plaid credentials, using mock token response`);
}

export default async function linkTokenHandler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!plaidClient) {
      return res.json(buildMockPayload("plaid client unavailable"));
    }

    const userId = req.body?.userId || req.query?.userId || "test-user";
    const params = {
      user: { client_user_id: String(userId) },
      client_name: "RavBot",
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
    };
    if (process.env.PLAID_REDIRECT_URI) {
      params.redirect_uri = process.env.PLAID_REDIRECT_URI;
    }

    console.log(`${TAG} linkTokenCreate start`, { userId });
    const response = await plaidClient.linkTokenCreate(params);
    console.log(`${TAG} linkTokenCreate ok`, { request_id: response?.data?.request_id });
    return res.json({ ...response.data, sandbox_hint: SANDBOX_HINT, mock_banks: [] });
  } catch (err) {
    const payload = err?.response?.data;
    console.error(`${TAG} error`, payload || err?.message || err);
    return res.json(buildMockPayload(payload?.error_message || err?.message || "plaid failure"));
  }
}
