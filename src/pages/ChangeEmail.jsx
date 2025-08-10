import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function ChangeEmail() {
  // Steps: auth -> code -> success
  const [step, setStep] = useState("auth");

  // Inputs
  const [currentEmail, setCurrentEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [code, setCode] = useState("");

  // State
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgColor, setMsgColor] = useState("white");
  const [resetLink, setResetLink] = useState(null);
  const [countdown, setCountdown] = useState(0); // seconds until resend
  const [verifiedNewEmail, setVerifiedNewEmail] = useState("");
  const [oldEmail, setOldEmail] = useState("");

  useEffect(() => {
    // Prefill current email from session if available
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        setCurrentEmail(session.user.email ?? "");
      }
    });
  }, []);

  // simple countdown for "Resend code"
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  function banner(text, color = "white") {
    setMsg(text);
    setMsgColor(color);
  }

  async function handleSendCode() {
    setMsg("");
    if (!currentEmail || !currentPassword || !newEmail || !confirmEmail) {
      return banner("Fill all fields.", "red");
    }
    if (newEmail !== confirmEmail) return banner("New email and confirmation do not match.", "red");
    if (currentEmail === newEmail) return banner("New email must be different from current email.", "red");

    setLoading(true);
    try {
      // 1) Re-auth with current creds and USE the returned session (no getSession here)
      const { data: signinData, error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: currentPassword
      });
      if (signInError) return banner(`Re-authentication failed: ${signInError.message}`, "red");

      const session = signinData?.session;
      if (!session?.user?.id) return banner("No user session. Please log in again.", "red");
      setUserId(session.user.id); // ✅ save user id for Step 2

      // Optional sanity check
      if (session.user.email && session.user.email.toLowerCase() !== currentEmail.toLowerCase()) {
        return banner("Logged in account does not match the entered current email.", "red");
      }

      // 2) Send code
      const r = await fetch("/api/sendEmailChangeCode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: session.user.id,
          current_email: currentEmail,
          new_email: newEmail,
          debug: true // <— forces debug mode so you see HTML/code in response
        })
      });

      const resp = await r.json().catch(() => ({}));
      
      // these are debug things
      console.log('[ChangeEmail] sendEmailChangeCode status:', r.status);
      console.log('[ChangeEmail] sendEmailChangeCode body:', resp);

      if (!r.ok) return banner(`Could not send code: ${resp?.error || "Unknown error"}`, "red");

      // If debug mode returns the code, show/prefill
      if (resp.code) {
        setCode(resp.code);
        banner(`(DEV) Code: ${resp.code}. It expires in 10 minutes.`, "cyan");
      } else {
        banner(`Verification code sent to ${newEmail}. It expires in 10 minutes.`, "cyan");
      }

      setVerifiedNewEmail(newEmail);
      setOldEmail(currentEmail);
      setCountdown(45);
      setStep("code");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmCode() {
    setMsg("");
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id || null;
    }
    if (!uid) return banner("No user session. Please log in again.", "red");
    if (!code || code.length < 6) return banner("Enter the 6 digit code.", "red");

    setLoading(true);
    try {
      // Step 3 - confirm code, update email via admin, warn old email, send recovery link
      const r = await fetch("/api/confirmEmailChange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: uid, code })
      });

      const data = await r.json().catch(() => ({}));

      // more debug things probably dont have in production
      console.log('[ChangeEmail] confirmEmailChange status:', r.status);
      console.log('[ChangeEmail] confirmEmailChange body:', data);

      if (!r.ok) {
        return banner(data?.error || "Invalid or expired code.", "red");
      }

      if (data?.forceLogout) {
        console.log('[ChangeEmail] forceLogout received - signing out');
        try {
          await supabase.auth.signOut();
        } catch (e) {
          console.log('[ChangeEmail] signOut error', e);
        }
      }

      // Store reset link if provided by backend
      const actionLink =
        data?.resetLink?.properties?.action_link ||
        data?.resetLink?.action_link ||
        null;
      setResetLink(actionLink);

      // Clear sensitive inputs
      setCurrentPassword("");
      setCode("");

      // Optional: show success in place
      setStep("success");
      banner(
        "Email updated. A warning was sent to your old email. A password reset link was sent to your new email.",
        "cyan"
      );
      
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    if (!userId || !verifiedNewEmail || !oldEmail) {
      return banner("Cannot resend yet. Go back and start again.", "red");
    }
    setLoading(true);
    try {
      const r = await fetch("/api/sendEmailChangeCode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          current_email: oldEmail,
          new_email: verifiedNewEmail
        })
      });
      if (!r.ok) {
        const { error } = await r.json().catch(() => ({ error: "Unknown error" }));
        return banner(`Could not resend code: ${error}`, "red");
      }
      setCountdown(45);
      banner(`New code sent to ${verifiedNewEmail}.`, "cyan");
    } finally {
      setLoading(false);
    }
  }

  function Stepper() {
    const idx = step === "auth" ? 1 : step === "code" ? 2 : 3;
    const steps = ["Verify identity", "Enter code", "Done"];
    return (
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        {steps.map((label, i) => {
          const n = i + 1;
          const active = n <= idx;
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  background: active ? "#0ea5e9" : "transparent",
                  border: "2px solid #0ea5e9",
                  color: active ? "white" : "#0ea5e9",
                  fontWeight: 700
                }}
              >
                {n}
              </div>
              <div style={{ opacity: active ? 1 : 0.6, fontWeight: 600 }}>{label}</div>
              {n < steps.length && <div style={{ width: 28, height: 2, background: "#0ea5e9", opacity: active ? 1 : 0.4 }} />}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ width: 360, maxWidth: "92vw" }}>
        <h2 style={{ marginBottom: 4 }}>Change Email</h2>
        <p style={{ marginTop: 0, color: "#9ca3af" }}>
          Step {step === "auth" ? "1" : step === "code" ? "2" : "3"} of 3
        </p>

        <Stepper />

        {/* Messages */}
        {msg && (
          <div
            style={{
              background: msgColor === "red" ? "#2a0f10" : "#06252b",
              border: `1px solid ${msgColor === "red" ? "#ef4444" : "#22d3ee"}`,
              color: msgColor,
              padding: "10px 12px",
              borderRadius: 8,
              marginBottom: 12
            }}
          >
            {msg}
          </div>
        )}

        {step === "auth" && (
          <div style={{ display: "grid", gap: 10 }}>
            <input
              type="email"
              placeholder="Current email"
              value={currentEmail}
              onChange={(e) => setCurrentEmail(e.target.value)}
              style={ipt}
            />
            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={ipt}
            />
            <input
              type="email"
              placeholder="New email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              style={ipt}
            />
            <input
              type="email"
              placeholder="Confirm new email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              style={ipt}
            />

            <button onClick={handleSendCode} disabled={loading} style={btnPrimary}>
              {loading ? "Sending..." : "Send verification code"}
            </button>

            <button onClick={() => (window.location.href = "/login")} style={btnGhost}>
              Back to Login
            </button>
          </div>
        )}

        {step === "code" && (
          <div style={{ display: "grid", gap: 10 }}>
            <p style={{ margin: 0 }}>
              We sent a 6 digit code to <b>{verifiedNewEmail}</b>.
            </p>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Enter 6 digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              style={ipt}
            />

            <button onClick={handleConfirmCode} disabled={loading || code.length < 6} style={btnPrimary}>
              {loading ? "Confirming..." : "Confirm email change"}
            </button>

            <button onClick={handleResend} disabled={loading || countdown > 0} style={btnGhost}>
              {countdown > 0 ? `Resend code in ${countdown}s` : "Resend code"}
            </button>

            <button onClick={() => setStep("auth")} style={btnGhost}>
              Go back
            </button>
          </div>
        )}

        {step === "success" && (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 16, lineHeight: 1.4 }}>
              <p style={{ margin: 0 }}>
                ✅ Email updated to <b>{verifiedNewEmail}</b>.
              </p>
              <p style={{ margin: "6px 0 0 0" }}>
                We sent a warning to <b>{oldEmail}</b>.
              </p>
              <p style={{ margin: "6px 0 0 0" }}>
                A password reset link was sent to <b>{verifiedNewEmail}</b>. For security, set a new password now.
              </p>
            </div>

            {resetLink ? (
              <a href={resetLink} style={{ ...btnPrimary, display: "grid", placeItems: "center", textDecoration: "none" }}>
                Open password reset link
              </a>
            ) : (
              <button onClick={() => (window.location.href = "/reset")} style={btnPrimary}>
                I already clicked the email link - take me to reset
              </button>
            )}

            <button onClick={() => (window.location.href = "/dashboard")} style={btnGhost}>
              Return to Dashboard
            </button>
            <button
              onClick={() => {
                window.location.href =
                  `/login#message=${encodeURIComponent(
                    'Email updated - check your inbox to reset your password.'
                  )}&emailChange=success&prefill=${encodeURIComponent(verifiedNewEmail)}`;
              }}
              style={btnGhost}
            >
              Go to Login
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href =
                  "/login#message=" +
                  encodeURIComponent("Sign in with your NEW email to continue.") +
                  `&prefill=${encodeURIComponent(verifiedNewEmail)}`;
              }}
              style={btnGhost}
            >
              Re-auth with new email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const ipt = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #374151",
  background: "#111827",
  color: "white",
  outline: "none"
};

const btnPrimary = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #0ea5e9",
  background: "#0ea5e9",
  color: "white",
  fontWeight: 700,
  cursor: "pointer"
};

const btnGhost = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #374151",
  background: "transparent",
  color: "white",
  cursor: "pointer"
};
