import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import type { Sale, Buyer, Material } from "@/types/database"
import { Save, Banknote, List, ChevronDown, Plus, Edit2, Trash2, Search, X } from "lucide-react"
import { toast } from "sonner"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"

type SalesItem = { name: string, quantity: number, rate: number, total: number }

const formatInr = (value: number) => {
  return new Intl.NumberFormat('en-IN').format(value)
}

export function Sales() {
  const { lang } = useOutletContext<{ lang: "en" | "te" }>()
  const [salesList, setSalesList] = useState<Sale[]>([])
  
  // Buyer state
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [isBuyerDropdownOpen, setIsBuyerDropdownOpen] = useState(false)
  const [buyerSearch, setBuyerSearch] = useState("")
  const [isBuyerModalOpen, setIsBuyerModalOpen] = useState(false)
  const [editingBuyer, setEditingBuyer] = useState<Buyer | null>(null)
  const [buyerFormName, setBuyerFormName] = useState("")
  const [buyerFormNameTe, setBuyerFormNameTe] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Sales Item State
  const [availableMaterials, setAvailableMaterials] = useState<Material[]>([])
  const [selectedItems, setSelectedItems] = useState<SalesItem[]>([])
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [itemSearch, setItemSearch] = useState("")

  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [factoryName, setFactoryName] = useState("")
  const [remarks, setRemarks] = useState("")

  const [loading, setLoading] = useState(false)
  const [savedSaleId, setSavedSaleId] = useState<string | null>(null)

  useEffect(() => {
    loadSales()
    loadBuyers()
    loadMaterials()
    
    // Close dropdown on outside click
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsBuyerDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const loadSales = async () => {
    const { data } = await supabase.from('sales').select('*').order('date', { ascending: false }).limit(10)
    if (data) setSalesList(data)
  }

  const loadBuyers = async () => {
    const { data } = await supabase.from('buyers').select('*').order('name')
    if (data && data.length === 0) {
      const defaultBuyers = [
        { name: 'Babi Garu [Rjy]' }, { name: 'Subuid Garu' }, { name: 'Ranga Garu [Rajolu]' },
        { name: 'Raju Garu [Box]' }, { name: 'Lokesh Garu' }, { name: 'Satya Narayana Garu [Books]' },
        { name: 'Prasadh Garu [Jrg]' }, { name: 'Krishna Garu [Nsp]' }
      ]
      await supabase.from('buyers').insert(defaultBuyers)
      const { data: freshData } = await supabase.from('buyers').select('*').order('name')
      if (freshData) setBuyers(freshData)
    } else if (data) {
      setBuyers(data)
    }
  }

  const loadMaterials = async () => {
    const { data } = await supabase.from('materials').select('*').order('category').order('name')
    if (data) setAvailableMaterials(data)
  }

  const handleSaveBuyer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!buyerFormName.trim()) return toast.error("Buyer name cannot be empty")
    try {
      const payload = { name: buyerFormName, name_te: buyerFormNameTe }
      if (editingBuyer) {
        await supabase.from('buyers').update(payload).eq('id', editingBuyer.id)
        toast.success(t("successUpdate", lang))
        if (factoryName === editingBuyer.name) setFactoryName(buyerFormName)
      } else {
        await supabase.from('buyers').insert([payload])
        toast.success(t("successSave", lang))
      }
      setBuyerFormName("")
      setBuyerFormNameTe("")
      setEditingBuyer(null)
      loadBuyers()
    } catch (err: any) {
      toast.error(err.message || "Error saving buyer")
    }
  }

  const handleDeleteBuyer = async (id: string, name: string) => {
    if (!confirm(`Delete buyer "${name}"?`)) return
    try {
      await supabase.from('buyers').delete().eq('id', id)
      toast.success("Buyer deleted")
      if (factoryName === name) setFactoryName("")
      loadBuyers()
    } catch (err: any) {
      toast.error("Error deleting buyer")
    }
  }

  const handleAddItem = (itemName: string) => {
    if (selectedItems.some(i => i.name === itemName)) {
      return toast.error("This item has already been added.")
    }
    setSelectedItems(prev => [...prev, { name: itemName, quantity: 0, rate: 0, total: 0 }])
    setIsItemModalOpen(false)
    setItemSearch("")
  }

  const updateItem = (index: number, field: keyof SalesItem, value: number) => {
    setSelectedItems(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      if (field === 'quantity' || field === 'rate') {
        copy[index].total = Number((copy[index].quantity * copy[index].rate).toFixed(2))
      }
      return copy
    })
  }

  const removeItem = (index: number) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index))
  }

  const totalQuantity = selectedItems.reduce((sum, i) => sum + i.quantity, 0)
  const grandTotal = selectedItems.reduce((sum, i) => sum + i.total, 0)

  const handleSaveSale = async () => {
    if (!factoryName) return toast.error("Please select a Buyer / Factory")
    if (selectedItems.length === 0) return toast.error("Please add at least one item")
    if (totalQuantity <= 0) return toast.error("Please enter quantities greater than 0")
    if (grandTotal <= 0) return toast.error("Total amount must be greater than 0")

    setLoading(true)
    try {
      const itemsToSave = selectedItems.filter(i => i.quantity > 0)
      const itemsJson = itemsToSave.reduce((acc, curr) => ({ ...acc, [curr.name]: curr }), {})

      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{
          date,
          buyer_name: factoryName,
          total_amount: grandTotal,
          payment_status: 'Pending',
          remarks,
          items: itemsJson,
          invoice_number: invoiceNumber
        }])
        .select()
        .single()

      if (saleError) throw saleError

      toast.success("Sales Invoice recorded successfully!")
      setSavedSaleId(saleData.id)
      loadSales()
    } catch (err: any) {
      toast.error(err.message || "Error saving sale")
    } finally {
      setLoading(false)
    }
  }

  const resetFormForAnotherBill = () => {
    setSelectedItems([])
    setRemarks("")
    setSavedSaleId(null)
  }



  // Group items by category for the modal
  const groupedMaterials = availableMaterials
    .filter(m => m.name.toLowerCase().includes(itemSearch.toLowerCase()) || m.category.toLowerCase().includes(itemSearch.toLowerCase()))
    .reduce((acc, curr) => {
      if (!acc[curr.category]) acc[curr.category] = []
      acc[curr.category].push(curr)
      return acc
    }, {} as Record<string, Material[]>)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Sales & Dispatch</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sales Form */}
        <div className="bg-card p-6 rounded-xl border shadow-sm md:col-span-3 space-y-4 min-h-[500px]">
          <h2 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center">
            <Banknote className="w-5 h-5 mr-2 text-primary" /> Invoice Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative" ref={dropdownRef}>
              <label className="block text-sm font-medium mb-1">Buyer / Factory *</label>
              <div 
                className={`w-full border p-2 rounded flex justify-between items-center cursor-pointer bg-background ${!!savedSaleId ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => setIsBuyerDropdownOpen(!isBuyerDropdownOpen)}
              >
                <span className={factoryName ? "" : "text-muted-foreground"}>{factoryName || "Select Buyer"}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </div>
              
              {isBuyerDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-hidden flex flex-col">
                  <div className="p-2 border-b flex items-center sticky top-0 bg-background">
                    <Search className="w-4 h-4 text-muted-foreground mr-2" />
                    <input 
                      type="text" 
                      placeholder="Search..." 
                      className="w-full text-sm outline-none bg-transparent"
                      value={buyerSearch}
                      onChange={e => setBuyerSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {buyers.filter(b => b.name.toLowerCase().includes(buyerSearch.toLowerCase()) || (b.name_te && b.name_te.includes(buyerSearch))).map(buyer => (
                      <div 
                        key={buyer.id} 
                        className="px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                        onClick={() => {
                          setFactoryName(buyer.name)
                          setIsBuyerDropdownOpen(false)
                          setBuyerSearch("")
                        }}
                      >
                        {lang === 'te' && buyer.name_te ? buyer.name_te : buyer.name}
                      </div>
                    ))}
                  </div>
                  <div 
                    className="p-2 border-t bg-muted/50 text-sm font-medium text-primary hover:bg-muted flex items-center justify-center cursor-pointer sticky bottom-0"
                    onClick={() => {
                      setIsBuyerDropdownOpen(false)
                      setIsBuyerModalOpen(true)
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" /> {t("addBuyer", lang)}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date *</label>
              <input type="date" className="w-full border p-2 rounded" value={date} onChange={e => setDate(e.target.value)} disabled={!!savedSaleId} />
            </div>
          </div>

          {/* Dynamic Item Entry */}
          <div className="mt-8 border rounded-lg overflow-hidden">
            <div className="bg-muted p-3 flex justify-between items-center border-b">
              <h3 className="font-semibold">Invoice Items</h3>
              {!savedSaleId && (
                <button onClick={() => setIsItemModalOpen(true)} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm flex items-center font-medium hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-1" /> Add Item
                </button>
              )}
            </div>
            <div className="overflow-x-auto min-h-[150px]">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-4 py-2">Item Name</th>
                    <th className="px-4 py-2 w-32">Quantity</th>
                    <th className="px-4 py-2 w-32">Rate (₹)</th>
                    <th className="px-4 py-2 text-right w-32">Amount</th>
                    {!savedSaleId && <th className="px-4 py-2 text-right w-16"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedItems.map((item, index) => (
                    <tr key={index} className="hover:bg-muted/10">
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-2">
                        <input type="number" className="w-full border p-1.5 rounded text-sm" value={item.quantity || ""} onChange={e => updateItem(index, 'quantity', Number(e.target.value))} disabled={!!savedSaleId} placeholder="0" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" className="w-full border p-1.5 rounded text-sm" value={item.rate || ""} onChange={e => updateItem(index, 'rate', Number(e.target.value))} disabled={!!savedSaleId} placeholder="0.00" />
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-primary">₹{formatInr(item.total)}</td>
                      {!savedSaleId && (
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {selectedItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No items added yet. Click "+ Add Item" to begin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-medium mb-1">Remarks</label>
              <textarea className="w-full border p-2 rounded text-sm" rows={4} value={remarks} onChange={e => setRemarks(e.target.value)} disabled={!!savedSaleId} />
            </div>
            
            <div className="space-y-3 bg-muted/30 p-4 rounded-lg border">
              <div className="flex justify-between items-center text-sm font-bold">
                <span>Total Quantity:</span>
                <span className="text-primary">{totalQuantity} Units</span>
              </div>
              <div className="border-t my-2 pt-2"></div>
              <div className="flex justify-between items-center text-lg font-bold">
                <span>Grand Total:</span>
                <span className="text-primary text-2xl">₹{formatInr(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Sidebar */}
        <div className="space-y-6">
          <div className="bg-card p-6 rounded-xl border shadow-sm flex flex-col gap-3">
            {!savedSaleId ? (
              <button onClick={handleSaveSale} disabled={loading} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium flex justify-center items-center hover:bg-primary/90 disabled:opacity-50">
                <Save className="w-5 h-5 mr-2" /> {loading ? "Saving..." : "Save Invoice"}
              </button>
            ) : (
                <button onClick={resetFormForAnotherBill} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium flex justify-center items-center hover:bg-blue-700">
                  <Save className="w-4 h-4 mr-2" /> Another Bill
                </button>
            )}
          </div>
          
          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <h2 className="font-semibold mb-4 flex items-center border-b pb-2">
              <List className="w-4 h-4 mr-2" /> Recent Sales
            </h2>
            <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2">
              {salesList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent sales.</p>
              ) : salesList.map(sale => (
                <div key={sale.id} className="border p-3 rounded-lg flex justify-between items-center text-sm bg-muted/30">
                  <div>
                    <div className="font-semibold text-primary">{sale.buyer_name}</div>
                    <div className="text-xs text-muted-foreground">{sale.date} {sale.invoice_number ? `• ${sale.invoice_number}` : ''}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">₹{formatInr(sale.total_amount)}</div>
                    <div className={`text-xs ${sale.payment_status === 'Completed' ? 'text-green-600' : 'text-orange-500'}`}>{sale.payment_status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Item Selector Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-lg rounded-lg shadow-lg flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-muted/30">
              <h2 className="text-lg font-bold">Select Sales Item</h2>
              <button onClick={() => {setIsItemModalOpen(false); setItemSearch("");}} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-4 border-b bg-muted/10 relative">
              <Search className="w-4 h-4 absolute left-7 top-7 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search items by name or category..." 
                className="w-full border p-2 pl-9 rounded-md text-sm"
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="overflow-y-auto p-4 flex-1 space-y-6 bg-muted/5">
              {Object.keys(groupedMaterials).length === 0 && (
                <div className="text-center text-muted-foreground py-8">No items match your search.</div>
              )}
              {Object.entries(groupedMaterials).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-sm font-bold text-primary border-b pb-1 mb-2">{category}</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {items.map(item => (
                      <button 
                        key={item.id} 
                        onClick={() => handleAddItem(item.name)}
                        className="text-left p-3 rounded border bg-card hover:border-primary hover:shadow-sm transition-all flex justify-between items-center"
                      >
                        <span className="font-medium text-sm">{item.name}</span>
                        <Plus className="w-4 h-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t bg-muted/30 text-xs text-center text-muted-foreground">
              To add new items or categories, visit Settings → Sales Items.
            </div>
          </div>
        </div>
      )}

      {/* Buyer CRUD Modal */}
      {isBuyerModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-lg rounded-lg shadow-lg flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-muted/30">
              <h2 className="text-lg font-bold">Manage Buyers</h2>
              <button onClick={() => { setIsBuyerModalOpen(false); setEditingBuyer(null); setBuyerFormName(""); }} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-4 border-b bg-muted/10">
              <form onSubmit={handleSaveBuyer} className="flex flex-col gap-2">
                <input 
                  type="text" 
                  placeholder={t("name", lang)} 
                  className="w-full border p-2 rounded text-sm"
                  value={buyerFormName}
                  onChange={e => setBuyerFormName(e.target.value)}
                  required
                />
                <input 
                  type="text" 
                  placeholder={t("nameTe", lang)} 
                  className="w-full border p-2 rounded text-sm"
                  value={buyerFormNameTe}
                  onChange={e => setBuyerFormNameTe(e.target.value)}
                />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:bg-primary/90">
                    {editingBuyer ? t("update", lang) : t("save", lang)}
                  </button>
                  {editingBuyer && (
                    <button type="button" onClick={() => { setEditingBuyer(null); setBuyerFormName(""); setBuyerFormNameTe(""); }} className="flex-1 px-3 py-2 border rounded text-sm hover:bg-muted">{t("cancel", lang)}</button>
                  )}
                </div>
              </form>
            </div>
            
            <div className="overflow-y-auto p-4 flex-1">
              <table className="w-full text-sm text-left border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2">{t("name", lang)}</th>
                    <th className="px-4 py-2">{t("nameTe", lang)}</th>
                    <th className="px-4 py-2 text-right w-24">{t("actions", lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {buyers.filter(b => b.name.toLowerCase().includes(buyerSearch.toLowerCase()) || (b.name_te && b.name_te.includes(buyerSearch))).map(buyer => (
                    <tr key={buyer.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{buyer.name}</td>
                      <td className="px-4 py-3 font-medium">{buyer.name_te || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => { setEditingBuyer(buyer); setBuyerFormName(buyer.name); setBuyerFormNameTe(buyer.name_te || ""); }} 
                          className="text-blue-600 hover:bg-blue-50 p-1.5 rounded mr-1"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteBuyer(buyer.id, buyer.name)} 
                          className="text-red-600 hover:bg-red-50 p-1.5 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {buyers.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-muted-foreground">No buyers found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
