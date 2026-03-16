'use client'
import { useState, useEffect, FormEvent } from 'react'
import AuthGuard from '../../components/AuthGuard'
import { supabase } from '../../lib/supabaseClient'
import { Database } from '../../lib/database.types'

type InventoryItem = Database['public']['Tables']['inventory']['Row']
type SalesLogItem = Database['public']['Tables']['sales_log']['Row'] & {
  inventory: { product_name: string } | null
}

export default function Tracker() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'sales'>('inventory')
  
  // Inventory State
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [isLoadingInventory, setIsLoadingInventory] = useState(true)
  const [invForm, setInvForm] = useState({ product_name: '', cost: '', price: '', stock: '' })
  const [editingInvId, setEditingInvId] = useState<string | null>(null)
  
  // Sales Log State
  const [sales, setSales] = useState<SalesLogItem[]>([])
  const [isLoadingSales, setIsLoadingSales] = useState(true)
  const [saleForm, setSaleForm] = useState({ inventory_id: '', quantity_sold: '1' })
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null)
  
  // Track original sale details for calculating stock/profit differences on edit
  const [originalSaleCtx, setOriginalSaleCtx] = useState<{ id: string, qty: number, inv_id: string } | null>(null)

  useEffect(() => {
    fetchInventory()
    fetchSales()
  }, [])

  const fetchInventory = async () => {
    try {
      setIsLoadingInventory(true)
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setInventory(data || [])
    } catch (error: any) {
      console.error('Error fetching inventory:', error)
    } finally {
      setIsLoadingInventory(false)
    }
  }

  const fetchSales = async () => {
    try {
      setIsLoadingSales(true)
      const { data, error } = await supabase
        .from('sales_log')
        // Using a join to fetch the related product name
        .select(`
          *,
          inventory ( product_name )
        `)
        .order('created_at', { ascending: false })
      if (error) throw error
      setSales(data as SalesLogItem[] || [])
    } catch (error: any) {
      console.error('Error fetching sales:', error)
    } finally {
      setIsLoadingSales(false)
    }
  }

  const handleAddInventory = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const insertPayload: Database['public']['Tables']['inventory']['Insert'] = {
        user_id: user.id,
        product_name: invForm.product_name,
        cost: Number(invForm.cost),
        price: Number(invForm.price),
        stock: Number(invForm.stock)
      }

      const updatePayload = {
        product_name: invForm.product_name,
        cost: Number(invForm.cost),
        price: Number(invForm.price),
        stock: Number(invForm.stock)
      }

      if (editingInvId) {
        const { error } = await supabase
          .from('inventory')
          // @ts-expect-error - Expected type mismatch due to Supabase type generation generic inference failing
          .update(updatePayload)
          .eq('id', editingInvId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('inventory')
          // @ts-expect-error - Expected type mismatch
          .insert([insertPayload])
        if (error) throw error
      }

      setInvForm({ product_name: '', cost: '', price: '', stock: '' })
      setEditingInvId(null)
      fetchInventory()
      fetchSales() // In case price/cost updates affect profit display context
    } catch (error: any) {
      alert('Error saving product: ' + error.message)
    }
  }

  const handleEditInv = (item: InventoryItem) => {
    setEditingInvId(item.id)
    setInvForm({
      product_name: item.product_name,
      cost: item.cost.toString(),
      price: item.price.toString(),
      stock: item.stock.toString()
    })
  }

  const handleDeleteInv = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product? This may fail if there are sales records linked to it.')) return;
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', id)
      if (error) throw error
      fetchInventory()
    } catch (error: any) {
      alert('Error deleting product: ' + error.message)
    }
  }

  const handleRecordSale = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const selectedProduct = inventory.find(i => i.id === saleForm.inventory_id)
      if (!selectedProduct) throw new Error('Please select a valid product')

      const qty = Number(saleForm.quantity_sold)
      const profitPerItem = selectedProduct.price - selectedProduct.cost
      const totalProfitForSale = profitPerItem * qty

      if (editingSaleId && originalSaleCtx) {
        // --- EDIT EXISTING SALE ---
        // 1. Calculate difference in quantity sold
        const qtyDiff = qty - originalSaleCtx.qty
        
        // Check if there's enough stock for the INCREASE in sales quantity
        if (qtyDiff > 0 && qtyDiff > selectedProduct.stock) {
           throw new Error(`Cannot increase sale by ${qtyDiff}. Only ${selectedProduct.stock} items available in stock.`)
        }

        // 2. Update the sale record
        const saleUpdatePayload: Database['public']['Tables']['sales_log']['Update'] = {
          inventory_id: selectedProduct.id,
          quantity_sold: qty,
          profit: totalProfitForSale
        }
        
        const { error: saleEditError } = await supabase
          .from('sales_log')
          // @ts-expect-error - Expected type mismatch
          .update(saleUpdatePayload)
          .eq('id', editingSaleId)
          
        if (saleEditError) throw saleEditError

        // 3. Adjust the inventory stock by the difference
        const invUpdatePayload: Database['public']['Tables']['inventory']['Update'] = {
          stock: selectedProduct.stock - qtyDiff
        }
        
        const { error: invEditError } = await supabase
          .from('inventory')
          // @ts-expect-error - Expected type mismatch
          .update(invUpdatePayload)
          .eq('id', selectedProduct.id)
          
        if (invEditError) throw invEditError
        
      } else {
        // --- CREATE NEW SALE ---
        if (qty > selectedProduct.stock) {
          throw new Error(`Cannot sell more than available stock (${selectedProduct.stock})`)
        }

        const salePayload: Database['public']['Tables']['sales_log']['Insert'] = {
          user_id: user.id,
          inventory_id: selectedProduct.id,
          quantity_sold: qty,
          profit: totalProfitForSale
        }
        
        const { error: saleError } = await supabase
          .from('sales_log')
          // @ts-expect-error - Expected type mismatch
          .insert([salePayload])
        
        if (saleError) throw saleError

        const updatePayload: Database['public']['Tables']['inventory']['Update'] = {
          stock: selectedProduct.stock - qty
        }
        
        const { error: updateError } = await supabase
          .from('inventory')
          // @ts-expect-error - Expected type mismatch
          .update(updatePayload)
          .eq('id', selectedProduct.id)

        if (updateError) throw updateError
      }

      setSaleForm({ inventory_id: '', quantity_sold: '1' })
      setEditingSaleId(null)
      setOriginalSaleCtx(null)
      fetchInventory()
      fetchSales()
    } catch (error: any) {
      alert('Error recording sale: ' + error.message)
    }
  }

  const handleEditSale = (sale: SalesLogItem) => {
    setEditingSaleId(sale.id)
    setOriginalSaleCtx({ id: sale.id, qty: sale.quantity_sold, inv_id: sale.inventory_id })
    setSaleForm({
      inventory_id: sale.inventory_id,
      quantity_sold: sale.quantity_sold.toString()
    })
  }

  const handleDeleteSale = async (sale: SalesLogItem) => {
    if (!window.confirm('Are you sure you want to delete this sales record? The stock quantity will be returned to the inventory.')) return;
    
    try {
      // 1. Delete the sale record
      const { error: deleteError } = await supabase.from('sales_log').delete().eq('id', sale.id)
      if (deleteError) throw deleteError

      // 2. Return the stock back to inventory
      // First, get the current stock to ensure we return it accurately
      const { data: currentInvData } = await supabase
        .from('inventory')
        .select('stock')
        .eq('id', sale.inventory_id)
        .single<any>()
        
      if (currentInvData) {
        const returnPayload = { stock: currentInvData.stock + sale.quantity_sold }
        const { error: invError } = await supabase
          .from('inventory')
          // @ts-expect-error - expected mismatch
          .update(returnPayload)
          .eq('id', sale.inventory_id)
          
        if (invError) console.error("Warning: Deleted sale but failed to return stock", invError)
      }

      fetchInventory()
      fetchSales()
    } catch (error: any) {
      alert('Error deleting sale: ' + error.message)
    }
  }

  // Calculate overall metrics
  const totalSalesCount = sales.reduce((acc, sale) => acc + sale.quantity_sold, 0)
  const totalProfit = sales.reduce((acc, sale) => acc + Number(sale.profit), 0)

  return (
    <AuthGuard>
      <div>
        <div className="page-header">
          <h1>Digital Tracker</h1>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button 
            className={`btn-primary ${activeTab !== 'inventory' ? 'inactive' : ''}`}
            style={{ opacity: activeTab === 'inventory' ? 1 : 0.6 }}
            onClick={() => setActiveTab('inventory')}
          >
            Inventory
          </button>
          <button 
            className={`btn-primary ${activeTab !== 'sales' ? 'inactive' : ''}`}
            style={{ opacity: activeTab === 'sales' ? 1 : 0.6 }}
            onClick={() => setActiveTab('sales')}
          >
            Sales Log
          </button>
        </div>

        {activeTab === 'inventory' && (
          <div className="grid-2-dashboard">
            <div className="card">
              <h3>{editingInvId ? 'Edit Product' : 'Add New Product'}</h3>
              <form onSubmit={handleAddInventory}>
                <input 
                  type="text" 
                  placeholder="Product Name" 
                  value={invForm.product_name} 
                  onChange={e => setInvForm({...invForm, product_name: e.target.value})} 
                  className="input-field" 
                  style={{ marginBottom: '1rem' }}
                  required 
                />
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="Cost (₱)" 
                    value={invForm.cost} 
                    onChange={e => setInvForm({...invForm, cost: e.target.value})} 
                    className="input-field" 
                    required 
                  />
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="Selling Price (₱)" 
                    value={invForm.price} 
                    onChange={e => setInvForm({...invForm, price: e.target.value})} 
                    className="input-field" 
                    required 
                  />
                  <input 
                    type="number" 
                    placeholder="Initial Stock" 
                    value={invForm.stock} 
                    onChange={e => setInvForm({...invForm, stock: e.target.value})} 
                    className="input-field" 
                    required 
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {editingInvId && (
                    <button 
                      type="button" 
                      className="btn-primary" 
                      style={{ flex: 1, backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                      onClick={() => {
                        setEditingInvId(null)
                        setInvForm({ product_name: '', cost: '', price: '', stock: '' })
                      }}
                    >
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="btn-primary" style={{ flex: 2 }}>
                    {editingInvId ? 'Update Product' : 'Add to Inventory'}
                  </button>
                </div>
              </form>
            </div>

            <div className="card table-container">
              <h3>Current Stock</h3>
              {isLoadingInventory ? <p>Loading...</p> : (
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Cost</th>
                      <th>Price</th>
                      <th>Profit/Item</th>
                      <th>In Stock</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center' }}>No products added yet.</td></tr>
                    ) : inventory.map(item => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: '500' }}>{item.product_name}</td>
                        <td>₱{item.cost.toFixed(2)}</td>
                        <td>₱{item.price.toFixed(2)}</td>
                        <td style={{ color: 'var(--success)', fontWeight: '500' }}>
                          ₱{(item.price - item.cost).toFixed(2)}
                        </td>
                        <td>
                          <span style={{ 
                            padding: '0.25rem 0.75rem', 
                            backgroundColor: item.stock <= 5 ? 'var(--danger)' : 'var(--success)', 
                            color: 'white', 
                            borderRadius: '999px',
                            fontSize: '0.875rem'
                          }}>
                            {item.stock}
                          </span>
                        </td>
                        <td>
                          <button 
                            className="btn-primary" 
                            style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} 
                            onClick={() => handleEditInv(item)}
                          >
                            Edit
                          </button>
                          <button 
                            className="btn-danger" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} 
                            onClick={() => handleDeleteInv(item.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="grid-2-dashboard">
            <div className="card">
              <h3>Record a Sale</h3>
              {inventory.length === 0 ? (
                 <p style={{ color: 'var(--text-muted)' }}>You need to add products to the Inventory first before recording sales.</p>
              ) : (
                <form onSubmit={handleRecordSale}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Select Product</label>
                    <select 
                      value={saleForm.inventory_id} 
                      onChange={e => setSaleForm({...saleForm, inventory_id: e.target.value})} 
                      className="input-field"
                      required
                    >
                      <option value="">-- Choose Product --</option>
                      {inventory.filter(i => i.stock > 0).map(item => (
                        <option key={item.id} value={item.id}>
                          {item.product_name} (In stock: {item.stock}) - Price: ₱{item.price}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Quantity Sold</label>
                    <input 
                      type="number" 
                      min="1"
                      placeholder="1" 
                      value={saleForm.quantity_sold} 
                      onChange={e => setSaleForm({...saleForm, quantity_sold: e.target.value})} 
                      className="input-field" 
                      required 
                    />
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                    {editingSaleId ? 'Update Sale Record' : 'Log Sale & Subtract Stock'}
                  </button>
                  {editingSaleId && (
                    <button 
                      type="button" 
                      className="btn-danger" 
                      style={{ width: '100%', marginTop: '0.5rem', backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                      onClick={() => {
                        setEditingSaleId(null)
                        setOriginalSaleCtx(null)
                        setSaleForm({ inventory_id: '', quantity_sold: '1' })
                      }}
                    >
                      Cancel Edit
                    </button>
                  )}
                </form>
              )}
            </div>

            <div>
               <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="card" style={{ flex: 1 }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Items Sold</p>
                    <h2 style={{ fontSize: '2rem' }}>{totalSalesCount}</h2>
                  </div>
                  <div className="card" style={{ flex: 1, borderLeft: '4px solid var(--success)' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Profit</p>
                    <h2 style={{ fontSize: '2rem', color: 'var(--success)' }}>₱{totalProfit.toFixed(2)}</h2>
                  </div>
               </div>

              <div className="card table-container">
                <h3>Sales Log</h3>
                {isLoadingSales ? <p>Loading...</p> : (
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Profit Earned</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center' }}>No sales recorded yet.</td></tr>
                      ) : sales.map(sale => (
                        <tr key={sale.id} style={{ backgroundColor: editingSaleId === sale.id ? 'var(--bg-card-hover)' : 'transparent' }}>
                          <td>{new Date(sale.created_at).toLocaleDateString()}</td>
                          <td>{sale.inventory?.product_name || 'Unknown'}</td>
                          <td>{sale.quantity_sold}</td>
                          <td style={{ color: 'var(--success)', fontWeight: '500' }}>₱{Number(sale.profit).toFixed(2)}</td>
                          <td>
                            <button 
                              className="btn-primary" 
                              style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} 
                              onClick={() => handleEditSale(sale)}
                              disabled={!!editingSaleId}
                            >
                              Edit
                            </button>
                            <button 
                              className="btn-danger" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} 
                              onClick={() => handleDeleteSale(sale)}
                              disabled={!!editingSaleId}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
