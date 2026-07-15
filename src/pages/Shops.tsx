import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Shop } from "@/types/database"
import { Plus, Search, Edit2, Trash2, History, Mic } from "lucide-react"
import { toast } from "sonner"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"

const WINE_FIXED_ITEMS = ["Beer", "L.C.'s", "Full's", "Atta", "Plastic", "Nibe Box", "Beer Box"]
const IRON_FIXED_ITEMS = ["Glass"]

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
  
  const [formData, setFormData] = useState<Partial<Shop>>({
    name: "", name_te: "", type: "Wine", landmark: "", landmark_te: "", contact_person: "", contact_person_te: "", mobile: "", whatsapp: "", address: "", address_te: "", marked_for_loading: false, shop_rates: {}
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
    const { error } = await supabase.from('shops').delete().eq('id', id)
    if (error) toast.error("Failed to delete")
    else {
      toast.success("Shop deleted")
      fetchShops()
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
    
    if (editingShop) {
      const { error } = await supabase.from('shops').update(payload).eq('id', editingShop.id)
      if (error) toast.error("Failed to update: " + error.message)
      else {
        toast.success(t("successUpdate", lang))
        setIsModalOpen(false)
        fetchShops()
      }
    } else {
      const { error } = await supabase.from('shops').insert([payload])
      if (error) toast.error("Failed to create: " + error.message)
      else {
        toast.success(t("successSave", lang))
        setIsModalOpen(false)
        fetchShops()
      }
    }
  }

  const openEdit = (shop: Shop) => {
    setEditingShop(shop)
    setFormData({ ...shop, shop_rates: shop.shop_rates || {} })
    setIsModalOpen(true)
  }

  const openCreate = () => {
    setEditingShop(null)
    setFormData({ name: "", name_te: "", type: typeFilter, landmark: "", landmark_te: "", contact_person: "", contact_person_te: "", mobile: "", whatsapp: "", address: "", address_te: "", marked_for_loading: false, shop_rates: {} })
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
                <tr><td colSpan={7} className="text-center py-8">{t("loading", lang)}...</td></tr>
              ) : filteredShops.map(shop => (
                <tr key={shop.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{lang === 'te' && shop.name_te ? shop.name_te : shop.name}</td>
                  <td className="px-4 py-3">{shop.type}</td>
                  <td className="px-4 py-3">{shop.mobile || '-'}</td>
                  <td className="px-4 py-3">{lang === 'te' && shop.landmark_te ? shop.landmark_te : (shop.landmark || '-')}</td>
                  <td className="px-4 py-3 text-center">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 accent-primary" 
                      checked={shop.marked_for_loading} 
                      readOnly 
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openHistory(shop)} className="text-gray-600 hover:bg-gray-100 p-2 rounded-md mr-1" title="History">
                      <History className="w-4 h-4" />
                    </button>
                    <button onClick={() => openEdit(shop)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-md mr-1" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(shop.id)} className="text-red-600 hover:bg-red-50 p-2 rounded-md" title="Delete">
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
              </div>

              {/* Shop Rates Section */}
              {getActiveItems().length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-bold border-b pb-2 mb-3">Fixed Item Rates (Required)</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {getActiveItems().map(item => (
                      <div key={item}>
                        <label className="block text-xs font-medium mb-1 text-muted-foreground">{item}</label>
                        <input 
                          type="number" 
                          step="0.01"
                          required
                          className="w-full border p-2 rounded text-sm" 
                          placeholder="0.00"
                          value={formData.shop_rates?.[item] !== undefined ? formData.shop_rates[item] : ""} 
                          onChange={e => handleRateChange(item, e.target.value)}
                        />
                      </div>
                    ))}
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
