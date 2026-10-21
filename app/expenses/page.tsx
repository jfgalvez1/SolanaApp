'use client'
import { useEffect, useState, FormEvent, ChangeEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import AuthGuard from '../../components/AuthGuard'
import { useProperty } from '../../components/PropertyProvider'
import { Database } from '../../lib/database.types'
import { addMonths, eachMonthOfInterval, format, isSameMonth, max, min, parseISO, startOfMonth, startOfYear } from 'date-fns'

type Expense = Database['public']['Tables']['expenses']['Row']
type NewExpense = Database['public']['Tables']['expenses']['Insert']

export default function Expenses() {
  const { currentProperty } = useProperty()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [formData, setFormData] = useState<Omit<NewExpense, 'id' | 'created_at' | 'user_id' | 'property_id'>>({
    description: '',
    amount: 0,
    category: 'other',
    date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (currentProperty) {
      fetchExpenses()
    }
  }, [currentProperty])

  const fetchExpenses = async () => {
    if (!currentProperty) return
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('property_id', currentProperty.id)
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
    if (!currentProperty) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user')

      const newExpense: NewExpense = {
        ...formData,
        user_id: user.id,
        property_id: currentProperty.id
      }

      let error
      if (editingId) {
        const { error: updateError } = await supabase
          .from('expenses')
          .update(newExpense)
          .eq('id', editingId)
        error = updateError
      } else {
        const { error: insertError } = await supabase
          .from('expenses')
          .insert([newExpense])
        error = insertError
      }
      
      if (error) throw error
      
      setShowForm(false)
      setEditingId(null)
      setFormData({ description: '', amount: 0, category: 'other', date: new Date().toISOString().split('T')[0] })
      fetchExpenses()
    } catch (error: any) {
      alert('Error saving expense: ' + error.message)
    }
  }

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id)
    setFormData({
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      date: expense.date
    })
    setShowForm(true)
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

  const expenseMonthDates = expenses
    .filter(item => item.date)
    .map(item => startOfMonth(parseISO(item.date)))
  const monthOptions = eachMonthOfInterval({
    start: min([startOfYear(new Date()), ...expenseMonthDates]),
    end: max([addMonths(new Date(), 12), ...expenseMonthDates]),
  })
  const selectedMonthDate = parseISO(`${selectedMonth}-01`)
  const monthlyExpenses = expenses.filter(item => item.date && isSameMonth(parseISO(item.date), selectedMonthDate))
  const sumAmounts = (rows: Expense[]) => rows.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const monthlyTotal = sumAmounts(monthlyExpenses)
  const overallTotal = sumAmounts(expenses)

  const renderExpenseTable = (rows: Expense[], emptyLabel: string) => (
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
          {rows.length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign: 'center' }}>{emptyLabel}</td></tr>
          ) : rows.map(item => (
            <tr key={item.id}>
              <td>{item.date}</td>
              <td>{item.description}</td>
              <td style={{ textTransform: 'capitalize' }}>{item.category}</td>
              <td style={{ fontWeight: '500', color: 'var(--danger)' }}>-₱{item.amount}</td>
              <td>
                <button className="btn-primary" style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => handleEdit(item)}>Edit</button>
                <button className="btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => handleDelete(item.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <AuthGuard>
      <div>
        <div className="page-header month-selector-header">
          <h1 style={{ marginBottom: 0 }}>Expenses{currentProperty ? ` — ${currentProperty.name}` : ''}</h1>
          <div className="month-selector" style={{ flexWrap: 'wrap' }}>
            <label htmlFor="expense-month">Month:</label>
            <select
              id="expense-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {monthOptions.map(date => (
                <option key={format(date, 'yyyy-MM')} value={format(date, 'yyyy-MM')}>
                  {format(date, 'MMMM yyyy')}
                </option>
              ))}
            </select>
            <button className="btn-primary" onClick={() => {
              setShowForm(!showForm)
              if (showForm) {
                setEditingId(null)
                setFormData({ description: '', amount: 0, category: 'other', date: new Date().toISOString().split('T')[0] })
              }
            }}>
              {showForm ? 'Cancel' : '+ Record Expense'}
            </button>
          </div>
        </div>

        {showForm && (
          <div className="card">
            <h3>{editingId ? 'Edit Expense' : 'Record Expense'}</h3>
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
              <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>{editingId ? 'Update' : 'Save'} Expense</button>
            </form>
          </div>
        )}

        {loading ? <p>Loading...</p> : (
          <>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>
              {format(selectedMonthDate, 'MMMM yyyy')}
            </h2>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3>Expenses this month</h3>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>-₱{monthlyTotal.toFixed(2)}</div>
              <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>
                {monthlyExpenses.length} {monthlyExpenses.length === 1 ? 'expense' : 'expenses'}
              </p>
            </div>
            {renderExpenseTable(monthlyExpenses, `No expenses in ${format(selectedMonthDate, 'MMMM yyyy')}.`)}

            <h2 style={{ fontSize: '1.25rem', margin: '0.5rem 0 1rem', color: 'var(--text-muted)' }}>All Expenses</h2>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3>Total expenses</h3>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>-₱{overallTotal.toFixed(2)}</div>
              <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)' }}>
                {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
              </p>
            </div>
            {renderExpenseTable(expenses, 'No expenses found.')}
          </>
        )}
      </div>
    </AuthGuard>
  )
}
