'use client'

import { useEffect, useState } from 'react'
import Calendar from '../../components/Calendar'
import CostCalculator from '../../components/CostCalculator'
import { guestLimit } from '../../lib/pricing'
import { useAuth } from '../../components/AuthProvider'
import { useProperty } from '../../components/PropertyProvider'
import { supabase } from '../../lib/supabaseClient'

type PublicReservation = {
  id: string
  check_in: string
  check_out: string
  status: 'confirmed' | 'reserved' | 'cancelled' | 'completed'
  property_id?: string
}

type PublicProperty = {
  id: string
  name: string
  slug: string
  reservations: PublicReservation[]
}

type PublicAvailabilityRow = {
  property_id: string
  property_name: string
  property_slug: string
  reservation_id: string | null
  check_in: string | null
  check_out: string | null
  status: string | null
}

function groupPublicAvailability(rows: PublicAvailabilityRow[]): PublicProperty[] {
  const properties = new Map<string, PublicProperty>()
  for (const row of rows) {
    let property = properties.get(row.property_id)
    if (!property) {
      property = {
        id: row.property_id,
        name: row.property_name,
        slug: row.property_slug,
        reservations: [],
      }
      properties.set(row.property_id, property)
    }
    if (
      row.reservation_id &&
      row.check_in &&
      row.check_out &&
      (row.status === 'confirmed' || row.status === 'reserved')
    ) {
      property.reservations.push({
        id: row.reservation_id,
        check_in: row.check_in,
        check_out: row.check_out,
        status: row.status,
      })
    }
  }
  return Array.from(properties.values())
}

function villaOrder(property: PublicProperty) {
  if (property.slug === 'villa-1') return 0
  if (property.slug === 'villa-2') return 1
  return 2
}

function preferredPropertyId(list: PublicProperty[], currentId: string | null) {
  if (currentId && list.some(property => property.id === currentId)) return currentId
  const preferred = [...list].sort((a, b) => villaOrder(a) - villaOrder(b) || a.name.localeCompare(b.name))[0]
  return preferred?.id ?? null
}

export default function AvailabilityPage() {
  const { user, loading: authLoading } = useAuth()
  const { properties: ownedProperties, loading: propertyLoading, error: propertyError } = useProperty()
  const [properties, setProperties] = useState<PublicProperty[]>([])
  const [propertyId, setPropertyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || (user && propertyLoading)) return

    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data: publicRows, error: publicError } = await supabase.rpc('get_public_availability')
        if (!publicError) {
          const list = groupPublicAvailability(publicRows || [])
          if (cancelled) return
          setProperties(list)
          setPropertyId(currentId => preferredPropertyId(list, currentId))
          return
        }

        if (user) {
          if (propertyError) throw new Error(propertyError)
          const ids = ownedProperties.map(property => property.id)
          let stays: PublicReservation[] = []
          if (ids.length > 0) {
            const { data, error: reservationError } = await supabase
              .from('reservations')
              .select('id, property_id, check_in, check_out, status')
              .in('property_id', ids)
              .in('status', ['confirmed', 'reserved'])
            if (reservationError) throw reservationError
            stays = data || []
          }
          if (cancelled) return
          const list = ownedProperties.map(property => ({
            id: property.id,
            name: property.name,
            slug: property.slug,
            reservations: stays.filter(stay => stay.property_id === property.id),
          }))
          setProperties(list)
          setPropertyId(currentId => preferredPropertyId(list, currentId))
          return
        }

        throw new Error('Could not load availability')
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load availability')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user, authLoading, propertyLoading, propertyError, ownedProperties])

  const current = properties.find(property => property.id === propertyId) || properties[0]
  const villas = [...properties].sort((a, b) => villaOrder(a) - villaOrder(b) || a.name.localeCompare(b.name))

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', width: '100%' }}>
      <div className="page-header">
        <h1 style={{ marginBottom: 0 }}>{properties.length > 1 ? 'Available dates' : (current?.name || 'Solana Villa')}</h1>
      </div>

      {!loading && !error && villas.length > 1 && (
        <div className="villa-choice" role="group" aria-label="Choose a villa">
          {villas.map(property => {
            const selected = property.id === current?.id
            return (
              <button
                key={property.id}
                type="button"
                className={`villa-choice-btn${selected ? ' active' : ''}`}
                aria-pressed={selected}
                onClick={() => setPropertyId(property.id)}
              >
                {property.name}
              </button>
            )
          })}
        </div>
      )}

      {loading && <div className="card">Loading...</div>}
      {error && <div className="card" style={{ color: 'var(--danger)' }}>{error}</div>}
      {!loading && (
        <CostCalculator
          key={current?.id || 'villa'}
          reservations={current?.reservations || []}
          maxPax={guestLimit(current ? { slug: current.slug } : null)}
          propertySlug={current?.slug}
        />
      )}
      {!loading && !error && !current && <div className="card">No villas found.</div>}
      {!loading && !error && current && (
        <Calendar reservations={current.reservations} hideDetails availabilityOnly propertySlug={current.slug} />
      )}
    </div>
  )
}
