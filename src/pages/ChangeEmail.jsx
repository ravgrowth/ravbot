import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ChangeEmail() {
  const [currentEmail, setCurrentEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [color, setColor] = useState('white')

  const handleChangeEmail = async () => {
    setMsg('')

    if (newEmail !== confirmEmail) {
      setMsg('New email and confirmation do not match.')
      setColor('red')
      return
    }

    if (currentEmail === newEmail) {
      setMsg('New email must be different from current email.')
      setColor('red')
      return
    }

    // Step 1: Re-authenticate
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: currentPassword,
    })

    if (signInError) {
      setMsg(`Re-authentication failed: ${signInError.message}`)
      setColor('red')
      return
    }

    // Step 2: Get session
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      setMsg('Auth session missing. Please log in again.')
      setColor('red')
      return
    }

    // Step 3: Update email
    const getTimestamp = () => {
      const now = new Date();
      return `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    const { error: updateError } = await supabase.auth.updateUser({ email: newEmail });

    if (updateError) {
      setMsg(`If allowed, you'll get an email confirmation. (${getTimestamp()})`)
      setColor('red')
    }
    else {
      setMsg(`Check your new email (${newEmail}) to confirm the change. (${getTimestamp()})`)
      setColor('cyan')

      // ✅ OPTIONAL: Trigger webhook or log to Supabase to notify old email
      // You'd set this up separately (Zapier webhook, Edge Function, etc)
      fetch("https://your-webhook-or-api.com/warn-old-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldEmail: currentEmail,
          newEmail,
          timestamp: getTimestamp()
        })
      }).catch(err => console.error("Warning email webhook failed", err))
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <h2>Change Email</h2>
        <input
          type="email"
          placeholder="Current Email"
          value={currentEmail}
          onChange={(e) => setCurrentEmail(e.target.value)}
          style={{ padding: '8px', marginBottom: '10px', display: 'block', width: '300px', margin: '0 auto 10px' }}
        />
        <input
          type="password"
          placeholder="Current Password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          style={{ padding: '8px', marginBottom: '10px', display: 'block', width: '300px', margin: '0 auto 10px' }}
        />
        <input
          type="email"
          placeholder="New Email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          style={{ padding: '8px', marginBottom: '10px', display: 'block', width: '300px', margin: '0 auto 10px' }}
        />
        <input
          type="email"
          placeholder="Confirm New Email"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          style={{ padding: '8px', marginBottom: '10px', display: 'block', width: '300px', margin: '0 auto 10px' }}
        />
        <button onClick={handleChangeEmail}>Submit</button>
        <p style={{ color }}>{msg}</p>
        <div style={{ marginTop: 30 }}>
          <button
            onClick={() => window.location.href = "/login"}
            style={{
              backgroundColor: "#007aff",
              color: "white",
              padding: "10px 20px",
              borderRadius: "6px",
              fontWeight: "bold",
              fontSize: "1rem",
              cursor: "pointer"
            }}
          >
            Go back to Login
          </button>
        </div>
      </div>
    </div>
  )
}
