import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user) {
    const from = encodeURIComponent(location.pathname)
    return <Navigate to={`/login?from=${from}`} replace />
  }
  return <>{children}</>
}

export default ProtectedRoute
