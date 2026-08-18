import { useAuth } from '../hooks/useAuth'
import LoginPage from '../components/LoginPage'
import GuardApp from '../components/GuardApp'

export default function GuardPage() {
  const auth = useAuth()

  if (auth.loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f3f4f6' }}>
        <div style={{ textAlign: 'center', color: '#6b7280' }}>Laddar...</div>
      </div>
    )
  }

  if (!auth.user) {
    return <LoginPage onLogin={auth.signIn} />
  }

  return (
    <GuardApp
      personnelId={auth.personnelId}
      personnelName={auth.personnelName}
      onSignOut={auth.signOut}
      isAdmin={auth.isAdmin}
      embedded={false}
    />
  )
}