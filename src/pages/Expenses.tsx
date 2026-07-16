import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Expense } from "@/types/database"
import { Plus, Edit2, Trash2, Search, Download, Printer, FileSpreadsheet, Receipt } from "lucide-react"
import { toast } from "sonner"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"
import { formatDate } from "@/lib/utils"
import jsPDF from "jspdf"
import "jspdf-autotable"
import * as XLSX from "xlsx"

const EXPENSE_CATEGORIES = [
  "Rent",
  "Electricity",
  "Tea & Snacks",
  "Transport",
  "Maintenance",
  "Fuel",
  "Loading Wages",
  "Miscellaneous"
]

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
  
  // Form State
  const [formData, setFormData] = useState<Partial<Expense>>({
    date: new Date().toISOString().split('T')[0],
    category: EXPENSE_CATEGORIES[0],
    description: "",
    amount: 0,
    remarks: ""
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

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.amount || Number(formData.amount) <= 0) {
      return toast.error("Amount must be greater than zero.")
    }
    try {
      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(formData)
          .eq('id', editingExpense.id)
        if (error) throw error
        toast.success("Expense updated successfully")
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert([formData])
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
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
      toast.success("Expense deleted successfully")
      fetchExpenses()
    } catch (err: any) {
      toast.error(err.message || "Failed to delete expense")
    }
  }

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = 
      exp.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (exp.remarks || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      exp.category.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = categoryFilter === "All" ? true : exp.category === categoryFilter
    
    const matchesStartDate = startDate ? exp.date >= startDate : true
    const matchesEndDate = endDate ? exp.date <= endDate : true
    
    return matchesSearch && matchesCategory && matchesStartDate && matchesEndDate
  })

  // --- EXPORTS ---
  const exportPDF = () => {
    const doc = new jsPDF()
    doc.text("Expenses Report", 14, 15)
    if (startDate || endDate) {
      const rangeText = `Range: ${startDate ? formatDate(startDate) : 'Start'} to ${endDate ? formatDate(endDate) : 'End'}`
      doc.setFontSize(10)
      doc.text(rangeText, 14, 21)
    }

    const head = [['S.No.', 'Date', 'Category', 'Description', 'Amount (Rs)', 'Remarks']]
    const body = filteredExpenses.map((exp, index) => [
      index + 1,
      formatDate(exp.date),
      exp.category,
      exp.description,
      exp.amount,
      exp.remarks || '-'
    ])

    // @ts-ignore
    doc.autoTable({ head, body, startY: startDate || endDate ? 25 : 20 })
    doc.save("Expenses.pdf")
  }

  const exportExcel = () => {
    const sheetData = filteredExpenses.map((exp, index) => ({
      "S.No.": index + 1,
      "Date": formatDate(exp.date),
      "Category": exp.category,
      "Description": exp.description,
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
            setEditingExpense(null)
            setFormData({
              date: new Date().toISOString().split('T')[0],
              category: EXPENSE_CATEGORIES[0],
              description: "",
              amount: 0,
              remarks: ""
            })
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
              placeholder={lang === 'te' ? "వెతకండి..." : "Search description..."}
              className="pl-9 pr-4 py-2 w-full border rounded-lg text-sm bg-background"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              className="w-full border p-2 rounded-lg text-sm bg-background"
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
            <button onClick={exportPDF} className="bg-red-600 text-white px-4 py-2 rounded text-sm flex items-center hover:bg-red-700 shadow-sm font-medium">
              <Download className="w-4 h-4 mr-2" /> PDF
            </button>
            <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded text-sm flex items-center hover:bg-green-700 shadow-sm font-medium">
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </button>
            <button onClick={() => window.print()} className="border border-slate-300 bg-white px-4 py-2 rounded text-sm flex items-center hover:bg-slate-50 shadow-sm font-medium">
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
                <th className="px-4 py-3 font-semibold">Description</th>
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
                    <td className="px-4 py-3">{formatDate(exp.date)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">{exp.description}</td>
                    <td className="px-4 py-3 text-right font-bold text-[15px] text-red-600">
                      ₹{Number(exp.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{exp.remarks || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button 
                          onClick={() => {
                            setEditingExpense(exp)
                            setFormData(exp)
                            setIsModalOpen(true)
                          }}
                          className="text-blue-600 hover:bg-blue-50 p-2 rounded transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="text-red-600 hover:bg-red-50 p-2 rounded transition-colors"
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
          <div className="bg-background w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">
                {editingExpense ? "Edit Expense" : "Add New Expense"}
              </h2>
            </div>
            
            <form onSubmit={handleSaveExpense} className="p-6 space-y-4">
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
                  className="w-full border p-2.5 rounded-lg text-sm bg-background"
                  value={formData.category || ""}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description *</label>
                <input 
                  required
                  type="text"
                  placeholder="e.g. Electricity bill for June"
                  className="w-full border p-2.5 rounded-lg text-sm bg-background"
                  value={formData.description || ""}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Amount (₹) *</label>
                <input 
                  required
                  type="number"
                  placeholder="0.00"
                  className="w-full border p-2.5 rounded-lg text-sm font-semibold bg-background"
                  value={formData.amount || ""}
                  onChange={e => setFormData({ ...formData, amount: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Remarks</label>
                <textarea 
                  placeholder="Add any extra notes..."
                  className="w-full border p-2.5 rounded-lg text-xs bg-background"
                  rows={2}
                  value={formData.remarks || ""}
                  onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
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
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
