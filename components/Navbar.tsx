'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { useProperty } from './PropertyProvider'

const Navbar = () => {
  const { user, signOut } = useAuth()
  const { properties, currentProperty, setCurrentProperty, loading, error } = useProperty()
  const pathname = usePathname()

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
        <Link href="/reservations" className={`nav-link ${pathname === '/reservations' ? 'active' : ''}`}>Reservations</Link>
        <Link href="/expenses" className={`nav-link ${pathname === '/expenses' ? 'active' : ''}`}>Expenses</Link>
        <Link href="/bitcoin-reserve" className={`nav-link ${pathname === '/bitcoin-reserve' ? 'active' : ''}`}>Bitcoin Reserve</Link>
        <Link href="/safety-lock" className={`nav-link ${pathname === '/safety-lock' ? 'active' : ''}`}>Safety Lock</Link>
        <Link href="/tracker" className={`nav-link ${pathname === '/tracker' ? 'active' : ''}`}>Tracker</Link>
      </div>
      <button onClick={signOut} className="btn-primary" style={{ backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
        Sign Out
      </button>
    </nav>
  </>
  )
}

export default Navbar
