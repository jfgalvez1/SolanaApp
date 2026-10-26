'use client'

import { useState } from 'react'
import { datesOverlap } from '../lib/reservationOverlap'
import { nightsBetween, PUBLIC_STAY_RATE, publicNightlyRate } from '../lib/pricing'

type StayRange = {
  check_in: string
  check_out: string
}

const FACEBOOK_PAGE = 'https://www.facebook.com/985264604671258'

function peso(amount: number) {
  return `₱${amount.toLocaleString('en-US')}`
}

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export default function CostCalculator({ reservations }: { reservations: StayRange[] }) {
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [pax, setPax] = useState(PUBLIC_STAY_RATE.includedPax)
  const today = todayIso()

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0
  const datesReady = Boolean(checkIn && checkOut && nights > 0)
  const nightly = publicNightlyRate(pax)
  const total = datesReady ? nightly * nights : 0
  const extraGuests = Math.max(0, pax - PUBLIC_STAY_RATE.includedPax)
  const reserved = datesReady && reservations.some(stay =>
    datesOverlap(checkIn, checkOut, stay.check_in, stay.check_out)
  )

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Check availability dates</h3>
      <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>
        {peso(PUBLIC_STAY_RATE.basePrice)} per night for {PUBLIC_STAY_RATE.includedPax} guests.
        Each additional guest is {peso(PUBLIC_STAY_RATE.extraPaxPrice)}.
        Maximum {PUBLIC_STAY_RATE.maxPax} guests.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <label>
          Check-in
          <input
            type="date"
            className="input-field"
            style={{ marginTop: '0.35rem', marginBottom: 0 }}
            min={today}
            value={checkIn}
            onChange={(event) => {
              const nextCheckIn = event.target.value
              setCheckIn(nextCheckIn)
              if (checkOut && nightsBetween(nextCheckIn, checkOut) <= 0) setCheckOut('')
            }}
          />
        </label>
        <label>
          Check-out
          <input
            type="date"
            className="input-field"
            style={{ marginTop: '0.35rem', marginBottom: 0 }}
            min={checkIn || today}
            value={checkOut}
            onChange={(event) => setCheckOut(event.target.value)}
          />
        </label>
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
