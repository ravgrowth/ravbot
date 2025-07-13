import { useState } from "react"
import supabase from "../lib/supabase"

export default function Signup() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState(null)

  const handleSignup = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setError(error.message)
    else window.location.href = "/"
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Sign Up</h2>
      <form onSubmit={handleSignup}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit">Create Account</button>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </form>
    </div>
  )
}
