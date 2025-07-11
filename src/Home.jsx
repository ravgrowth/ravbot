import { useEffect } from "react"
import supabase from "../lib/supabase"
import LogoutButton from "../components/LogoutButton"

export default function Home() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) window.location.href = "/login"
    })
  }, [])

  return (
    <div style={{ padding: "2rem" }}>
      <h1>👾 RavBot Dashboard</h1>
      <p>Your automated wealth assistant.</p>
      <ul>
        <li>✅ Daily task: DCA $10 into BTC</li>
        <li>📈 Review net worth</li>
        <li>🧠 Journal 3 wins</li>
        <li>Claim alpha tester rewards</li>
      </ul>
      <LogoutButton />
    </div>
  )
}
