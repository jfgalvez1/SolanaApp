'use client'
import { useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isWithinInterval,
  parseISO
} from 'date-fns'
import { Database } from '../lib/database.types'

type Reservation = Database['public']['Tables']['reservations']['Row']

interface CalendarProps {
  reservations: Reservation[]
  currentMonth?: Date
  onMonthChange?: (date: Date) => void
}

export default function Calendar({ reservations, currentMonth: externalMonth, onMonthChange }: CalendarProps) {
  const [internalMonth, setInternalMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [dayReservations, setDayReservations] = useState<Reservation[]>([])

  const currentMonth = externalMonth ?? internalMonth

  const onNextMonth = () => {
    const next = addMonths(currentMonth, 1)
    if (onMonthChange) onMonthChange(next)
    else setInternalMonth(next)
  }
  const onPrevMonth = () => {
    const prev = subMonths(currentMonth, 1)
    if (onMonthChange) onMonthChange(prev)
    else setInternalMonth(prev)
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

  const getReservationsForDay = (day: Date): Reservation[] => {
    return reservations.filter(res => {
      if (!['confirmed', 'reserved'].includes(res.status)) return false
      const checkIn = parseISO(res.check_in)
      const checkOut = parseISO(res.check_out)
      const adjustedEnd = new Date(checkOut)
      adjustedEnd.setDate(adjustedEnd.getDate() - 1)
      return isWithinInterval(day, { start: checkIn, end: adjustedEnd })
    })
  }

  const getDayStatus = (day: Date) => {
    return getReservationsForDay(day).length > 0 ? 'reserved' : 'free'
  }

  const handleDayClick = (day: Date) => {
    const found = getReservationsForDay(day)
    setSelectedDay(day)
    setDayReservations(found)
  }

  const closeModal = () => {
    setSelectedDay(null)
    setDayReservations([])
  }

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <button onClick={onPrevMonth} className="btn-primary" style={{ padding: '0.25rem 0.5rem' }}>&lt;</button>
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
            const status = getDayStatus(day)
            const isCurrentMonth = isSameMonth(day, monthStart)
            const isToday = isSameDay(day, new Date())

            return (
              <div
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                style={{
                  padding: '0.5rem',
                  borderRadius: '4px',
                  backgroundColor: status === 'reserved' ? 'var(--success)' : 'transparent',
                  color: status === 'reserved' ? 'white' : (isCurrentMonth ? 'var(--text-main)' : 'var(--border)'),
                  opacity: isCurrentMonth ? 1 : 0.5,
                  fontWeight: isToday ? 'bold' : 'normal',
                  border: isToday && status !== 'reserved' ? '1px solid var(--primary)' : 'none',
                  position: 'relative',
                  cursor: status === 'reserved' ? 'pointer' : 'default'
                }}
              >
                <span style={{ position: 'relative', zIndex: 1 }}>{format(day, 'd')}</span>
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: 'var(--success)', borderRadius: '50%' }}></div>
            Reserved
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Today (Border)
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedDay && (
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '600', fontSize: '1rem' }}>{res.guest_name}</span>
                      <span className={`status-badge status-${res.status}`}>{res.status}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      <div><strong>Check-in:</strong> {format(parseISO(res.check_in), 'MMM d, yyyy')}</div>
                      <div><strong>Check-out:</strong> {format(parseISO(res.check_out), 'MMM d, yyyy')}</div>
                      <div><strong>Pax:</strong> {res.pax ?? 2}</div>
                      <div><strong>Price:</strong> ₱{res.total_price.toLocaleString()}</div>
                      {res.notes && (
                        <div style={{ gridColumn: '1 / -1' }}><strong>Notes:</strong> {res.notes}</div>
                      )}
                    </div>
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
