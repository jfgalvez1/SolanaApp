'use client'

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthProvider'
import { useProperty } from './PropertyProvider'

type PendingRequest = {
  id: string
  guest_name: string
  property_id: string
  check_in: string
  check_out: string
}

type BookingAlert = PendingRequest & {
  propertyName: string
}

export type VillaPending = {
  propertyId: string
  propertyName: string
  count: number
}

type BookingRequestAlertsContextType = {
  pendingCount: number
  villaPending: VillaPending[]
  freshIds: string[]
  refreshToken: number
}

const BookingRequestAlertsContext = createContext<BookingRequestAlertsContextType>({
  pendingCount: 0,
  villaPending: [],
  freshIds: [],
  refreshToken: 0,
})

export function useBookingRequestAlerts() {
  return useContext(BookingRequestAlertsContext)
}

const POLL_MS = 15000

function formatStay(checkIn: string, checkOut: string) {
  const fmt = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
  }
  return `${fmt(checkIn)} – ${fmt(checkOut)}`
}

function playChime() {
  try {
    const audio = new AudioContext()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.05, audio.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.4)
    osc.connect(gain)
    gain.connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + 0.42)
    osc.onended = () => audio.close()
  } catch {
    // A blocked sound should not stop the on-screen alert.
  }
}

function notifyBrowser(alert: BookingAlert) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const notice = new Notification('New booking request', {
    body: `${alert.guest_name} · ${alert.propertyName} · ${formatStay(alert.check_in, alert.check_out)}`,
    tag: alert.id,
  })
  notice.onclick = () => {
    window.focus()
    notice.close()
  }
}

export function BookingRequestAlerts({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { properties, setCurrentProperty } = useProperty()
  const router = useRouter()
  const [pendingCount, setPendingCount] = useState(0)
  const [villaPending, setVillaPending] = useState<VillaPending[]>([])
  const [freshIds, setFreshIds] = useState<string[]>([])
  const [alerts, setAlerts] = useState<BookingAlert[]>([])
  const [refreshToken, setRefreshToken] = useState(0)
  const knownIds = useRef<Set<string> | null>(null)
  const propertiesRef = useRef(properties)
  propertiesRef.current = properties

  const propertyName = useCallback((propertyId: string) => {
    return propertiesRef.current.find(property => property.id === propertyId)?.name || 'Villa'
  }, [])

  const dismiss = useCallback((id: string) => {
    setAlerts(current => current.filter(alert => alert.id !== id))
  }, [])

  const openAlert = useCallback((alert: BookingAlert) => {
    const property = propertiesRef.current.find(item => item.id === alert.property_id)
    if (property) setCurrentProperty(property)
    dismiss(alert.id)
    router.push('/booking-requests')
  }, [dismiss, router, setCurrentProperty])

  useEffect(() => {
    setAlerts(current => current.map(alert => ({
      ...alert,
      propertyName: propertyName(alert.property_id),
    })))
    setVillaPending(current => current.map(item => ({
      ...item,
      propertyName: propertyName(item.propertyId),
    })))
  }, [properties, propertyName])

  useEffect(() => {
    if (!user) {
      knownIds.current = null
      setPendingCount(0)
      setVillaPending([])
      setFreshIds([])
      setAlerts([])
      document.title = 'Reservation Manager'
      return
    }

    let cancelled = false

    const load = async () => {
      const { data, error } = await supabase
        .from('booking_requests')
        .select('id, guest_name, property_id, check_in, check_out')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (cancelled || error || !data) return

      const pending = data as PendingRequest[]
      const grouped = new Map<string, VillaPending>()
      for (const request of pending) {
        const current = grouped.get(request.property_id)
        if (current) current.count += 1
        else {
          grouped.set(request.property_id, {
            propertyId: request.property_id,
            propertyName: propertyName(request.property_id),
            count: 1,
          })
        }
      }

      if (knownIds.current === null) {
        knownIds.current = new Set(pending.map(request => request.id))
      } else {
        const arrived = pending.filter(request => !knownIds.current?.has(request.id))
        if (arrived.length > 0) {
          const nextAlerts = arrived.map(request => ({
            ...request,
            propertyName: propertyName(request.property_id),
          }))
          setAlerts(current => {
            const existing = new Set(current.map(alert => alert.id))
            return [...nextAlerts.filter(alert => !existing.has(alert.id)), ...current].slice(0, 5)
          })
          setFreshIds(current => Array.from(new Set([...arrived.map(request => request.id), ...current])))
          setRefreshToken(token => token + 1)
          playChime()
          nextAlerts.forEach(notifyBrowser)
        }
        knownIds.current = new Set(pending.map(request => request.id))
      }

      setPendingCount(pending.length)
      setVillaPending(Array.from(grouped.values()))
      document.title = pending.length > 0
        ? `(${pending.length}) Reservation Manager`
        : 'Reservation Manager'
    }

    void load()
    const poll = window.setInterval(() => { void load() }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)

    const channel = supabase
      .channel('booking-request-alerts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'booking_requests' },
        () => { void load() }
      )
      .subscribe()

    return () => {
      cancelled = true
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      void supabase.removeChannel(channel)
      document.title = 'Reservation Manager'
    }
  }, [user, propertyName])

  return (
    <BookingRequestAlertsContext.Provider value={{ pendingCount, villaPending, freshIds, refreshToken }}>
      {children}
      {alerts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: 80,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            width: 'min(360px, calc(100vw - 2rem))',
          }}
        >
          {alerts.map(alert => (
            <div
              key={alert.id}
              role="status"
              style={{
                background: '#fff',
                border: '1px solid var(--border)',
                borderLeft: '4px solid var(--primary)',
                borderRadius: '12px',
                boxShadow: '0 12px 40px rgba(15, 23, 42, 0.16)',
                padding: '0.9rem 1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                <strong>New booking request</strong>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(alert.id)}
                  style={{ background: 'transparent', color: 'var(--text-muted)', padding: 0 }}
                >
                  ×
                </button>
              </div>
              <p style={{ margin: '0.35rem 0 0.75rem', color: 'var(--text-muted)' }}>
                {alert.guest_name} · {alert.propertyName}
                <br />
                {formatStay(alert.check_in, alert.check_out)}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn-primary" onClick={() => openAlert(alert)}>
                  Open request
                </button>
                {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
                  <button
                    type="button"
                    onClick={() => { void Notification.requestPermission() }}
                    style={{ background: 'transparent', color: 'var(--primary)', border: '1px solid var(--border)' }}
                  >
                    Allow desktop alerts
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </BookingRequestAlertsContext.Provider>
  )
}
