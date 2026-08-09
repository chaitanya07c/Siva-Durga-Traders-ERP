import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Shop } from "@/types/database"
import { Plus, Search, Edit2, Trash2, History, Mic } from "lucide-react"
import { toast } from "sonner"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"
import { addToRecycleBin } from "@/lib/recycleBin"
import { DEFAULT_PURCHASE_UNITS, STANDARD_UNIT_OPTIONS } from "@/lib/utils"

const WINE_FIXED_ITEMS = ["Beer", "L.C.'s", "Full's", "Atta", "Plastic", "Nibe Box", "Beer Box"]
const IRON_FIXED_ITEMS = ["Glass", "Beer"]

export function Shops() {
  const { lang } = useOutletContext<{ lang: "en" | "te" }>()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"Wine" | "Akividu Wine" | "Iron">("Wine")
  const [isListening, setIsListening] = useState(false)

  const handleVoiceSearch = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.error(lang === 'te' ? "మీ బ్రౌజర్ లో వాయిస్ సెర్చ్ సపోర్ట్ చేయదు." : "Voice search is not supported in your browser.")
      return
    }
    
    const recognition = new SpeechRecognition()
    recognition.lang = lang === "te" ? "te-IN" : "en-IN"
    recognition.interimResults = false
    
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    
    recognition.onerror = (e: any) => {
      console.error(e)
      setIsListening(false)
      toast.error(lang === 'te' ? "వాయిస్ సెర్చ్ లో లోపం సంభవించింది" : "Error occurred in voice recognition")
    }
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setSearch(transcript)
    }
    
    recognition.start()
  }

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [editingShop, setEditingShop] = useState<Shop | null>(null)
  const [shopHistory, setShopHistory] = useState<any[]>([])
  const [shopFilterQuery, setShopFilterQuery] = useState("")
  
  const [formData, setFormData] = useState<Partial<Shop>>({
    name: "", name_te: "", type: "Wine", landmark: "", landmark_te: "", contact_person: "", contact_person_te: "", mobile: "", whatsapp: "", address: "", address_te: "", marked_for_loading: false, shop_rates: {}, shop_units: {}, combinable_shop_ids: []
  })

  useEffect(() => {
    fetchShops()
  }, [])

  const fetchShops = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('shops').select('*').order('name')
    if (error) {
      toast.error("Failed to fetch shops")
    } else {
      setShops(data || [])
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this shop?")) return
    try {
      const { data: shopData } = await supabase.from('shops').select('*').eq('id', id).single()
      if (shopData) {
        await addToRecycleBin({
          id: crypto.randomUUID(),
          type: 'shop',
          item_id: shopData.id,
          title: `Shop: ${shopData.name}`,
          shop_name: shopData.name,
          amount: 0,
          data: { shop: shopData },
          deleted_at: new Date().toISOString()
        })
      }
      const { error } = await supabase.from('shops').delete().eq('id', id)
      if (error) throw error
      toast.success("Shop moved to Recycle Bin!")
      fetchShops()
    } catch (err: any) {
      toast.error("Failed to delete shop: " + (err.message || ""))
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const payload = { ...formData }
    
    const activeItems = getActiveItems()
    if (activeItems.length > 0) {
      for (const item of activeItems) {
        if (payload.shop_rates?.[item] === undefined || payload.shop_rates?.[item] === null) {
          toast.error(`Please enter the rate for ${item}`)
          return
        }
      }
    } else {
      payload.shop_rates = {}
    }

    delete payload.id
    delete payload.created_at
    
    // Two-Way Sync calculation for combinable_shop_ids
    const currentShopId = editingShop ? editingShop.id : null
    const oldSelectedIds: string[] = editingShop?.combinable_shop_ids || []
    const newSelectedIds: string[] = payload.combinable_shop_ids || []

    const addedIds = newSelectedIds.filter(id => !oldSelectedIds.includes(id))
    const removedIds = oldSelectedIds.filter(id => !newSelectedIds.includes(id))

    if (editingShop) {
      const { error } = await supabase.from('shops').update(payload).eq('id', editingShop.id)
      if (error) {
        // Fallback retry without combinable_shop_ids if column is not in DB schema cache yet
        const fallbackPayload = { ...payload }
        delete (fallbackPayload as any).combinable_shop_ids
        const { error: retryError } = await supabase.from('shops').update(fallbackPayload).eq('id', editingShop.id)
        if (retryError) toast.error("Failed to update: " + retryError.message)
        else {
          toast.success(t("successUpdate", lang))
          setIsModalOpen(false)
          fetchShops()
        }
      } else {
        // Perform Two-Way database relationship sync for added/removed shops
        for (const targetId of addedIds) {
          const targetShop = shops.find(s => s.id === targetId)
          if (targetShop) {
            const existingIds: string[] = targetShop.combinable_shop_ids || []
            if (!existingIds.includes(currentShopId!)) {
              const updatedTargetIds = [...existingIds, currentShopId!]
              await supabase.from('shops').update({ combinable_shop_ids: updatedTargetIds }).eq('id', targetId)
            }
          }
        }
        for (const targetId of removedIds) {
          const targetShop = shops.find(s => s.id === targetId)
          if (targetShop) {
            const existingIds: string[] = targetShop.combinable_shop_ids || []
            if (existingIds.includes(currentShopId!)) {
              const updatedTargetIds = existingIds.filter(id => id !== currentShopId)
              await supabase.from('shops').update({ combinable_shop_ids: updatedTargetIds }).eq('id', targetId)
            }
          }
        }
        toast.success(t("successUpdate", lang))
        setIsModalOpen(false)
        fetchShops()
      }
    } else {
      const { data: insertedData, error } = await supabase.from('shops').insert([payload]).select()
      if (error) {
        // Fallback retry without combinable_shop_ids if column is not in DB schema cache yet
        const fallbackPayload = { ...payload }
        delete (fallbackPayload as any).combinable_shop_ids
        const { error: retryError } = await supabase.from('shops').insert([fallbackPayload])
        if (retryError) toast.error("Failed to create: " + retryError.message)
        else {
          toast.success(t("successSave", lang))
          setIsModalOpen(false)
          fetchShops()
        }
      } else {
        const newShopObj = insertedData?.[0]
        if (newShopObj && newSelectedIds.length > 0) {
          for (const targetId of newSelectedIds) {
            const targetShop = shops.find(s => s.id === targetId)
            if (targetShop) {
              const existingIds: string[] = targetShop.combinable_shop_ids || []
              if (!existingIds.includes(newShopObj.id)) {
                const updatedTargetIds = [...existingIds, newShopObj.id]
                await supabase.from('shops').update({ combinable_shop_ids: updatedTargetIds }).eq('id', targetId)
              }
            }
          }
        }
        toast.success(t("successSave", lang))
        setIsModalOpen(false)
        fetchShops()
      }
    }
  }

  const openEdit = (shop: Shop) => {
    setEditingShop(shop)
    setShopFilterQuery("")
    const initialUnits: Record<string, string> = { ...(shop.shop_units || {}) }
    WINE_FIXED_ITEMS.concat(IRON_FIXED_ITEMS).forEach(item => {
      if (!initialUnits[item]) {
        initialUnits[item] = DEFAULT_PURCHASE_UNITS[item] || "Nos"
      }
    })
    setFormData({ ...shop, shop_rates: shop.shop_rates || {}, shop_units: initialUnits, combinable_shop_ids: shop.combinable_shop_ids || [] })
    setIsModalOpen(true)
  }

  const openCreate = () => {
    setEditingShop(null)
    setShopFilterQuery("")
    const initialUnits: Record<string, string> = {}
    WINE_FIXED_ITEMS.concat(IRON_FIXED_ITEMS).forEach(item => {
      initialUnits[item] = DEFAULT_PURCHASE_UNITS[item] || "Nos"
    })
    setFormData({ name: "", name_te: "", type: typeFilter, landmark: "", landmark_te: "", contact_person: "", contact_person_te: "", mobile: "", whatsapp: "", address: "", address_te: "", marked_for_loading: false, shop_rates: {}, shop_units: initialUnits, combinable_shop_ids: [] })
    setIsModalOpen(true)
  }

  const openHistory = async (shop: Shop) => {
    setEditingShop(shop)
    setIsHistoryOpen(true)
    const { data } = await supabase.from('purchases').select('*').eq('shop_id', shop.id).order('date', { ascending: false })
    setShopHistory(data || [])
  }

  const filteredShops = shops.filter(s => {
    const matchesType = s.type === typeFilter
    const q = search.toLowerCase()
    const matchesSearch = !search || 
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.name_te && s.name_te.toLowerCase().includes(q)) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(q)) ||
      (s.contact_person_te && s.contact_person_te.toLowerCase().includes(q)) ||
      (s.mobile && s.mobile.includes(q)) ||
      (s.landmark && s.landmark.toLowerCase().includes(q)) ||
      (s.landmark_te && s.landmark_te.toLowerCase().includes(q));
    return matchesType && matchesSearch
  })

  const getActiveItems = () => {
    if (formData.type === "Iron") return IRON_FIXED_ITEMS
    if (formData.type === "Wine" || formData.type === "Akividu Wine") return WINE_FIXED_ITEMS
    return []
  }

  const handleRateChange = (item: string, value: string) => {
    setFormData(prev => {
      const newRates = { ...(prev.shop_rates || {}) }
      if (value === "") {
        delete newRates[item]
      } else {
        newRates[item] = Number(value)
      }
      return { ...prev, shop_rates: newRates }
    })
  }

  const handleUnitChange = (item: string, value: string) => {
    setFormData(prev => {
      const newUnits = { ...(prev.shop_units || {}) }
      newUnits[item] = value
      return { ...prev, shop_units: newUnits }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t("shopDetails", lang)}</h1>
        <button 
          onClick={openCreate}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md flex items-center hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t("addShop", lang)}
        </button>
      </div>

      <div className="flex border-b">
        {["Wine", "Akividu Wine", "Iron"].map((tab) => (
          <button
            key={tab}
            onClick={() => setTypeFilter(tab as any)}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              typeFilter === tab 
                ? 'border-b-2 border-primary text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === "Wine" ? (lang === 'te' ? "వైన్ దుకాణాలు" : "Wine Shops") : tab === "Iron" ? (lang === 'te' ? "ఐరన్ దుకాణాలు" : "Iron Shops") : (lang === 'te' ? "ఆకివీడు వైన్ దుకాణాలు" : "Akividu Wine Shops")}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input 
          type="text" 
          placeholder={lang === 'te' ? "దుకాణాలు, చిరునామా, మొబైల్ ద్వారా వెతకండి..." : "Search by name, contact, mobile, landmark..."} 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <button 
          type="button"
          onClick={handleVoiceSearch}
          className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors ${isListening ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`}
        >
          <Mic className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 w-16">S.No.</th>
                <th className="px-4 py-3">{t("name", lang)}</th>
                <th className="px-4 py-3">{t("type", lang)}</th>
                <th className="px-4 py-3">{t("mobile", lang)}</th>
                <th className="px-4 py-3">{t("landmark", lang)}</th>
                <th className="px-4 py-3 text-center">{lang === 'te' ? "రేపటి లోడింగ్" : "Loading Tmro"}</th>
                <th className="px-4 py-3 text-right">{t("actions", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8">{t("loading", lang)}...</td></tr>
              ) : filteredShops.map((shop, index) => (
                <tr key={shop.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3 text-muted-foreground font-medium">{index + 1}</td>
                  <td className="px-4 py-3 font-medium">{lang === 'te' && shop.name_te ? shop.name_te : shop.name}</td>
                  <td className="px-4 py-3">{shop.type}</td>
                  <td className="px-4 py-3">{shop.mobile || '-'}</td>
                  <td className="px-4 py-3">{lang === 'te' && shop.landmark_te ? shop.landmark_te : (shop.landmark || '-')}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={async () => {
                        try {
                          const newVal = !shop.marked_for_loading;
                          const { error } = await supabase
                            .from('shops')
                            .update({ marked_for_loading: newVal })
                            .eq('id', shop.id);
                          if (error) throw error;
                          toast.success(newVal ? (lang === 'te' ? "రేపటి లోడింగ్ కోసం చేర్చబడింది!" : "Marked for Tomorrow Loading!") : (lang === 'te' ? "రేపటి లోడింగ్ నుండి తొలగించబడింది!" : "Removed from Tomorrow Loading!"));
                          fetchShops();
                        } catch (err: any) {
                          toast.error(err.message || "Error updating loading status");
                        }
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                        shop.marked_for_loading 
                          ? 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200' 
                          : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {shop.marked_for_loading ? (
                        <>✓ {lang === 'te' ? "చేర్చబడింది" : "Added"}</>
                      ) : (
                        <>🚚 {lang === 'te' ? "రేపటి లోడింగ్" : "Tomorrow Loading"}</>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openHistory(shop)} className="text-gray-600 hover:bg-gray-100 p-2 rounded-md mr-1" title="History">
                      <History className="w-4 h-4" />
                    </button>
                    <button onClick={() => openEdit(shop)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-md mr-1" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(shop.id)} className="text-red-600 hover:bg-red-50 p-2 rounded" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background w-full max-w-2xl rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingShop ? t("editShop", lang) : t("addShop", lang)}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("name", lang)} *</label>
                  <input required type="text" className="w-full border p-2 rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("nameTe", lang)}</label>
                  <input type="text" className="w-full border p-2 rounded" value={formData.name_te || ""} onChange={e => setFormData({...formData, name_te: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("type", lang)} *</label>
                  <select required className="w-full border p-2 rounded" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option value="Iron">Iron</option>
                    <option value="Wine">Wine</option>
                    <option value="Akividu Wine">Akividu Wine</option>
                    <option value="Public">Public Supplier</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("contactPerson", lang)}</label>
                  <input type="text" className="w-full border p-2 rounded" value={formData.contact_person || ""} onChange={e => setFormData({...formData, contact_person: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("contactPersonTe", lang)}</label>
                  <input type="text" className="w-full border p-2 rounded" value={formData.contact_person_te || ""} onChange={e => setFormData({...formData, contact_person_te: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("landmark", lang)}</label>
                  <input type="text" className="w-full border p-2 rounded" value={formData.landmark || ""} onChange={e => setFormData({...formData, landmark: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("landmarkTe", lang)}</label>
                  <input type="text" className="w-full border p-2 rounded" value={formData.landmark_te || ""} onChange={e => setFormData({...formData, landmark_te: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("mobile", lang)}</label>
                  <input type="text" className="w-full border p-2 rounded" value={formData.mobile || ""} onChange={e => setFormData({...formData, mobile: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("whatsapp", lang)}</label>
                  <input type="text" className="w-full border p-2 rounded" value={formData.whatsapp || ""} onChange={e => setFormData({...formData, whatsapp: e.target.value})} />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">{t("address", lang)}</label>
                  <textarea className="w-full border p-2 rounded" rows={2} value={formData.address || ""} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium mb-1">{t("addressTe", lang)}</label>
                  <textarea className="w-full border p-2 rounded" rows={2} value={formData.address_te || ""} onChange={e => setFormData({...formData, address_te: e.target.value})} />
                </div>
                <div className="col-span-1 sm:col-span-2 flex items-center gap-2 mt-2 border-b pb-4">
                  <input 
                    type="checkbox" 
                    id="loadingCheck"
                    className="w-5 h-5 accent-primary cursor-pointer"
                    checked={formData.marked_for_loading || false} 
                    onChange={e => setFormData({...formData, marked_for_loading: e.target.checked})} 
                  />
                  <label htmlFor="loadingCheck" className="text-sm font-medium cursor-pointer">{t("markedForLoading", lang)}</label>
                </div>

                {/* Combined Bills Configuration Section */}
                <div className="col-span-1 sm:col-span-2 border-t pt-4 mt-2">
                  <label className="block text-sm font-bold text-slate-800 mb-1">
                    {lang === 'te' ? "కంబైన్డ్ బిల్లుల షాపుల ఎంపిక (Combined Bills)" : "Combined Bills Configuration"}
                  </label>
                  <p className="text-xs text-muted-foreground mb-3">
                    {lang === 'te' 
                      ? "ఈ షాపుతో కలిపి కంబైన్డ్ బిల్లు తయారుచేయదగిన ఇతర షాపులను ఎంచుకోండి." 
                      : "Select which other shops can be combined with this shop."}
                  </p>
                  
                  {/* Search filter inside modal */}
                  <div className="relative mb-2">
                    <input 
                      type="text" 
                      placeholder={lang === 'te' ? "షాపుల పేరు ద్వారా వెతకండి..." : "Filter shop names..."} 
                      value={shopFilterQuery}
                      onChange={e => setShopFilterQuery(e.target.value)}
                      className="w-full text-xs border p-2 pl-8 rounded bg-background"
                    />
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>

                  {/* Scrollable multi-select checkbox list prioritizing SELECTED SHOPS */}
                  {(() => {
                    const selectedIds = formData.combinable_shop_ids || []
                    const candidateShops = shops
                      .filter(s => s.id !== editingShop?.id)
                      .filter(s => {
                        if (!shopFilterQuery) return true
                        const q = shopFilterQuery.toLowerCase()
                        return s.name.toLowerCase().includes(q) || (s.landmark && s.landmark.toLowerCase().includes(q))
                      })

                    const selectedShopsList = candidateShops
                      .filter(s => selectedIds.includes(s.id))
                      .sort((a, b) => a.name.localeCompare(b.name))

                    const unselectedShopsList = candidateShops
                      .filter(s => !selectedIds.includes(s.id))
                      .sort((a, b) => a.name.localeCompare(b.name))

                    if (candidateShops.length === 0) {
                      return (
                        <div className="border rounded-lg p-3 bg-muted/20 text-center">
                          <p className="text-xs text-muted-foreground italic py-1">No matching shops available.</p>
                        </div>
                      )
                    }

                    return (
                      <div className="max-h-56 overflow-y-auto border rounded-lg p-2.5 bg-muted/20 space-y-3">
                        {/* Selected Shops Section at Top */}
                        {selectedShopsList.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between px-1 mb-1.5 border-b pb-1">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                {lang === 'te' ? "ఎంచుకున్న షాపులు" : "Selected Shops"}
                              </span>
                              <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                {selectedShopsList.length}
                              </span>
                            </div>
                            <div className="space-y-1 bg-emerald-50/40 p-1.5 rounded-md border border-emerald-100">
                              {selectedShopsList.map(otherShop => (
                                <label key={otherShop.id} className="flex items-center justify-between text-xs cursor-pointer bg-white hover:bg-emerald-50 p-1.5 rounded border border-emerald-200 shadow-sm transition-all">
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="checkbox"
                                      checked={true}
                                      onChange={() => {
                                        const currentIds = formData.combinable_shop_ids || []
                                        const updatedIds = currentIds.filter(id => id !== otherShop.id)
                                        setFormData({ ...formData, combinable_shop_ids: updatedIds })
                                      }}
                                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                                    />
                                    <span className="font-bold text-slate-900">{lang === 'te' && otherShop.name_te ? otherShop.name_te : otherShop.name}</span>
                                    {otherShop.landmark && <span className="text-[11px] text-muted-foreground">({otherShop.landmark})</span>}
                                  </div>
                                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{otherShop.type}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Other Shops Section Below */}
                        {unselectedShopsList.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between px-1 mb-1.5 border-b pb-1">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                                {lang === 'te' ? "ఇతర షాపులు" : "Other Shops"}
                              </span>
                              <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                                {unselectedShopsList.length}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {unselectedShopsList.map(otherShop => (
                                <label key={otherShop.id} className="flex items-center justify-between text-xs cursor-pointer hover:bg-muted/40 p-1.5 rounded border border-border/50 transition-colors">
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="checkbox"
                                      checked={false}
                                      onChange={() => {
                                        const currentIds = formData.combinable_shop_ids || []
                                        const updatedIds = [...currentIds, otherShop.id]
                                        setFormData({ ...formData, combinable_shop_ids: updatedIds })
                                      }}
                                      className="w-4 h-4 accent-primary rounded cursor-pointer"
                                    />
                                    <span className="font-semibold text-slate-800">{lang === 'te' && otherShop.name_te ? otherShop.name_te : otherShop.name}</span>
                                    {otherShop.landmark && <span className="text-[11px] text-muted-foreground">({otherShop.landmark})</span>}
                                  </div>
                                  <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">{otherShop.type}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* Shop Rates & Quantity Type Section */}
              {getActiveItems().length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-bold border-b pb-2 mb-3">Item Rates & Quantity Types</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {getActiveItems().map(item => {
                      const currentUnit = formData.shop_units?.[item] !== undefined ? formData.shop_units[item] : (DEFAULT_PURCHASE_UNITS[item] || "Nos")
                      return (
                        <div key={item} className="p-3 border rounded-lg bg-muted/20 space-y-2">
                          <label className="block text-xs font-bold text-slate-800">{item}</label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Cost (₹) *</label>
                              <input 
                                type="number" 
                                step="0.01"
                                required
                                className="w-full border p-2 rounded text-sm bg-background" 
                                placeholder="0.00"
                                value={formData.shop_rates?.[item] !== undefined ? formData.shop_rates[item] : ""} 
                                onChange={e => handleRateChange(item, e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-muted-foreground mb-1">Quantity Type (Unit) *</label>
                              <input 
                                type="text"
                                required
                                className="w-full border p-2 rounded text-sm bg-background font-medium" 
                                placeholder="Nos, Kg, Litres..."
                                value={currentUnit} 
                                onChange={e => handleUnitChange(item, e.target.value)}
                                list={`unitsList-${item}`}
                              />
                              <datalist id={`unitsList-${item}`}>
                                {STANDARD_UNIT_OPTIONS.map(opt => <option key={opt} value={opt} />)}
                              </datalist>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded hover:bg-muted">{t("cancel", lang)}</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">{t("save", lang)}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isHistoryOpen && editingShop && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background w-full max-w-2xl rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingShop.name} - Purchase History</h2>
            {shopHistory.length === 0 ? (
              <p className="text-muted-foreground text-sm">No purchases recorded for this shop.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border">
                  <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2">Bill No</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Grand Total</th>
                  </tr>
                </thead>
                <tbody>
                  {shopHistory.map(h => (
                    <tr key={h.id} className="border-b">
                      <td className="px-4 py-2">#{h.bill_number}</td>
                      <td className="px-4 py-2">{h.date}</td>
                      <td className="px-4 py-2 font-semibold">₹{h.grand_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            <div className="flex justify-end mt-6">
              <button onClick={() => setIsHistoryOpen(false)} className="px-4 py-2 border rounded hover:bg-muted">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
