'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AuthGuard from '../components/AuthGuard'
import Calendar from '../components/Calendar'
import CircularProgress from '../components/CircularProgress'
import { format, parseISO, isSameMonth, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths, startOfYear, getDaysInMonth, eachDayOfInterval, startOfDay } from 'date-fns'

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
  const [stats, setStats] = useState<Stats>({ 
    monthlyRevenue: 0, monthlyExpenses: 0, monthlyProfit: 0, monthlyBookingCount: 0, occupiedNightsCount: 0, occupancyRate: 0,
    overallRevenue: 0, overallExpenses: 0, overallProfit: 0,
    reservations: [] 
  })
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [allReservations, setAllReservations] = useState<any[]>([])
  const [allExpenses, setAllExpenses] = useState<any[]>([])

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  useEffect(() => {
    calculateStats()
  }, [selectedMonth, allReservations, allExpenses])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('*')
      
      if (resError) throw resError

      const { data: expenses, error: expError } = await supabase
        .from('expenses')
        .select('*')

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

  return (
    <AuthGuard>
      <div>
        <div className="page-header month-selector-header">
            <h1 style={{ marginBottom: 0 }}>Dashboard</h1>
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
             <Calendar reservations={stats.reservations} />
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
      </div>
    </AuthGuard>
  )
}
