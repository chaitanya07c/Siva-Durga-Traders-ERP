import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Shop, CompletedLoading as CompletedLoadingType } from "@/types/database"
import { CheckCircle, XCircle, FileText, Store, Search, Printer, Download, Eye, Clock } from "lucide-react"
import { toast } from "sonner"
import { useNavigate, useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"
import jsPDF from "jspdf"
import "jspdf-autotable"
import { formatDate } from "@/lib/utils"

export function Loading() {
  const { lang } = useOutletContext<{ lang: "en" | "te" }>()
  const [activeTab, setActiveTab] = useState<'Pending' | 'Completed'>('Pending')
  
  // Pending Tab State
  const [shops, setShops] = useState<Shop[]>([])
  const [pendingLoading, setPendingLoading] = useState(true)

  // Completed Tab State
  const [loadings, setLoadings] = useState<CompletedLoadingType[]>([])
  const [completedLoading, setCompletedLoading] = useState(true)
  
  // Completed Filters
  const [search, setSearch] = useState("")
  const [dateFilter, setDateFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("All")

  const navigate = useNavigate()

  // Modal State
  const [completeModal, setCompleteModal] = useState<Shop | null>(null)
  const [purchaseAmount, setPurchaseAmount] = useState<string>("")
  const [billNumber, setBillNumber] = useState<string>("")

  useEffect(() => {
    fetchLoadingShops()
    fetchCompletedLoadings()
  }, [])

  const fetchLoadingShops = async () => {
    setPendingLoading(true)
    const { data, error } = await supabase.from('shops').select('*').eq('marked_for_loading', true).order('name')
    if (error) {
      toast.error("Failed to load pending shops")
    } else {
      setShops(data || [])
    }
    setPendingLoading(false)
  }

  const fetchCompletedLoadings = async () => {
    setCompletedLoading(true)
    const { data, error } = await supabase.from('completed_loadings').select('*, shops(name, name_te)').order('completed_at', { ascending: false })
    if (error) {
      toast.error("Failed to fetch completed loadings")
    } else {
      setLoadings(data || [])
    }
    setCompletedLoading(false)
  }

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('shops').update({ marked_for_loading: false }).eq('id', id)
    if (!error) {
      toast.success(t("removedFromLoading", lang))
      fetchLoadingShops()
    }
  }

  const handleInitiateComplete = (shop: Shop) => {
    setCompleteModal(shop)
    setPurchaseAmount("")
    setBillNumber("")
  }

  const handleCompleteSave = async () => {
    if (!completeModal) return

    const parsedAmount = parseFloat(purchaseAmount.replace(/,/g, ''))
    const amount = isNaN(parsedAmount) ? 0 : parsedAmount

    let finalBill: number | null = null
    if (billNumber) {
      const parsed = parseInt(billNumber, 10)
      if (!isNaN(parsed)) finalBill = parsed
    }

    try {
      // Create completed loading record
      const { error: completedError } = await supabase.from('completed_loadings').insert([{
        shop_id: completeModal.id,
        shop_name: completeModal.name,
        shop_type: completeModal.type,
        loading_date: new Date().toISOString().split('T')[0],
        purchase_bill_number: finalBill,
        purchase_amount: amount
      }])
      
      if (completedError) throw completedError

      // Remove from pending
      await supabase.from('shops').update({ marked_for_loading: false }).eq('id', completeModal.id)

      toast.success(t("loadingCompleted", lang))
      setCompleteModal(null)
      fetchLoadingShops()
      fetchCompletedLoadings()
    } catch (err: any) {
      console.error("Supabase Error:", err)
      const errorMsg = err.message || err.details || JSON.stringify(err)
      toast.error("Failed to mark as completed: " + errorMsg)
    }
  }

  // Filter Completed Loadings
  const filteredLoadings = loadings.filter(l => {
    const nameToMatch = lang === 'te' && (l as any).shops?.name_te ? (l as any).shops.name_te : l.shop_name
    const matchesSearch = nameToMatch.toLowerCase().includes(search.toLowerCase()) || 
                          (l.purchase_bill_number?.toString() || "").includes(search)
    const matchesDate = dateFilter ? l.loading_date === dateFilter : true
    const matchesType = typeFilter === "All" ? true : l.shop_type === typeFilter
    return matchesSearch && matchesDate && matchesType
  })

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.text("Completed Loading Report", 14, 15)
    
    const head = [['S.No.', 'Date', 'Shop Name', 'Type', 'Bill No', 'Amount', 'Status']]
    const body = filteredLoadings.map((l, index) => [
      index + 1,
      formatDate(l.loading_date),
      l.shop_name,
      l.shop_type,
      l.purchase_bill_number || '-',
      `Rs ${l.purchase_amount.toLocaleString('en-IN')}`,
      'Completed'
    ])

    // @ts-ignore
    doc.autoTable({ head, body, startY: 25 })
    doc.save("Completed_Loading.pdf")
  }

  const renderCategory = (title: string, type: string) => {
    const categoryShops = shops.filter(s => s.type === type)
    if (categoryShops.length === 0) return null

    return (
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b pb-2">
          <Store className="w-5 h-5 text-primary" /> {title} ({categoryShops.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categoryShops.map(shop => (
            <div key={shop.id} className="bg-card border rounded-lg p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg">{lang === 'te' && shop.name_te ? shop.name_te : shop.name}</h3>
                  <p className="text-sm text-muted-foreground">{shop.type}</p>
                </div>
              </div>
              <div className="text-sm space-y-1">
                <p><span className="font-medium">{t("landmark", lang)}:</span> {lang === 'te' && shop.landmark_te ? shop.landmark_te : (shop.landmark || '-')}</p>
                <p><span className="font-medium">{t("contactPerson", lang)}:</span> {lang === 'te' && shop.contact_person_te ? shop.contact_person_te : (shop.contact_person || '-')}</p>
                <p><span className="font-medium">{t("mobile", lang)}:</span> {shop.mobile || '-'}</p>
                <p><span className="font-medium">{t("scheduledDate", lang)}:</span> {new Date().toLocaleDateString('en-IN')}</p>
              </div>
              <div className="pt-4 flex flex-col gap-2">
                <button 
                  onClick={() => navigate(`/purchasing?shopId=${shop.id}`)}
                  className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 flex justify-center items-center gap-2"
                >
                  <FileText className="w-4 h-4" /> {t("saveBill", lang)}
                </button>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleInitiateComplete(shop)}
                    className="flex-1 bg-green-600 text-white py-2 rounded-md text-sm font-medium hover:bg-green-700 flex justify-center items-center gap-1"
                  >
                    <CheckCircle className="w-4 h-4" /> {t("complete", lang)}
                  </button>
                  <button 
                    onClick={() => handleRemove(shop.id)}
                    className="flex-1 bg-red-100 text-red-700 py-2 rounded-md text-sm font-medium hover:bg-red-200 flex justify-center items-center gap-1"
                  >
                    <XCircle className="w-4 h-4" /> {t("remove", lang)}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Loading</h1>
      </div>

      <div className="flex justify-between items-center border-b pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('Pending')}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm flex items-center transition-colors ${
              activeTab === 'Pending' 
                ? 'bg-orange-100 text-orange-700' 
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Clock className="w-4 h-4 mr-2" /> {t("pendingLoading", lang)}
          </button>
          <button
            onClick={() => setActiveTab('Completed')}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm flex items-center transition-colors ${
              activeTab === 'Completed' 
                ? 'bg-green-100 text-green-700' 
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <CheckCircle className="w-4 h-4 mr-2" /> {t("completedLoading", lang)}
          </button>
        </div>

        {activeTab === 'Completed' && (
          <div className="flex gap-2">
            <button onClick={exportPDF} className="bg-red-600 text-white px-4 py-2 rounded flex items-center hover:bg-red-700 text-sm">
              <Download className="w-4 h-4 mr-2" /> {t("downloadPdf", lang)}
            </button>
            <button onClick={() => window.print()} className="border border-slate-300 bg-white px-4 py-2 rounded flex items-center hover:bg-slate-50 text-sm">
              <Printer className="w-4 h-4 mr-2" /> {t("print", lang)}
            </button>
          </div>
        )}
      </div>

      {activeTab === 'Pending' ? (
        <div>
          {pendingLoading ? (
            <p>{t("loading", lang)}...</p>
          ) : shops.length === 0 ? (
            <div className="bg-card p-10 text-center rounded-xl border">
              <p className="text-muted-foreground">No shops marked for loading tomorrow.</p>
            </div>
          ) : (
            <div>
              {renderCategory(lang === 'te' ? "వైన్ దుకాణాలు" : "Wine Shops", "Wine")}
              {renderCategory(lang === 'te' ? "ఆకివీడు వైన్ దుకాణాలు" : "Akividu Wine Shops", "Akividu Wine")}
              {renderCategory(lang === 'te' ? "ఐరన్ దుకాణాలు" : "Iron Shops", "Iron")}
              {renderCategory(lang === 'te' ? "పబ్లిక్ సప్లయర్స్" : "Public Suppliers", "Public")}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6 bg-card p-4 rounded-lg border shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder={t("searchShop", lang)} 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md text-sm"
              />
            </div>
            <input 
              type="date" 
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="border rounded-md px-4 py-2 text-sm"
            />
            <select 
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="border rounded-md px-4 py-2 text-sm"
            >
              <option value="All">{lang === 'te' ? "అన్ని రకాలు" : "All Types"}</option>
              <option value="Wine">{lang === 'te' ? "వైన్ దుకాణాలు" : "Wine Shops"}</option>
              <option value="Akividu Wine">{lang === 'te' ? "ఆకివీడు వైన్ దుకాణాలు" : "Akividu Wine Shops"}</option>
              <option value="Iron">{lang === 'te' ? "ఐరన్ దుకాణాలు" : "Iron Shops"}</option>
            </select>
          </div>

          <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 w-16">S.No.</th>
                    <th className="px-4 py-3">{lang === 'te' ? "పూర్తయిన సమయం" : "Completed On"}</th>
                    <th className="px-4 py-3">{t("loadingDate", lang)}</th>
                    <th className="px-4 py-3">{t("name", lang)}</th>
                    <th className="px-4 py-3">{t("type", lang)}</th>
                    <th className="px-4 py-3">{t("billNo", lang)}</th>
                    <th className="px-4 py-3">{t("amount", lang)}</th>
                    <th className="px-4 py-3">{t("status", lang)}</th>
                    <th className="px-4 py-3 text-right">{t("actions", lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {completedLoading ? (
                    <tr><td colSpan={9} className="text-center py-8">{t("loading", lang)}...</td></tr>
                  ) : filteredLoadings.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No completed loadings found matching filters.</td></tr>
                  ) : filteredLoadings.map((row, index) => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-3">{new Date(row.completed_at).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">{formatDate(row.loading_date)}</td>
                      <td className="px-4 py-3 font-medium">{lang === 'te' && (row as any).shops?.name_te ? (row as any).shops.name_te : row.shop_name}</td>
                      <td className="px-4 py-3">{row.shop_type}</td>
                      <td className="px-4 py-3">{row.purchase_bill_number ? `#${row.purchase_bill_number}` : '-'}</td>
                      <td className="px-4 py-3 font-semibold text-green-600">
                        ₹{row.purchase_amount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">{t("completed", lang)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-md" title="View Bill">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}      {/* Complete Loading Modal */}
      {completeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b bg-slate-50">
              <h2 className="text-xl font-bold text-center">{t("completeLoading", lang)}</h2>
              <p className="text-sm text-center text-muted-foreground">{lang === 'te' && completeModal.name_te ? completeModal.name_te : completeModal.name}</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="block font-medium text-sm text-slate-700">{t("amount", lang)} (₹)</label>
                <input 
                  type="number" 
                  className="w-full border p-3 rounded-lg text-lg font-semibold"
                  value={purchaseAmount}
                  onChange={e => setPurchaseAmount(e.target.value)}
                  placeholder="0"
                  autoFocus
                />
              </div>
 
              <div className="space-y-2">
                <label className="block font-medium text-sm text-slate-700">{t("billNo", lang)} ({t("optional", lang)})</label>
                <input 
                  type="number" 
                  className="w-full border p-3 rounded-lg text-lg font-semibold"
                  value={billNumber}
                  onChange={e => setBillNumber(e.target.value)}
                  placeholder="e.g. 101"
                />
              </div>
            </div>
 
            <div className="p-4 border-t flex gap-2 bg-slate-50">
              <button 
                onClick={() => setCompleteModal(null)} 
                className="flex-1 py-3 text-sm text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl font-medium transition-colors"
              >
                {t("cancel", lang)}
              </button>
              <button 
                onClick={handleCompleteSave} 
                className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors shadow-sm flex justify-center items-center"
              >
                <CheckCircle className="w-5 h-5 mr-2" /> {t("save", lang)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
