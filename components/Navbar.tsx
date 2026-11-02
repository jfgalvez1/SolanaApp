'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { useProperty } from './PropertyProvider'
import { useBookingRequestAlerts } from './BookingRequestAlerts'

const Navbar = () => {
  const { user, signOut } = useAuth()
  const { properties, currentProperty, setCurrentProperty, loading, error } = useProperty()
  const pathname = usePathname()
  const { pendingCount } = useBookingRequestAlerts()

  if (!user) return null

  return (
  <>
    {error && (
      <div style={{ background: '#fef3c7', color: '#92400e', padding: '0.75rem 1.5rem', fontSize: '0.875rem', borderBottom: '1px solid #fcd34d' }}>
        {error}
      </div>
    )}
    <nav className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {properties.length > 1 ? (
          <select
            value={currentProperty?.id || ''}
            onChange={(e) => {
              const property = properties.find(p => p.id === e.target.value)
              if (property) setCurrentProperty(property)
            }}
            className="input-field"
            style={{ fontWeight: 'bold', fontSize: '1rem', padding: '0.35rem 0.5rem', minWidth: '140px' }}
            disabled={loading}
          >
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ) : (
          <div style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>
            {currentProperty?.name || 'Solana Villa'}
          </div>
        )}
      </div>
      <div className="nav-links">
        <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>Dashboard</Link>
        <Link href="/availability" className={`nav-link ${pathname === '/availability' ? 'active' : ''}`}>Availability</Link>
        <Link href="/reservations" className={`nav-link ${pathname === '/reservations' ? 'active' : ''}`}>Reservations</Link>
        <Link href="/booking-requests" className={`nav-link ${pathname === '/booking-requests' ? 'active' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          Booking Requests
          {pendingCount > 0 && (
            <span
              aria-label={`${pendingCount} pending booking ${pendingCount === 1 ? 'request' : 'requests'}`}
              style={{
                minWidth: '1.25rem',
                height: '1.25rem',
                padding: '0 0.35rem',
                borderRadius: '999px',
                background: 'var(--danger)',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 700,
                lineHeight: '1.25rem',
                textAlign: 'center',
              }}
            >
              {pendingCount}
            </span>
          )}
        </Link>
        <Link href="/expenses" className={`nav-link ${pathname === '/expenses' ? 'active' : ''}`}>Expenses</Link>
        <Link href="/safety-lock" className={`nav-link ${pathname === '/safety-lock' ? 'active' : ''}`}>Safety Lock</Link>
        <Link href="/profile" className={`nav-link ${pathname === '/profile' ? 'active' : ''}`}>Profile</Link>
      </div>
      <button onClick={signOut} className="btn-primary" style={{ backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
        Sign Out
      </button>
    </nav>
  </>
  )
}

export default Navbar
