import { useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function EmailChangeConfirmed() {
  useEffect(() => {
    const finish = async () => {
      await supabase.auth.signOut({ scope: 'global' })
      const msg = encodeURIComponent('Email change confirmed. Please log in again.')
      window.location.replace(`/login#message=${msg}`)
    }
    finish()
  }, [])

  return <p>Signing out...</p>
}
