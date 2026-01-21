'use client'
import { useEffect, useState, FormEvent, ChangeEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import AuthGuard from '../../components/AuthGuard'
import { Database } from '../../lib/database.types'

type Reservation = Database['public']['Tables']['reservations']['Row']
type NewReservation = Database['public']['Tables']['reservations']['Insert']

export default function Reservations() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Omit<NewReservation, 'id' | 'created_at' | 'user_id'>>({
    guest_name: '',
    check_in: '',
    check_out: '',
    total_price: 0,
    status: 'confirmed',
    notes: ''
  })

  // Get today's date in YYYY-MM-DD format for min attribute
  const today = new Date().toISOString().split('T')[0]

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
      const today = new Date().toISOString().split('T')[0]
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
      setFormData({ guest_name: '', check_in: '', check_out: '', total_price: 0, status: 'confirmed', notes: '' })
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
    const value = e.target.name === 'total_price' ? Number(e.target.value) : e.target.value
    setFormData({ ...formData, [e.target.name]: value })
  }

  return (
    <AuthGuard>
      <div>
        <div className="page-header">
          <h1>Reservations</h1>
          <button className="btn-primary" onClick={() => {
            setShowForm(!showForm)
            if (showForm) {
              setEditingId(null)
              setFormData({ guest_name: '', check_in: '', check_out: '', total_price: 0, status: 'confirmed', notes: '' })
            }
          }}>
            {showForm ? 'Cancel' : '+ New Reservation'}
          </button>
        </div>

        {showForm && (
          <div className="card">
            <h3>{editingId ? 'Edit Reservation' : 'New Reservation'}</h3>
            <form onSubmit={handleCreate}>
              <div className="grid-3">
                <input name="guest_name" placeholder="Guest Name" value={formData.guest_name} onChange={handleChange} className="input-field" required />
                <input name="check_in" type="date" min={today} placeholder="Check In" value={formData.check_in} onChange={handleChange} className="input-field" required />
                <input name="check_out" type="date" min={formData.check_in || today} placeholder="Check Out" value={formData.check_out} onChange={handleChange} className="input-field" required />
                <input name="total_price" type="number" placeholder="Total Price" value={formData.total_price || ''} onChange={handleChange} className="input-field" required />
                <select name="status" value={formData.status} onChange={handleChange} className="input-field">
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <input name="notes" placeholder="Notes (Optional)" value={formData.notes || ''} onChange={handleChange} className="input-field" />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>{editingId ? 'Update' : 'Save'} Reservation</button>
            </form>
          </div>
        )}

        {loading ? <p>Loading...</p> : (
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
                {reservations.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center' }}>No reservations found.</td></tr>
                ) : reservations.map(res => (
                  <tr key={res.id}>
                    <td>
                      <div style={{ fontWeight: '500' }}>{res.guest_name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{res.notes}</div>
                    </td>
                    <td>
                      {res.check_in} <span style={{ color: 'var(--text-muted)' }}>to</span> {res.check_out}
                    </td>
                    <td>
                      <span className={`status-badge status-${res.status}`}>
                        {res.status}
                      </span>
                    </td>
                    <td style={{ fontWeight: '500' }}>${res.total_price}</td>
                    <td>
                      <button className="btn-primary" style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => handleEdit(res)}>Edit</button>
                      <button className="btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => handleDelete(res.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
