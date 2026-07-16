import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Printer, Download, Share2, CheckCircle2, Eye, Clock, Search } from "lucide-react"
import { toast } from "sonner"
import { 
  fetchBillBreakdowns, 
  generateCombinedPDF, 
  shareWhatsApp, 
  formatQuantity,
  belongsToPredefinedGroup,
  getPredefinedGroupShops,
  generateCombinedGroupPDF,
  shareCombinedGroupWhatsApp
} from "@/lib/pdfUtils"
import type { GroupedSession, BillBreakdown } from "@/lib/pdfUtils"
import type { Shop } from "@/types/database"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"
import { formatDate } from "@/lib/utils"

const formatInr = (value: number) => new Intl.NumberFormat('en-IN').format(value)

export function Payments() {
  const { lang } = useOutletContext<{ lang: "en" | "te" }>()
  const [activeTab, setActiveTab] = useState<'Pending' | 'Completed'>('Pending')
  const [activeCategory, setActiveCategory] = useState<'Wine' | 'Akividu Wine' | 'Iron'>('Wine')
  const [groupedSessions, setGroupedSessions] = useState<GroupedSession[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [overallPending, setOverallPending] = useState(0)
  const [overallCompleted, setOverallCompleted] = useState(0)

  const [shops, setShops] = useState<Shop[]>([])
  const [detailsModal, setDetailsModal] = useState<{ session: GroupedSession, bills: BillBreakdown[] } | null>(null)
  
  const [paymentModal, setPaymentModal] = useState<GroupedSession | null>(null)
  const [partialPayment, setPartialPayment] = useState<number>(0)
  const [exportPromptSession, setExportPromptSession] = useState<GroupedSession | null>(null)
  const [groupExportPrompt, setGroupExportPrompt] = useState<{ 
    shopsInGroup: Shop[], 
    targetShop: Shop, 
    label: string,
    billIds?: string[],
    date?: string
  } | null>(null)

  useEffect(() => {
    loadSessions()
    loadShops()
  }, [activeTab])

  const loadShops = async () => {
    const { data } = await supabase.from('shops').select('*')
    if (data) setShops(data)
  }

  const loadSessions = async () => {
    const { data } = await supabase
      .from('purchases')
      .select('id, date, grand_total, payment_status, shop_id, shops(name, name_te, type), session_id, session_partial_payment, payment_date')
      .order('date', { ascending: false })

    if (data) {
      // Calculate overall pending and completed amounts
      let pendingSum = 0
      let completedSum = 0
      data.forEach(d => {
        if (d.payment_status === 'Pending') {
          pendingSum += (d.grand_total - (d.session_partial_payment || 0))
        } else if (d.payment_status === 'Completed') {
          completedSum += d.grand_total
        }
      })
      setOverallPending(pendingSum)
      setOverallCompleted(completedSum)

      // Filter for active tab display
      const activeData = data.filter(d => d.payment_status === activeTab)

      // Group by session_id
      const groups = new Map<string, GroupedSession>()
      
      activeData.forEach(d => {
        const key = activeTab === 'Completed' ? d.shop_id : (d.session_id || d.id)
        if (!groups.has(key)) {
          groups.set(key, {
            id: key,
            session_id: activeTab === 'Completed' ? undefined : (d.session_id || d.id),
            session_partial_payment: activeTab === 'Completed' ? 0 : (d.session_partial_payment || 0),
            payment_date: d.payment_date,
            shop_id: d.shop_id,
            shop_name: lang === 'te' && (d.shops as any)?.name_te ? (d.shops as any).name_te : ((d.shops as any)?.name || 'Unknown'),
            shop_type: (d.shops as any)?.type || 'Unknown',
            date: d.date,
            billsCount: 0,
            overallTotal: 0,
            status: activeTab,
            bill_ids: []
          })
        }
        
        const group = groups.get(key)!
        group.billsCount += 1
        group.overallTotal += d.grand_total
        group.bill_ids.push(d.id)
      })

      setGroupedSessions(Array.from(groups.values()))
    }
  }

  const isMarkedForCombined = (shopId: string) => {
    const shop = shops.find(s => s.id === shopId)
    return shop ? shop.marked_for_combined_bill : false
  }

  const shouldShowCombinedToggle = (session: GroupedSession) => {
    if (session.status !== 'Pending') return false
    
    const shop = shops.find(s => s.id === session.shop_id)
    if (!shop) return false
    
    // Check 1: Same shop has 2 or more pending bills across all pending sessions
    const sameShopPendingBillsCount = groupedSessions
      .filter(s => s.shop_id === session.shop_id && s.status === 'Pending')
      .reduce((sum, s) => sum + s.billsCount, 0)
      
    if (sameShopPendingBillsCount >= 2) {
      return true
    }
    
    // Check 2: Owner group (predefined or Akividu) has 2 or more pending shops
    let groupShops: Shop[] = []
    if (belongsToPredefinedGroup(shop.name)) {
      groupShops = getPredefinedGroupShops(shops, shop)
    } else if (shop.type === 'Akividu Wine') {
      groupShops = shops.filter(s => s.type === 'Akividu Wine')
    }
    
    if (groupShops.length > 0) {
      const groupShopIds = new Set(groupShops.map(s => s.id))
      const pendingGroupShopsCount = groupedSessions.filter(s => groupShopIds.has(s.shop_id) && s.status === 'Pending').length
      if (pendingGroupShopsCount >= 2) {
        return true
      }
    }
    
    return false
  }

  const handleToggleMarkCombinedBill = async (session: GroupedSession) => {
    try {
      const shop = shops.find(s => s.id === session.shop_id)
      if (!shop) return
      const newVal = !shop.marked_for_combined_bill
      
      let groupShops: Shop[] = []
      if (belongsToPredefinedGroup(shop.name)) {
        groupShops = getPredefinedGroupShops(shops, shop)
      } else if (shop.type === 'Akividu Wine') {
        groupShops = shops.filter(s => s.type === 'Akividu Wine')
      } else {
        groupShops = [shop]
      }
      
      const shopIds = groupShops.map(s => s.id)
      
      const { error } = await supabase
        .from('shops')
        .update({ marked_for_combined_bill: newVal })
        .in('id', shopIds)

      if (error) throw error

      toast.success(
        newVal 
          ? (lang === 'te' ? "కంబైన్డ్ బిల్లుకు జోడించబడింది" : "Marked for Combined Bill successfully!")
          : (lang === 'te' ? "కంబైన్డ్ బిల్లు నుండి తీసివేయబడింది" : "Removed from Combined Bill successfully!")
      )

      const { data: shopsData } = await supabase.from('shops').select('*')
      if (shopsData) setShops(shopsData)
      loadSessions()
    } catch (err: any) {
      toast.error(err.message || "Failed to update status")
    }
  }

  const handleCompletePaymentInitiate = async (session: GroupedSession) => {
    const shop = shops.find(s => s.id === session.shop_id)
    if (shop && shop.marked_for_combined_bill && shouldShowCombinedToggle(session)) {
      let groupShops: Shop[] = []
      if (belongsToPredefinedGroup(shop.name)) {
        groupShops = getPredefinedGroupShops(shops, shop)
      } else if (shop.type === 'Akividu Wine') {
        groupShops = shops.filter(s => s.type === 'Akividu Wine')
      } else {
        groupShops = [shop]
      }
      
      const shopIds = groupShops.map(s => s.id)
      const { data: groupPurchases } = await supabase
        .from('purchases')
        .select('id, grand_total, session_partial_payment')
        .in('shop_id', shopIds)
        .eq('payment_status', 'Pending')
        
      if (groupPurchases && groupPurchases.length > 0) {
        const groupBillIds = groupPurchases.map(p => p.id)
        const overallTotal = groupPurchases.reduce((sum, p) => sum + p.grand_total, 0)
        const totalPartialPayment = groupPurchases.reduce((sum, p) => sum + (p.session_partial_payment || 0), 0)
        
        setPaymentModal({
          ...session,
          shop_name: `${shop.name} (${lang === 'te' ? 'కంబైన్డ్' : 'Combined'})`,
          overallTotal,
          bill_ids: groupBillIds,
          isCombinedGroup: groupShops.length > 1,
          shopsInGroup: groupShops
        } as any)
        setPartialPayment(totalPartialPayment)
        return
      }
    }
    
    setPaymentModal(session)
    setPartialPayment(session.session_partial_payment || 0)
  }

  const handleSavePartialPayment = async () => {
    if (!paymentModal) return
    try {
      const today = new Date().toISOString().split('T')[0]
      await supabase.from('purchases').update({ 
        session_partial_payment: partialPayment, 
        payment_date: today 
      }).in('id', paymentModal.bill_ids)
      
      toast.success("Partial payment saved successfully!")
      setPaymentModal(null)
      loadSessions()
    } catch (err: any) {
      toast.error(err.message || "Failed to save partial payment")
    }
  }

  const handleCompletePaymentFinal = async () => {
    if (!paymentModal) return
    try {
      const today = new Date().toISOString().split('T')[0]
      await supabase.from('purchases').update({ 
        payment_status: 'Completed', 
        session_partial_payment: partialPayment,
        payment_date: today
      }).in('id', paymentModal.bill_ids)

      // Automatically remove Combined Bill flag for all shops in the group
      const shopIds = (paymentModal as any).shopsInGroup?.map((s: Shop) => s.id) || [paymentModal.shop_id]
      await supabase.from('shops').update({ marked_for_combined_bill: false }).in('id', shopIds)

      // Reload shops state
      const { data: shopsData } = await supabase.from('shops').select('*')
      if (shopsData) setShops(shopsData)

      toast.success(t("paymentSaved", lang))
      
      if ((paymentModal as any).isCombinedGroup) {
        setExportPromptSession(null)
        setGroupExportPrompt({
          shopsInGroup: (paymentModal as any).shopsInGroup,
          targetShop: shops.find(s => s.id === paymentModal.shop_id) || (paymentModal as any).shopsInGroup[0],
          label: lang === 'te' ? "కంబైన్డ్ బిల్లు" : "Combined Bill",
          billIds: paymentModal.bill_ids,
          date: paymentModal.date
        })
      } else {
        const sessionToExport = { ...paymentModal, session_partial_payment: partialPayment, payment_date: today, status: 'Completed' as const }
        setExportPromptSession(sessionToExport)
      }
      
      setPaymentModal(null)
      loadSessions()
    } catch (err: any) {
      toast.error(err.message || "Failed to complete payment")
    }
  }

  const handleViewDetails = async (session: GroupedSession) => {
    try {
      const shop = shops.find(s => s.id === session.shop_id)
      if (shop && shop.marked_for_combined_bill && shouldShowCombinedToggle(session)) {
        let groupShops: Shop[] = []
        if (belongsToPredefinedGroup(shop.name)) {
          groupShops = getPredefinedGroupShops(shops, shop)
        } else if (shop.type === 'Akividu Wine') {
          groupShops = shops.filter(s => s.type === 'Akividu Wine')
        } else {
          groupShops = [shop]
        }
        
        const shopIds = groupShops.map(s => s.id)
        const { data: purchases } = await supabase
          .from('purchases')
          .select('*, shops(*)')
          .in('shop_id', shopIds)
          .eq('payment_status', 'Pending')
          .order('date', { ascending: true })
          
        if (purchases && purchases.length > 0) {
          const billIds = purchases.map(p => p.id)
          const overallTotal = purchases.reduce((sum, p) => sum + p.grand_total, 0)
          
          const { data: allItems } = await supabase
            .from('purchase_items')
            .select('*, materials(name, name_te)')
            .in('purchase_id', billIds)

          const bills = purchases.map(fb => {
            const itemsForBill = allItems?.filter(i => i.purchase_id === fb.id) || []
            const formattedItems = itemsForBill.map(i => {
              const matName = lang === 'te' && i.materials?.name_te ? i.materials.name_te : ((i.materials as any)?.name || 'Unknown')
              return {
                id: i.id,
                name: i.item_name || matName,
                quantity: i.quantity,
                rate: i.rate,
                total: i.total
              }
            })
            return {
              id: fb.id,
              billNumber: fb.bill_number,
              date: fb.date,
              items: formattedItems,
              grandTotal: fb.grand_total,
              previous_balance: fb.previous_balance || 0,
              advance: fb.advance || 0,
              remarks: fb.remarks,
              session_id: fb.session_id || fb.id,
              session_partial_payment: fb.session_partial_payment || 0
            }
          })

          setDetailsModal({
            session: {
              ...session,
              shop_name: `${shop.name} (${lang === 'te' ? 'కంబైన్డ్' : 'Combined'})`,
              overallTotal,
              bill_ids: billIds,
              isCombinedGroup: groupShops.length > 1,
              shopsInGroup: groupShops
            } as any,
            bills
          })
          return
        }
      }
      
      const { bills } = await fetchBillBreakdowns(session, lang)
      setDetailsModal({ session, bills })
    } catch (err: any) {
      toast.error("Failed to load details")
    }
  }



  // Edit Bill states and handlers
  const [editingBill, setEditingBill] = useState<BillBreakdown | null>(null)
  const [editBillDate, setEditBillDate] = useState("")
  const [editBillPrevBalance, setEditBillPrevBalance] = useState(0)
  const [editBillAdvance, setEditBillAdvance] = useState(0)
  const [editBillRemarks, setEditBillRemarks] = useState("")
  const [editBillItems, setEditBillItems] = useState<{ id?: string, name: string, quantity: number, rate: number, total: number }[]>([])

  const handleEditBillInitiate = (bill: BillBreakdown) => {
    setEditingBill(bill)
    setEditBillDate(bill.date)
    setEditBillPrevBalance(bill.previous_balance || 0)
    setEditBillAdvance(bill.advance || 0)
    setEditBillRemarks(bill.remarks || "")
    setEditBillItems(bill.items.map(item => ({ ...item })))
  }

  const handleEditBillItemChange = (index: number, field: 'quantity' | 'rate', value: number) => {
    setEditBillItems(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      copy[index].total = Number((copy[index].quantity * copy[index].rate).toFixed(2))
      return copy
    })
  }

  const handleSaveEditedBill = async () => {
    if (!editingBill) return
    try {
      const subTotal = editBillItems.reduce((sum, item) => sum + item.total, 0)
      const grandTotal = subTotal + editBillPrevBalance - editBillAdvance

      // 1. Update purchase
      const { error: purchaseError } = await supabase
        .from('purchases')
        .update({
          date: editBillDate,
          previous_balance: editBillPrevBalance,
          advance: editBillAdvance,
          grand_total: grandTotal,
          remarks: editBillRemarks
        })
        .eq('id', editingBill.id)

      if (purchaseError) throw purchaseError

      // 2. Update purchase items
      for (const item of editBillItems) {
        if (item.id) {
          const { error: itemError } = await supabase
            .from('purchase_items')
            .update({
              quantity: item.quantity,
              rate: item.rate,
              total: item.total
            })
            .eq('id', item.id)
          if (itemError) throw itemError
        }
      }

      toast.success("Bill updated successfully!")
      setEditingBill(null)
      
      // Reload main page list/cards
      await loadSessions()
      
      // Refresh active details modal content
      if (detailsModal) {
        const { data: updatedPurchases } = await supabase
          .from('purchases')
          .select('grand_total')
          .in('id', detailsModal.session.bill_ids)
          
        const newOverallTotal = updatedPurchases?.reduce((sum, p) => sum + p.grand_total, 0) || 0

        const updatedSession = {
          ...detailsModal.session,
          overallTotal: newOverallTotal
        }
        
        const { bills } = await fetchBillBreakdowns(updatedSession, lang)
        setDetailsModal({ session: updatedSession, bills })
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update bill")
    }
  }

  const filteredSessions = groupedSessions.filter(s => {
    const matchesSearch = s.shop_name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = s.shop_type === activeCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t("payments", lang)}</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pending Card */}
        <div className="bg-card p-6 rounded-xl border shadow-sm flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-950">
            <Clock className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {lang === 'te' ? "మొత్తం పెండింగ్ అమౌంట్" : "Overall Pending Amount"}
            </p>
            <h3 className="text-2xl font-bold text-foreground mt-1">
              ₹{formatInr(overallPending)}
            </h3>
          </div>
        </div>

        {/* Completed Card */}
        <div className="bg-card p-6 rounded-xl border shadow-sm flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-green-100 dark:bg-green-950">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {lang === 'te' ? "మొత్తం పూర్తయిన అమౌంట్" : "Overall Completed Amount"}
            </p>
            <h3 className="text-2xl font-bold text-foreground mt-1">
              ₹{formatInr(overallCompleted)}
            </h3>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('Pending')}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm flex items-center transition-colors ${
              activeTab === 'Pending' 
                ? 'bg-orange-100 text-orange-700' 
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Clock className="w-4 h-4 mr-2" /> {t("pendingPayments", lang)}
          </button>
          <button
            onClick={() => setActiveTab('Completed')}
            className={`px-5 py-2.5 rounded-lg font-medium text-sm flex items-center transition-colors ${
              activeTab === 'Completed' 
                ? 'bg-green-100 text-green-700' 
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" /> {t("completedPayments", lang)}
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input 
            type="text" 
            placeholder={t("searchShop", lang)} 
            className="pl-9 pr-4 py-2 border rounded-lg text-sm w-full md:w-64"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex border-b bg-card rounded-t-xl px-2 pt-2 gap-2">
        <button
          onClick={() => setActiveCategory('Wine')}
          className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${
            activeCategory === 'Wine'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {lang === 'te' ? "వైన్ షాపులు" : "Wine Shops"}
        </button>
        <button
          onClick={() => setActiveCategory('Akividu Wine')}
          className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${
            activeCategory === 'Akividu Wine'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {lang === 'te' ? "ఆకివీడు వైన్ షాపులు" : "Akividu Wine Shops"}
        </button>
        <button
          onClick={() => setActiveCategory('Iron')}
          className={`px-4 py-2 font-semibold text-sm transition-colors border-b-2 ${
            activeCategory === 'Iron'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {lang === 'te' ? "ఐరన్ షాపులు" : "Iron Shops"}
        </button>
      </div>

      <div className="bg-card border rounded-b-xl shadow-sm overflow-hidden min-h-[500px]">
        <div className="overflow-x-auto p-4">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 font-semibold w-16">S.No.</th>
                <th className="px-4 py-3 font-semibold">{t("name", lang)}</th>
                <th className="px-4 py-3 font-semibold">{t("type", lang)}</th>
                <th className="px-4 py-3 font-semibold text-center">{t("totalBills", lang)}</th>
                <th className="px-4 py-3 font-semibold">{t("date", lang)}</th>
                <th className="px-4 py-3 font-semibold text-right">{t("overallTotal", lang)}</th>
                <th className="px-4 py-3 font-semibold text-center">{t("status", lang)}</th>
                <th className="px-4 py-3 font-semibold text-right">{t("actions", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No {activeTab.toLowerCase()} payments found.</td></tr>
              ) : (
                filteredSessions.map((session, index) => (
                  <tr key={session.id} className="border-b hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-4 text-muted-foreground">{index + 1}</td>
                    <td className="px-4 py-4 font-semibold text-primary">{session.shop_name}</td>
                    <td className="px-4 py-4 text-muted-foreground">{session.shop_type}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">{session.billsCount}</span>
                    </td>
                    <td className="px-4 py-4">{formatDate(session.date)}</td>
                    <td className="px-4 py-4 text-right font-bold text-[15px]">₹{formatInr(session.overallTotal)}</td>
                    <td className="px-4 py-4 text-center">
                      {session.status === 'Pending' ? (
                        <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold">Pending</span>
                      ) : (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">Completed</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {shouldShowCombinedToggle(session) && (
                          <button 
                            onClick={() => handleToggleMarkCombinedBill(session)} 
                            className={`px-3 py-1.5 rounded flex items-center text-xs font-semibold shadow-sm transition-colors ${
                              isMarkedForCombined(session.shop_id) 
                                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                                : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                            }`}
                          >
                            {isMarkedForCombined(session.shop_id) 
                              ? (lang === 'te' ? "✓ కంబైన్డ్" : "✓ Combined")
                              : (lang === 'te' ? "కంబైన్డ్" : "Combined")}
                          </button>
                        )}



                        <button 
                          onClick={() => handleViewDetails(session)} 
                          className="text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded flex items-center text-xs font-medium"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> {t("viewDetails", lang)}
                        </button>

                        {session.status === 'Pending' && (
                          <button 
                            onClick={() => handleCompletePaymentInitiate(session)} 
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded shadow-sm flex items-center text-xs font-medium ml-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {t("completePayment", lang)}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {detailsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl flex flex-col">
            <div className="p-5 border-b flex justify-between items-center sticky top-0 bg-background z-10">
              <div>
                <h2 className="text-xl font-bold">Session Details</h2>
                <p className="text-sm text-muted-foreground">{detailsModal.session.shop_name} • {formatDate(detailsModal.session.date)}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Overall Total</div>
                <div className="text-2xl font-bold text-primary">₹{formatInr(detailsModal.session.overallTotal)}</div>
              </div>
            </div>
            
            <div className="p-6 space-y-6 bg-slate-50 flex-1">
              {(() => {
                // Group bills by session
                const sessionGroups = new Map<string, BillBreakdown[]>()
                detailsModal.bills.forEach(bill => {
                  const sId = bill.session_id || 'unknown'
                  if (!sessionGroups.has(sId)) sessionGroups.set(sId, [])
                  sessionGroups.get(sId)!.push(bill)
                })

                let globalBillCounter = 0

                return Array.from(sessionGroups.entries()).map(([sId, sessionBills], sessionIndex) => (
                  <div key={sId} className="space-y-4">
                    {sessionGroups.size > 1 && (
                      <div className="flex items-center gap-4">
                        <div className="h-px bg-slate-200 flex-1"></div>
                        <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Session {sessionIndex + 1}</span>
                        <div className="h-px bg-slate-200 flex-1"></div>
                      </div>
                    )}
                    
                    {sessionBills.map((bill, index) => {
                      globalBillCounter++
                      return (
                        <div key={index} className="bg-card border rounded-lg overflow-hidden shadow-sm">
                          <div className="bg-slate-100 px-4 py-2 border-b flex justify-between items-center font-semibold">
                            <div className="flex items-center gap-2">
                              <span>Bill {globalBillCounter} {bill.billNumber ? `(#${bill.billNumber})` : ''}</span>
                              {detailsModal.session.status === 'Pending' && (
                                <button
                                  onClick={() => handleEditBillInitiate(bill)}
                                  className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors font-bold"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                            <span>₹{formatInr(bill.grandTotal)}</span>
                          </div>
                          <div className="p-4">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="text-muted-foreground border-b text-left">
                                  <tr>
                                    <th className="pb-2 w-12">S.No.</th>
                                    <th className="pb-2">Item</th>
                                    <th className="pb-2 text-center">Qty</th>
                                    <th className="pb-2 text-right">Rate</th>
                                    <th className="pb-2 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {bill.items.filter(i => i.quantity > 0).map((item, i) => (
                                    <tr key={i}>
                                      <td className="py-2 text-muted-foreground">{i + 1}</td>
                                      <td className="py-2">{item.name}</td>
                                      <td className="py-2 text-center">{formatQuantity(item.name, item.quantity)}</td>
                                      <td className="py-2 text-right">₹{item.rate}</td>
                                      <td className="py-2 text-right font-medium">₹{formatInr(item.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))
              })()}
              
              {/* Payment Summary */}
              {((detailsModal.session.session_partial_payment || 0) > 0 || detailsModal.session.status === 'Completed') && (
                <div className="bg-card border rounded-lg overflow-hidden shadow-sm mt-6">
                  <div className="bg-slate-100 px-4 py-2 border-b font-semibold text-center tracking-wide text-sm">
                    PAYMENT SUMMARY
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium">Status</span>
                      <span className="font-semibold text-slate-900">{detailsModal.session.status === 'Completed' ? 'Completed' : 'Partial Payment'}</span>
                    </div>
                    {detailsModal.session.payment_date && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">Payment Date</span>
                        <span className="font-semibold text-slate-900">{formatDate(detailsModal.session.payment_date)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium">Overall Bill Amount</span>
                      <span className="font-semibold text-slate-900">₹{formatInr(detailsModal.session.overallTotal)}</span>
                    </div>
                    {detailsModal.session.overallTotal - (detailsModal.session.session_partial_payment || 0) > 0 ? (
                      <>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground font-medium">Partial Amount Paid</span>
                          <span className="font-semibold text-green-600">₹{formatInr(detailsModal.session.session_partial_payment || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t">
                          <span className="font-bold text-slate-900">Balance Amount</span>
                          <span className="font-bold text-red-600 text-lg">₹{formatInr(detailsModal.session.overallTotal - (detailsModal.session.session_partial_payment || 0))}</span>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t sticky bottom-0 bg-background flex flex-wrap justify-end gap-2">
              <button
                onClick={() => {
                  const s = detailsModal.session
                  const targetShop = shops.find(sh => sh.id === s.shop_id)
                  if ((s as any).isCombinedGroup) {
                    const groupTargetShop = targetShop || (s as any).shopsInGroup[0]
                    generateCombinedGroupPDF((s as any).shopsInGroup, 'download', lang, groupTargetShop, s.bill_ids, detailsModal.bills, s.date)
                  } else {
                    generateCombinedPDF(s, 'download', lang, detailsModal.bills, targetShop)
                  }
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium text-sm flex items-center transition-colors border"
              >
                <Download className="w-4 h-4 mr-1.5" /> Download PDF
              </button>

              <button
                onClick={() => {
                  const s = detailsModal.session
                  const targetShop = shops.find(sh => sh.id === s.shop_id)
                  if ((s as any).isCombinedGroup) {
                    const groupTargetShop = targetShop || (s as any).shopsInGroup[0]
                    generateCombinedGroupPDF((s as any).shopsInGroup, 'print', lang, groupTargetShop, s.bill_ids, detailsModal.bills, s.date)
                  } else {
                    generateCombinedPDF(s, 'print', lang, detailsModal.bills, targetShop)
                  }
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium text-sm flex items-center transition-colors border"
              >
                <Printer className="w-4 h-4 mr-1.5" /> Print Bill
              </button>

              <button
                onClick={() => {
                  const s = detailsModal.session
                  const targetShop = shops.find(sh => sh.id === s.shop_id)
                  if ((s as any).isCombinedGroup) {
                    const groupTargetShop = targetShop || (s as any).shopsInGroup[0]
                    shareCombinedGroupWhatsApp((s as any).shopsInGroup, lang, groupTargetShop, s.bill_ids, detailsModal.bills, s.date)
                  } else {
                    shareWhatsApp(s, lang, detailsModal.bills, targetShop)
                  }
                }}
                className="px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg font-medium text-sm flex items-center transition-colors border border-green-200"
              >
                <Share2 className="w-4 h-4 mr-1.5" /> Share via WhatsApp
              </button>

              <button 
                onClick={() => setDetailsModal(null)} 
                className="px-6 py-2 border rounded-lg font-medium hover:bg-muted text-sm"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Completion Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b bg-slate-50">
              <h2 className="text-xl font-bold text-center">Payment Summary</h2>
              <p className="text-sm text-center text-muted-foreground">{paymentModal.shop_name} • {paymentModal.date}</p>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="font-medium text-slate-700">Overall Bill Amount</span>
                <span className="text-xl font-bold text-primary">₹{formatInr(paymentModal.overallTotal)}</span>
              </div>
              
              <div className="space-y-2">
                <label className="block font-medium text-sm text-slate-700">Partial Amount Paid (₹)</label>
                <input 
                  type="number" 
                  className="w-full border p-3 rounded-lg text-lg font-semibold"
                  value={partialPayment || ''}
                  onChange={e => setPartialPayment(Number(e.target.value))}
                  placeholder="0"
                />
              </div>

              <div className="flex justify-between items-center pt-4 border-t bg-slate-50 p-4 rounded-lg">
                <span className="font-bold text-slate-700">Balance Amount</span>
                <span className={`text-xl font-bold ${paymentModal.overallTotal - partialPayment > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ₹{formatInr(Math.max(0, paymentModal.overallTotal - partialPayment))}
                </span>
              </div>
            </div>

            <div className="p-4 border-t flex flex-col gap-2 bg-slate-50">
              <button 
                onClick={handleSavePartialPayment} 
                className="w-full bg-orange-100 text-orange-700 py-3 rounded-xl font-semibold hover:bg-orange-200 transition-colors"
              >
                Save Partial Payment
              </button>
              <button 
                onClick={handleCompletePaymentFinal} 
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors shadow-sm flex justify-center items-center"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" /> Complete Payment
              </button>
              <button 
                onClick={() => setPaymentModal(null)} 
                className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium mt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Completion Export Prompt */}
      {exportPromptSession && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-sm rounded-2xl shadow-xl overflow-hidden flex flex-col items-center p-8 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Payment Completed!</h2>
            <p className="text-muted-foreground text-sm mb-8">The payment has been marked as completed successfully.</p>
            
            <div className="w-full flex flex-col gap-3">
              <button onClick={() => generateCombinedPDF(exportPromptSession, 'download', lang, undefined, shops.find(sh => sh.id === exportPromptSession.shop_id))} className="w-full flex items-center justify-center py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors">
                <Download className="w-5 h-5 mr-2" /> Download PDF
              </button>
              <button onClick={() => generateCombinedPDF(exportPromptSession, 'print', lang, undefined, shops.find(sh => sh.id === exportPromptSession.shop_id))} className="w-full flex items-center justify-center py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors">
                <Printer className="w-5 h-5 mr-2" /> Print Bill
              </button>
              <button onClick={() => shareWhatsApp(exportPromptSession, lang, undefined, shops.find(sh => sh.id === exportPromptSession.shop_id))} className="w-full flex items-center justify-center py-3 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl font-medium transition-colors">
                <Share2 className="w-5 h-5 mr-2" /> Share via WhatsApp
              </button>
              <button onClick={() => setExportPromptSession(null)} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium mt-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Predefined Group / Akividu Export Prompt Modal */}
      {groupExportPrompt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-sm rounded-2xl shadow-xl overflow-hidden flex flex-col items-center p-8 text-center">
            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4">
              <Printer className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{groupExportPrompt.label}</h2>
            <p className="text-muted-foreground text-sm mb-8">
              {lang === 'te' 
                ? "కంబైన్డ్ పిడిఎఫ్ ని డౌన్‌లోడ్ చేయండి, ప్రింట్ చేయండి లేదా షేర్ చేయండి." 
                : "Download, print, or share the combined PDF for this group."}
            </p>
            
            <div className="w-full flex flex-col gap-3">
              <button 
                onClick={() => generateCombinedGroupPDF(groupExportPrompt.shopsInGroup, 'download', lang, groupExportPrompt.targetShop, groupExportPrompt.billIds, undefined, groupExportPrompt.date)} 
                className="w-full flex items-center justify-center py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors"
              >
                <Download className="w-5 h-5 mr-2" /> {lang === 'te' ? "డౌన్‌లోడ్ PDF" : "Download PDF"}
              </button>
              <button 
                onClick={() => generateCombinedGroupPDF(groupExportPrompt.shopsInGroup, 'print', lang, groupExportPrompt.targetShop, groupExportPrompt.billIds, undefined, groupExportPrompt.date)} 
                className="w-full flex items-center justify-center py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors"
              >
                <Printer className="w-5 h-5 mr-2" /> {lang === 'te' ? "ప్రింట్ బిల్" : "Print Bill"}
              </button>
              <button 
                onClick={() => shareCombinedGroupWhatsApp(groupExportPrompt.shopsInGroup, lang, groupExportPrompt.targetShop, groupExportPrompt.billIds, undefined, groupExportPrompt.date)} 
                className="w-full flex items-center justify-center py-3 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl font-medium transition-colors"
              >
                <Share2 className="w-5 h-5 mr-2" /> {lang === 'te' ? "వాట్సాప్ ద్వారా షేర్ చేయండి" : "Share via WhatsApp"}
              </button>
              <button 
                onClick={() => setGroupExportPrompt(null)} 
                className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium mt-2"
              >
                {lang === 'te' ? "మూసివేయండి" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Bill Modal */}
      {editingBill && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b bg-slate-50 flex justify-between items-center sticky top-0 bg-background z-10">
              <div>
                <h2 className="text-xl font-bold">Edit Bill Info</h2>
                <p className="text-xs text-muted-foreground">{editingBill.billNumber ? `Bill #${editingBill.billNumber}` : 'Edit Bill'}</p>
              </div>
              <button onClick={() => setEditingBill(null)} className="text-slate-400 hover:text-slate-600 text-lg font-medium">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Date</label>
                <input 
                  type="date"
                  className="w-full border p-2 rounded text-sm"
                  value={editBillDate}
                  onChange={e => setEditBillDate(e.target.value)}
                />
              </div>

              {/* Items Section */}
              <div className="space-y-2 border-t pt-3">
                <h3 className="text-sm font-bold text-slate-800 mb-1">Items Breakdown</h3>
                <div className="bg-slate-50 p-3 rounded-lg border space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-xs font-bold text-slate-500 border-b pb-1">
                    <div>Item</div>
                    <div className="text-center">Qty</div>
                    <div className="text-center">Rate (₹)</div>
                  </div>
                  {editBillItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                      <div className="text-xs font-medium text-slate-800 truncate">{item.name}</div>
                      <input 
                        type="number"
                        className="border p-1 rounded text-xs text-center font-medium bg-background"
                        value={item.quantity || ''}
                        onChange={e => handleEditBillItemChange(idx, 'quantity', Number(e.target.value))}
                        placeholder="0"
                      />
                      <input 
                        type="number"
                        step="0.01"
                        className="border p-1 rounded text-xs text-center font-medium bg-background"
                        value={item.rate || ''}
                        onChange={e => handleEditBillItemChange(idx, 'rate', Number(e.target.value))}
                        placeholder="0.00"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Previous Balance (₹)</label>
                  <input 
                    type="number"
                    className="w-full border p-2 rounded text-sm font-semibold"
                    value={editBillPrevBalance || ''}
                    onChange={e => setEditBillPrevBalance(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Advance (₹)</label>
                  <input 
                    type="number"
                    className="w-full border p-2 rounded text-sm font-semibold"
                    value={editBillAdvance || ''}
                    onChange={e => setEditBillAdvance(Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Remarks</label>
                <textarea 
                  className="w-full border p-2 rounded text-xs"
                  rows={2}
                  value={editBillRemarks}
                  onChange={e => setEditBillRemarks(e.target.value)}
                  placeholder="Enter remarks..."
                />
              </div>

              <div className="bg-slate-100 p-3 rounded-lg border space-y-1.5 text-sm font-semibold">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal:</span>
                  <span>₹{formatInr(editBillItems.reduce((sum, item) => sum + item.total, 0))}</span>
                </div>
                <div className="flex justify-between text-primary text-base font-bold">
                  <span>New Grand Total:</span>
                  <span>
                    ₹{formatInr(
                      editBillItems.reduce((sum, item) => sum + item.total, 0) + 
                      editBillPrevBalance - 
                      editBillAdvance
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex gap-3">
              <button 
                onClick={() => setEditingBill(null)} 
                className="flex-1 py-2.5 border rounded-xl font-semibold hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEditedBill} 
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors shadow-sm"
              >
                Save Updates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
