import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, type OctopusConnection } from '../api/client'
import { useAuth } from '../auth/AuthContext'

interface OctopusConnectionContextValue {
  connection: OctopusConnection | null
  loading: boolean
  refresh: () => Promise<void>
  setConnection: (connection: OctopusConnection) => void
}

const OctopusConnectionContext = createContext<OctopusConnectionContextValue | undefined>(undefined)

export function OctopusConnectionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [connection, setConnection] = useState<OctopusConnection | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setConnection(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await api.octopus.connection()
      setConnection(result)
    } catch {
      setConnection({ connected: false })
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <OctopusConnectionContext.Provider value={{ connection, loading, refresh, setConnection }}>
      {children}
    </OctopusConnectionContext.Provider>
  )
}

export function useOctopusConnection() {
  const ctx = useContext(OctopusConnectionContext)
  if (!ctx) throw new Error('useOctopusConnection must be used within OctopusConnectionProvider')
  return ctx
}
