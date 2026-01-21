'use client'
import { useEffect, useState, FormEvent, ChangeEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import AuthGuard from '../../components/AuthGuard'
import { Database } from '../../lib/database.types'

type Expense = Database['public']['Tables']['expenses']['Row']
type NewExpense = Database['public']['Tables']['expenses']['Insert']

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<Omit<NewExpense, 'id' | 'created_at' | 'user_id'>>({
    description: '',
    amount: 0,
    category: 'other',
    date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    fetchExpenses()
  }, [])

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false })
      
      if (error) throw error
      setExpenses(data || [])
    } catch (error) {
      console.error('Error fetching expenses:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user')

      const newExpense: NewExpense = {
        ...formData,
        user_id: user.id
      }

      const { error } = await (supabase as any)
        .from('expenses')
        .insert([newExpense])
      
      if (error) throw error
      
      setShowForm(false)
      setFormData({ description: '', amount: 0, category: 'other', date: new Date().toISOString().split('T')[0] })
      fetchExpenses()
    } catch (error: any) {
      alert('Error creating expense: ' + error.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense?')) return
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
      fetchExpenses()
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.name === 'amount' ? Number(e.target.value) : e.target.value
    setFormData({ ...formData, [e.target.name]: value })
  }

  return (
    <AuthGuard>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1>Expenses</h1>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Record Expense'}
          </button>
        </div>

        {showForm && (
          <div className="card">
            <h3>Record Expense</h3>
            <form onSubmit={handleCreate}>
              <div className="grid-3">
                <input name="description" placeholder="Description" value={formData.description} onChange={handleChange} className="input-field" required />
                <input name="amount" type="number" placeholder="Amount" value={formData.amount || ''} onChange={handleChange} className="input-field" required />
                <select name="category" value={formData.category} onChange={handleChange} className="input-field">
                  <option value="maintenance">Maintenance</option>
                  <option value="supplies">Supplies</option>
                  <option value="utilities">Utilities</option>
                  <option value="other">Other</option>
                </select>
                <input name="date" type="date" value={formData.date || ''} onChange={handleChange} className="input-field" required />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>Save Expense</button>
            </form>
          </div>
        )}

        {loading ? <p>Loading...</p> : (
          <div className="card table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center' }}>No expenses found.</td></tr>
                ) : expenses.map(item => (
                  <tr key={item.id}>
                    <td>{item.date}</td>
                    <td>{item.description}</td>
                    <td style={{ textTransform: 'capitalize' }}>{item.category}</td>
                    <td style={{ fontWeight: '500', color: 'var(--danger)' }}>-${item.amount}</td>
                    <td>
                      <button className="btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => handleDelete(item.id)}>Delete</button>
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
