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

    // Step 1: Sign in again to reauthenticate
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: currentPassword
    })

    if (signInError) {
      setMsg(`Re-authentication failed: ${signInError.message}`)
      setColor('red')
      return
    }

    // Step 2: Check session
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      setMsg('Auth session missing. Please log in again.')
      setColor('red')
      return
    }

    if (currentEmail === newEmail) {
      setMsg('New email must be different from current email.')
      setColor('red')
      return
    }

    // Step 3: Update email
    const { error: updateError } = await supabase.auth.updateUser({ email: newEmail })

    if (updateError) {
      setMsg(`Email change failed: ${updateError.message}`)
      setColor('red')
    } else {
      setMsg(`Check your new email (${newEmail}) to confirm the change.`)
      setColor('cyan')
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
      </div>
    </div>
  )
}
