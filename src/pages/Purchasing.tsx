import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import type { Shop } from "@/types/database"
import { toast } from "sonner"
import { useSearchParams, useOutletContext } from "react-router-dom"
import { generateCombinedPDF, shareWhatsApp, buildCurrentSession } from "@/lib/pdfUtils"
import { Printer, Download, Share2, Save, StoreIcon, CheckCircle2, Search, Mic } from "lucide-react"
import { t } from "@/lib/i18n"

const WINE_FIXED_ITEMS = ["Beer", "L.C.'s", "Full's", "Atta", "Plastic", "Nibe Box", "Beer Box"]
const IRON_FIXED_ITEMS = ["Glass"]

type LineItem = { name: string, quantity: number, rate: number, total: number }

const formatInr = (value: number) => new Intl.NumberFormat('en-IN').format(value)

const getItemName = (name: string, lang: 'en' | 'te') => {
  if (lang === 'te') {
    if (name === "Beer") return "బీర్"
    if (name === "L.C.'s") return "ఎల్.సి.లు"
    if (name === "Full's") return "ఫుల్స్"
    if (name === "Atta") return "అట్ట"
    if (name === "Plastic") return "ప్లాస్టిక్"
    if (name === "Nibe Box") return "నిబ్ బాక్స్"
    if (name === "Beer Box") return "బీర్ బాక్స్"
    if (name === "Glass") return "గ్లాస్"
  }
  return name
}

export function Purchasing() {
  const { lang } = useOutletContext<{ lang: "en" | "te" }>()
  const [searchParams] = useSearchParams()
  const initialShopId = searchParams.get('shopId')

  const [activeTab, setActiveTab] = useState<"Wine" | "Akividu Wine" | "Iron">("Wine")
  const [shops, setShops] = useState<Shop[]>([])
  const [selectedShopId, setSelectedShopId] = useState<string>("")
  const [search, setSearch] = useState("")
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
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [items, setItems] = useState<LineItem[]>([])
  const [previousBalance, setPreviousBalance] = useState(0)
  const [advance, setAdvance] = useState(0)
  const [remarks, setRemarks] = useState("")

  const [savedBillId, setSavedBillId] = useState<string | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string>(crypto.randomUUID())

  const shopSelectRef = useRef<HTMLSelectElement>(null)
  const prevShopIdRef = useRef<string>("")

  useEffect(() => {
    loadShops()
  }, [])

  useEffect(() => {
    const defaultItems = (activeTab === "Iron" ? IRON_FIXED_ITEMS : WINE_FIXED_ITEMS).map(name => ({
      name, quantity: 0, rate: 0, total: 0
    }))
    setItems(defaultItems)
    setSelectedShopId("")
    setSavedBillId(null)
    setCurrentSessionId(crypto.randomUUID())
  }, [activeTab])

  useEffect(() => {
    if (initialShopId && shops.length > 0 && !savedBillId) {
      const shop = shops.find(s => s.id === initialShopId)
      if (shop) {
        if (shop.type === "Wine" || shop.type === "Akividu Wine" || shop.type === "Iron") {
          setActiveTab(shop.type as any)
          setSelectedShopId(shop.id)
        }
      }
    }
  }, [initialShopId, shops])

  useEffect(() => {
    if (selectedShopId) {
      const shop = shops.find(s => s.id === selectedShopId) || null
      
      if (shop && selectedShopId !== prevShopIdRef.current) {
        setItems(prevItems => prevItems.map(item => {
          const shopRates = shop.shop_rates as Record<string, number> || {}
          const defaultRate = shopRates[item.name] || 0
          return {
            ...item,
            rate: defaultRate,
            total: Number((item.quantity * defaultRate).toFixed(2))
          }
        }))
        prevShopIdRef.current = selectedShopId
      }
    } else {
      prevShopIdRef.current = ""
    }
  }, [selectedShopId, shops])

  const loadShops = async () => {
    const { data } = await supabase.from('shops').select('*').order('name')
    if (data) setShops(data)
  }

  const updateItem = (index: number, field: keyof LineItem, value: number) => {
    setItems(prev => {
      const newItems = [...prev]
      newItems[index] = { ...newItems[index], [field]: value }
      if (field === 'quantity' || field === 'rate') {
        newItems[index].total = Number((newItems[index].quantity * newItems[index].rate).toFixed(2))
      }
      return newItems
    })
  }

  const subTotal = items.reduce((sum, item) => sum + item.total, 0)
  const grandTotal = subTotal + previousBalance - advance

  const handleSaveBill = async () => {
    if (!selectedShopId) return toast.error("Please select a shop")
    if (!items.some(i => i.quantity > 0)) return toast.error("Please enter quantity for at least one item")

    try {
      const { data: purchaseData, error: purchaseError } = await supabase
        .from('purchases')
        .insert([{
          shop_id: selectedShopId,
          date,
          previous_balance: previousBalance,
          advance,
          grand_total: grandTotal,
          payment_status: 'Pending',
          remarks,
          session_id: currentSessionId,
          session_partial_payment: 0
        }])
        .select()
        .single()

      if (purchaseError) throw purchaseError

      const { data: mats } = await supabase.from('materials').select('id, name, name_te')
      
      const purchaseItems = items.filter(i => i.quantity > 0).map(item => {
        const mat = mats?.find(m => m.name.toLowerCase() === item.name.toLowerCase())
        return {
          purchase_id: purchaseData.id,
          material_id: mat?.id || null,
          item_name: item.name,
          quantity: item.quantity,
          unit: activeTab === 'Iron' ? 'Kg' : 'Nos',
          rate: item.rate,
          total: item.total
        }
      })

      const { error: itemsError } = await supabase.from('purchase_items').insert(purchaseItems)
      if (itemsError) throw itemsError

      toast.success(t("billSaved", lang))
      setSavedBillId(purchaseData.id)
    } catch (err: any) {
      toast.error(err.message || "Error saving bill")
    }
  }

  const resetFormForAnotherBill = () => {
    setPreviousBalance(0)
    setAdvance(0)
    setRemarks("")
    setSavedBillId(null)
    
    // Reset quantities to 0, keep edited rates
    setItems(prevItems => prevItems.map(item => ({
      ...item,
      quantity: 0,
      total: 0
    })))
  }

  const handlePdfAction = async (action: 'download' | 'print') => {
    if (!selectedShopId) return
    const session = await buildCurrentSession(currentSessionId)
    if (session) {
      await generateCombinedPDF(session, action, lang)
    }
  }

  const handleWhatsAppAction = async () => {
    if (!selectedShopId) return
    const session = await buildCurrentSession(currentSessionId)
    if (session) {
      await shareWhatsApp(session, lang)
    }
  }

  const resetFormForAnotherShopBill = () => {
    setSelectedShopId("")
    setPreviousBalance(0)
    setAdvance(0)
    setRemarks("")
    setSavedBillId(null)
    setCurrentSessionId(crypto.randomUUID())
    const defaultItems = (activeTab === "Iron" ? IRON_FIXED_ITEMS : WINE_FIXED_ITEMS).map(name => ({
      name, quantity: 0, rate: 0, total: 0
    }))
    setItems(defaultItems)
    setTimeout(() => {
      shopSelectRef.current?.focus()
    }, 100)
  }

    const filteredShops = shops.filter(s => {
      const matchesTab = s.type === activeTab
      const q = search.toLowerCase()
      const matchesSearch = !search || 
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.name_te && s.name_te.toLowerCase().includes(q)) ||
        (s.contact_person && s.contact_person.toLowerCase().includes(q)) ||
        (s.contact_person_te && s.contact_person_te.toLowerCase().includes(q)) ||
        (s.mobile && s.mobile.includes(q)) ||
        (s.landmark && s.landmark.toLowerCase().includes(q)) ||
        (s.landmark_te && s.landmark_te.toLowerCase().includes(q));
      return matchesTab && matchesSearch
    })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t("purchasing", lang)}</h1>
      </div>

      <div className="flex border-b">
        {["Wine", "Akividu Wine", "Iron"].map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab as any); setSearch(""); }}
            className={`px-6 py-3 font-medium text-sm transition-colors ${
              activeTab === tab 
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bill Details */}
        <div className="bg-card p-6 rounded-xl border shadow-sm lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Select Shop *</label>
              <select 
              ref={shopSelectRef}
              className="w-full border p-2.5 rounded-lg font-medium outline-none focus:ring-2 focus:ring-primary/50 text-[15px]" 
              value={selectedShopId} 
              onChange={e => setSelectedShopId(e.target.value)}
            >
              <option value="">-- {lang === 'te' ? "దుకాణాన్ని ఎంచుకోండి" : "Select Shop"} --</option>
              {filteredShops.map(shop => (
                <option key={shop.id} value={shop.id}>
                  {lang === 'te' && shop.name_te ? shop.name_te : shop.name}
                </option>
              ))}
            </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date *</label>
              <input 
                type="date" className="w-full border p-2 rounded" 
                value={date} onChange={e => setDate(e.target.value)}
                disabled={!!savedBillId}
              />
            </div>
          </div>

          <div className="overflow-x-auto mt-6">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">{t("name", lang)}</th>
                    <th className="px-4 py-3 text-center">{t("quantity", lang)}</th>
                    <th className="px-4 py-3 text-right">{t("rate", lang)}</th>
                    <th className="px-4 py-3 text-right">{t("amount", lang)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item, index) => (
                    <tr key={item.name} className="hover:bg-muted/30">
                      <td className="px-4 py-3.5 font-bold text-slate-800">{getItemName(item.name, lang)}</td>
                    <td className="px-3 py-2">
                      <input type="number" className="w-full border p-2 rounded text-sm" value={item.quantity || ""} onChange={e => updateItem(index, 'quantity', Number(e.target.value))} disabled={!!savedBillId} placeholder="0" />
                    </td>
                    <td className="px-3 py-2">
                      <input 
                        type="number" 
                        className="w-full border p-2 rounded text-sm bg-muted/50 cursor-not-allowed text-muted-foreground" 
                        value={item.rate !== undefined && item.rate !== null ? item.rate : ""} 
                        readOnly 
                        disabled 
                        placeholder="0.00" 
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">₹{formatInr(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t">
          </div>
        </div>

        {/* Action Sidebar */}
        <div className="space-y-6">
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-[17px] font-bold border-b pb-2">{t("paymentSummary", lang)}</h2>
            <div className="space-y-3.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">{t("total", lang)}</span>
                <span className="font-semibold text-slate-800">₹{formatInr(subTotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">{t("previousBalance", lang)}</span>
                <input 
                  type="number" 
                  className="w-24 border p-1 rounded text-right font-medium" 
                  value={previousBalance || ''} 
                  onChange={e => setPreviousBalance(Number(e.target.value))} 
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-medium">{t("advance", lang)}</span>
                <input 
                  type="number" 
                  className="w-24 border p-1 rounded text-right font-medium" 
                  value={advance || ''} 
                  onChange={e => setAdvance(Number(e.target.value))} 
                />
              </div>
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="font-bold text-slate-900">{t("grandTotal", lang)}</span>
                <span className="font-bold text-primary text-[17px]">₹{formatInr(grandTotal)}</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{t("remarks", lang)}</label>
                <textarea 
                  className="w-full border p-2 rounded text-xs" 
                  rows={2} 
                  value={remarks} 
                  onChange={e => setRemarks(e.target.value)} 
                />
              </div>
            </div>
            
            <div className="pt-4 space-y-2">
              {!savedBillId ? (
                <button 
                  onClick={handleSaveBill}
                  className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium flex justify-center items-center hover:bg-primary/90 shadow-sm transition-colors"
                >
                  <Save className="w-4 h-4 mr-2" /> {t("saveBill", lang)}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="bg-green-50 text-green-700 p-3 rounded-lg flex items-center mb-3">
                    <CheckCircle2 className="w-5 h-5 mr-2 shrink-0" />
                    <span className="text-xs font-medium">{t("billSaved", lang)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handlePdfAction('download')} className="bg-slate-100 text-slate-700 py-2 rounded-md text-xs font-semibold flex justify-center items-center hover:bg-slate-200">
                      <Download className="w-3.5 h-3.5 mr-1" /> PDF
                    </button>
                    <button onClick={() => handlePdfAction('print')} className="bg-slate-100 text-slate-700 py-2 rounded-md text-xs font-semibold flex justify-center items-center hover:bg-slate-200">
                      <Printer className="w-3.5 h-3.5 mr-1" /> {t("print", lang)}
                    </button>
                  </div>
                  <button onClick={handleWhatsAppAction} className="w-full bg-green-50 text-green-700 py-2 rounded-md text-xs font-semibold flex justify-center items-center hover:bg-green-100">
                    <Share2 className="w-3.5 h-3.5 mr-1" /> WhatsApp
                  </button>
                  
                  <div className="border-t pt-3 mt-3">
                    <button onClick={resetFormForAnotherBill} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium flex justify-center items-center hover:bg-blue-700 mb-2">
                      <Save className="w-4 h-4 mr-2" /> {t("anotherBill", lang)}
                    </button>
                    <button onClick={resetFormForAnotherShopBill} className="w-full border border-blue-600 text-blue-600 py-2.5 rounded-lg font-medium flex justify-center items-center hover:bg-blue-50">
                      <StoreIcon className="w-4 h-4 mr-2" /> {t("anotherShopBill", lang)}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
