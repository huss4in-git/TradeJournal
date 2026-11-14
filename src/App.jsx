import { useEffect, useState } from 'react'
import './App.css'
import './theme.css'
import './lib/theme' // applies the saved light / dark choice before first paint
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

  if (checking) return <div className="min-h-screen bg-[color:var(--tl-bg)]" />

  return (
    <div className="app-container">
      {session ? <TradingJournalDashboard session={session} /> : <Auth />}
    </div>
  )
}

export default App