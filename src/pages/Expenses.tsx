import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Expense } from "@/types/database"
import { Plus, Edit2, Trash2, Search, Download, Printer, FileSpreadsheet, Receipt } from "lucide-react"
import { toast } from "sonner"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"
import { formatDate } from "@/lib/utils"
import { generateTablePDF } from "@/lib/pdfTemplate"
import { addToRecycleBin } from "@/lib/recycleBin"
import * as XLSX from "xlsx"

export const EXPENSE_CATEGORIES = [
  "🚚 Transport",
  "👷 Loading Wages",
  "🍺 Sunday Packing Wages",
  "⛽ Diesel / Fuel",
  "🛍️ Packing Materials",
  "🔧 Vehicle Maintenance",
  "⚡ Utilities",
  "🏢 Office Expenses",
  "📦 Miscellaneous"
] as const

export interface ExpenseDetailsData {
  vehicleNumber?: string
  driverName?: string
  driverPhone?: string
  route?: string
  numWorkers?: string | number
  workDesc?: string
  packingWork?: string
  fuelQty?: string | number
  fuelStation?: string
  materialType?: string
  quantity?: string | number
  repairType?: string
  utilityType?: string
  officeExpenseType?: string
  description?: string
}

export function autoFormatVehicleNumber(value: string): string {
  if (!value) return ""
  const clean = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
  if (clean.length === 0) return ""
  
  const match = clean.match(/^([A-Z]{0,2})(\d{0,2})([A-Z]{0,3})(\d{0,4})$/)
  if (!match) return clean

  const parts = [match[1], match[2], match[3], match[4]].filter(Boolean)
  return parts.join(" ")
}

export function getExpenseDetails(exp: Partial<Expense>): string {
  if (!exp.description) return "-"

  let details: ExpenseDetailsData | null = null
  if (typeof exp.description === "string" && exp.description.trim().startsWith("{")) {
    try {
      details = JSON.parse(exp.description)
    } catch {
      details = null
    }
  }

  if (!details) {
    return exp.description || "-"
  }

  const category = exp.category || ""

  if (category.includes("Transport")) {
    const parts: string[] = []
    if (details.vehicleNumber) parts.push(details.vehicleNumber)
    if (details.route) parts.push(details.route)
    
    if (details.driverName || details.driverPhone) {
      const driverParts: string[] = []
      if (details.driverName) driverParts.push(details.driverName)
      if (details.driverPhone) driverParts.push(details.driverPhone)
      parts.push(`Driver: ${driverParts.join(" - ")}`)
    }

    return parts.length > 0 ? parts.join(" • ") : (details.description || "-")
  }

  if (category.includes("Loading Wages")) {
    const parts: string[] = []
    if (details.numWorkers) parts.push(`${details.numWorkers} Workers`)
    if (details.workDesc) parts.push(details.workDesc)
    return parts.length > 0 ? parts.join(" • ") : (details.description || "-")
  }

  if (category.includes("Sunday Packing Wages")) {
    const parts: string[] = []
    if (details.numWorkers) parts.push(`${details.numWorkers} Workers`)
    if (details.packingWork) parts.push(details.packingWork)
    return parts.length > 0 ? parts.join(" • ") : (details.description || "-")
  }

  if (category.includes("Diesel") || category.includes("Fuel")) {
    const parts: string[] = []
    if (details.vehicleNumber) parts.push(details.vehicleNumber)
    if (details.fuelQty) parts.push(`${details.fuelQty} Litres`)
    if (details.fuelStation) parts.push(details.fuelStation)
    return parts.length > 0 ? parts.join(" • ") : (details.description || "-")
  }

  if (category.includes("Packing Materials")) {
    const parts: string[] = []
    if (details.materialType) parts.push(details.materialType)
    if (details.quantity) parts.push(`Qty ${details.quantity}`)
    return parts.length > 0 ? parts.join(" • ") : (details.description || "-")
  }

  if (category.includes("Vehicle Maintenance")) {
    const parts: string[] = []
    if (details.vehicleNumber) parts.push(details.vehicleNumber)
    if (details.repairType) parts.push(details.repairType)
    return parts.length > 0 ? parts.join(" • ") : (details.description || "-")
  }

  if (category.includes("Utilities")) {
    return details.utilityType || details.description || "-"
  }

  if (category.includes("Office Expenses")) {
    return details.officeExpenseType || details.description || "-"
  }

  if (category.includes("Miscellaneous")) {
    return details.description || "-"
  }

  const fallbackParts = Object.values(details).filter(Boolean).map(String)
  return fallbackParts.length > 0 ? fallbackParts.join(" • ") : (exp.description || "-")
}

export function Expenses() {
  const { lang } = useOutletContext<{ lang: "en" | "te" }>()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("All")
  
  // Date range filter
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  
  // Base Form State
  const [formData, setFormData] = useState<{
    date: string
    category: string
    amount: number | string
    remarks: string
  }>({
    date: new Date().toISOString().split('T')[0],
    category: EXPENSE_CATEGORIES[0],
    amount: "",
    remarks: ""
  })

  // Dynamic Details Form State
  const [detailsData, setDetailsData] = useState<ExpenseDetailsData>({
    vehicleNumber: "",
    driverName: "",
    driverPhone: "",
    route: "",
    numWorkers: "",
    workDesc: "",
    packingWork: "",
    fuelQty: "",
    fuelStation: "",
    materialType: "Plastic Bags",
    quantity: "",
    repairType: "",
    utilityType: "Electricity",
    officeExpenseType: "Stationery",
    description: ""
  })

  useEffect(() => {
    fetchExpenses()
  }, [])

  const fetchExpenses = async () => {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    
    if (error) {
      toast.error("Failed to load expenses: " + error.message)
    } else if (data) {
      setExpenses(data)
    }
  }

  const resetForm = () => {
    setEditingExpense(null)
    setFormData({
      date: new Date().toISOString().split('T')[0],
      category: EXPENSE_CATEGORIES[0],
      amount: "",
      remarks: ""
    })
    setDetailsData({
      vehicleNumber: "",
      driverName: "",
      driverPhone: "",
      route: "",
      numWorkers: "",
      workDesc: "",
      packingWork: "",
      fuelQty: "",
      fuelStation: "",
      materialType: "Plastic Bags",
      quantity: "",
      repairType: "",
      utilityType: "Electricity",
      officeExpenseType: "Stationery",
      description: ""
    })
  }

  const handleEditClick = (exp: Expense) => {
    setEditingExpense(exp)
    
    // Find matching category or fallback
    const matchedCategory = EXPENSE_CATEGORIES.find(
      c => c === exp.category || c.includes(exp.category) || exp.category.includes(c.replace(/^[^\w\s]+/, '').trim())
    ) || exp.category

    setFormData({
      date: exp.date,
      category: matchedCategory,
      amount: exp.amount,
      remarks: exp.remarks || ""
    })

    let parsed: any = null
    if (exp.description && exp.description.trim().startsWith("{")) {
      try {
        parsed = JSON.parse(exp.description)
      } catch {
        parsed = null
      }
    }

    if (parsed && typeof parsed === "object") {
      setDetailsData({
        vehicleNumber: parsed.vehicleNumber || "",
        driverName: parsed.driverName || "",
        driverPhone: parsed.driverPhone || "",
        route: parsed.route || "",
        numWorkers: parsed.numWorkers || "",
        workDesc: parsed.workDesc || "",
        packingWork: parsed.packingWork || "",
        fuelQty: parsed.fuelQty || "",
        fuelStation: parsed.fuelStation || "",
        materialType: parsed.materialType || "Plastic Bags",
        quantity: parsed.quantity || "",
        repairType: parsed.repairType || "",
        utilityType: parsed.utilityType || "Electricity",
        officeExpenseType: parsed.officeExpenseType || "Stationery",
        description: parsed.description || ""
      })
    } else {
      setDetailsData({
        vehicleNumber: "",
        driverName: "",
        driverPhone: "",
        route: "",
        numWorkers: "",
        workDesc: exp.description || "",
        packingWork: exp.description || "",
        fuelQty: "",
        fuelStation: "",
        materialType: "Plastic Bags",
        quantity: "",
        repairType: exp.description || "",
        utilityType: "Electricity",
        officeExpenseType: "Stationery",
        description: exp.description || ""
      })
    }

    setIsModalOpen(true)
  }

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    const numericAmount = Number(formData.amount)
    if (!formData.amount || numericAmount <= 0) {
      return toast.error("Amount must be greater than zero.")
    }

    let serializedDescription = ""

    if (formData.category.includes("Transport")) {
      const phone = detailsData.driverPhone?.trim().replace(/\D/g, "") || ""
      if (phone.length > 0 && phone.length !== 10) {
        return toast.error("Driver Phone Number must be exactly 10 digits.")
      }

      serializedDescription = JSON.stringify({
        vehicleNumber: detailsData.vehicleNumber?.trim() || "",
        driverName: detailsData.driverName?.trim() || "",
        driverPhone: phone,
        route: detailsData.route?.trim() || ""
      })
    } else if (formData.category.includes("Loading Wages")) {
      serializedDescription = JSON.stringify({
        numWorkers: detailsData.numWorkers || "",
        workDesc: detailsData.workDesc?.trim() || ""
      })
    } else if (formData.category.includes("Sunday Packing Wages")) {
      serializedDescription = JSON.stringify({
        numWorkers: detailsData.numWorkers || "",
        packingWork: detailsData.packingWork?.trim() || ""
      })
    } else if (formData.category.includes("Diesel") || formData.category.includes("Fuel")) {
      serializedDescription = JSON.stringify({
        vehicleNumber: detailsData.vehicleNumber?.trim() || "",
        fuelQty: detailsData.fuelQty || "",
        fuelStation: detailsData.fuelStation?.trim() || ""
      })
    } else if (formData.category.includes("Packing Materials")) {
      serializedDescription = JSON.stringify({
        materialType: detailsData.materialType || "Plastic Bags",
        quantity: detailsData.quantity || ""
      })
    } else if (formData.category.includes("Vehicle Maintenance")) {
      serializedDescription = JSON.stringify({
        vehicleNumber: detailsData.vehicleNumber?.trim() || "",
        repairType: detailsData.repairType?.trim() || ""
      })
    } else if (formData.category.includes("Utilities")) {
      serializedDescription = JSON.stringify({
        utilityType: detailsData.utilityType || "Electricity"
      })
    } else if (formData.category.includes("Office Expenses")) {
      serializedDescription = JSON.stringify({
        officeExpenseType: detailsData.officeExpenseType || "Stationery"
      })
    } else { // Miscellaneous
      serializedDescription = JSON.stringify({
        description: detailsData.description?.trim() || ""
      })
    }

    const payload = {
      date: formData.date,
      category: formData.category,
      description: serializedDescription,
      amount: numericAmount,
      remarks: formData.remarks?.trim() || null
    }

    try {
      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', editingExpense.id)
        if (error) throw error
        toast.success("Expense updated successfully")
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert([payload])
        if (error) throw error
        toast.success("Expense added successfully")
      }
      setIsModalOpen(false)
      fetchExpenses()
    } catch (err: any) {
      toast.error(err.message || "Failed to save expense")
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return
    try {
      const { data: expData } = await supabase.from('expenses').select('*').eq('id', id).single()
      if (expData) {
        await addToRecycleBin({
          id: crypto.randomUUID(),
          type: 'expense',
          item_id: expData.id,
          title: `Expense: ${expData.category}`,
          amount: Number(expData.amount || 0),
          data: { expense: expData },
          deleted_at: new Date().toISOString()
        })
      }
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
      toast.success("Expense moved to Recycle Bin!")
      fetchExpenses()
    } catch (err: any) {
      toast.error(err.message || "Failed to delete expense")
    }
  }

  const filteredExpenses = expenses.filter(exp => {
    const detailsStr = getExpenseDetails(exp).toLowerCase()
    const remarksStr = (exp.remarks || "").toLowerCase()
    const categoryStr = (exp.category || "").toLowerCase()
    const query = searchQuery.toLowerCase()

    const matchesSearch = !searchQuery || detailsStr.includes(query) || remarksStr.includes(query) || categoryStr.includes(query)
    
    const matchesCategory = categoryFilter === "All" || 
      exp.category === categoryFilter || 
      exp.category.includes(categoryFilter.replace(/^[^\w\s]+/, '').trim()) ||
      categoryFilter.includes(exp.category)
    
    const matchesStartDate = startDate ? exp.date >= startDate : true
    const matchesEndDate = endDate ? exp.date <= endDate : true
    
    return matchesSearch && matchesCategory && matchesStartDate && matchesEndDate
  })

  // --- EXPORTS ---
  const exportPDF = (action: 'download' | 'print' = 'download') => {
    const totalAmount = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0)
    const metadata = startDate || endDate 
      ? [`Date Range: ${startDate ? formatDate(startDate) : 'Start'} to ${endDate ? formatDate(endDate) : 'End'}`, `Total Expenses: Rs ${new Intl.NumberFormat('en-IN').format(totalAmount)}`]
      : [`Total Expenses: Rs ${new Intl.NumberFormat('en-IN').format(totalAmount)}`]

    const head = [['S.No.', 'Date', 'Category', 'Details', 'Amount (Rs)', 'Remarks']]
    const body: any[][] = filteredExpenses.map((exp, index) => [
      index + 1,
      formatDate(exp.date),
      exp.category,
      getExpenseDetails(exp),
      `Rs ${new Intl.NumberFormat('en-IN').format(exp.amount)}`,
      exp.remarks || '-'
    ])

    if (body.length > 0) {
      body.push(['', '', '', 'TOTAL AMOUNT', `Rs ${new Intl.NumberFormat('en-IN').format(totalAmount)}`, ''])
    }

    generateTablePDF({
      title: "EXPENSES REPORT",
      subHeader: lang === 'te' ? "విస్సాకోడేరు బ్రిడ్జ్ దగ్గర, భీమవరం[534201]." : "NEAR VISSAKODERU BRIDGE, BHIMAVARAM[534201].",
      filename: `Expenses_${new Date().toISOString().split('T')[0]}.pdf`,
      metadata,
      tableHead: head,
      tableBody: body
    }, action)
  }

  const exportExcel = () => {
    const sheetData = filteredExpenses.map((exp, index) => ({
      "S.No.": index + 1,
      "Date": formatDate(exp.date),
      "Category": exp.category,
      "Details": getExpenseDetails(exp),
      "Amount (Rs)": Number(exp.amount),
      "Remarks": exp.remarks || '-'
    }))

    const ws = XLSX.utils.json_to_sheet(sheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Expenses")
    XLSX.writeFile(wb, "Expenses.xlsx")
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="w-6 h-6 text-primary" />
          {lang === 'te' ? "ఖర్చులు" : "Expenses"}
        </h1>
        <button 
          onClick={() => {
            resetForm()
            setIsModalOpen(true)
          }}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> {lang === 'te' ? "ఖర్చును జోడించండి" : "Add Expense"}
        </button>
      </div>

      {/* Filters Container */}
      <div className="bg-card p-6 border rounded-xl shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input 
              type="text" 
              placeholder={lang === 'te' ? "వెతకండి..." : "Search details or remarks..."}
              className="pl-9 pr-4 py-2 w-full border rounded-lg text-sm bg-background"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              className="w-full border p-2 rounded-lg text-sm bg-background font-medium"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="All">{lang === 'te' ? "అన్ని విభాగాలు" : "All Categories"}</option>
              {EXPENSE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-muted-foreground font-semibold shrink-0">From</span>
            <input 
              type="date" 
              className="w-full border p-2 rounded-lg text-sm bg-background"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          {/* End Date */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-muted-foreground font-semibold shrink-0">To</span>
            <input 
              type="date" 
              className="w-full border p-2 rounded-lg text-sm bg-background"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap justify-between items-center pt-2 gap-2">
          <div className="text-sm font-semibold text-muted-foreground">
            Total Expenses: <span className="text-primary text-base font-bold">₹{filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0).toLocaleString('en-IN')}</span>
          </div>

          <div className="flex gap-2">
            <button onClick={() => exportPDF('download')} className="bg-red-600 text-white px-4 py-2 rounded text-sm flex items-center hover:bg-red-700 shadow-sm font-medium">
              <Download className="w-4 h-4 mr-2" /> PDF
            </button>
            <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded text-sm flex items-center hover:bg-green-700 shadow-sm font-medium">
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </button>
            <button onClick={() => exportPDF('print')} className="border border-slate-300 bg-white px-4 py-2 rounded text-sm flex items-center hover:bg-slate-50 shadow-sm font-medium">
              <Printer className="w-4 h-4 mr-2" /> Print
            </button>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 w-16 font-semibold">S.No.</th>
                <th className="px-4 py-3 font-semibold">{t("date", lang)}</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Details</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Remarks</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No expense records found matching filters.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp, index) => (
                  <tr key={exp.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(exp.date)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                      <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-semibold inline-block">
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{getExpenseDetails(exp)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[15px] text-red-600 whitespace-nowrap">
                      ₹{Number(exp.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{exp.remarks || '-'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1.5">
                        <button 
                          onClick={() => handleEditClick(exp)}
                          className="text-blue-600 hover:bg-blue-50 p-2 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="text-red-600 hover:bg-red-50 p-2 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CRUD Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-lg rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b bg-slate-50 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-slate-800">
                {editingExpense ? "Edit Expense" : "Add New Expense"}
              </h2>
            </div>
            
            <form onSubmit={handleSaveExpense} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Date *</label>
                  <input 
                    required
                    type="date"
                    className="w-full border p-2.5 rounded-lg text-sm bg-background"
                    value={formData.date || ""}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Category *</label>
                  <select
                    required
                    className="w-full border p-2.5 rounded-lg text-sm bg-background font-medium"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* DYNAMIC FORM FIELDS BASED ON CATEGORY */}
              
              {/* 1. 🚚 Transport */}
              {formData.category.includes("Transport") && (
                <div className="space-y-4 p-4 border rounded-xl bg-slate-50/50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Vehicle Number (Optional)</label>
                      <input 
                        type="text"
                        placeholder="AP 37 TD 5799"
                        className="w-full border p-2.5 rounded-lg text-sm bg-background font-medium uppercase"
                        value={detailsData.vehicleNumber || ""}
                        onChange={e => setDetailsData({ ...detailsData, vehicleNumber: autoFormatVehicleNumber(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Driver Name (Optional)</label>
                      <input 
                        type="text"
                        placeholder="e.g. Raju"
                        className="w-full border p-2.5 rounded-lg text-sm bg-background"
                        value={detailsData.driverName || ""}
                        onChange={e => setDetailsData({ ...detailsData, driverName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Driver Phone Number (Optional)</label>
                    <input 
                      type="tel"
                      maxLength={10}
                      placeholder="10 digit phone number"
                      className="w-full border p-2.5 rounded-lg text-sm bg-background font-mono"
                      value={detailsData.driverPhone || ""}
                      onChange={e => setDetailsData({ ...detailsData, driverPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Route / Place</label>
                    <input 
                      type="text"
                      placeholder="e.g. Bhimavaram → Akividu"
                      className="w-full border p-2.5 rounded-lg text-sm bg-background"
                      value={detailsData.route || ""}
                      onChange={e => setDetailsData({ ...detailsData, route: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* 2. 👷 Loading Wages */}
              {formData.category.includes("Loading Wages") && (
                <div className="space-y-4 p-4 border rounded-xl bg-slate-50/50">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Number of Workers</label>
                    <input 
                      type="number"
                      min="1"
                      placeholder="e.g. 8"
                      className="w-full border p-2.5 rounded-lg text-sm bg-background"
                      value={detailsData.numWorkers || ""}
                      onChange={e => setDetailsData({ ...detailsData, numWorkers: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Work Description</label>
                    <input 
                      type="text"
                      placeholder="e.g. Beer Loading, Glass Loading, Bottle Sorting"
                      className="w-full border p-2.5 rounded-lg text-sm bg-background"
                      value={detailsData.workDesc || ""}
                      onChange={e => setDetailsData({ ...detailsData, workDesc: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* 3. 🍺 Sunday Packing Wages */}
              {formData.category.includes("Sunday Packing Wages") && (
                <div className="space-y-4 p-4 border rounded-xl bg-slate-50/50">
                  <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    💡 Payment for workers who voluntarily come on Sunday to pack bottles (Not salary).
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Number of Workers</label>
                    <input 
                      type="number"
                      min="1"
                      placeholder="e.g. 6"
                      className="w-full border p-2.5 rounded-lg text-sm bg-background"
                      value={detailsData.numWorkers || ""}
                      onChange={e => setDetailsData({ ...detailsData, numWorkers: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Packing Work</label>
                    <input 
                      type="text"
                      placeholder="e.g. Beer Packing, Liquor Packing, Mixed Packing"
                      className="w-full border p-2.5 rounded-lg text-sm bg-background"
                      value={detailsData.packingWork || ""}
                      onChange={e => setDetailsData({ ...detailsData, packingWork: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* 4. ⛽ Diesel / Fuel */}
              {(formData.category.includes("Diesel") || formData.category.includes("Fuel")) && (
                <div className="space-y-4 p-4 border rounded-xl bg-slate-50/50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Vehicle Number</label>
                      <input 
                        type="text"
                        placeholder="AP 37 TD 5799"
                        className="w-full border p-2.5 rounded-lg text-sm bg-background font-medium uppercase"
                        value={detailsData.vehicleNumber || ""}
                        onChange={e => setDetailsData({ ...detailsData, vehicleNumber: autoFormatVehicleNumber(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Fuel Quantity (Litres)</label>
                      <input 
                        type="number"
                        step="0.01"
                        placeholder="e.g. 42"
                        className="w-full border p-2.5 rounded-lg text-sm bg-background"
                        value={detailsData.fuelQty || ""}
                        onChange={e => setDetailsData({ ...detailsData, fuelQty: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Fuel Station (Optional)</label>
                    <input 
                      type="text"
                      placeholder="e.g. HP Petrol Bunk"
                      className="w-full border p-2.5 rounded-lg text-sm bg-background"
                      value={detailsData.fuelStation || ""}
                      onChange={e => setDetailsData({ ...detailsData, fuelStation: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* 5. 🛍️ Packing Materials */}
              {formData.category.includes("Packing Materials") && (
                <div className="space-y-4 p-4 border rounded-xl bg-slate-50/50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Material Type</label>
                      <select
                        className="w-full border p-2.5 rounded-lg text-sm bg-background font-medium"
                        value={detailsData.materialType || "Plastic Bags"}
                        onChange={e => setDetailsData({ ...detailsData, materialType: e.target.value })}
                      >
                        <option value="Plastic Bags">Plastic Bags</option>
                        <option value="Sacks">Sacks</option>
                        <option value="Rope">Rope</option>
                        <option value="Tape">Tape</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Quantity</label>
                      <input 
                        type="text"
                        placeholder="e.g. 500"
                        className="w-full border p-2.5 rounded-lg text-sm bg-background"
                        value={detailsData.quantity || ""}
                        onChange={e => setDetailsData({ ...detailsData, quantity: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 6. 🔧 Vehicle Maintenance */}
              {formData.category.includes("Vehicle Maintenance") && (
                <div className="space-y-4 p-4 border rounded-xl bg-slate-50/50">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Vehicle Number</label>
                    <input 
                      type="text"
                      placeholder="AP 37 TD 5799"
                      className="w-full border p-2.5 rounded-lg text-sm bg-background font-medium uppercase"
                      value={detailsData.vehicleNumber || ""}
                      onChange={e => setDetailsData({ ...detailsData, vehicleNumber: autoFormatVehicleNumber(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Repair Type</label>
                    <input 
                      type="text"
                      placeholder="e.g. Oil Change, Brakes, Tyre Replacement"
                      className="w-full border p-2.5 rounded-lg text-sm bg-background"
                      value={detailsData.repairType || ""}
                      onChange={e => setDetailsData({ ...detailsData, repairType: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {/* 7. ⚡ Utilities */}
              {formData.category.includes("Utilities") && (
                <div className="space-y-4 p-4 border rounded-xl bg-slate-50/50">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Utility Type</label>
                    <select
                      className="w-full border p-2.5 rounded-lg text-sm bg-background font-medium"
                      value={detailsData.utilityType || "Electricity"}
                      onChange={e => setDetailsData({ ...detailsData, utilityType: e.target.value })}
                    >
                      <option value="Electricity">Electricity</option>
                      <option value="Water">Water</option>
                      <option value="Internet">Internet</option>
                      <option value="Mobile Recharge">Mobile Recharge</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 8. 🏢 Office Expenses */}
              {formData.category.includes("Office Expenses") && (
                <div className="space-y-4 p-4 border rounded-xl bg-slate-50/50">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Expense Type</label>
                    <select
                      className="w-full border p-2.5 rounded-lg text-sm bg-background font-medium"
                      value={detailsData.officeExpenseType || "Stationery"}
                      onChange={e => setDetailsData({ ...detailsData, officeExpenseType: e.target.value })}
                    >
                      <option value="Stationery">Stationery</option>
                      <option value="Printing">Printing</option>
                      <option value="Office Items">Office Items</option>
                      <option value="Cleaning">Cleaning</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 9. 📦 Miscellaneous */}
              {formData.category.includes("Miscellaneous") && (
                <div className="space-y-4 p-4 border rounded-xl bg-slate-50/50">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                    <input 
                      type="text"
                      placeholder="Enter expense description..."
                      className="w-full border p-2.5 rounded-lg text-sm bg-background"
                      value={detailsData.description || ""}
                      onChange={e => setDetailsData({ ...detailsData, description: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount (₹) *</label>
                  <input 
                    required
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full border p-2.5 rounded-lg text-sm font-semibold bg-background"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Remarks</label>
                  <input 
                    type="text"
                    placeholder="Add optional notes..."
                    className="w-full border p-2.5 rounded-lg text-sm bg-background"
                    value={formData.remarks}
                    onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-muted text-sm font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium transition-colors"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

