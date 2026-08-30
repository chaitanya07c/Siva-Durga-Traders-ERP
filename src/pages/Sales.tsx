import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import type { Sale, Buyer, Material } from "@/types/database"
import { Save, Banknote, List, ChevronDown, Plus, Edit2, Trash2, Search, X, Printer, Download, Share2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"
import { formatVehicleNumber, isValidVehicleNumber, isValidDriverName, isValidDriverPhone, getItemUnit } from "@/lib/utils"
import { generateSalesCombinedPDF, shareSalesWhatsApp } from "@/lib/salesPdfUtils"
import type { GroupedSaleSession } from "@/lib/salesPdfUtils"
import { addToRecycleBin } from "@/lib/recycleBin"

type SalesItem = { name: string, quantity: number, rate: number, total: number, unit?: string }

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
  const [buyerFormMobile, setBuyerFormMobile] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Sales Item State
  const [availableMaterials, setAvailableMaterials] = useState<Material[]>([])
  const [selectedItems, setSelectedItems] = useState<SalesItem[]>([])
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [itemSearch, setItemSearch] = useState("")

  // Additional Expenses State
  const [additionalExpenses, setAdditionalExpenses] = useState<{ id: string, name: string, amount: number }[]>([])
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null)
  const [editingInvoiceNumber, setEditingInvoiceNumber] = useState<string | null>(null)

  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [factoryName, setFactoryName] = useState("")
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [driverName, setDriverName] = useState("")
  const [driverPhone, setDriverPhone] = useState("")
  const [remarks, setRemarks] = useState("")
  const [advance, setAdvance] = useState<number>(0)

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
    const cleanMobile = buyerFormMobile.trim().replace(/\D/g, '')
    if (cleanMobile && cleanMobile.length !== 10) {
      return toast.error("Phone Number must be exactly 10 digits")
    }

    try {
      const payload = { 
        name: buyerFormName.trim(), 
        name_te: buyerFormNameTe.trim() || null, 
        mobile: cleanMobile || null 
      }
      if (editingBuyer) {
        await supabase.from('buyers').update(payload).eq('id', editingBuyer.id)
        toast.success(t("successUpdate", lang))
        if (factoryName === editingBuyer.name) setFactoryName(buyerFormName.trim())
      } else {
        await supabase.from('buyers').insert([payload])
        toast.success(t("successSave", lang))
      }
      setBuyerFormName("")
      setBuyerFormNameTe("")
      setBuyerFormMobile("")
      setEditingBuyer(null)
      loadBuyers()
    } catch (err: any) {
      toast.error(err.message || "Error saving buyer")
    }
  }

  const handleDeleteBuyer = async (id: string, name: string) => {
    if (!confirm(`Delete buyer "${name}"?`)) return
    try {
      const { data: buyerData } = await supabase.from('buyers').select('*').eq('id', id).single()
      if (buyerData) {
        await addToRecycleBin({
          id: crypto.randomUUID(),
          type: 'buyer',
          item_id: buyerData.id,
          title: `Buyer: ${buyerData.name}`,
          amount: 0,
          data: { buyer: buyerData },
          deleted_at: new Date().toISOString()
        })
      }
      await supabase.from('buyers').delete().eq('id', id)
      toast.success("Buyer moved to Recycle Bin!")
      if (factoryName === name) setFactoryName("")
      loadBuyers()
    } catch (err: any) {
      toast.error("Error deleting buyer: " + (err.message || ""))
    }
  }

  const handleAddItem = (itemName: string) => {
    if (selectedItems.some(i => i.name === itemName)) {
      return toast.error("This item has already been added.")
    }
    const mat = availableMaterials.find(m => m.name === itemName)
    const defaultRate = mat && mat.default_cost !== undefined && mat.default_cost !== null ? Number(mat.default_cost) : 0
    const unit = mat?.unit || getItemUnit(itemName, 'sales', availableMaterials)
    setSelectedItems(prev => [...prev, { name: itemName, quantity: 0, rate: defaultRate, total: 0, unit }])
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

  const handleAddExpense = () => {
    setAdditionalExpenses(prev => [...prev, { id: crypto.randomUUID(), name: "", amount: 0 }])
  }

  const updateExpense = (id: string, field: 'name' | 'amount', value: any) => {
    setAdditionalExpenses(prev => prev.map(exp => {
      if (exp.id === id) {
        if (field === 'amount') {
          const numVal = Math.max(0, Number(value) || 0)
          return { ...exp, amount: numVal }
        }
        return { ...exp, [field]: value }
      }
      return exp
    }))
  }

  const removeExpense = (id: string) => {
    setAdditionalExpenses(prev => prev.filter(exp => exp.id !== id))
  }

  const totalQuantity = selectedItems.reduce((sum, i) => sum + i.quantity, 0)
  const itemsTotal = selectedItems.reduce((sum, i) => sum + i.total, 0)
  const additionalExpensesTotal = additionalExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const grandTotal = Number((itemsTotal + additionalExpensesTotal).toFixed(2))
  const advanceVal = Number(advance || 0)
  const remainingBalance = Math.max(0, Number((grandTotal - advanceVal).toFixed(2)))

  const handleSaveSale = async () => {
    if (!factoryName) return toast.error("Please select a Buyer / Factory")
    if (selectedItems.length === 0) return toast.error("Please add at least one item")
    if (totalQuantity <= 0) return toast.error("Please enter quantities greater than 0")
    if (grandTotal <= 0) return toast.error("Total amount must be greater than 0")
    
    for (const exp of additionalExpenses) {
      if (Number(exp.amount) < 0) {
        return toast.error("Expense amount cannot be negative")
      }
    }

    if (vehicleNumber.trim() && !isValidVehicleNumber(vehicleNumber)) {
      return toast.error("Please enter a valid Vehicle Number (e.g. AP 27 TX 3987)")
    }
    if (driverName.trim() && !isValidDriverName(driverName)) {
      return toast.error("Please enter a valid Driver Name (letters, spaces, and common characters)")
    }
    if (driverPhone.trim() && !isValidDriverPhone(driverPhone)) {
      return toast.error("Driver Phone Number must be exactly 10 digits")
    }

    setLoading(true)
    try {
      const itemsToSave = selectedItems.filter(i => i.quantity > 0).map(i => ({
        ...i,
        unit: i.unit || getItemUnit(i.name, 'sales', availableMaterials)
      }))
      const itemsJson = itemsToSave.reduce((acc, curr) => ({ ...acc, [curr.name]: curr }), {})

      const formattedExpenses = additionalExpenses
        .filter(e => e.name.trim() || Number(e.amount) > 0)
        .map(e => ({ name: e.name.trim() || 'Expense', amount: Number(e.amount) || 0 }))

      const formattedVehicle = vehicleNumber.trim() ? formatVehicleNumber(vehicleNumber) : null
      const advanceNumber = Number(advance || 0)

      if (editingSaleId) {
        // Update existing sale
        const { data: existingSale } = await supabase.from('sales').select('*').eq('id', editingSaleId).single()
        
        let paymentStatus = existingSale?.payment_status || 'Pending'
        let paymentHistory = Array.isArray(existingSale?.payment_history) ? [...existingSale.payment_history] : []
        const partialPay = Number(existingSale?.partial_payment || 0)
        const totalPaidSoFar = advanceNumber + partialPay

        if (totalPaidSoFar >= grandTotal && grandTotal > 0) {
          paymentStatus = 'Completed'
        } else if (totalPaidSoFar > 0) {
          paymentStatus = 'Partial Payment'
        } else {
          paymentStatus = 'Pending'
        }

        // If payment history has advance, update it
        if (paymentHistory.length > 0 && paymentHistory[0].remarks === "Advance Payment") {
          if (advanceNumber > 0) {
            paymentHistory[0].amount = advanceNumber
            paymentHistory[0].remainingBalance = Math.max(0, grandTotal - advanceNumber)
          } else {
            paymentHistory.shift()
          }
        } else if (advanceNumber > 0 && paymentHistory.length === 0) {
          paymentHistory = [{
            id: crypto.randomUUID(),
            date: date,
            amount: advanceNumber,
            remainingBalance: Math.max(0, grandTotal - advanceNumber),
            remarks: "Advance Payment"
          }]
        }

        const updatePayload: any = {
          date,
          buyer_name: factoryName,
          vehicle_number: formattedVehicle,
          driver_name: driverName.trim() || null,
          driver_phone: driverPhone.trim().replace(/\D/g, '') || null,
          total_amount: grandTotal,
          advance: advanceNumber,
          payment_status: paymentStatus,
          payment_history: paymentHistory,
          remarks,
          items: {
            ...itemsJson,
            ...(formattedExpenses.length > 0 ? { _additional_expenses: formattedExpenses } : {})
          },
          additional_expenses: formattedExpenses
        }

        let { error: updateErr } = await supabase
          .from('sales')
          .update(updatePayload)
          .eq('id', editingSaleId)

        if (updateErr && (updateErr.message?.includes('additional_expenses') || updateErr.code === 'PGRST204')) {
          delete updatePayload.additional_expenses
          const retry = await supabase.from('sales').update(updatePayload).eq('id', editingSaleId)
          updateErr = retry.error
        }

        if (updateErr) throw updateErr

        toast.success("Sales Invoice updated successfully!")
        setSavedSaleId(editingSaleId)
        setEditingSaleId(null)
        setEditingInvoiceNumber(null)
        loadSales()
      } else {
        const invoiceNumber = `INV-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`
        const initialStatus = (advanceNumber >= grandTotal) 
          ? 'Completed' 
          : (advanceNumber > 0 ? 'Partial Payment' : 'Pending')

        const initialHistory = advanceNumber > 0 ? [{
          id: crypto.randomUUID(),
          date: date,
          amount: advanceNumber,
          remainingBalance: Math.max(0, grandTotal - advanceNumber),
          remarks: "Advance Payment"
        }] : []

        const salePayload: any = {
          date,
          buyer_name: factoryName,
          vehicle_number: formattedVehicle,
          driver_name: driverName.trim() || null,
          driver_phone: driverPhone.trim().replace(/\D/g, '') || null,
          total_amount: grandTotal,
          advance: advanceNumber,
          payment_status: initialStatus,
          partial_payment: 0,
          payment_history: initialHistory,
          remarks,
          items: {
            ...itemsJson,
            ...(formattedExpenses.length > 0 ? { _additional_expenses: formattedExpenses } : {})
          },
          additional_expenses: formattedExpenses,
          invoice_number: invoiceNumber
        }

        let { data: saleData, error: saleError } = await supabase
          .from('sales')
          .insert([salePayload])
          .select()
          .single()

        if (saleError && (saleError.message?.includes('additional_expenses') || saleError.code === 'PGRST204')) {
          delete salePayload.additional_expenses
          const retry = await supabase.from('sales').insert([salePayload]).select().single()
          saleData = retry.data
          saleError = retry.error
        }

        if (saleError) throw saleError

        toast.success("Sales Invoice recorded successfully!")
        setSavedSaleId(saleData.id)
        loadSales()
      }
    } catch (err: any) {
      toast.error(err.message || "Error saving sale")
    } finally {
      setLoading(false)
    }
  }

  const handleEditSale = (sale: Sale) => {
    setEditingSaleId(sale.id)
    setEditingInvoiceNumber(sale.invoice_number || null)
    setFactoryName(sale.buyer_name || "")
    setDate(sale.date || new Date().toISOString().split('T')[0])
    setVehicleNumber(sale.vehicle_number || "")
    setDriverName(sale.driver_name || "")
    setDriverPhone(sale.driver_phone || "")
    setRemarks(sale.remarks || "")
    setAdvance(sale.advance || 0)
    
    // Load items (ignoring internal metadata keys like _additional_expenses)
    const itemsJson = sale.items || {}
    const itemsList: SalesItem[] = Object.entries(itemsJson)
      .filter(([k]) => k !== '_additional_expenses')
      .map(([_, i]: [string, any]) => ({
        name: i.name,
        quantity: Number(i.quantity || 0),
        rate: Number(i.rate || 0),
        total: Number(i.total || 0),
        unit: i.unit || getItemUnit(i.name, 'sales', availableMaterials)
      }))
    setSelectedItems(itemsList)

    // Load additional expenses from column or items._additional_expenses
    const rawExpenses = Array.isArray(sale.additional_expenses) && sale.additional_expenses.length > 0
      ? sale.additional_expenses
      : (Array.isArray(sale.items?._additional_expenses) ? sale.items._additional_expenses : [])

    const expensesList = rawExpenses.map((e: any) => ({
      id: crypto.randomUUID(),
      name: String(e.name || ''),
      amount: Number(e.amount || 0)
    }))
    setAdditionalExpenses(expensesList)

    setSavedSaleId(null)
  }

  const cancelEdit = () => {
    resetFormForAnotherBill()
  }

  const resetFormForAnotherBill = () => {
    setSelectedItems([])
    setAdditionalExpenses([])
    setRemarks("")
    setAdvance(0)
    setVehicleNumber("")
    setDriverName("")
    setDriverPhone("")
    setSavedSaleId(null)
    setEditingSaleId(null)
    setEditingInvoiceNumber(null)
  }

  const handlePdfAction = async (action: 'download' | 'print') => {
    if (!savedSaleId) return
    const { data: sale } = await supabase.from('sales').select('*').eq('id', savedSaleId).single()
    if (sale) {
      const session: GroupedSaleSession = {
        id: sale.id,
        buyer_name: sale.buyer_name,
        date: sale.date,
        billsCount: 1,
        overallTotal: sale.total_amount,
        status: sale.payment_status,
        bill_ids: [sale.id],
        partial_payment: sale.partial_payment || 0,
        payment_date: sale.payment_date
      }
      await generateSalesCombinedPDF(session, action, lang)
    }
  }

  const handleWhatsAppAction = async () => {
    if (!savedSaleId) return
    const { data: sale } = await supabase.from('sales').select('*').eq('id', savedSaleId).single()
    if (sale) {
      const session: GroupedSaleSession = {
        id: sale.id,
        buyer_name: sale.buyer_name,
        date: sale.date,
        billsCount: 1,
        overallTotal: sale.total_amount,
        status: sale.payment_status,
        bill_ids: [sale.id],
        partial_payment: sale.partial_payment || 0,
        payment_date: sale.payment_date
      }
      await shareSalesWhatsApp(session, lang)
    }
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
          {editingSaleId && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-lg flex justify-between items-center mb-2">
              <div className="text-xs font-semibold flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                <span>Editing Invoice {editingInvoiceNumber ? `#${editingInvoiceNumber}` : ''}</span>
              </div>
              <button 
                onClick={cancelEdit}
                className="text-xs text-blue-700 hover:text-blue-900 font-bold px-2.5 py-1 bg-white border border-blue-300 rounded shadow-sm hover:bg-blue-50 transition-colors"
              >
                {t("cancel", lang)}
              </button>
            </div>
          )}

          <h2 className="text-lg font-semibold border-b pb-2 mb-4 flex items-center">
            <Banknote className="w-5 h-5 mr-2 text-primary" /> {t("invoiceDetails", lang)}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    {buyers.filter(b => b.name.toLowerCase().includes(buyerSearch.toLowerCase()) || (b.name_te && b.name_te.includes(buyerSearch)) || (b.mobile && b.mobile.includes(buyerSearch))).map(buyer => (
                      <div 
                        key={buyer.id} 
                        className="px-3 py-2 text-sm hover:bg-muted cursor-pointer flex justify-between items-center"
                        onClick={() => {
                          setFactoryName(buyer.name)
                          setIsBuyerDropdownOpen(false)
                          setBuyerSearch("")
                        }}
                      >
                        <span>{lang === 'te' && buyer.name_te ? buyer.name_te : buyer.name}</span>
                        {buyer.mobile && <span className="text-xs text-muted-foreground font-mono ml-2">📱 {buyer.mobile}</span>}
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
            <div>
              <label className="block text-sm font-medium mb-1">Vehicle Number</label>
              <input 
                type="text" 
                placeholder="AP 37 TD 5799" 
                className="w-full border p-2 rounded bg-background font-semibold uppercase tracking-wide" 
                value={vehicleNumber} 
                onChange={e => setVehicleNumber(formatVehicleNumber(e.target.value))} 
                disabled={!!savedSaleId} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("driverName", lang)}</label>
              <input 
                type="text" 
                placeholder="Driver Name" 
                className="w-full border p-2 rounded bg-background" 
                value={driverName} 
                onChange={e => setDriverName(e.target.value)} 
                disabled={!!savedSaleId} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("driverPhone", lang)}</label>
              <input 
                type="tel" 
                maxLength={10}
                placeholder="10 digit phone number" 
                className="w-full border p-2 rounded bg-background font-mono" 
                value={driverPhone} 
                onChange={e => setDriverPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} 
                disabled={!!savedSaleId} 
              />
            </div>
          </div>

          {/* Dynamic Item Entry */}
          <div className="mt-8 border rounded-lg overflow-hidden">
            <div className="bg-muted p-3 flex justify-between items-center border-b">
              <h3 className="font-semibold">{t("invoiceItems", lang)}</h3>
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
                        <div className="flex items-center gap-1.5">
                          <input type="number" className="w-full border p-1.5 rounded text-sm" value={item.quantity || ""} onChange={e => updateItem(index, 'quantity', Number(e.target.value))} disabled={!!savedSaleId} placeholder="0" />
                          <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded shrink-0 border">
                            {item.unit || getItemUnit(item.name, 'sales', availableMaterials)}
                          </span>
                        </div>
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

          {/* Additional Expenses Section */}
          <div className="mt-6 border rounded-lg overflow-hidden">
            <div className="bg-muted p-3 flex justify-between items-center border-b">
              <div>
                <h3 className="font-semibold text-foreground">
                  {t("additionalExpenses", lang)}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {lang === 'te' 
                    ? "వాన్ ఛార్జీలు, లోడింగ్ కూలీలు, రవాణా ఖర్చులు మొదలైనవి" 
                    : "Van charges, loading wages, transport & delivery expenses"}
                </p>
              </div>
              {!savedSaleId && (
                <button 
                  onClick={handleAddExpense} 
                  className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm flex items-center font-medium hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-1" /> {t("addExpense", lang)}
                </button>
              )}
            </div>
            
            <div className="p-3 bg-muted/5 space-y-2">
              <datalist id="expense-suggestions">
                <option value="Van Charges" />
                <option value="Loading Charges" />
                <option value="Loading Workers Wages" />
                <option value="Transport Charges" />
                <option value="Driver Charges" />
                <option value="Other Expenses" />
              </datalist>

              {additionalExpenses.map((exp) => (
                <div key={exp.id} className="flex items-center gap-3 bg-background p-2.5 rounded-lg border shadow-sm">
                  <div className="flex-1">
                    <input 
                      type="text" 
                      list="expense-suggestions"
                      placeholder={lang === 'te' ? "ఖర్చు పేరు (ఉదా: Van Charges)" : "Expense Name (e.g. Van Charges, Loading Wages)"}
                      className="w-full border p-2 rounded text-sm bg-background font-medium"
                      value={exp.name}
                      onChange={e => updateExpense(exp.id, 'name', e.target.value)}
                      disabled={!!savedSaleId}
                    />
                  </div>
                  <div className="w-44 flex items-center gap-1.5">
                    <span className="text-sm font-bold text-muted-foreground">₹</span>
                    <input 
                      type="number" 
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full border p-2 rounded text-sm font-semibold text-right bg-background"
                      value={exp.amount || ""}
                      onChange={e => updateExpense(exp.id, 'amount', e.target.value)}
                      disabled={!!savedSaleId}
                    />
                  </div>
                  {!savedSaleId && (
                    <button 
                      onClick={() => removeExpense(exp.id)} 
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition-colors"
                      title={t("delete", lang)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              {additionalExpenses.length === 0 && (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  {lang === 'te' 
                    ? "అదనపు ఖర్చులు ఏవీ జోడించబడలేదు. ఖర్చులను జోడించడానికి \"+ ఖర్చును జోడించు\" క్లిక్ చేయండి."
                    : "No additional expenses added. Click \"+ Add Expense\" to add delivery/loading charges."}
                </div>
              )}
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
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-slate-700">{t("itemsTotal", lang)}:</span>
                <span className="font-bold text-foreground">₹{formatInr(itemsTotal)}</span>
              </div>
              {additionalExpensesTotal > 0 && (
                <div className="flex justify-between items-center text-sm text-slate-700">
                  <span className="font-semibold">{t("additionalExpensesTotal", lang)}:</span>
                  <span className="font-bold text-purple-700">+ ₹{formatInr(additionalExpensesTotal)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-slate-700">{t("advance", lang)} (₹):</span>
                <input 
                  type="number" 
                  min="0"
                  step="0.01"
                  className="w-32 border p-1 rounded text-sm text-right font-bold bg-background"
                  value={advance || ''}
                  onChange={e => setAdvance(Math.max(0, Number(e.target.value) || 0))}
                  disabled={!!savedSaleId}
                  placeholder="0.00"
                />
              </div>
              {advanceVal > 0 && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">{t("balance", lang)}:</span>
                  <span className={`font-bold ${remainingBalance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    ₹{formatInr(remainingBalance)}
                  </span>
                </div>
              )}
              <div className="border-t my-2 pt-2"></div>
              <div className="flex justify-between items-center text-lg font-bold">
                <span>{t("grandTotal", lang)}:</span>
                <span className="text-primary text-2xl">₹{formatInr(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Sidebar */}
        <div className="space-y-6">
          <div className="bg-card p-6 rounded-xl border shadow-sm flex flex-col gap-3">
            {!savedSaleId ? (
              <button onClick={handleSaveSale} disabled={loading} className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium flex justify-center items-center hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm">
                <Save className="w-5 h-5 mr-2" /> {loading ? "Saving..." : (editingSaleId ? (lang === 'te' ? "ఇన్వాయిస్ అప్‌డేట్ చేయి" : "Update Invoice") : t("saveInvoice", lang))}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="bg-green-50 text-green-700 p-3 rounded-lg flex items-center mb-3">
                  <CheckCircle2 className="w-5 h-5 mr-2 shrink-0" />
                  <span className="text-xs font-medium">Invoice saved successfully!</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handlePdfAction('download')} className="bg-slate-100 text-slate-700 py-2 rounded-md text-xs font-semibold flex justify-center items-center hover:bg-slate-200">
                    <Download className="w-3.5 h-3.5 mr-1" /> PDF
                  </button>
                  <button onClick={() => handlePdfAction('print')} className="bg-slate-100 text-slate-700 py-2 rounded-md text-xs font-semibold flex justify-center items-center hover:bg-slate-200">
                    <Printer className="w-3.5 h-3.5 mr-1" /> Print
                  </button>
                </div>
                <button onClick={handleWhatsAppAction} className="w-full bg-green-50 text-green-700 py-2 rounded-md text-xs font-semibold flex justify-center items-center hover:bg-green-100">
                  <Share2 className="w-3.5 h-3.5 mr-1" /> Share via WhatsApp
                </button>
                
                <div className="border-t pt-3 mt-3">
                  <button onClick={resetFormForAnotherBill} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium flex justify-center items-center hover:bg-blue-700 mb-2">
                    <Save className="w-4 h-4 mr-2" /> Another Bill
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <h2 className="font-semibold mb-4 flex items-center border-b pb-2">
              <List className="w-4 h-4 mr-2" /> {t("recentSales", lang)}
            </h2>
            <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2">
              {salesList.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noRecentSales", lang)}</p>
              ) : salesList.map(sale => (
                <div key={sale.id} className="border p-3 rounded-lg flex justify-between items-center text-sm bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex-1 mr-2">
                    <div className="font-semibold text-primary">{sale.buyer_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {sale.date} {sale.invoice_number ? `• ${sale.invoice_number}` : ''} {sale.vehicle_number ? `• Vehicle: ${sale.vehicle_number}` : ''}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Driver: {sale.driver_name || '-'} ({sale.driver_phone || '-'})
                    </div>
                    {Array.isArray(sale.additional_expenses) && sale.additional_expenses.length > 0 && (
                      <div className="text-[11px] text-purple-700 font-medium mt-0.5">
                        +{sale.additional_expenses.length} Expense(s): ₹{formatInr(sale.additional_expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0))}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <div className="font-bold">₹{formatInr(sale.total_amount)}</div>
                    <div className={`text-xs ${sale.payment_status === 'Completed' ? 'text-green-600' : 'text-orange-500'}`}>{sale.payment_status}</div>
                    <button 
                      onClick={() => handleEditSale(sale)}
                      className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1 font-semibold mt-1"
                    >
                      <Edit2 className="w-3 h-3" /> {t("edit", lang)}
                    </button>
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
                        <span className="font-medium text-sm flex items-center gap-2">
                          {item.name}
                          <span className="bg-muted px-2 py-0.5 rounded text-xs text-muted-foreground font-medium border">{item.unit || getItemUnit(item.name, 'sales', availableMaterials)}</span>
                        </span>
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
          <div className="bg-background w-full max-w-xl rounded-lg shadow-lg flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-muted/30">
              <h2 className="text-lg font-bold">Manage Buyers</h2>
              <button onClick={() => { setIsBuyerModalOpen(false); setEditingBuyer(null); setBuyerFormName(""); setBuyerFormNameTe(""); setBuyerFormMobile(""); }} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-4 border-b bg-muted/10">
              <form onSubmit={handleSaveBuyer} className="flex flex-col gap-2">
                <input 
                  type="text" 
                  placeholder={t("name", lang)} 
                  className="w-full border p-2 rounded text-sm bg-background"
                  value={buyerFormName}
                  onChange={e => setBuyerFormName(e.target.value)}
                  required
                />
                <input 
                  type="text" 
                  placeholder={t("nameTe", lang)} 
                  className="w-full border p-2 rounded text-sm bg-background"
                  value={buyerFormNameTe}
                  onChange={e => setBuyerFormNameTe(e.target.value)}
                />
                <input 
                  type="tel" 
                  maxLength={10}
                  placeholder={lang === 'te' ? "ఫోన్ నంబర్ (10 అంకెలు)" : "Phone Number (10 digits)"} 
                  className="w-full border p-2 rounded text-sm bg-background font-mono"
                  value={buyerFormMobile}
                  onChange={e => setBuyerFormMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium hover:bg-primary/90">
                    {editingBuyer ? t("update", lang) : t("save", lang)}
                  </button>
                  {editingBuyer && (
                    <button type="button" onClick={() => { setEditingBuyer(null); setBuyerFormName(""); setBuyerFormNameTe(""); setBuyerFormMobile(""); }} className="flex-1 px-3 py-2 border rounded text-sm hover:bg-muted">{t("cancel", lang)}</button>
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
                    <th className="px-4 py-2">Phone Number</th>
                    <th className="px-4 py-2 text-right w-24">{t("actions", lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {buyers.filter(b => b.name.toLowerCase().includes(buyerSearch.toLowerCase()) || (b.name_te && b.name_te.includes(buyerSearch)) || (b.mobile && b.mobile.includes(buyerSearch))).map(buyer => (
                    <tr key={buyer.id} className="border-b last:border-0 hover:bg-muted/10">
                      <td className="px-4 py-3 font-medium">{buyer.name}</td>
                      <td className="px-4 py-3 font-medium">{buyer.name_te || '-'}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{buyer.mobile || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => { setEditingBuyer(buyer); setBuyerFormName(buyer.name); setBuyerFormNameTe(buyer.name_te || ""); setBuyerFormMobile(buyer.mobile || ""); }} 
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
