'use client'
import { useEffect, useState, FormEvent, ChangeEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import AuthGuard from '../../components/AuthGuard'
import { useProperty } from '../../components/PropertyProvider'
import { Database } from '../../lib/database.types'
import { calculateTotalPrice, extraPaxLabel } from '../../lib/pricing'
import {
  findOverlappingReservations,
  formatOverlapError,
  isOccupyingStatus,
} from '../../lib/reservationOverlap'

type BookingRequest = Database['public']['Tables']['booking_requests']['Row']
type Reservation = Database['public']['Tables']['reservations']['Row']

type EditForm = {
  guest_name: string
  check_in: string
  check_out: string
  pax: number
  suggested_price: number
  status: 'confirmed' | 'reserved'
  notes: string
}

const emptyEdit = (): EditForm => ({
  guest_name: '',
  check_in: '',
  check_out: '',
  pax: 2,
  suggested_price: 0,
  status: 'confirmed',
  notes: '',
})

export default function BookingRequestsPage() {
  const { currentProperty } = useProperty()
  const [requests, setRequests] = useState<BookingRequest[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [editing, setEditing] = useState<BookingRequest | null>(null)
  const [form, setForm] = useState<EditForm>(emptyEdit())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentProperty) {
      fetchData()
    }
  }, [currentProperty])

  const fetchData = async () => {
    if (!currentProperty) return
    try {
      setLoading(true)
      const [reqRes, resRes] = await Promise.all([
        supabase
          .from('booking_requests')
          .select('*')
          .eq('property_id', currentProperty.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('reservations')
          .select('*')
          .eq('property_id', currentProperty.id)
          .in('status', ['confirmed', 'reserved']),
      ])
      if (reqRes.error) throw reqRes.error
      if (resRes.error) throw resRes.error
      setRequests(reqRes.data || [])
      setReservations(resRes.data || [])
    } catch (error) {
      console.error('Error fetching booking requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const pending = requests.filter(r => r.status === 'pending')
  const approved = requests.filter(r => r.status === 'approved')
  const rejected = requests.filter(r => r.status === 'rejected')
  const displayed =
    activeTab === 'pending' ? pending : activeTab === 'approved' ? approved : rejected

  const openReview = (req: BookingRequest) => {
    setEditing(req)
    setForm({
      guest_name: req.guest_name,
      check_in: req.check_in,
      check_out: req.check_out,
      pax: req.pax,
      suggested_price: Number(req.suggested_price) || 0,
      status: 'confirmed',
      notes: req.notes || '',
    })
  }

  const closeReview = () => {
    setEditing(null)
    setForm(emptyEdit())
  }

  const liveConflicts =
    editing && form.check_in && form.check_out && isOccupyingStatus(form.status)
      ? findOverlappingReservations(reservations, form.check_in, form.check_out)
      : []

  const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm(prev => {
      const next = {
        ...prev,
        [name]:
          name === 'pax' || name === 'suggested_price' ? Number(value) : value,
      } as EditForm

      if (
        currentProperty &&
        (name === 'check_in' || name === 'check_out' || name === 'pax')
      ) {
        const checkIn = name === 'check_in' ? (value as string) : prev.check_in
        const checkOut = name === 'check_out' ? (value as string) : prev.check_out
        const pax = name === 'pax' ? Number(value) : prev.pax
        if (checkIn && checkOut) {
          next.suggested_price = calculateTotalPrice(
            checkIn,
            checkOut,
            pax,
            currentProperty
          )
        }
      }
      return next
    })
  }

  const handleApprove = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing || !currentProperty) return
    if (liveConflicts.length > 0) {
      alert(formatOverlapError(liveConflicts))
      return
    }
    if (form.check_out <= form.check_in) {
      alert('Check-out must be after check-in')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')

      const { data: reservation, error: insertError } = await supabase
        .from('reservations')
        .insert([
          {
            user_id: user.id,
            property_id: currentProperty.id,
            guest_name: form.guest_name.trim(),
            check_in: form.check_in,
            check_out: form.check_out,
            pax: form.pax,
            total_price: form.suggested_price,
            status: form.status,
            notes: form.notes || 'Approved from booking request',
          },
        ])
        .select('id')
        .single()

      if (insertError) throw insertError

      const { error: updateError } = await supabase
        .from('booking_requests')
        .update({
          status: 'approved',
          guest_name: form.guest_name.trim(),
          check_in: form.check_in,
          check_out: form.check_out,
          pax: form.pax,
          suggested_price: form.suggested_price,
          notes: form.notes,
          reservation_id: reservation.id,
          reviewed_at: new Date().toISOString(),
          overlap_warning: null,
        })
        .eq('id', editing.id)

      if (updateError) throw updateError

      closeReview()
      fetchData()
    } catch (error: any) {
      alert('Could not approve: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReject = async (req: BookingRequest) => {
    if (!window.confirm(`Reject booking request for ${req.guest_name}?`)) return
    try {
      const { error } = await supabase
        .from('booking_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', req.id)
      if (error) throw error
      if (editing?.id === req.id) closeReview()
      fetchData()
    } catch (error: any) {
      alert('Could not reject: ' + error.message)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })

  const tabStyle = (tab: typeof activeTab) => ({
    background: 'none' as const,
    border: 'none' as const,
    fontSize: '1rem',
    fontWeight: activeTab === tab ? '600' : '400',
    color: activeTab === tab ? 'var(--primary-color, #4f46e5)' : 'var(--text-muted, #64748b)',
    borderBottom:
      activeTab === tab
        ? '2px solid var(--primary-color, #4f46e5)'
        : '2px solid transparent',
    padding: '0.5rem 0',
    cursor: 'pointer',
    marginBottom: '-1px',
  })

  return (
    <AuthGuard>
      <div>
        <div className="page-header">
          <h1>
            Booking Requests
            {currentProperty ? ` — ${currentProperty.name}` : ''}
          </h1>
        </div>

        <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
          Google Form submissions land here first. Approve to add them to Reservations,
          or reject to discard.
        </p>

        {editing && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Review &amp; approve</h3>
            {editing.overlap_warning && (
              <p style={{ color: 'var(--danger)', marginTop: 0 }}>
                {editing.overlap_warning}
              </p>
            )}
            <form onSubmit={handleApprove}>
              <div className="grid-3">
                <input
                  name="guest_name"
                  className="input-field"
                  value={form.guest_name}
                  onChange={handleFormChange}
                  placeholder="Guest name"
                  required
                />
                <input
                  name="check_in"
                  type="date"
                  className="input-field"
                  value={form.check_in}
                  onChange={handleFormChange}
                  required
                />
                <input
                  name="check_out"
                  type="date"
                  className="input-field"
                  value={form.check_out}
                  onChange={handleFormChange}
                  required
                />
                <select
                  name="pax"
                  className="input-field"
                  value={form.pax}
                  onChange={handleFormChange}
                >
                  {[...Array(currentProperty?.max_pax ?? 5)].map((_, i) => {
                    const n = i + 1
                    return (
                      <option key={n} value={n}>
                        {n} Pax{' '}
                        {currentProperty ? extraPaxLabel(n, currentProperty) : ''}
                      </option>
                    )
                  })}
                </select>
                <input
                  name="suggested_price"
                  type="number"
                  className="input-field"
                  value={form.suggested_price}
                  onChange={handleFormChange}
                  required
                />
                <select
                  name="status"
                  className="input-field"
                  value={form.status}
                  onChange={handleFormChange}
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="reserved">Reserved</option>
                </select>
                <input
                  name="notes"
                  className="input-field"
                  value={form.notes}
                  onChange={handleFormChange}
                  placeholder="Notes (optional)"
                />
              </div>
              {liveConflicts.length > 0 && (
                <p style={{ color: 'var(--danger)', margin: '0 0 0.75rem' }}>
                  {formatOverlapError(liveConflicts)}
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving || liveConflicts.length > 0}
                >
                  {saving ? 'Saving...' : 'Approve → Reservations'}
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  disabled={saving}
                  onClick={() => handleReject(editing)}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                  }}
                  disabled={saving}
                  onClick={closeReview}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                gap: '1.5rem',
                marginBottom: '1rem',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
              }}
            >
              <button onClick={() => setActiveTab('pending')} style={tabStyle('pending')}>
                Pending ({pending.length})
              </button>
              <button onClick={() => setActiveTab('approved')} style={tabStyle('approved')}>
                Approved ({approved.length})
              </button>
              <button onClick={() => setActiveTab('rejected')} style={tabStyle('rejected')}>
                Rejected ({rejected.length})
              </button>
            </div>

            <div className="card table-container">
              <table>
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Dates</th>
                    <th>Pax</th>
                    <th>Price</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center' }}>
                        No {activeTab} booking requests.
                      </td>
                    </tr>
                  ) : (
                    displayed.map(req => (
                      <tr key={req.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{req.guest_name}</div>
                          {req.overlap_warning && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>
                              {req.overlap_warning}
                            </div>
                          )}
                        </td>
                        <td>
                          {formatDate(req.check_in)}
                          <span style={{ color: 'var(--text-muted)', margin: '0 0.25rem' }}>
                            to
                          </span>
                          {formatDate(req.check_out)}
                        </td>
                        <td style={{ textAlign: 'center' }}>{req.pax}</td>
                        <td>₱{Number(req.suggested_price)}</td>
                        <td style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                          {formatDate(req.created_at)}
                        </td>
                        <td>
                          {req.status === 'pending' ? (
                            <button
                              className="btn-primary"
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.875rem',
                              }}
                              onClick={() => openReview(req)}
                            >
                              Review
                            </button>
                          ) : (
                            <span className={`status-badge status-${req.status === 'approved' ? 'confirmed' : 'cancelled'}`}>
                              {req.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AuthGuard>
  )
}
