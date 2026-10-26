'use client'
import { useEffect, useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isAfter,
  addMonths,
  subMonths,
  parseISO,
  startOfDay
} from 'date-fns'
import { Database } from '../lib/database.types'
import { isOccupyingStatus } from '../lib/reservationOverlap'

type ReservationRow = Database['public']['Tables']['reservations']['Row']

type CalendarReservation = Pick<ReservationRow, 'id' | 'check_in' | 'check_out' | 'status'> &
  Partial<Pick<ReservationRow, 'guest_name' | 'contact_number' | 'pax' | 'total_price' | 'notes' | 'check_in_preference'>>

const WIFI_PASSWORD = 'SolanaVilla24'
const CHECK_IN_TIME = '2:00 PM'
const CHECK_OUT_TIME = '11:00 AM'

function formatLongDate(iso: string) {
  return format(parseISO(iso), 'MMMM d, yyyy')
}

function formatPeso(amount: number) {
  return `₱${Number(amount).toLocaleString('en-US')}`
}

function buildGuestCopyText(res: CalendarReservation) {
  return [
    `Guest Name(s): ${res.guest_name}`,
    '',
    `Contact Number: ${res.contact_number || ''}`,
    '',
    `Number of Guests: ${res.pax ?? 2} pax`,
    '',
    `Check-in Date: ${formatLongDate(res.check_in)}`,
    `Check-in Time: ${CHECK_IN_TIME}`,
    ...(res.check_in_preference ? [`Check-in Preference: ${res.check_in_preference}`] : []),
    '',
    `Check-out Date: ${formatLongDate(res.check_out)}`,
    `Check-out Time: ${CHECK_OUT_TIME}`,
    '',
    `Amount Due: ${formatPeso(res.total_price ?? 0)} (to be paid upon check-in)`,
    '',
    `WiFi Password: ${WIFI_PASSWORD}`,
  ].join('\n')
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    el.style.position = 'fixed'
    el.style.left = '-9999px'
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
}

interface CalendarProps {
  reservations: CalendarReservation[]
  currentMonth?: Date
  onMonthChange?: (date: Date) => void
  /** Public availability view: same grid, without guest details. */
  hideDetails?: boolean
  /** This month and later months. Past months stay hidden, and days are not clickable. */
  availabilityOnly?: boolean
}

export default function Calendar({ reservations, currentMonth: externalMonth, onMonthChange, hideDetails = false, availabilityOnly = false }: CalendarProps) {
  const [internalMonth, setInternalMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [dayReservations, setDayReservations] = useState<CalendarReservation[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (!copiedId) return
    const timer = window.setTimeout(() => setCopiedId(null), 2000)
    return () => window.clearTimeout(timer)
  }, [copiedId])

  const today = startOfDay(new Date())
  const thisMonthStart = startOfMonth(today)
  const currentMonth = externalMonth ?? internalMonth
  const canGoBack = !availabilityOnly || isAfter(startOfMonth(currentMonth), thisMonthStart)

  const onNextMonth = () => {
    const next = addMonths(currentMonth, 1)
    if (onMonthChange) onMonthChange(next)
    else setInternalMonth(next)
  }
  const onPrevMonth = () => {
    if (!canGoBack) return
    const prev = subMonths(currentMonth, 1)
    if (onMonthChange) onMonthChange(prev)
    else setInternalMonth(prev)
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

  const getReservationsForDay = (day: Date): CalendarReservation[] => {
    const dayIso = format(day, 'yyyy-MM-dd')
    return reservations.filter(res => {
      if (!isOccupyingStatus(res.status)) return false
      // Occupied nights are [check_in, check_out). Checkout day is free.
      return dayIso >= res.check_in && dayIso < res.check_out
    })
  }

  const getDayStatus = (day: Date) => {
    return getReservationsForDay(day).length > 0 ? 'reserved' : 'free'
  }

  const handleDayClick = (day: Date) => {
    if (hideDetails) return
    const found = getReservationsForDay(day)
    setSelectedDay(day)
    setDayReservations(found)
  }

  const closeModal = () => {
    setSelectedDay(null)
    setDayReservations([])
    setCopiedId(null)
  }

  const copyReservation = async (res: CalendarReservation) => {
    await copyText(buildGuestCopyText(res))
    setCopiedId(res.id)
  }

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <button
            onClick={onPrevMonth}
            className="btn-primary"
            style={{ padding: '0.25rem 0.5rem', visibility: canGoBack ? 'visible' : 'hidden' }}
            aria-hidden={!canGoBack}
            tabIndex={canGoBack ? 0 : -1}
          >
            &lt;
          </button>
          <h3 style={{ margin: 0 }}>{format(currentMonth, 'MMMM yyyy')}</h3>
          <button onClick={onNextMonth} className="btn-primary" style={{ padding: '0.25rem 0.5rem' }}>&gt;</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {day}
            </div>
          ))}

          {calendarDays.map((day) => {
            const isCurrentMonth = isSameMonth(day, monthStart)
            if (availabilityOnly && !isCurrentMonth) {
              return <div key={day.toISOString()} style={{ padding: '0.5rem' }} />
            }

            const status = getDayStatus(day)
            const isToday = isSameDay(day, today)
            const interactive = !hideDetails && !availabilityOnly

            return (
              <div
                key={day.toISOString()}
                onClick={interactive ? () => handleDayClick(day) : undefined}
                style={{
                  padding: '0.5rem',
                  borderRadius: '4px',
                  backgroundColor: status === 'reserved' ? 'var(--success)' : 'transparent',
                  color: status === 'reserved' ? 'white' : (isCurrentMonth ? 'var(--text-main)' : 'var(--border)'),
                  opacity: isCurrentMonth ? 1 : 0.5,
                  fontWeight: isToday ? 'bold' : 'normal',
                  border: isToday && status !== 'reserved' ? '1px solid var(--primary)' : 'none',
                  position: 'relative',
                  cursor: interactive && status === 'reserved' ? 'pointer' : 'default'
                }}
              >
                <span style={{ position: 'relative', zIndex: 1 }}>{format(day, 'd')}</span>
              </div>
            )
          })}
        </div>

        {availabilityOnly ? (
          <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.95rem', lineHeight: 1.5 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
              <span style={{ width: '1rem', height: '1rem', marginTop: '0.2rem', borderRadius: '4px', backgroundColor: 'var(--success)', flexShrink: 0 }} />
              <span><strong>Green dates are reserved.</strong> The villa is already booked on those nights.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
              <span style={{ width: '1rem', height: '1rem', marginTop: '0.2rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'transparent', flexShrink: 0 }} />
              <span><strong>Open dates are available.</strong> You can reserve any date that is not highlighted.</span>
            </div>
            <p style={{ margin: '0.15rem 0 0', color: 'var(--text-muted)' }}>
              Check-in is at <strong style={{ color: 'var(--text-main)' }}>{CHECK_IN_TIME}</strong>. Check-out is at <strong style={{ color: 'var(--text-main)' }}>{CHECK_OUT_TIME}</strong>.
            </p>
          </div>
        ) : (
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <div style={{ width: '10px', height: '10px', backgroundColor: 'var(--success)', borderRadius: '50%' }}></div>
              Reserved
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Today (Border)
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedDay && !hideDetails && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card-bg, #fff)', borderRadius: '12px',
              padding: '1.5rem', minWidth: '320px', maxWidth: '480px', width: '90%',
              maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>{format(selectedDay, 'MMMM d, yyyy')}</h3>
              <button
                onClick={closeModal}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {dayReservations.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>No bookings on this day.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {dayReservations.map(res => (
                  <div
                    key={res.id}
                    style={{
                      border: '1px solid var(--border-color, #e2e8f0)',
                      borderRadius: '8px', padding: '1rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: '600', fontSize: '1rem' }}>{res.guest_name}</span>
                      <span className={`status-badge status-${res.status}`}>{res.status}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-main)' }}>
                      <div><strong>Contact Number:</strong> {res.contact_number || '—'}</div>
                      <div><strong>Number of Guests:</strong> {res.pax ?? 2} pax</div>
                      <div>
                        <div><strong>Check-in Date:</strong> {formatLongDate(res.check_in)}</div>
                        <div><strong>Check-in Time:</strong> {CHECK_IN_TIME}</div>
                        {res.check_in_preference && (
                          <div><strong>Check-in Preference:</strong> {res.check_in_preference}</div>
                        )}
                      </div>
                      <div>
                        <div><strong>Check-out Date:</strong> {formatLongDate(res.check_out)}</div>
                        <div><strong>Check-out Time:</strong> {CHECK_OUT_TIME}</div>
                      </div>
                      <div><strong>Amount Due:</strong> {formatPeso(res.total_price ?? 0)} (to be paid upon check-in)</div>
                      <div><strong>WiFi Password:</strong> {WIFI_PASSWORD}</div>
                    </div>
                    {res.notes?.trim() && (
                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border, #e2e8f0)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        <strong>Notes:</strong> {res.notes}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => copyReservation(res)}
                      className="btn-primary"
                      style={{ marginTop: '0.9rem', padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                    >
                      {copiedId === res.id ? 'Copied' : 'Copy details'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
