import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { usePlaidLink } from "react-plaid-link";

export default function Dashboard() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState([]);
  const [linkToken, setLinkToken] = useState(null);
  const [banks, setBanks] = useState([]); // connected banks
  const [accounts, setAccounts] = useState({});
  const [transactions, setTransactions] = useState({});

  // ---------------------------
  // Auth + subscriptions
  // ---------------------------
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/";
      } else {
        setSession(session);
        setLoading(false);

        try {
          const res = await fetch("/api/subscriptions/scan");
          if (res.ok) {
            const data = await res.json();
            setSubs(data.subscriptions || []);
          } else {
            console.warn("scan endpoint not available yet");
          }
        } catch (e) {
          console.error("scan failed", e);
        }

        // fetch connected banks
        try {
          const { data: banksData } = await supabase
            .from("bank_connections")
            .select("id, institution_name, institution_id, is_test, created_at")
            .eq("user_id", session.user.id);
          setBanks(banksData || []);
        } catch (e) {
          console.error("failed to fetch banks", e);
        }
      }
    };
    checkSession();
  }, []);

  // ---------------------------
  // Fetch link_token on load
  // ---------------------------
  useEffect(() => {
    const createLinkToken = async () => {
      try {
        const res = await fetch("/api/linkToken", { method: "POST" });
        const data = await res.json();
        setLinkToken(data.link_token);
      } catch (err) {
        console.error("failed to create link token", err);
      }
    };
    createLinkToken();
  }, []);

  // ---------------------------
  // Plaid hook
  // ---------------------------
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      const bankName = metadata.institution?.name;
      const bankId = metadata.institution?.institution_id;
      const userId = session.user.id;

      try {
        const res = await fetch("/api/exchangePublicToken", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token, bankName, bankId, userId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Exchange failed");

        // add new bank to state
        setBanks((prev) => [...prev, data.bank]);
      } catch (err) {
        console.error("exchange failed", err);
        alert("Failed to link bank");
      }
    },
  });

  // ---------------------------
  // Fetch accounts/transactions
  // ---------------------------
  async function fetchAccounts(bankConnectionId) {
    try {
      const res = await fetch("/api/getAccounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id, bankConnectionId }),
      });
      const data = await res.json();
      setAccounts((prev) => ({ ...prev, [bankConnectionId]: data.accounts || [] }));
    } catch (err) {
      console.error("failed to fetch accounts", err);
    }
  }

  async function fetchTransactions(bankConnectionId) {
    try {
      const res = await fetch("/api/getTransactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id, bankConnectionId }),
      });
      const data = await res.json();
      setTransactions((prev) => ({ ...prev, [bankConnectionId]: data.transactions || [] }));
    } catch (err) {
      console.error("failed to fetch transactions", err);
    }
  }

  async function fetchAllTransactions() {
    for (let bank of banks.filter(Boolean)) {
      if (bank?.id) {
        console.log("trying to do this: Banks in state when loading all txns:", banks);
        await fetchTransactions(bank.id);
        console.log("Banks in state when loading all txns:", banks);
      }
    }
  }

  // ---------------------------
  // Render
  // ---------------------------
  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 40 }}>
      <h1>🔥 Welcome to RavBot Dashboard 🔥</h1>
      <p>Logged in as: {session.user.email}</p>

      <button onClick={() => (window.location.href = "/settings")}>Settings</button>
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          window.location.href = "/login";
        }}
      >
        Log Out
      </button>

      {/* ---------------------------
          Bank Connections
      --------------------------- */}
      <h2>Bank Connections</h2>
      <button
        onClick={() => open()}
        disabled={!ready || !linkToken}
        style={{ marginBottom: "1rem" }}
      >
        Connect Bank
      </button>

      {banks && banks.length > 0 ? (
        <ul>
          {banks.filter(Boolean).map((b) => (
            <li key={b.id} style={{ marginBottom: "1rem" }}>
              ✅ {b.institution_name} (ID: {b.institution_id})
              <div style={{ marginTop: "0.5rem" }}>
                <button onClick={() => fetchAccounts(b.id)}>Load Accounts</button>
                <button onClick={() => fetchTransactions(b.id)}>Load Transactions</button>
              </div>

              {/* Accounts */}
              {accounts[b.id] && accounts[b.id].length > 0 && (
                <ul>
                  {accounts[b.id].map((acc) => (
                    <li key={acc.account_id}>
                      {acc.name} – ${acc.balances.current}
                    </li>
                  ))}
                </ul>
              )}

              {/* Transactions */}
              {transactions[b.id] && transactions[b.id].length > 0 && (
                <ul>
                  {transactions[b.id].map((t) => (
                    <li key={t.transaction_id}>
                      {t.date}: {t.name} – ${t.amount}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No banks connected yet.</p>
      )}

      {banks.length > 0 && (
        <button onClick={fetchAllTransactions} style={{ marginTop: "1rem" }}>
          Load All Transactions
        </button>
      )}

      {/* ---------------------------
          Subscriptions
      --------------------------- */}
      <h2>Subscriptions</h2>
      {subs.length === 0 ? (
        <p>No subscriptions</p>
      ) : (
        <ul>
          {subs.map((s) => (
            <li key={s.id}>
              {s.name}{" "}
              {s.status === "cancelled" ? (
                "(Cancelled)"
              ) : (
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/subscriptions/cancel", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ subscriptionId: s.id }),
                      });
                      if (!res.ok) throw new Error("Request failed");
                      setSubs((prev) => prev.filter((x) => x.id !== s.id));
                    } catch (err) {
                      console.error(err);
                      alert("Failed to cancel");
                    }
                  }}
                >
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
