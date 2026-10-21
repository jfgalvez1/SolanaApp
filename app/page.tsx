'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import { useProperty } from '../components/PropertyProvider'
import AuthGuard from '../components/AuthGuard'
import Calendar from '../components/Calendar'
import CircularProgress from '../components/CircularProgress'
import { format, parseISO, isSameMonth, endOfMonth, endOfYear, eachMonthOfInterval, addMonths, startOfYear, getDaysInMonth, eachDayOfInterval, startOfDay } from 'date-fns'

interface Stats {
  monthlyRevenue: number
  monthlyExpenses: number
  monthlyProfit: number
  monthlyBookingCount: number
  occupiedNightsCount: number
  occupancyRate: number
  overallRevenue: number
  overallExpenses: number
  overallProfit: number
  reservations: any[]
}

export default function Dashboard() {
  const { user } = useAuth()
  const { currentProperty } = useProperty()
  const [stats, setStats] = useState<Stats>({ 
    monthlyRevenue: 0, monthlyExpenses: 0, monthlyProfit: 0, monthlyBookingCount: 0, occupiedNightsCount: 0, occupancyRate: 0,
    overallRevenue: 0, overallExpenses: 0, overallProfit: 0,
    reservations: [] 
  })
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const currentYear = format(new Date(), 'yyyy')
  const [rangeFrom, setRangeFrom] = useState(`${currentYear}-01`)
  const [rangeTo, setRangeTo] = useState(`${currentYear}-12`)
  const [allReservations, setAllReservations] = useState<any[]>([])
  const [allExpenses, setAllExpenses] = useState<any[]>([])

  useEffect(() => {
    if (user && currentProperty) {
      fetchData()
    }
  }, [user, currentProperty])

  useEffect(() => {
    calculateStats()
  }, [selectedMonth, allReservations, allExpenses])

  const fetchData = async () => {
    if (!currentProperty) return
    try {
      setLoading(true)
      
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('*')
        .eq('property_id', currentProperty.id)
      
      if (resError) throw resError

      const { data: expenses, error: expError } = await supabase
        .from('expenses')
        .select('*')
        .eq('property_id', currentProperty.id)

      if (expError) throw expError

      setAllReservations(reservations || [])
      setAllExpenses(expenses || [])

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = () => {
    // Monthly Stats
    const start = parseISO(`${selectedMonth}-01`)
    const end = endOfMonth(start)
    const daysInMonth = getDaysInMonth(start)
    
    let occupiedDaysCount = 0
    const monthDays = eachDayOfInterval({ start, end })

    monthDays.forEach(day => {
      const isOccupied = allReservations.some(r => {
        if (!['confirmed', 'reserved'].includes(r.status)) return false
        if (!r.check_in || !r.check_out) return false
        const checkIn = startOfDay(parseISO(r.check_in))
        const checkOut = startOfDay(parseISO(r.check_out))
        return day >= checkIn && day < checkOut
      })
      if (isOccupied) occupiedDaysCount++
    })

    const occupancyRate = (occupiedDaysCount / daysInMonth) * 100

    const currentMonthReservations = allReservations.filter(r => {
      if (!r.check_in) return false
      return isSameMonth(parseISO(r.check_in), start) && ['confirmed', 'reserved'].includes(r.status)
    })

    const currentMonthExpenses = allExpenses.filter(e => {
        if (!e.date) return false
        return isSameMonth(parseISO(e.date), start)
    })

    const monthlyRevenue = currentMonthReservations.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0)
    const monthlyExpenses = currentMonthExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

    // Overall Stats
    const confirmedReservations = allReservations.filter(r => ['confirmed', 'reserved'].includes(r.status))
    const overallRevenue = confirmedReservations.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0)
    const overallExpenses = allExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

    setStats({
      monthlyRevenue,
      monthlyExpenses,
      monthlyProfit: monthlyRevenue - monthlyExpenses,
      monthlyBookingCount: currentMonthReservations.length,
      occupiedNightsCount: occupiedDaysCount,
      occupancyRate,
      overallRevenue,
      overallExpenses,
      overallProfit: overallRevenue - overallExpenses,
      reservations: allReservations
    })
  }

  // Generate months starting from the beginning of the current year (2026)
  const months = eachMonthOfInterval({
    start: startOfYear(new Date()),
    end: addMonths(new Date(), 12)
  })

  const rangeMonths = eachMonthOfInterval({
    start: startOfYear(new Date()),
    end: endOfYear(addMonths(new Date(), 12))
  })

  const activeBookingsInMonth = (monthDate: Date) =>
    allReservations.filter(r => {
      if (!r.check_in) return false
      if (!['confirmed', 'reserved'].includes(r.status)) return false
      return isSameMonth(parseISO(r.check_in), monthDate)
    })

  const occupancyForMonth = (monthDate: Date) => {
    const days = getDaysInMonth(monthDate)
    let occupiedNights = 0
    eachDayOfInterval({ start: monthDate, end: endOfMonth(monthDate) }).forEach(day => {
      const isOccupied = allReservations.some(r => {
        if (!['confirmed', 'reserved'].includes(r.status)) return false
        if (!r.check_in || !r.check_out) return false
        const checkIn = startOfDay(parseISO(r.check_in))
        const checkOut = startOfDay(parseISO(r.check_out))
        return day >= checkIn && day < checkOut
      })
      if (isOccupied) occupiedNights++
    })
    return {
      occupiedNights,
      days,
      occupancyRate: days > 0 ? (occupiedNights / days) * 100 : 0,
    }
  }

  const rangeStart = parseISO(`${rangeFrom}-01`)
  const rangeEnd = parseISO(`${rangeTo}-01`)
  const rangedMonths = eachMonthOfInterval({ start: rangeStart, end: rangeEnd })
  const monthlyBreakdown = rangedMonths.map(monthDate => {
    const bookings = activeBookingsInMonth(monthDate)
    const revenue = bookings.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0)
    const occupancy = occupancyForMonth(monthDate)
    return {
      key: format(monthDate, 'yyyy-MM'),
      label: format(monthDate, 'MMMM yyyy'),
      bookings: bookings.length,
      revenue,
      occupancyRate: occupancy.occupancyRate,
      occupiedNights: occupancy.occupiedNights,
      days: occupancy.days,
    }
  })
  const rangeMonthCount = monthlyBreakdown.length
  const rangeBookingTotal = monthlyBreakdown.reduce((sum, row) => sum + row.bookings, 0)
  const rangeRevenueTotal = monthlyBreakdown.reduce((sum, row) => sum + row.revenue, 0)
  const rangeOccupiedNights = monthlyBreakdown.reduce((sum, row) => sum + row.occupiedNights, 0)
  const rangeDays = monthlyBreakdown.reduce((sum, row) => sum + row.days, 0)
  const averageBookings = rangeMonthCount > 0 ? rangeBookingTotal / rangeMonthCount : 0
  const averageRevenue = rangeMonthCount > 0 ? rangeRevenueTotal / rangeMonthCount : 0
  const averageBookingValue = rangeBookingTotal > 0 ? rangeRevenueTotal / rangeBookingTotal : 0
  const averageOccupancy = rangeDays > 0 ? (rangeOccupiedNights / rangeDays) * 100 : 0

  return (
    <AuthGuard>
      <div>
        <div className="page-header month-selector-header">
            <h1 style={{ marginBottom: 0 }}>Dashboard{currentProperty ? ` — ${currentProperty.name}` : ''}</h1>
            <div className="month-selector">
                <label>Month:</label>
                <select 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)}
                >
                    {months.map(date => (
                        <option key={format(date, 'yyyy-MM')} value={format(date, 'yyyy-MM')}>
                            {format(date, 'MMMM yyyy')}
                        </option>
                    ))}
                </select>
            </div>
        </div>
        
        <div className="dashboard-header">
          <div>
             <Calendar
               reservations={stats.reservations}
               currentMonth={parseISO(`${selectedMonth}-01`)}
               onMonthChange={(date) => setSelectedMonth(format(date, 'yyyy-MM'))}
             />
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <h3 style={{ marginTop: 0 }}>Welcome, {user?.user_metadata?.full_name || user?.email}</h3>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
              You have {stats.monthlyBookingCount} confirmed bookings occupying <strong>{stats.occupiedNightsCount} nights</strong> in {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}.
            </p>
            
            <CircularProgress percentage={stats.occupancyRate} primaryColor="var(--success)" />
            <p style={{ marginTop: '1rem', marginBottom: 0, color: 'var(--text-muted)', fontWeight: 500 }}>
              Occupancy Rate
            </p>
          </div>
        </div>

        {/* Monthly Stats */}
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>Monthly Overview ({format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')})</h2>
        <div className="grid-3" style={{ marginBottom: '2rem' }}>
          <div className="card">
            <h3>Revenue</h3>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>₱{stats.monthlyRevenue.toFixed(2)}</div>
          </div>
          <div className="card">
            <h3>Expenses</h3>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>₱{stats.monthlyExpenses.toFixed(2)}</div>
          </div>
          <div className="card">
            <h3>Net Profit</h3>
            <div className="stat-value" style={{ color: stats.monthlyProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              ₱{stats.monthlyProfit.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Overall Stats */}
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>All Time Overview</h2>
        <div className="grid-3">
          <div className="card">
            <h3>Total Revenue</h3>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>₱{stats.overallRevenue.toFixed(2)}</div>
          </div>
          <div className="card">
            <h3>Total Expenses</h3>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>₱{stats.overallExpenses.toFixed(2)}</div>
          </div>
          <div className="card">
            <h3>Net Profit</h3>
            <div className="stat-value" style={{ color: stats.overallProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              ₱{stats.overallProfit.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Average booking over a chosen month range */}
        <div className="page-header" style={{ marginTop: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: 0, color: 'var(--text-muted)' }}>Average Booking</h2>
          <div className="month-selector" style={{ flexWrap: 'wrap' }}>
            <label htmlFor="range-from">From</label>
            <select
              id="range-from"
              value={rangeFrom}
              onChange={(e) => {
                const next = e.target.value
                setRangeFrom(next)
                if (next > rangeTo) setRangeTo(next)
              }}
            >
              {rangeMonths.map(date => (
                <option key={`from-${format(date, 'yyyy-MM')}`} value={format(date, 'yyyy-MM')}>
                  {format(date, 'MMMM yyyy')}
                </option>
              ))}
            </select>
            <label htmlFor="range-to">To</label>
            <select
              id="range-to"
              value={rangeTo}
              onChange={(e) => {
                const next = e.target.value
                setRangeTo(next)
                if (next < rangeFrom) setRangeFrom(next)
              }}
            >
              {rangeMonths.map(date => (
                <option key={`to-${format(date, 'yyyy-MM')}`} value={format(date, 'yyyy-MM')}>
                  {format(date, 'MMMM yyyy')}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p style={{ marginTop: '-0.5rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>
          Confirmed and reserved bookings by check-in month, {format(rangeStart, 'MMMM yyyy')} to {format(rangeEnd, 'MMMM yyyy')} ({rangeMonthCount} {rangeMonthCount === 1 ? 'month' : 'months'}).
        </p>
        <div className="grid-3" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div className="card">
            <h3>Average Bookings</h3>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>{averageBookings.toFixed(1)}</div>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>per month</p>
          </div>
          <div className="card">
            <h3>Occupancy</h3>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{averageOccupancy.toFixed(0)}%</div>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>
              {rangeOccupiedNights} of {rangeDays} nights
            </p>
          </div>
          <div className="card">
            <h3>Average Revenue</h3>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>₱{averageRevenue.toFixed(2)}</div>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>per month</p>
          </div>
          <div className="card">
            <h3>Average Booking Value</h3>
            <div className="stat-value" style={{ color: 'var(--success)' }}>₱{averageBookingValue.toFixed(2)}</div>
            <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>
              {rangeBookingTotal} {rangeBookingTotal === 1 ? 'booking' : 'bookings'} in range
            </p>
          </div>
        </div>
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Bookings</th>
                  <th>Occupancy</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {monthlyBreakdown.map(row => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td>{row.bookings}</td>
                    <td>{row.occupancyRate.toFixed(0)}%</td>
                    <td>₱{row.revenue.toFixed(2)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ fontWeight: 700 }}>Average</td>
                  <td style={{ fontWeight: 700 }}>{averageBookings.toFixed(1)}</td>
                  <td style={{ fontWeight: 700 }}>{averageOccupancy.toFixed(0)}%</td>
                  <td style={{ fontWeight: 700 }}>₱{averageRevenue.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
