import { useEffect, useState } from "react"
import { Moon, Sun, Plus, Edit2, Trash2, Package, Globe, RotateCcw, AlertTriangle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Material } from "@/types/database"
import { toast } from "sonner"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"
import { getRecycleBinItems, restoreFromRecycleBin, deletePermanentlyFromRecycleBin, addToRecycleBin, type RecycleBinItem } from "@/lib/recycleBin"
import { formatDate } from "@/lib/utils"

const formatInr = (val: number) => new Intl.NumberFormat('en-IN').format(val)

export function Settings() {
  const [activeTab, setActiveTab] = useState<"general" | "items" | "recycle_bin">("general")
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const { lang, setLang } = useOutletContext<{ lang: "en" | "te", setLang: (lang: "en" | "te") => void }>()

  // Sales Items State
  const [materials, setMaterials] = useState<Material[]>([])
  const [search, setSearch] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Material | null>(null)
  
  const [formName, setFormName] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [formNameTe, setFormNameTe] = useState("")
  const [formCategoryTe, setFormCategoryTe] = useState("")
  const [formDefaultCost, setFormDefaultCost] = useState("")
  const [formUnit, setFormUnit] = useState("Nos")

  // Recycle Bin State
  const [recycleBinItems, setRecycleBinItems] = useState<RecycleBinItem[]>([])
  const [loadingRecycleBin, setLoadingRecycleBin] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{
    action: 'restore' | 'delete',
    item: RecycleBinItem
  } | null>(null)

  useEffect(() => {
    if (document.documentElement.classList.contains("dark")) {
      setTheme("dark")
    }
    loadMaterials()
    loadRecycleBin()
  }, [])

  useEffect(() => {
    if (activeTab === "recycle_bin") {
      loadRecycleBin()
    }
  }, [activeTab])

  const toggleTheme = () => {
    if (theme === "light") {
      document.documentElement.classList.add("dark")
      setTheme("dark")
    } else {
      document.documentElement.classList.remove("dark")
      setTheme("light")
    }
  }

  const loadMaterials = async () => {
    const { data } = await supabase.from('materials').select('*').order('category').order('name')
    if (data) setMaterials(data)
  }

  const loadRecycleBin = async () => {
    setLoadingRecycleBin(true)
    try {
      const items = await getRecycleBinItems()
      setRecycleBinItems(items)
    } catch (e) {
      console.error("Error loading recycle bin:", e)
    } finally {
      setLoadingRecycleBin(false)
    }
  }

  const handleRestoreItem = async (item: RecycleBinItem) => {
    try {
      await restoreFromRecycleBin(item.id)
      toast.success(lang === 'te' ? "బిల్లు విజ‌య‌వంతంగా రీస్టోర్ చేయ‌బ‌డింది!" : "Bill restored successfully!")
      setConfirmModal(null)
      loadRecycleBin()
    } catch (err: any) {
      console.error("Error restoring bill:", err)
      toast.error(err.message || "Error restoring bill")
    }
  }

  const handlePermanentDelete = async (item: RecycleBinItem) => {
    try {
      await deletePermanentlyFromRecycleBin(item.id)
      toast.success(lang === 'te' ? "శాశ్వతంగా తొలగించబడింది" : "Permanently deleted")
      setConfirmModal(null)
      loadRecycleBin()
    } catch (err: any) {
      console.error("Error permanently deleting bill:", err)
      toast.error(err.message || "Error deleting bill")
    }
  }

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formCategory.trim()) return toast.error(t("errFieldsRequired", lang))
    
    const cost = parseFloat(formDefaultCost)
    if (isNaN(cost) || cost < 0) {
      return toast.error("Please enter a valid default cost")
    }

    try {
      const payload = {
        name: formName,
        name_te: formNameTe,
        category: formCategory,
        category_te: formCategoryTe,
        default_cost: cost,
        unit: formUnit.trim() || "Nos"
      }
      if (editingItem) {
        await supabase.from('materials').update(payload).eq('id', editingItem.id)
        toast.success(t("successUpdate", lang))
      } else {
        await supabase.from('materials').insert([payload])
        toast.success(t("successSave", lang))
      }
      setIsModalOpen(false)
      loadMaterials()
    } catch (err: any) {
      toast.error(err.message || "Error saving item")
    }
  }

  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return
    try {
      const { data: matData } = await supabase.from('materials').select('*').eq('id', id).single()
      if (matData) {
        await addToRecycleBin({
          id: crypto.randomUUID(),
          type: 'material',
          item_id: matData.id,
          title: `Item: ${matData.name}`,
          amount: Number(matData.default_cost || 0),
          data: { material: matData },
          deleted_at: new Date().toISOString()
        })
      }
      await supabase.from('materials').delete().eq('id', id)
      toast.success("Item moved to Recycle Bin!")
      loadMaterials()
    } catch (err: any) {
      toast.error(err.message || "Error deleting item")
    }
  }

  const openModal = (item?: Material) => {
    if (item) {
      setEditingItem(item)
      setFormName(item.name)
      setFormNameTe(item.name_te || "")
      setFormCategory(item.category)
      setFormCategoryTe(item.category_te || "")
      setFormDefaultCost(item.default_cost !== undefined && item.default_cost !== null ? String(item.default_cost) : "")
      setFormUnit(item.unit || "Nos")
    } else {
      setEditingItem(null)
      setFormName("")
      setFormNameTe("")
      setFormCategory("")
      setFormCategoryTe("")
      setFormDefaultCost("")
      setFormUnit("Nos")
    }
    setIsModalOpen(true)
  }

  const categories = Array.from(new Set(materials.map(m => m.category)))
  const filteredMaterials = materials.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    (m.name_te && m.name_te.includes(search)) ||
    m.category.toLowerCase().includes(search.toLowerCase()) ||
    (m.category_te && m.category_te.includes(search))
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t("settings", lang)}</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 space-y-2">
          <button 
            onClick={() => setActiveTab("general")}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${activeTab === "general" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {t("generalSettings", lang)}
          </button>
          <button 
            onClick={() => setActiveTab("items")}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors flex items-center ${activeTab === "items" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            <Package className="w-4 h-4 mr-2" /> {t("salesItems", lang)}
          </button>
          <button 
            onClick={() => setActiveTab("recycle_bin")}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors flex items-center ${activeTab === "recycle_bin" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            <Trash2 className="w-4 h-4 mr-2" /> {t("recycleBin", lang)}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-card rounded-xl border shadow-sm min-h-[500px]">
          
          {/* GENERAL SETTINGS TAB */}
          {activeTab === "general" && (
            <div className="p-6 space-y-8">
              <div>
                <h2 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" /> {t("appLanguage", lang)}
                </h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("appLanguage", lang)}</p>
                    <p className="text-sm text-muted-foreground">{t("appLanguageDesc", lang)}</p>
                  </div>
                  <div className="relative">
                    <select
                      value={lang}
                      onChange={(e) => setLang(e.target.value as "en" | "te")}
                      className="appearance-none bg-secondary hover:bg-secondary/80 border-none rounded-lg px-4 py-2.5 pr-10 font-medium cursor-pointer outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="en">English</option>
                      <option value="te">తెలుగు</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                      <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-4 border-b pb-2">{t("appTheme", lang)}</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t("appTheme", lang)}</p>
                    <p className="text-sm text-muted-foreground">{t("appThemeDesc", lang)}</p>
                  </div>
                  <button 
                    onClick={toggleTheme}
                    className="p-3 bg-secondary rounded-lg hover:bg-secondary/80 flex items-center gap-2"
                  >
                    {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    <span className="capitalize">{theme} Mode</span>
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-4 border-b pb-2">{t("dbConnection", lang)}</h2>
                <div className="space-y-2">
                  <p className="text-sm"><span className="font-medium">Status:</span> <span className="text-green-600 font-bold">Connected (Supabase)</span></p>
                  <p className="text-sm"><span className="font-medium">URL:</span> {import.meta.env.VITE_SUPABASE_URL}</p>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-4 border-b pb-2">{t("sysInfo", lang)}</h2>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Siva Durga Traders ERP v1.0.0</p>
                  <p>Developed with React & Supabase</p>
                </div>
              </div>
            </div>
          )}

          {/* SALES ITEMS TAB */}
          {activeTab === "items" && (
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Manage Items & Categories</h2>
                <button onClick={() => openModal()} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm flex items-center hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" /> Add Item
                </button>
              </div>

              <input 
                type="text" 
                placeholder="Search items or categories..." 
                className="w-full border p-2 rounded-lg"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3">{t("category", lang)}</th>
                      <th className="px-4 py-3">{t("name", lang)}</th>
                      <th className="px-4 py-3 text-center">{t("unit", lang)}</th>
                      <th className="px-4 py-3 text-right">{lang === 'te' ? "డిఫాల్ట్ ధర (₹)" : "Default Cost (₹)"}</th>
                      <th className="px-4 py-3 text-right">{t("actions", lang)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredMaterials.map(m => (
                      <tr key={m.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium text-muted-foreground">{lang === 'te' && m.category_te ? m.category_te : m.category}</td>
                        <td className="px-4 py-3 font-semibold">{lang === 'te' && m.name_te ? m.name_te : m.name}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-muted px-2.5 py-1 rounded-full text-xs font-semibold text-foreground border">
                            {m.unit || "Nos"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">₹{m.default_cost !== undefined && m.default_cost !== null ? Number(m.default_cost).toFixed(2) : "0.00"}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openModal(m)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded mr-1"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteItem(m.id, m.name)} className="text-red-600 hover:bg-red-50 p-1.5 rounded"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                    {filteredMaterials.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No items found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* RECYCLE BIN TAB */}
          {activeTab === "recycle_bin" && (
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center border-b pb-4">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-red-500" />
                    {t("recycleBin", lang)}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lang === 'te'
                      ? "తొలగించబడిన బిల్లులను నిర్వహించండి. రీస్టోర్ చేయడంతో అన్ని విభాగాలలో డేటా తిరిగి వస్తుంది."
                      : "Manage deleted bills. Restoring a bill recovers all related records across Purchasing, Payments, Dashboard, Reports, and Stock."}
                  </p>
                </div>
                <button
                  onClick={loadRecycleBin}
                  className="text-xs font-semibold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20 transition-colors"
                >
                  {lang === 'te' ? "రిఫ్రెష్" : "Refresh"}
                </button>
              </div>

              {loadingRecycleBin ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  {lang === 'te' ? "డేటా లోడ్ అవుతోంది..." : "Loading recycle bin..."}
                </div>
              ) : recycleBinItems.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed rounded-xl bg-muted/20 space-y-2">
                  <Trash2 className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
                  <p className="text-sm font-semibold text-muted-foreground">
                    {t("emptyRecycleBin", lang)}
                  </p>
                </div>
              ) : (
                <div className="border rounded-xl overflow-x-auto shadow-sm">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Module</th>
                        <th className="px-4 py-3 font-semibold">Record / Title</th>
                        <th className="px-4 py-3 font-semibold">{t("deletedDate", lang)}</th>
                        <th className="px-4 py-3 font-semibold text-right">{lang === 'te' ? "మొత్తం అమౌంట్" : "Amount"}</th>
                        <th className="px-4 py-3 font-semibold text-center">{t("actions", lang)}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {recycleBinItems.map((item) => {
                        const typeLabel = 
                          item.type === 'purchase_bill' || item.type === 'purchase' ? 'Purchasing' :
                          item.type === 'sale_bill' || item.type === 'sale' ? 'Sales' :
                          item.type === 'shop' ? 'Shop' :
                          item.type === 'worker' || item.type === 'employee' ? 'Worker' :
                          item.type === 'expense' ? 'Expense' :
                          item.type === 'buyer' ? 'Buyer' :
                          item.type === 'material' ? 'Stock / Material' :
                          item.type === 'loading' ? 'Loading' : 'Other'

                        const badgeColor = 
                          typeLabel === 'Purchasing' ? 'bg-purple-100 text-purple-700' :
                          typeLabel === 'Sales' ? 'bg-blue-100 text-blue-700' :
                          typeLabel === 'Shop' ? 'bg-amber-100 text-amber-700' :
                          typeLabel === 'Worker' ? 'bg-emerald-100 text-emerald-700' :
                          typeLabel === 'Expense' ? 'bg-red-100 text-red-700' :
                          typeLabel === 'Buyer' ? 'bg-indigo-100 text-indigo-700' :
                          'bg-slate-100 text-slate-700'

                        return (
                          <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className={`px-2.5 py-1 rounded text-xs font-bold ${badgeColor}`}>
                                {typeLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-foreground">
                              {item.title || item.shop_name || (item.bill_number ? `Bill #${item.bill_number}` : 'Deleted Item')}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(item.deleted_at)} {new Date(item.deleted_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-3 text-right font-extrabold text-foreground whitespace-nowrap">
                              {Number(item.amount || 0) > 0 ? `₹${formatInr(item.amount)}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => setConfirmModal({ action: 'restore', item })}
                                  className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center transition-colors shadow-sm"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                  {t("restore", lang)}
                                </button>
                                <button
                                  onClick={() => setConfirmModal({ action: 'delete', item })}
                                  className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center transition-colors shadow-sm"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                                  {t("deletePermanently", lang)}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Recycle Bin Action Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6 text-center space-y-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
              confirmModal.action === 'restore' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}>
              {confirmModal.action === 'restore' ? <RotateCcw className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            
            <h2 className="text-xl font-bold text-foreground">
              {confirmModal.action === 'restore' 
                ? (lang === 'te' ? "బిల్లును రీస్టోర్ చేయాలా?" : "Restore Bill") 
                : (lang === 'te' ? "శాశ్వతంగా తొలగించాలా?" : "Delete Permanently")}
            </h2>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {confirmModal.action === 'restore'
                ? (lang === 'te'
                    ? `${confirmModal.item.shop_name} కొరకు బిల్లు #${confirmModal.item.bill_number || ''} ని తిరిగి రీస్టోర్ చేయాలనుకుంటున్నారా? ఇది కొనుగోళ్లు, చెల్లింపులు, డ్యాష్‌బోర్డ్, నివేదికలు మరియు స్టాక్ డేటాలో తిరిగి వస్తుంది.`
                    : `Are you sure you want to restore Bill #${confirmModal.item.bill_number || ''} for ${confirmModal.item.shop_name}? All records will be automatically recovered across Purchasing, Payments, Dashboard, Reports, and Stock.`)
                : (lang === 'te'
                    ? `మీరు ఈ బిల్లును శాశ్వతంగా తొలగించాలనుకుంటున్నారా? ఈ చర్యను రద్దు చేయలేరు.`
                    : `Are you sure you want to permanently delete Bill #${confirmModal.item.bill_number || ''}? This action cannot be undone.`)}
            </p>

            <div className="pt-2 flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 border rounded-xl font-semibold hover:bg-slate-100 transition-colors text-sm"
              >
                {t("cancel", lang)}
              </button>
              
              {confirmModal.action === 'restore' ? (
                <button
                  onClick={() => handleRestoreItem(confirmModal.item)}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors shadow-sm text-sm"
                >
                  {t("restore", lang)}
                </button>
              ) : (
                <button
                  onClick={() => handlePermanentDelete(confirmModal.item)}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors shadow-sm text-sm"
                >
                  {t("deletePermanently", lang)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-md rounded-xl shadow-lg flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-muted/30">
              <h2 className="text-lg font-bold">{editingItem ? "Edit Item" : "Add New Item"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            
            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t("name", lang)} *</label>
                <input 
                  type="text" 
                  className="w-full border p-2 rounded"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Kingfisher Red"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("nameTe", lang)}</label>
                <input 
                  type="text" 
                  className="w-full border p-2 rounded"
                  value={formNameTe}
                  onChange={e => setFormNameTe(e.target.value)}
                  placeholder="ఉదా. కింగ్‌ఫిషర్ రెడ్"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("category", lang)} *</label>
                <input 
                  type="text" 
                  className="w-full border p-2 rounded"
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value)}
                  placeholder="e.g. Beer Bottles"
                  list="categoriesList"
                  required
                />
                <datalist id="categoriesList">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("categoryTe", lang)}</label>
                <input 
                  type="text" 
                  className="w-full border p-2 rounded"
                  value={formCategoryTe}
                  onChange={e => setFormCategoryTe(e.target.value)}
                  placeholder="ఉదా. బీర్ బాటిల్స్"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("unit", lang)} *</label>
                <input 
                  type="text" 
                  className="w-full border p-2 rounded bg-background font-medium text-sm"
                  value={formUnit}
                  onChange={e => setFormUnit(e.target.value)}
                  placeholder="e.g. Nos, Kg, Litres, Box, Packet, Ton"
                  list="unitsList"
                  required
                />
                <datalist id="unitsList">
                  <option value="Nos" />
                  <option value="Kg" />
                  <option value="Litres" />
                  <option value="Box" />
                  <option value="Packet" />
                  <option value="Ton" />
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{lang === 'te' ? "డిఫాల్ట్ ధర (₹) *" : "Default Cost (₹) *"}</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="w-full border p-2 rounded"
                  value={formDefaultCost}
                  onChange={e => setFormDefaultCost(e.target.value)}
                  placeholder="e.g. 150.00"
                  required
                />
              </div>
              
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted font-medium">Cancel</button>
                <button type="submit" className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90">
                  {editingItem ? "Save Changes" : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
