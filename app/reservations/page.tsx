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
  const [formData, setFormData] = useState<Omit<NewReservation, 'id' | 'created_at' | 'user_id'>>({
    guest_name: '',
    check_in: '',
    check_out: '',
    total_price: 0,
    status: 'confirmed',
    notes: ''
  })

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

      const newReservation: NewReservation = {
        ...formData,
        user_id: user.id,
        status: formData.status as Database['public']['Tables']['reservations']['Row']['status']
      }

      const { error } = await (supabase as any)
        .from('reservations')
        .insert([newReservation])
      
      if (error) throw error
      
      setShowForm(false)
      setFormData({ guest_name: '', check_in: '', check_out: '', total_price: 0, status: 'confirmed', notes: '' })
      fetchReservations()
    } catch (error: any) {
      alert('Error creating reservation: ' + error.message)
    }
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1>Reservations</h1>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Reservation'}
          </button>
        </div>

        {showForm && (
          <div className="card">
            <h3>New Reservation</h3>
            <form onSubmit={handleCreate}>
              <div className="grid-3">
                <input name="guest_name" placeholder="Guest Name" value={formData.guest_name} onChange={handleChange} className="input-field" required />
                <input name="check_in" type="date" placeholder="Check In" value={formData.check_in} onChange={handleChange} className="input-field" required />
                <input name="check_out" type="date" placeholder="Check Out" value={formData.check_out} onChange={handleChange} className="input-field" required />
                <input name="total_price" type="number" placeholder="Total Price" value={formData.total_price || ''} onChange={handleChange} className="input-field" required />
                <select name="status" value={formData.status} onChange={handleChange} className="input-field">
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <input name="notes" placeholder="Notes (Optional)" value={formData.notes || ''} onChange={handleChange} className="input-field" />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>Save Reservation</button>
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
