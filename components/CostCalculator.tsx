'use client'

import { useEffect, useRef, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { datesOverlap } from '../lib/reservationOverlap'
import { nightsBetween, PUBLIC_STAY_RATE, publicNightlyRate } from '../lib/pricing'

type StayRange = {
  check_in: string
  check_out: string
}

type DateField = 'in' | 'out'

const FACEBOOK_PAGE = 'https://www.facebook.com/985264604671258'
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function peso(amount: number) {
  return `₱${amount.toLocaleString('en-US')}`
}

function isReservedNight(dayIso: string, reservations: StayRange[]) {
  return reservations.some(stay => dayIso >= stay.check_in && dayIso < stay.check_out)
}

function AvailabilityDateField({
  label,
  value,
  reservations,
  isSelectable,
  open,
  onOpen,
  onClose,
  onSelect,
}: {
  label: string
  value: string
  reservations: StayRange[]
  isSelectable: (day: Date) => boolean
  open: boolean
  onOpen: () => void
  onClose: () => void
  onSelect: (iso: string) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [month, setMonth] = useState(() => startOfMonth(value ? parseISO(value) : new Date()))
  const today = startOfDay(new Date())
  const thisMonth = startOfMonth(today)
  const canGoBack = isAfter(startOfMonth(month), thisMonth)

  useEffect(() => {
    if (!open) return
    setMonth(startOfMonth(value ? parseISO(value) : new Date()))
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, value])

  const monthStart = startOfMonth(month)
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(endOfMonth(monthStart)),
  })

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <div>{label}</div>
      <button
        type="button"
        className="input-field"
        style={{
          marginTop: '0.35rem',
          marginBottom: 0,
          textAlign: 'left',
          background: '#fff',
          color: value ? 'var(--text-main)' : 'var(--text-muted)',
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? onClose() : onOpen())}
      >
        {value ? format(parseISO(value), 'dd/MM/yyyy') : 'dd/mm/yyyy'}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 30,
            width: 'min(420px, 90vw)',
            marginTop: '0.35rem',
            padding: '0.85rem',
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.16)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '0.25rem 0.5rem', visibility: canGoBack ? 'visible' : 'hidden' }}
              onClick={() => canGoBack && setMonth(current => subMonths(current, 1))}
              aria-label="Previous month"
            >
              &lt;
            </button>
            <strong>{format(month, 'MMMM yyyy')}</strong>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '0.25rem 0.5rem' }}
              onClick={() => setMonth(current => addMonths(current, 1))}
              aria-label="Next month"
            >
              &gt;
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem', textAlign: 'center' }}>
            {WEEKDAYS.map(day => (
              <div key={day} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{day}</div>
            ))}
            {days.map(day => {
              if (!isSameMonth(day, monthStart)) {
                return <div key={day.toISOString()} />
              }
              const dayIso = format(day, 'yyyy-MM-dd')
              const reserved = isReservedNight(dayIso, reservations)
              const selected = Boolean(value) && isSameDay(day, parseISO(value))
              const selectable = isSelectable(day)
              const isToday = isSameDay(day, today)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={!selectable}
                  onClick={() => {
                    onSelect(dayIso)
                    onClose()
                  }}
                  style={{
                    padding: '0.4rem 0',
                    borderRadius: '4px',
                    backgroundColor: reserved ? 'var(--success)' : 'transparent',
                    color: reserved ? '#fff' : 'var(--text-main)',
                    fontWeight: isToday || selected ? 700 : 500,
                    border: selected
                      ? '2px solid var(--primary)'
                      : isToday && !reserved
                        ? '1px solid var(--primary)'
                        : '1px solid transparent',
                    cursor: selectable ? 'pointer' : 'default',
                    opacity: selectable ? 1 : 0.4,
                  }}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.85rem', lineHeight: 1.45 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <span style={{ width: '0.85rem', height: '0.85rem', marginTop: '0.15rem', borderRadius: '4px', backgroundColor: 'var(--success)', flexShrink: 0 }} />
              <span><strong>Green dates are reserved.</strong> The villa is already booked on those nights.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <span style={{ width: '0.85rem', height: '0.85rem', marginTop: '0.15rem', borderRadius: '4px', border: '1px solid var(--border)', flexShrink: 0 }} />
              <span><strong>Open dates are available.</strong> You can reserve any date that is not highlighted.</span>
            </div>
            <p style={{ margin: '0.1rem 0 0', color: 'var(--text-muted)' }}>
              Check-in is at <strong style={{ color: 'var(--text-main)' }}>2:00 PM</strong>. Check-out is at <strong style={{ color: 'var(--text-main)' }}>11:00 AM</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CostCalculator({ reservations }: { reservations: StayRange[] }) {
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [pax, setPax] = useState(PUBLIC_STAY_RATE.includedPax)
  const [openField, setOpenField] = useState<DateField | null>(null)
  const today = startOfDay(new Date())

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0
  const datesReady = Boolean(checkIn && checkOut && nights > 0)
  const nightly = publicNightlyRate(pax)
  const total = datesReady ? nightly * nights : 0
  const extraGuests = Math.max(0, pax - PUBLIC_STAY_RATE.includedPax)
  const reserved = datesReady && reservations.some(stay =>
    datesOverlap(checkIn, checkOut, stay.check_in, stay.check_out)
  )

  const canSelect = (field: DateField, day: Date) => {
    const dayStart = startOfDay(day)
    if (isBefore(dayStart, today)) return false
    if (field === 'out') {
      const earliest = checkIn ? startOfDay(parseISO(checkIn)) : today
      return isAfter(dayStart, earliest)
    }
    return true
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Check availability dates</h3>
      <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>
        {peso(PUBLIC_STAY_RATE.basePrice)} per night for {PUBLIC_STAY_RATE.includedPax} guests.
        Each additional guest is {peso(PUBLIC_STAY_RATE.extraPaxPrice)}.
        Maximum {PUBLIC_STAY_RATE.maxPax} guests.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <AvailabilityDateField
          label="Check-in"
          value={checkIn}
          reservations={reservations}
          open={openField === 'in'}
          onOpen={() => setOpenField('in')}
          onClose={() => setOpenField(current => (current === 'in' ? null : current))}
          isSelectable={(day) => canSelect('in', day)}
          onSelect={(iso) => {
            setCheckIn(iso)
            if (checkOut && nightsBetween(iso, checkOut) <= 0) setCheckOut('')
          }}
        />
        <AvailabilityDateField
          label="Check-out"
          value={checkOut}
          reservations={reservations}
          open={openField === 'out'}
          onOpen={() => setOpenField('out')}
          onClose={() => setOpenField(current => (current === 'out' ? null : current))}
          isSelectable={(day) => canSelect('out', day)}
          onSelect={setCheckOut}
        />
        <div>
          <div>Guests</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '0.45rem 0.75rem', opacity: pax <= 1 ? 0.45 : 1 }}
              onClick={() => setPax(current => Math.max(1, current - 1))}
              disabled={pax <= 1}
              aria-label="Fewer guests"
            >
              −
            </button>
            <strong style={{ minWidth: '1.5rem', textAlign: 'center' }}>{pax}</strong>
            <button
              type="button"
              className="btn-primary"
              style={{ padding: '0.45rem 0.75rem', opacity: pax >= PUBLIC_STAY_RATE.maxPax ? 0.45 : 1 }}
              onClick={() => setPax(current => Math.min(PUBLIC_STAY_RATE.maxPax, current + 1))}
              disabled={pax >= PUBLIC_STAY_RATE.maxPax}
              aria-label="More guests"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        {!checkIn || !checkOut ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Enter your check-in and check-out dates to see the cost.</p>
        ) : nights <= 0 ? (
          <p style={{ margin: 0, color: 'var(--danger)' }}>Check-out must be after check-in.</p>
        ) : (
          <>
            <p style={{ margin: '0 0 0.35rem', color: 'var(--text-muted)' }}>
              {peso(nightly)} per night × {nights} {nights === 1 ? 'night' : 'nights'}
              {extraGuests > 0 ? ` (${extraGuests} additional ${extraGuests === 1 ? 'guest' : 'guests'})` : ''}
            </p>
            <div className="stat-value">{peso(total)}</div>
            <p style={{ margin: '0.5rem 0 0', color: reserved ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
              {reserved ? 'These dates are reserved.' : 'You can reserve these dates.'}
            </p>
            {!reserved && (
              <p style={{ margin: '0.35rem 0 0' }}>
                Message us on our{' '}
                <a href={FACEBOOK_PAGE} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                  Facebook page
                </a>
                {' '}to book.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
