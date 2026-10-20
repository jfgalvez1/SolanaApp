'use client'
import { useEffect, useState, FormEvent } from 'react'
import AuthGuard from '../../components/AuthGuard'
import { useAuth } from '../../components/AuthProvider'

export default function Profile() {
  const { user, updatePassword, updateFullName } = useAuth()
  const [fullName, setFullName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nameMsg, setNameMsg] = useState('')
  const [nameError, setNameError] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    setFullName(user?.user_metadata?.full_name || '')
  }, [user])

  const handleUpdateName = async (e: FormEvent) => {
    e.preventDefault()
    setNameMsg('')
    setNameError('')
    setSavingName(true)
    try {
      const { error } = await updateFullName(fullName.trim())
      if (error) throw error
      setNameMsg('Display name updated.')
      setTimeout(() => setNameMsg(''), 3000)
    } catch (err: any) {
      setNameError(err.message || 'Failed to update name')
    } finally {
      setSavingName(false)
    }
  }

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordMsg('')
    setPasswordError('')

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    setSavingPassword(true)
    try {
      const { error } = await updatePassword(currentPassword, newPassword)
      if (error) throw error
      setPasswordMsg('Password updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordMsg(''), 3000)
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <AuthGuard>
      <div>
        <div className="page-header">
          <h1>Profile</h1>
        </div>

        <div className="card" style={{ maxWidth: '480px', marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>Account</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Signed in as <strong style={{ color: 'var(--text-main)' }}>{user?.email}</strong>
          </p>
          <form onSubmit={handleUpdateName}>
            <label htmlFor="fullName" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>
              Display name
            </label>
            <input
              id="fullName"
              className="input-field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Display name"
            />
            {nameError && (
              <p style={{ color: 'var(--danger)', marginTop: 0 }}>{nameError}</p>
            )}
            {nameMsg && (
              <p style={{ color: 'var(--success)', marginTop: 0 }}>{nameMsg}</p>
            )}
            <button type="submit" className="btn-primary" disabled={savingName}>
              {savingName ? 'Saving...' : 'Save Name'}
            </button>
          </form>
        </div>

        <div className="card" style={{ maxWidth: '480px' }}>
          <h3 style={{ marginTop: 0 }}>Change Password</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Enter your current password, then choose a new one.
          </p>
          <form onSubmit={handleUpdatePassword}>
            <label htmlFor="currentPassword" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>
              Current password
            </label>
            <input
              id="currentPassword"
              type="password"
              className="input-field"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            <label htmlFor="newPassword" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              className="input-field"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />

            <label htmlFor="confirmPassword" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              className="input-field"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />

            {passwordError && (
              <p style={{ color: 'var(--danger)', marginTop: 0 }}>{passwordError}</p>
            )}
            {passwordMsg && (
              <p style={{ color: 'var(--success)', marginTop: 0 }}>{passwordMsg}</p>
            )}

            <button type="submit" className="btn-primary" disabled={savingPassword}>
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </AuthGuard>
  )
}
