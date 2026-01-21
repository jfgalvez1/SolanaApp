'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../components/AuthProvider'
import AuthGuard from '../components/AuthGuard'
import Calendar from '../components/Calendar'

interface Stats {
  revenue: number
  expenses: number
  profit: number
  bookingCount: number
  reservations: any[]
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({ revenue: 0, expenses: 0, profit: 0, bookingCount: 0, reservations: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchStats()
    }
  }, [user])

  const fetchStats = async () => {
    try {
      setLoading(true)
      
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('*')
      
      if (resError) throw resError

      const { data: expenses, error: expError } = await supabase
        .from('expenses')
        .select('amount')

      if (expError) throw expError

      const confirmedReservations = (reservations as any[])?.filter((r: any) => r.status === 'confirmed') || []
      const revenue = confirmedReservations.reduce((sum: number, item: any) => sum + (Number(item.total_price) || 0), 0)
      const totalExpenses = (expenses || []).reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0)
      
      setStats({
        revenue,
        expenses: totalExpenses,
        profit: revenue - totalExpenses,
        bookingCount: confirmedReservations.length,
        reservations: reservations || []
      })

    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthGuard>
      <div>
        <h1 style={{ marginBottom: '1.5rem' }}>Dashboard</h1>
        
        <div className="dashboard-header">
          <div>
             <Calendar reservations={stats.reservations} />
          </div>
          <div className="card">
            <h3>Welcome, {user?.user_metadata?.full_name || user?.email}</h3>
            <p>You have {stats.bookingCount} confirmed bookings this month.</p>
          </div>
        </div>

        <div className="grid-3">
          <div className="card">
            <h3>Total Revenue</h3>
            <div className="stat-value" style={{ color: 'var(--primary)' }}>PHP{stats.revenue.toFixed(2)}</div>
          </div>
          <div className="card">
            <h3>Total Expenses</h3>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>PHP{stats.expenses.toFixed(2)}</div>
          </div>
          <div className="card">
            <h3>Net Profit</h3>
            <div className="stat-value" style={{ color: stats.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              PHP{stats.profit.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  )
}
