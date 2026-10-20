'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<any>
  signUp: (email: string, password: string, fullName: string) => Promise<any>
  updatePassword: (currentPassword: string, newPassword: string) => Promise<{ error: Error | null }>
  updateFullName: (fullName: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<any>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    fetchSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (_event === 'SIGNED_IN') router.refresh()
      if (_event === 'SIGNED_OUT') router.refresh()
    })

    return () => subscription.unsubscribe()
  }, [router])

  const signUp = (email: string, password: string, fullName: string) => {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })
  }

  const signIn = (email: string, password: string) => {
    return supabase.auth.signInWithPassword({
      email,
      password,
    })
  }

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    const email = user?.email
    if (!email) {
      return { error: new Error('Not signed in') }
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })
    if (reauthError) {
      return { error: new Error('Current password is incorrect') }
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error ? new Error(error.message) : null }
  }

  const updateFullName = async (fullName: string) => {
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    })
    return { error: error ? new Error(error.message) : null }
  }

  const signOut = () => {
    return supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, signUp, signIn, updatePassword, updateFullName, signOut, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
