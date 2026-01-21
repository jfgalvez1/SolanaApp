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
}

export default function Calendar({ reservations }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const onNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const onPrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate
  })

  const getDayStatus = (day: Date) => {
    const isReserved = reservations.some(res => {
      if (res.status !== 'confirmed') return false
      const checkIn = parseISO(res.check_in)
      const checkOut = parseISO(res.check_out)
      // Exclude checkout date from highlighted interval
      // Use subDays(checkOut, 1) or just check explicitly if day is before checkOut
      // But isWithinInterval is inclusive. So we want [checkIn, checkOut - 1 day]
      // However, if checkIn == checkOut (impossible typically, but 1 day means checkIn -> next day checkOut)
      // If 1 night: 2023-10-01 to 2023-10-02. We want 2023-10-01 only.
      // interval { start: 2023-10-01, end: 2023-10-01 }
      const intervalEnd = subMonths(checkOut, 0) // Just to clone? No, subtract 1 day.
      // Wait, let's use date math.
      const adjustedEnd = new Date(checkOut)
      adjustedEnd.setDate(adjustedEnd.getDate() - 1)
      
      return isWithinInterval(day, { start: checkIn, end: adjustedEnd })
    })
    return isReserved ? 'reserved' : 'free'
  }

  return (
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
        
        {calendarDays.map((day, idx) => {
          const status = getDayStatus(day)
          const isCurrentMonth = isSameMonth(day, monthStart)
          const isToday = isSameDay(day, new Date())
          
          return (
            <div
              key={day.toISOString()}
              style={{
                padding: '0.5rem',
                borderRadius: '4px',
                backgroundColor: status === 'reserved' ? 'var(--success)' : 'transparent',
                color: status === 'reserved' ? 'white' : (isCurrentMonth ? 'var(--text-main)' : 'var(--border)'),
                opacity: isCurrentMonth ? 1 : 0.5,
                fontWeight: isToday ? 'bold' : 'normal',
                border: isToday && status !== 'reserved' ? '1px solid var(--primary)' : 'none',
                position: 'relative'
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
  )
}
