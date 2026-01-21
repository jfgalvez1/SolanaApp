'use client'
import { useEffect, ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import { useRouter } from 'next/navigation'

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>Loading...</div>
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
