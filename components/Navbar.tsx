'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'

const Navbar = () => {
  const { user, signOut } = useAuth()
  const pathname = usePathname()

  if (!user) return null

  return (
    <nav className="navbar">
      <div style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>Solana Villa</div>
      <div className="nav-links">
        <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>Dashboard</Link>
        <Link href="/reservations" className={`nav-link ${pathname === '/reservations' ? 'active' : ''}`}>Reservations</Link>
        <Link href="/expenses" className={`nav-link ${pathname === '/expenses' ? 'active' : ''}`}>Expenses</Link>
      </div>
      <button onClick={signOut} className="btn-primary" style={{ backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
        Sign Out
      </button>
    </nav>
  )
}

export default Navbar
