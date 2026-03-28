'use client'
import { useEffect, useState, FormEvent, ChangeEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import AuthGuard from '../../components/AuthGuard'
import { Database } from '../../lib/database.types'

type Reservation = Database['public']['Tables']['reservations']['Row']
type NewReservation = Database['public']['Tables']['reservations']['Insert']

const getLocalToday = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split('T')[0]
}

export default function Reservations() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pax, setPax] = useState<number>(2)
  const [activeTab, setActiveTab] = useState<'incoming' | 'done' | 'cancelled'>('incoming')
  const [formData, setFormData] = useState<Omit<NewReservation, 'id' | 'created_at' | 'user_id'>>({
    guest_name: '',
    check_in: '',
    check_out: '',
    total_price: 2500,
    status: 'confirmed',
    notes: ''
  })

  // Get today's date in YYYY-MM-DD format for min attribute
  const today = getLocalToday()

  const incomingReservations = reservations
    .filter(res => res.status !== 'cancelled' && res.check_out >= today)
    .sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime()) // Closest first

  const doneReservations = reservations
    .filter(res => res.status !== 'cancelled' && res.check_out < today)
    .sort((a, b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime()) // Most recent past first
    
  const cancelledReservations = reservations
    .filter(res => res.status === 'cancelled')
    .sort((a, b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime()) // Most recent first
  
  const displayedReservations = 
    activeTab === 'incoming' ? incomingReservations : 
    activeTab === 'done' ? doneReservations : 
    cancelledReservations

  useEffect(() => {
    fetchReservations()
  }, [])

  const fetchReservations = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .order('check_in', { ascending: false })
      
      if (error) throw error
      setReservations(data || [])
    } catch (error) {
      console.error('Error fetching reservations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user')

      // Validate dates
      const today = getLocalToday()
      if (formData.check_in < today) {
        throw new Error('Check-in date cannot be in the past')
      }
      if (formData.check_out < formData.check_in) {
        throw new Error('Check-out date must be after check-in date')
      }

      const newReservation: NewReservation = {
        ...formData,
        user_id: user.id,
        status: formData.status as Database['public']['Tables']['reservations']['Row']['status']
      }

      let error
      if (editingId) {
        const { error: updateError } = await (supabase as any)
          .from('reservations')
          .update(newReservation)
          .eq('id', editingId)
        error = updateError
      } else {
        const { error: insertError } = await (supabase as any)
          .from('reservations')
          .insert([newReservation])
        error = insertError
      }
      
      if (error) throw error
      
      setShowForm(false)
      setEditingId(null)
      setFormData({ guest_name: '', check_in: '', check_out: '', total_price: 2500, status: 'confirmed', notes: '' })
      setPax(2)
      fetchReservations()
    } catch (error: any) {
      alert('Error saving reservation: ' + error.message)
    }
  }

  const handleEdit = (reservation: Reservation) => {
    setEditingId(reservation.id)
    setFormData({
      guest_name: reservation.guest_name,
      check_in: reservation.check_in,
      check_out: reservation.check_out,
      total_price: reservation.total_price,
      status: reservation.status,
      notes: reservation.notes
    })
    
    let days = 1
    if (reservation.check_in && reservation.check_out) {
      const start = new Date(reservation.check_in)
      const end = new Date(reservation.check_out)
      const timeDiff = end.getTime() - start.getTime()
      if (timeDiff > 0) {
        days = Math.ceil(timeDiff / (1000 * 3600 * 24))
      }
    }
    
    let calculatedPax = 2
    if (reservation.total_price) {
      const basePrice = reservation.total_price / days
      if (basePrice > 2500) {
        calculatedPax = Math.min(5, 2 + Math.floor((basePrice - 2500) / 500))
      }
    }
    setPax(calculatedPax)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this reservation?')) return
    try {
      const { error } = await supabase.from('reservations').delete().eq('id', id)
      if (error) throw error
      fetchReservations()
    } catch (error: any) {
      alert('Error deleting: ' + error.message)
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const name = e.target.name
    const value = name === 'total_price' ? Number(e.target.value) : e.target.value
    
    setFormData(prev => {
      const newData = { ...prev, [name]: value }
      
      if (name === 'check_in' || name === 'check_out') {
        const startStr = name === 'check_in' ? value as string : prev.check_in
        const endStr = name === 'check_out' ? value as string : prev.check_out
        
        if (startStr && endStr) {
          const start = new Date(startStr)
          const end = new Date(endStr)
          const timeDiff = end.getTime() - start.getTime()
          const days = timeDiff > 0 ? Math.ceil(timeDiff / (1000 * 3600 * 24)) : 1
          const basePrice = 2500 + (pax > 2 ? (pax - 2) * 500 : 0)
          newData.total_price = basePrice * days
        }
      }
      return newData
    })
  }

  const handleExportCSV = () => {
    if (displayedReservations.length === 0) return

    const headers = ['Guest Name', 'Check In', 'Check Out', 'Total Price', 'Status', 'Notes']
    
    const csvRows = [headers.join(',')]
    
    displayedReservations.forEach(res => {
      const row = [
        `"${(res.guest_name || '').replace(/"/g, '""')}"`,
        `"${res.check_in || ''}"`,
        `"${res.check_out || ''}"`,
        res.total_price || 0,
        `"${res.status || ''}"`,
        `"${(res.notes || '').replace(/"/g, '""')}"`
      ]
      csvRows.push(row.join(','))
    })
    
    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `${activeTab}_reservations_export_${getLocalToday()}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePaxChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newPax = Number(e.target.value)
    setPax(newPax)
    
    setFormData(prev => {
      let days = 1
      if (prev.check_in && prev.check_out) {
        const start = new Date(prev.check_in)
        const end = new Date(prev.check_out)
        const timeDiff = end.getTime() - start.getTime()
        if (timeDiff > 0) {
          days = Math.ceil(timeDiff / (1000 * 3600 * 24))
        }
      }
      const basePrice = 2500 + (newPax > 2 ? (newPax - 2) * 500 : 0)
      return { ...prev, total_price: basePrice * days }
    })
  }

  return (
    <AuthGuard>
      <div>
        <div className="page-header">
          <h1>Reservations</h1>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              className="btn-primary" 
              onClick={handleExportCSV} 
              disabled={displayedReservations.length === 0 || loading}
              style={{ backgroundColor: 'var(--success-color, #10b981)', borderColor: 'var(--success-color, #10b981)' }}
            >
              Export CSV
            </button>
            <button className="btn-primary" onClick={() => {
              setShowForm(!showForm)
              if (showForm) {
                setEditingId(null)
                setFormData({ guest_name: '', check_in: '', check_out: '', total_price: 2500, status: 'confirmed', notes: '' })
                setPax(2)
              }
            }}>
              {showForm ? 'Cancel' : '+ New Reservation'}
            </button>
          </div>
        </div>

        {showForm && (
          <div className="card">
            <h3>{editingId ? 'Edit Reservation' : 'New Reservation'}</h3>
            <form onSubmit={handleCreate}>
              <div className="grid-3">
                <input name="guest_name" placeholder="Guest Name" value={formData.guest_name} onChange={handleChange} className="input-field" required />
                <input name="check_in" type="date" min={today} placeholder="Check In" value={formData.check_in} onChange={handleChange} className="input-field" required />
                <input name="check_out" type="date" min={formData.check_in || today} placeholder="Check Out" value={formData.check_out} onChange={handleChange} className="input-field" required />
                <select name="pax" value={pax} onChange={handlePaxChange} className="input-field">
                  {[...Array(5)].map((_, i) => {
                    const n = i + 1;
                    return (
                      <option key={n} value={n}>
                        {n} Pax {n > 2 ? `(+₱${(n - 2) * 500})` : ''}
                      </option>
                    );
                  })}
                </select>
                <input name="total_price" type="number" placeholder="Total Price" value={formData.total_price || ''} onChange={handleChange} className="input-field" required />
                <select name="status" value={formData.status} onChange={handleChange} className="input-field">
                  <option value="confirmed">Confirmed</option>
                  <option value="reserved">Reserved</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <input name="notes" placeholder="Notes (Optional)" value={formData.notes || ''} onChange={handleChange} className="input-field" />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>{editingId ? 'Update' : 'Save'} Reservation</button>
            </form>
          </div>
        )}

        {loading ? <p>Loading...</p> : (
          <>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
              <button 
                onClick={() => setActiveTab('incoming')}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '1rem', 
                  fontWeight: activeTab === 'incoming' ? '600' : '400',
                  color: activeTab === 'incoming' ? 'var(--primary-color, #4f46e5)' : 'var(--text-muted, #64748b)',
                  borderBottom: activeTab === 'incoming' ? '2px solid var(--primary-color, #4f46e5)' : '2px solid transparent',
                  padding: '0.5rem 0',
                  cursor: 'pointer',
                  marginBottom: '-1px'
                }}
              >
                Incoming ({incomingReservations.length})
              </button>
              <button 
                onClick={() => setActiveTab('done')}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '1rem', 
                  fontWeight: activeTab === 'done' ? '600' : '400',
                  color: activeTab === 'done' ? 'var(--primary-color, #4f46e5)' : 'var(--text-muted, #64748b)',
                  borderBottom: activeTab === 'done' ? '2px solid var(--primary-color, #4f46e5)' : '2px solid transparent',
                  padding: '0.5rem 0',
                  cursor: 'pointer',
                  marginBottom: '-1px'
                }}
              >
                Done ({doneReservations.length})
              </button>
              <button 
                onClick={() => setActiveTab('cancelled')}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '1rem', 
                  fontWeight: activeTab === 'cancelled' ? '600' : '400',
                  color: activeTab === 'cancelled' ? 'var(--primary-color, #4f46e5)' : 'var(--text-muted, #64748b)',
                  borderBottom: activeTab === 'cancelled' ? '2px solid var(--primary-color, #4f46e5)' : '2px solid transparent',
                  padding: '0.5rem 0',
                  cursor: 'pointer',
                  marginBottom: '-1px'
                }}
              >
                Cancelled ({cancelledReservations.length})
              </button>
            </div>
            <div className="card table-container">
              <table>
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Dates</th>
                    <th>Status</th>
                    <th>Price</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedReservations.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center' }}>No {activeTab} reservations found.</td></tr>
                  ) : displayedReservations.map(res => (
                  <tr key={res.id}>
                    <td>
                      <div style={{ fontWeight: '500' }}>{res.guest_name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{res.notes}</div>
                    </td>
                    <td>
                      {new Date(res.check_in).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })} 
                      <span style={{ color: 'var(--text-muted)', margin: '0 0.25rem' }}>to</span> 
                      {new Date(res.check_out).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })}
                    </td>
                    <td>
                      <span className={`status-badge status-${res.status}`}>
                        {res.status}
                      </span>
                    </td>
                    <td style={{ fontWeight: '500' }}>₱{res.total_price}</td>
                    <td>
                      <button className="btn-primary" style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => handleEdit(res)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </AuthGuard>
  )
}
