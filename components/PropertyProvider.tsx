'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthProvider'
import { Database } from '../lib/database.types'

export type Property = Database['public']['Tables']['properties']['Row']

const STORAGE_KEY = 'selectedPropertyId'

interface PropertyContextType {
  properties: Property[]
  currentProperty: Property | null
  setCurrentProperty: (property: Property) => void
  loading: boolean
  error: string | null
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined)

export const PropertyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth()
  const [properties, setProperties] = useState<Property[]>([])
  const [currentProperty, setCurrentPropertyState] = useState<Property | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const setCurrentProperty = useCallback((property: Property) => {
    setCurrentPropertyState(property)
    localStorage.setItem(STORAGE_KEY, property.id)
  }, [])

  useEffect(() => {
    if (!user) {
      setProperties([])
      setCurrentPropertyState(null)
      setLoading(false)
      return
    }

    const fetchProperties = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data, error: fetchError } = await supabase
          .from('properties')
          .select('*')
          .eq('user_id', user.id)
          .order('slug', { ascending: true })

        if (fetchError) throw fetchError

        const props = data || []
        setProperties(props)

        if (props.length === 0) {
          setError('No properties found. Run the multi-villa migration in Supabase first.')
          setCurrentPropertyState(null)
          return
        }

        const storedId = localStorage.getItem(STORAGE_KEY)
        const stored = storedId ? props.find(p => p.id === storedId) : null
        const villa1 = props.find(p => p.slug === 'villa-1')
        setCurrentPropertyState(stored || villa1 || props[0])
      } catch (err: any) {
        console.error('Error fetching properties:', err)
        setError(err.message || 'Failed to load properties')
      } finally {
        setLoading(false)
      }
    }

    fetchProperties()
  }, [user])

  return (
    <PropertyContext.Provider value={{ properties, currentProperty, setCurrentProperty, loading, error }}>
      {children}
    </PropertyContext.Provider>
  )
}

export const useProperty = () => {
  const context = useContext(PropertyContext)
  if (context === undefined) {
    throw new Error('useProperty must be used within a PropertyProvider')
  }
  return context
}
