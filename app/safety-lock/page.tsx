'use client'
import { useState, useEffect, FormEvent } from 'react'
import AuthGuard from '../../components/AuthGuard'
import { supabase } from '../../lib/supabaseClient'
import { Database } from '../../lib/database.types'

export default function SafetyLock() {
  const [lockCode, setLockCode] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentCode, setCurrentCode] = useState<string | null>(null)

  useEffect(() => {
    fetchSafetyCode()
  }, [])

  const fetchSafetyCode = async () => {
    try {
      setIsLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single<any>()

      if (error) {
        if (error.code !== 'PGRST116') { // PGRST116 means zero rows found, we can safely ignore if profile doesn't exist yet but user is auth
          throw error
        }
      }

      if (data && data.safety_code) {
        setCurrentCode(data.safety_code)
        // Also prefill input with current code if they edit later
        setLockCode(data.safety_code)
      } else {
        // Automatically open edit mode if no code is set
        setIsEditing(true)
      }
    } catch (error: any) {
      console.error('Error fetching safety code:', error)
      setErrorMsg('Failed to fetch code. ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    
    // Validate that it's exactly 4 digits
    if (!/^\d{4}$/.test(lockCode)) {
      setErrorMsg('Safety lock code must be exactly 4 digits.')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Upsert profile data
      const payload: Database['public']['Tables']['profiles']['Update'] = {
        id: user.id, 
        safety_code: lockCode,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('profiles')
        .upsert(payload as any)

      if (error) throw error

      setSuccessMsg('Safety lock code saved successfully!')
      setCurrentCode(lockCode)
      setIsEditing(false) // Switch back to view mode
      
      // Hide success message after 3 seconds
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (error: any) {
      console.error('Error saving safety code:', error)
      setErrorMsg('Failed to save code. ' + error.message)
    }
  }

  return (
    <AuthGuard>
      <div>
        <div className="page-header">
          <h1>Safety Lock</h1>
        </div>

        <div className="card" style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
          {isLoading ? (
            <p>Loading your safety code...</p>
          ) : (
             <>
               {isEditing ? (
                 <>
                   <h3>{currentCode ? 'Update Safety Lock' : 'Set Safety Lock'}</h3>
                   
                   {errorMsg && (
                     <p style={{ color: 'var(--danger)', marginBottom: '1rem', fontWeight: '500' }}>
                       {errorMsg}
                     </p>
                   )}

                   <form onSubmit={handleSave}>
                     <div style={{ marginBottom: '1rem' }}>
                       <label htmlFor="lockCode" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                         4-Digit Code
                       </label>
                       <input
                         id="lockCode"
                         type="text"
                         maxLength={4}
                         value={lockCode}
                         onChange={(e) => setLockCode(e.target.value.replace(/\D/g, ''))}
                         placeholder="Enter 4 digits"
                         className="input-field"
                         required
                         style={{ fontSize: '1.5rem', letterSpacing: '0.25rem', textAlign: 'center' }}
                       />
                     </div>
                     
                     <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {currentCode && (
                          <button 
                            type="button" 
                            className="btn-primary" 
                            style={{ flex: 1, backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                            onClick={() => {
                              setIsEditing(false)
                              setLockCode(currentCode) // Reset un-saved changes
                              setErrorMsg('')
                            }}
                          >
                            Cancel
                          </button>
                        )}
                        <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                          Save Code
                        </button>
                     </div>
                   </form>
                 </>
               ) : (
                 <>
                   <h3>Current Safety Lock</h3>
                   <div style={{
                     margin: '2rem 0',
                     padding: '1.5rem',
                     backgroundColor: 'var(--surface)',
                     borderRadius: '8px',
                     border: '1px solid var(--border)'
                   }}>
                     <span style={{ 
                       fontSize: '3rem', 
                       fontWeight: 'bold', 
                       letterSpacing: '0.5rem',
                       color: 'var(--text)'
                     }}>
                       {currentCode}
                     </span>
                   </div>
                   
                   <button 
                     type="button" 
                     className="btn-primary" 
                     style={{ width: '100%' }}
                     onClick={() => setIsEditing(true)}
                   >
                     Edit Code
                   </button>
                   
                   {successMsg && (
                     <p style={{ marginTop: '1rem', color: 'var(--success, green)', fontWeight: '500' }}>
                       {successMsg}
                     </p>
                   )}
                 </>
               )}
             </>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
