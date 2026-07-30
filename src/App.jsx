import { useEffect, useState } from 'react'
import './App.css'
import { supabase } from './lib/supabaseClient'
import Auth from './Components/Auth'
import TradingJournalDashboard from './Components/TradingJournalDashboard'

function App() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))

    return () => subscription.unsubscribe()
  }, [])

  if (checking) return <div className="min-h-screen bg-[#0A0A0B]" />

  return (
    <div className="app-container">
      {session ? <TradingJournalDashboard session={session} /> : <Auth />}
    </div>
  )
}

export default App