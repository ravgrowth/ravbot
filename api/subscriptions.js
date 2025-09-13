// api/subscriptions.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  try {
    const { userId } = req.query; // if GET
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, merchant_name, status, interval, amount")
      .eq("user_id", userId);

    if (error) throw error;
    res.status(200).json({ data });
  } catch (err) {
    console.error("[api/subscriptions] list error", err.message);
    res.status(500).json({ error: err.message });
  }
}
