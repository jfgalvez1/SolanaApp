'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import AuthGuard from '../../components/AuthGuard'
import { useAuth } from '../../components/AuthProvider'
import { format, parseISO, startOfYear, addMonths, endOfMonth, eachDayOfInterval, startOfDay, eachMonthOfInterval } from 'date-fns'

interface MonthData {
  occupiedNights: number
  bitcoinAmount: number
}

export default function BitcoinReserve() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<MonthData>({ occupiedNights: 0, bitcoinAmount: 0 })
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [allReservations, setAllReservations] = useState<any[]>([])
  const [boughtRecords, setBoughtRecords] = useState<any[]>([])
  const [isBought, setIsBought] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (allReservations.length > 0) {
      calculateBitcoinReserve()
    } else {
      setData({ occupiedNights: 0, bitcoinAmount: 0 })
    }
  }, [allReservations, selectedMonth])

  useEffect(() => {
    // Check if this month is already bought
    const match = boughtRecords.some(r => r.description === `Bitcoin Reserve: ${selectedMonth}`)
    setIsBought(match)
  }, [boughtRecords, selectedMonth])

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
        .eq('category', 'Bitcoin Reserve')
      
      if (expError) throw expError

      setAllReservations(reservations || [])
      setBoughtRecords(expenses || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateBitcoinReserve = () => {
    const start = parseISO(`${selectedMonth}-01`)
    const end = endOfMonth(start)
    const monthDays = eachDayOfInterval({ start, end })
    
    let occupiedDaysCount = 0

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

    setData({
      occupiedNights: occupiedDaysCount,
      bitcoinAmount: occupiedDaysCount * 100
    })
  }

  const handleConfirmBought = async () => {
    if (!user) return alert('You must be logged in')
    if (data.bitcoinAmount <= 0) return alert('No bitcoin to buy for this month.')

    if (!window.confirm(`Are you sure you want to record a Bitcoin purchase of ₱${data.bitcoinAmount.toLocaleString()}?`)) return

    try {
      setSaving(true)
      const newRecord = {
        user_id: user.id,
        description: `Bitcoin Reserve: ${selectedMonth}`,
        amount: data.bitcoinAmount,
        category: 'Bitcoin Reserve',
        date: new Date().toISOString().split('T')[0]
      }

      const { error } = await (supabase as any)
        .from('expenses')
        .insert([newRecord])

      if (error) throw error

      setBoughtRecords(prev => [...prev, newRecord])
      alert('Recorded successfully!')
    } catch (error: any) {
      alert('Error saving record: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  // Generate months for the selector starting from 2026
  const months = eachMonthOfInterval({
    start: startOfYear(new Date(2026, 0, 1)),
    end: addMonths(new Date(), 12)
  })

  return (
    <AuthGuard>
      <div>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ marginBottom: 0 }}>Bitcoin Reserve</h1>
          <div className="month-selector">
            <label style={{ marginRight: '0.5rem', fontWeight: 500 }}>Month:</label>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input-field"
              style={{ width: 'auto', display: 'inline-block' }}
            >
              {months.map(date => (
                <option key={format(date, 'yyyy-MM')} value={format(date, 'yyyy-MM')}>
                  {format(date, 'MMMM yyyy')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? <p>Loading...</p> : (
          <div className="card" style={{ marginBottom: '2rem', textAlign: 'center', backgroundColor: isBought ? 'var(--success)' : 'var(--primary)', color: '#fff', padding: '3rem 2rem', transition: 'background-color 0.3s' }}>
            <h2 style={{ marginTop: 0, opacity: 0.9, fontWeight: 500 }}>
              Bitcoin to Buy ({format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')})
            </h2>
            <div style={{ fontSize: '3.5rem', fontWeight: 'bold', margin: '1rem 0' }}>
              ₱{data.bitcoinAmount.toLocaleString()}
            </div>
            <p style={{ marginBottom: isBought ? '0' : '1.5rem', opacity: 0.8, fontSize: '1.1rem' }}>
              Based on {data.occupiedNights} occupied {data.occupiedNights === 1 ? 'night' : 'nights'} 
              <br/> (₱100 / night)
            </p>

            {isBought ? (
              <div style={{ display: 'inline-block', marginTop: '1rem', padding: '0.75rem 1.5rem', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.2rem' }}>
                ✅ Already Bought
              </div>
            ) : (
              data.bitcoinAmount > 0 && (
                <button 
                  onClick={handleConfirmBought} 
                  disabled={saving}
                  className="btn-primary" 
                  style={{ backgroundColor: '#fff', color: 'var(--primary)', border: 'none', padding: '0.75rem 2rem', fontSize: '1.1rem', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                >
                  {saving ? 'Saving...' : 'Confirm Bought'}
                </button>
              )
            )}
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
