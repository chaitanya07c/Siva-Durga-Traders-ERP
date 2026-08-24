import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Printer, Download, Share2, CheckCircle2, Eye, Clock, Search, Wallet, Trash2, Edit2, Plus } from "lucide-react"
import { toast } from "sonner"
import { addToRecycleBin } from "@/lib/recycleBin"
import { 
  fetchBillBreakdowns, 
  generateCombinedPDF, 
  shareWhatsApp, 
  formatQuantity,
  generateCombinedGroupPDF,
  shareCombinedGroupWhatsApp,
  computeCombinedPaymentSummary
} from "@/lib/pdfUtils"
import type { GroupedSession, BillBreakdown } from "@/lib/pdfUtils"
import type { Shop, PaymentHistoryEntry } from "@/types/database"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"
import { formatDate, getItemUnit, STANDARD_UNIT_OPTIONS, getCombinableShops } from "@/lib/utils"

const formatInr = (value: number) => new Intl.NumberFormat('en-IN').format(value)

const WINE_FIXED_ITEMS = ["Beer", "L.C.'s", "Full's", "Atta", "Plastic", "Nibe Box", "Beer Box"]
const IRON_FIXED_ITEMS = ["Glass", "Beer"]

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

const getPredefinedItemsForShop = (shop?: Shop | null): string[] => {
  const shopType = shop?.type || 'Wine'
  const baseItems = shopType === 'Iron' ? IRON_FIXED_ITEMS : WINE_FIXED_ITEMS
  const extraItems = shop?.shop_rates ? Object.keys(shop.shop_rates) : []
  return Array.from(new Set([...baseItems, ...extraItems])).filter(Boolean)
}

export function Payments() {
  const { lang } = useOutletContext<{ lang: "en" | "te" }>()
  const [activeTab, setActiveTab] = useState<'Pending' | 'Completed'>('Pending')
  const [activeCategory, setActiveCategory] = useState<'Wine' | 'Akividu Wine' | 'Iron'>('Wine')
  const [groupedSessions, setGroupedSessions] = useState<GroupedSession[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [overallPending, setOverallPending] = useState(0)
  const [overallCompleted, setOverallCompleted] = useState(0)
  const [overallAdvance, setOverallAdvance] = useState(0)

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
    const { data: freshShops } = await supabase.from('shops').select('*')
    const currentShops = freshShops || shops
    if (freshShops) setShops(freshShops)

    const { data } = await supabase
      .from('purchases')
      .select('id, date, grand_total, advance, payment_status, shop_id, shops(name, name_te, type), session_id, session_partial_payment, payment_date, payment_history')
      .order('date', { ascending: false })

    if (data) {
      // Map shop_id to combinable group key if marked for combined bill
      const shopGroupKeyMap = new Map<string, string>()
      currentShops.forEach(sh => {
        if (sh.marked_for_combined_bill) {
          const groupShops = getCombinableShops(sh, currentShops)
          const groupKey = `combined_group_${groupShops.map(s => s.id).sort().join('_')}`
          groupShops.forEach(gs => {
            shopGroupKeyMap.set(gs.id, groupKey)
          })
        }
      })

      // 1. Group all purchase records by combined group key or session_id
      const sessionMap = new Map<string, {
        id: string;
        session_id: string;
        shop_id: string;
        shop_name: string;
        shop_type: string;
        date: string;
        billsCount: number;
        overallTotal: number;
        advance: number;
        bill_ids: string[];
        payment_date?: string | null;
        payment_history: PaymentHistoryEntry[];
        session_partial_payment: number;
        status: 'Pending' | 'Partial Payment' | 'Completed';
        remainingBalance: number;
        totalPaid: number;
        isCombinedGroup?: boolean;
        shopsInGroup?: Shop[];
      }>()

      data.forEach(d => {
        // If shop is marked for combined bill, group all its bills together
        const isCombined = shopGroupKeyMap.has(d.shop_id)
        const key = isCombined ? shopGroupKeyMap.get(d.shop_id)! : (d.session_id || d.id)

        const grossBillAmount = Number(d.grand_total || 0) + Number(d.advance || 0)
        const adv = Number(d.advance || 0)
        const shopObj = currentShops.find(s => s.id === d.shop_id)
        const rawShopName = (d.shops as any)?.name || shopObj?.name || 'Unknown'
        const rawShopNameTe = (d.shops as any)?.name_te || shopObj?.name_te
        const shopName = lang === 'te' && rawShopNameTe ? rawShopNameTe : rawShopName
        const shopType = (d.shops as any)?.type || shopObj?.type || 'Unknown'

        if (!sessionMap.has(key)) {
          let groupShops: Shop[] = []
          let displayShopName = shopName
          if (isCombined && shopObj) {
            groupShops = getCombinableShops(shopObj, currentShops)
            if (groupShops.length > 1) {
              displayShopName = `${shopObj.name} (${lang === 'te' ? 'కంబైన్డ్' : 'Combined'})`
            }
          }

          sessionMap.set(key, {
            id: key,
            session_id: key,
            shop_id: d.shop_id,
            shop_name: displayShopName,
            shop_type: shopType,
            date: d.date,
            billsCount: 0,
            overallTotal: 0,
            advance: 0,
            bill_ids: [],
            payment_date: d.payment_date,
            payment_history: [],
            session_partial_payment: 0,
            status: 'Pending',
            remainingBalance: 0,
            totalPaid: 0,
            isCombinedGroup: isCombined && groupShops.length > 1,
            shopsInGroup: groupShops.length > 0 ? groupShops : undefined
          })
        }

        const s = sessionMap.get(key)!
        s.billsCount += 1
        s.overallTotal += grossBillAmount
        s.advance += adv
        s.bill_ids.push(d.id)
        if (new Date(d.date) > new Date(s.date)) {
          s.date = d.date
        }
        if (d.payment_date) {
          s.payment_date = d.payment_date
        }

        // Collect payment history entries
        if (Array.isArray(d.payment_history) && d.payment_history.length > 0) {
          d.payment_history.forEach((h: any) => {
            if (h && Number(h.amount) > 0 && h.date) {
              if (h.remarks === "Advance Payment") return
              const histKey = h.id || `${h.date}_${h.amount}`
              if (!s.payment_history.some((ex: any) => (ex.id || `${ex.date}_${ex.amount}`) === histKey)) {
                s.payment_history.push(h)
              }
            }
          })
        }
      })

      // 2. Compute session-level paid amount, remaining balance, and status for each session
      let pendingSum = 0
      let completedSum = 0
      let activeAdvanceSum = 0

      const allSessions: GroupedSession[] = []

      sessionMap.forEach(s => {
        s.payment_history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        
        const historyPaid = s.payment_history.reduce((sum, h) => sum + Number(h.amount || 0), 0)
        const actualPaid = historyPaid > 0 ? historyPaid : (s.session_partial_payment || 0)
        s.session_partial_payment = actualPaid
        s.totalPaid = s.advance + actualPaid
        s.remainingBalance = Math.max(0, Number((s.overallTotal - s.totalPaid).toFixed(2)))

        if (s.remainingBalance === 0) {
          s.status = 'Completed'
          completedSum += s.overallTotal
        } else {
          s.status = s.totalPaid > 0 ? 'Partial Payment' : 'Pending'
          pendingSum += s.remainingBalance
          activeAdvanceSum += s.advance
        }

        allSessions.push(s as GroupedSession)
      })

      setOverallPending(pendingSum)
      setOverallCompleted(completedSum)
      setOverallAdvance(activeAdvanceSum)

      // 3. Filter for active tab display
      const tabSessions = allSessions.filter(s => 
        activeTab === 'Pending' 
          ? (s.status === 'Pending' || s.status === 'Partial Payment') 
          : s.status === 'Completed'
      )

      setGroupedSessions(tabSessions)
    }
  }

  const isMarkedForCombined = (shopId: string) => {
    const shop = shops.find(s => s.id === shopId)
    return shop ? shop.marked_for_combined_bill : false
  }

  const getShopsForGroup = (shop: Shop): Shop[] => {
    return getCombinableShops(shop, shops)
  }

  const shouldShowCombinedToggle = (session: GroupedSession) => {
    if (session.status === 'Completed') return false
    
    const shop = shops.find(s => s.id === session.shop_id)
    if (!shop) return false
    
    // Check 1: Same shop has 2 or more pending bills across all pending sessions
    const sameShopPendingBillsCount = groupedSessions
      .filter(s => s.shop_id === session.shop_id && s.status !== 'Completed')
      .reduce((sum, s) => sum + s.billsCount, 0)
      
    if (sameShopPendingBillsCount >= 2) {
      return true
    }
    
    // Check 2: Combinable shops group has 2 or more pending shops
    const groupShops = getShopsForGroup(shop)
    if (groupShops.length > 1) {
      const groupShopIds = new Set(groupShops.map(s => s.id))
      const pendingGroupShopsCount = groupedSessions.filter(s => groupShopIds.has(s.shop_id) && s.status !== 'Completed').length
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
      
      const groupShops = getShopsForGroup(shop)
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
      await loadSessions()
    } catch (err: any) {
      toast.error(err.message || "Failed to update status")
    }
  }

  const handleCompletePaymentInitiate = async (session: GroupedSession) => {
    const { bills } = await fetchBillBreakdowns(session, lang)
    const summary = computeCombinedPaymentSummary(bills, session)
    setPaymentModal({
      ...session,
      overallTotal: summary.overallBillAmount,
      advance: summary.totalAdvance,
      bill_ids: session.bill_ids,
      payment_history: summary.paymentHistory
    } as any)
    setPartialPayment(summary.balance)
  }

  const handleProcessPayment = async (amountToPay: number, isFinalComplete: boolean = false) => {
    if (!paymentModal) return
    try {
      const today = new Date().toISOString().split('T')[0]
      const { bills } = await fetchBillBreakdowns(paymentModal, lang)
      const currentSummary = computeCombinedPaymentSummary(bills, paymentModal)
      
      const currentBalance = currentSummary.balance
      let actualPay = isFinalComplete ? currentBalance : Number(amountToPay || 0)

      if (actualPay <= 0 && !isFinalComplete) {
        toast.error("Please enter a valid payment amount")
        return
      }

      if (actualPay > currentBalance) {
        actualPay = currentBalance
      }

      const newBalance = Math.max(0, Number((currentBalance - actualPay).toFixed(2)))
      const newStatus = (newBalance === 0 || isFinalComplete) ? 'Completed' : 'Partial Payment'

      // Create a single payment history entry representing the actual payment transaction
      const newEntry: PaymentHistoryEntry = {
        id: crypto.randomUUID(),
        date: today,
        amount: actualPay,
        remainingBalance: newBalance
      }

      const existingHistory = currentSummary.paymentHistory.map(h => ({
        id: (h as any).id || crypto.randomUUID(),
        date: h.date,
        amount: Number(h.amount),
        remarks: (h as any).remarks
      }))

      const updatedHistory = actualPay > 0 ? [...existingHistory, newEntry] : existingHistory
      const totalPaidSession = currentSummary.totalActualPayments + actualPay

      // Assign a shared session_id so all bills in this combined session stay linked together
      const targetSessionId = paymentModal.session_id || paymentModal.id || `session_${crypto.randomUUID()}`

      // Update all purchases in this session
      const { error: updateError } = await supabase.from('purchases').update({
        session_id: targetSessionId,
        payment_status: newStatus,
        session_partial_payment: totalPaidSession,
        payment_date: today,
        payment_history: updatedHistory
      }).in('id', paymentModal.bill_ids)

      if (updateError) throw updateError

      // Automatically remove Combined Bill flag for all shops in the group if completed
      if (newStatus === 'Completed') {
        const shopIds = (paymentModal as any).shopsInGroup?.map((s: Shop) => s.id) || [paymentModal.shop_id]
        await supabase.from('shops').update({ marked_for_combined_bill: false }).in('id', shopIds)
        const { data: shopsData } = await supabase.from('shops').select('*')
        if (shopsData) setShops(shopsData)
      }

      toast.success(newStatus === 'Completed' ? t("paymentSaved", lang) : "Partial payment saved successfully!")

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
        const sessionToExport = { 
          ...paymentModal, 
          session_id: targetSessionId,
          session_partial_payment: totalPaidSession, 
          payment_date: today, 
          status: newStatus as any,
          payment_history: updatedHistory
        }
        setExportPromptSession(sessionToExport)
      }

      setPaymentModal(null)
      await loadSessions()
    } catch (err: any) {
      toast.error(err.message || "Failed to process payment")
    }
  }

  const handleSavePartialPayment = async () => {
    await handleProcessPayment(partialPayment, false)
  }

  const handleCompletePaymentFinal = async () => {
    await handleProcessPayment(0, true)
  }

  const handleViewDetails = async (session: GroupedSession) => {
    try {
      const { bills } = await fetchBillBreakdowns(session, lang)
      const summary = computeCombinedPaymentSummary(bills, session)
      setDetailsModal({ 
        session: {
          ...session,
          overallTotal: summary.overallBillAmount,
          advance: summary.totalAdvance,
          session_partial_payment: summary.totalActualPayments,
          payment_history: summary.paymentHistory
        }, 
        bills 
      })
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
  const [editBillItems, setEditBillItems] = useState<{ id?: string, name: string, quantity: number, rate: number, total: number, unit?: string }[]>([])
  const [originalItemIds, setOriginalItemIds] = useState<string[]>([])

  // Add Item states for Edit Bill
  const [addItemMode, setAddItemMode] = useState<'existing' | 'custom'>('existing')
  const [selectedExistingItem, setSelectedExistingItem] = useState("")
  const [existingQty, setExistingQty] = useState<string | number>("")
  const [existingUnit, setExistingUnit] = useState("Nos")
  const [existingRate, setExistingRate] = useState<string | number>("")

  const [customItemName, setCustomItemName] = useState("")
  const [customQty, setCustomQty] = useState<string | number>("")
  const [customUnit, setCustomUnit] = useState("Nos")
  const [customRate, setCustomRate] = useState<string | number>("")

  const handleEditBillInitiate = (bill: BillBreakdown) => {
    setEditingBill(bill)
    setEditBillDate(bill.date)
    setEditBillPrevBalance(bill.previous_balance || 0)
    setEditBillAdvance(bill.advance || 0)
    setEditBillRemarks(bill.remarks || "")
    setEditBillItems(bill.items.map(item => ({
      ...item,
      unit: item.unit || getItemUnit(item.name, 'purchasing', bill.shop?.shop_units || bill.shop)
    })))
    setOriginalItemIds(bill.items.map(i => i.id).filter(Boolean) as string[])

    // Reset Add Item inputs
    setAddItemMode('existing')
    setSelectedExistingItem("")
    setExistingQty("")
    setExistingUnit("Nos")
    setExistingRate("")
    setCustomItemName("")
    setCustomQty("")
    setCustomUnit("Nos")
    setCustomRate("")
  }

  const handleSelectExistingItem = (itemName: string) => {
    setSelectedExistingItem(itemName)
    if (itemName && editingBill) {
      const u = getItemUnit(itemName, 'purchasing', editingBill.shop?.shop_units || editingBill.shop)
      setExistingUnit(u)
      const r = editingBill.shop?.shop_rates?.[itemName]
      setExistingRate(r !== undefined && r !== null ? r : "")
    }
  }

  const handleAddExistingItem = () => {
    if (!selectedExistingItem) {
      toast.error(lang === 'te' ? "దయచేసి వస్తువును ఎంచుకోండి" : "Please select an item")
      return
    }
    const qty = Number(existingQty)
    if (isNaN(qty) || qty <= 0) {
      toast.error(lang === 'te' ? "పరిమాణం 0 కంటే ఎక్కువగా ఉండాలి" : "Quantity must be greater than 0")
      return
    }
    const rate = Number(existingRate)
    if (isNaN(rate) || rate < 0) {
      toast.error(lang === 'te' ? "ధర ప్రతికూలంగా ఉండకూడదు" : "Rate cannot be negative")
      return
    }
    const total = Number((qty * rate).toFixed(2))

    setEditBillItems(prev => [
      ...prev,
      {
        name: selectedExistingItem,
        quantity: qty,
        unit: existingUnit || getItemUnit(selectedExistingItem, 'purchasing', editingBill?.shop?.shop_units || editingBill?.shop),
        rate: rate,
        total: total
      }
    ])

    setSelectedExistingItem("")
    setExistingQty("")
    setExistingRate("")
    toast.success(lang === 'te' ? "వస్తువు జోడించబడింది" : "Item added to bill")
  }

  const handleAddCustomItem = () => {
    const trimmedName = customItemName.trim()
    if (!trimmedName) {
      toast.error(lang === 'te' ? "దయచేసి వస్తువు పేరు ఎంటర్ చేయండి" : "Item Name is required")
      return
    }
    const qty = Number(customQty)
    if (isNaN(qty) || qty <= 0) {
      toast.error(lang === 'te' ? "పరిమాణం 0 కంటే ఎక్కువగా ఉండాలి" : "Quantity must be greater than 0")
      return
    }
    const rate = Number(customRate)
    if (isNaN(rate) || rate < 0) {
      toast.error(lang === 'te' ? "ధర ప్రతికూలంగా ఉండకూడదు" : "Rate cannot be negative")
      return
    }
    const total = Number((qty * rate).toFixed(2))

    setEditBillItems(prev => [
      ...prev,
      {
        name: trimmedName,
        quantity: qty,
        unit: customUnit || "Nos",
        rate: rate,
        total: total
      }
    ])

    setCustomItemName("")
    setCustomQty("")
    setCustomRate("")
    setCustomUnit("Nos")
    toast.success(lang === 'te' ? "కస్టమ్ వస్తువు జోడించబడింది" : "Custom item added to bill")
  }

  const handleRemoveEditBillItem = (index: number) => {
    setEditBillItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleEditBillItemChange = (index: number, field: 'quantity' | 'rate' | 'unit', value: number | string) => {
    setEditBillItems(prev => {
      const copy = [...prev]
      if (field === 'unit') {
        copy[index] = { ...copy[index], unit: value as string }
      } else {
        copy[index] = { ...copy[index], [field]: value as number }
        copy[index].total = Number((copy[index].quantity * copy[index].rate).toFixed(2))
      }
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
          payment_status: editingBill.payment_status || 'Pending',
          remarks: editBillRemarks
        })
        .eq('id', editingBill.id)

      if (purchaseError) throw purchaseError

      // 2. Fetch materials for optional ID matching
      const { data: mats } = await supabase.from('materials').select('id, name')

      // 3. Delete items removed during editing
      const currentIds = editBillItems.map(i => i.id).filter(Boolean) as string[]
      const deletedIds = originalItemIds.filter(id => !currentIds.includes(id))
      if (deletedIds.length > 0) {
        const { error: delError } = await supabase
          .from('purchase_items')
          .delete()
          .in('id', deletedIds)
        if (delError) throw delError
      }

      // 4. Update or insert purchase items
      for (const item of editBillItems) {
        if (item.id) {
          const { error: itemError } = await supabase
            .from('purchase_items')
            .update({
              quantity: item.quantity,
              unit: item.unit,
              rate: item.rate,
              total: item.total
            })
            .eq('id', item.id)
          if (itemError) throw itemError
        } else {
          const matchedMat = mats?.find(m => m.name.toLowerCase() === item.name.toLowerCase())
          const { error: insertError } = await supabase
            .from('purchase_items')
            .insert([{
              purchase_id: editingBill.id,
              material_id: matchedMat?.id || null,
              item_name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              rate: item.rate,
              total: item.total
            }])
          if (insertError) throw insertError
        }
      }

      toast.success(lang === 'te' ? "బిల్లు విజయవంతంగా అప్‌డేట్ చేయబడింది!" : "Bill updated successfully!")
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

  // Delete Bill states and handler
  const [deletingBill, setDeletingBill] = useState<BillBreakdown | null>(null)

  const handleConfirmDeleteBill = async () => {
    if (!deletingBill) return
    const billToDelete = deletingBill
    setDeletingBill(null)

    try {
      // 1. Fetch full purchase record and purchase_items
      const { data: purchaseData } = await supabase
        .from('purchases')
        .select('*')
        .eq('id', billToDelete.id)
        .single()

      const { data: itemsData } = await supabase
        .from('purchase_items')
        .select('*')
        .eq('purchase_id', billToDelete.id)

      if (!purchaseData) throw new Error("Purchase record not found")

      // 2. Add to Recycle Bin
      const shopName = detailsModal?.session.shop_name || 'Unknown Shop'
      await addToRecycleBin({
        id: crypto.randomUUID(),
        type: 'purchase_bill',
        item_id: billToDelete.id || purchaseData.id || '',
        title: `Bill #${billToDelete.billNumber || 'N/A'} - ${shopName}`,
        shop_name: shopName,
        bill_number: String(billToDelete.billNumber || ''),
        amount: billToDelete.grandTotal,
        data: {
          purchase: purchaseData,
          purchase_items: itemsData || []
        },
        deleted_at: new Date().toISOString()
      })

      // 3. Delete purchase_items and purchase row from Supabase
      await supabase.from('purchase_items').delete().eq('purchase_id', billToDelete.id)
      await supabase.from('purchases').delete().eq('id', billToDelete.id)

      toast.success("Bill moved to Recycle Bin!")

      // 4. Reload main list & cards
      await loadSessions()

      // 5. Update or close detailsModal
      if (detailsModal) {
        const remainingBillIds = detailsModal.session.bill_ids.filter(id => id !== billToDelete.id)
        if (remainingBillIds.length === 0) {
          // No more bills in this session -> close modal automatically
          setDetailsModal(null)
        } else {
          // Re-fetch remaining bills
          const { data: remainingPurchases } = await supabase
            .from('purchases')
            .select('grand_total')
            .in('id', remainingBillIds)

          const newOverallTotal = remainingPurchases?.reduce((sum, p) => sum + Number(p.grand_total || 0), 0) || 0

          const updatedSession = {
            ...detailsModal.session,
            overallTotal: newOverallTotal,
            bill_ids: remainingBillIds,
            billsCount: remainingBillIds.length
          }

          const { bills } = await fetchBillBreakdowns(updatedSession, lang)
          setDetailsModal({ session: updatedSession, bills })
        }
      }
    } catch (err: any) {
      console.error("Error deleting bill:", err)
      toast.error(err.message || "Failed to delete bill")
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* Overall Advance Given Card */}
        <div className="bg-card p-6 rounded-xl border shadow-sm flex items-center space-x-4">
          <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-950">
            <Wallet className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {t("overallAdvanceGiven", lang)}
            </p>
            <h3 className="text-2xl font-bold text-foreground mt-1">
              ₹{formatInr(overallAdvance)}
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
                      {session.status === 'Completed' ? (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">Completed</span>
                      ) : session.status === 'Partial Payment' ? (
                        <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold">Partial Payment</span>
                      ) : (
                        <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold">Pending</span>
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

                        {session.status !== 'Completed' && (
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
              <tr className="bg-muted/50 font-bold border-t-2 border-slate-300">
                <td className="px-4 py-3" colSpan={3}></td>
                <td className="px-4 py-3 text-center">
                  {activeTab === 'Pending' 
                    ? (lang === 'te' ? `మొత్తం పెండింగ్ బిల్లులు : ${filteredSessions.length}` : `Total Pending Bills : ${filteredSessions.length}`) 
                    : (lang === 'te' ? `మొత్తం పూర్తయిన బిల్లులు : ${filteredSessions.length}` : `Total Completed Bills : ${filteredSessions.length}`)}
                </td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right text-green-700 text-base font-extrabold" colSpan={3}>
                  {lang === 'te' 
                    ? `మొత్తం అమౌంట్ : ₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(filteredSessions.reduce((sum, s) => sum + s.overallTotal, 0))}` 
                    : `Overall Total Amount : ₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(filteredSessions.reduce((sum, s) => sum + s.overallTotal, 0))}`}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {detailsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl flex flex-col">
            {/* Header with Prominent Shop Name Banner */}
            <div className="p-5 border-b sticky top-0 bg-background z-10 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold">{lang === 'te' ? "సెషన్ వివరాలు" : "Session Details"}</h2>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">{lang === 'te' ? "మొత్తం బ్యాలెన్స్" : "Overall Total"}</div>
                  <div className="text-2xl font-bold text-primary">₹{formatInr(detailsModal.session.overallTotal)}</div>
                </div>
              </div>

              {/* Shop Name & Session Info Banner */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 flex flex-wrap justify-between items-center gap-2">
                <div>
                  <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block">
                    {lang === 'te' ? "దుకాణం పేరు:" : "Shop Name:"}
                  </span>
                  <span className="font-bold text-base text-foreground">
                    {detailsModal.session.shop_name}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                  <div>
                    <span className="text-muted-foreground">{lang === 'te' ? "తేదీ: " : "Date: "}</span>
                    <span className="text-foreground font-bold">{formatDate(detailsModal.session.date)}</span>
                  </div>
                  {detailsModal.bills.length > 1 && (
                    <span className="bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 rounded-full text-xs font-bold">
                      {lang === 'te' ? `కంబైన్డ్ బిల్లులు: ${detailsModal.bills.length}` : `Combined Bills: ${detailsModal.bills.length}`}
                    </span>
                  )}
                </div>
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
                              {(detailsModal.session.status === 'Pending' || detailsModal.session.status === 'Partial Payment') && (
                                <button
                                  onClick={() => handleEditBillInitiate(bill)}
                                  className="text-blue-600 hover:text-blue-800 text-xs px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors font-bold flex items-center gap-1"
                                >
                                  <Edit2 className="w-3 h-3" /> Edit
                                </button>
                              )}
                              <button
                                onClick={() => setDeletingBill(bill)}
                                className="text-red-600 hover:text-red-800 text-xs px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 border border-red-200 transition-colors font-bold flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            </div>
                            <span>₹{formatInr(bill.grandTotal)}</span>
                          </div>
                          <div className="p-4 space-y-3">
                            {/* Shop Name & Bill Date Sub-Header */}
                            <div className="flex flex-wrap justify-between items-center bg-slate-50 border rounded-lg p-2.5 px-3 text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground font-medium">{lang === 'te' ? "దుకాణం పేరు:" : "Shop Name:"}</span>
                                <span className="font-bold text-foreground">
                                  {bill.shop ? (lang === 'te' && bill.shop.name_te ? bill.shop.name_te : bill.shop.name) : detailsModal.session.shop_name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground font-medium">{lang === 'te' ? "బిల్లు తేదీ:" : "Bill Date:"}</span>
                                <span className="font-bold text-foreground">{formatDate(bill.date)}</span>
                              </div>
                            </div>

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
                                      <td className="py-2 text-center">{formatQuantity(item.name, item.quantity, (item as any).unit || getItemUnit(item.name, 'purchasing', bill.shop?.shop_units || bill.shop))}</td>
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
              {(() => {
                const summary = computeCombinedPaymentSummary(detailsModal.bills, detailsModal.session)
                return (
                  <div className="bg-card border rounded-lg overflow-hidden shadow-sm mt-6">
                    <div className="bg-slate-100 px-4 py-2 border-b font-semibold text-center tracking-wide text-sm">
                      PAYMENT SUMMARY
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">Status</span>
                        <span className={`font-semibold px-2.5 py-0.5 rounded-full text-xs ${
                          summary.status === 'Completed' ? 'bg-green-100 text-green-700' : summary.status === 'Partial Payment' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {summary.status}
                        </span>
                      </div>
                      {summary.effectivePaymentDate && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground font-medium">Payment Date</span>
                          <span className="font-semibold text-slate-900">{formatDate(summary.effectivePaymentDate)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">Overall Bill Amount</span>
                        <span className="font-semibold text-slate-900">₹{formatInr(summary.overallBillAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">Advance Amount</span>
                        <span className="font-semibold text-purple-700">₹{formatInr(summary.totalAdvance)}</span>
                      </div>
                      
                      {/* Payment History Subtable */}
                      {summary.paymentHistory.length > 0 && (
                        <div className="border rounded-lg overflow-hidden my-2">
                          <div className="bg-slate-50 px-3 py-1.5 border-b font-semibold text-xs text-slate-700 flex justify-between">
                            <span>Payment Date</span>
                            <span>Amount Paid</span>
                          </div>
                          <div className="divide-y text-xs">
                            {summary.paymentHistory.map((h, i) => (
                              <div key={i} className="px-3 py-1.5 flex justify-between items-center bg-white">
                                <span className="text-slate-600">{formatDate(h.date)}</span>
                                <span className="font-semibold text-green-600">₹{formatInr(h.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-3 border-t">
                        <span className="font-bold text-slate-900">Balance Amount</span>
                        <span className={`font-bold text-lg ${summary.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ₹{formatInr(summary.balance)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })()}
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
      {paymentModal && (() => {
        const modalOverall = paymentModal.overallTotal || 0
        const modalAdvance = (paymentModal as any).advance || 0
        const modalHistory = (paymentModal as any).payment_history || []
        const totalPaidPrior = modalHistory.reduce((sum: number, h: any) => sum + Number(h.amount || 0), 0)
        const currentBalanceDue = Math.max(0, modalOverall - modalAdvance - totalPaidPrior)
        const balanceAfterInput = Math.max(0, currentBalanceDue - (partialPayment || 0))

        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-background w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
              <div className="p-5 border-b bg-slate-50">
                <h2 className="text-xl font-bold text-center">Payment Summary</h2>
                <p className="text-sm text-center text-muted-foreground">{paymentModal.shop_name} • {paymentModal.date}</p>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b text-sm">
                  <span className="font-medium text-slate-700">Overall Bill Amount</span>
                  <span className="text-lg font-bold text-slate-900">₹{formatInr(modalOverall)}</span>
                </div>

                {modalAdvance > 0 && (
                  <div className="flex justify-between items-center pb-2 border-b text-sm">
                    <span className="font-medium text-slate-700">Advance Amount</span>
                    <span className="text-sm font-semibold text-purple-700">₹{formatInr(modalAdvance)}</span>
                  </div>
                )}

                {totalPaidPrior > 0 && (
                  <div className="flex justify-between items-center pb-2 border-b text-sm">
                    <span className="font-medium text-slate-700">Previous Payments Paid</span>
                    <span className="text-sm font-semibold text-green-600">₹{formatInr(totalPaidPrior)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pb-2 border-b text-sm bg-slate-50 p-2 rounded">
                  <span className="font-bold text-slate-800">Current Balance Due</span>
                  <span className="text-base font-bold text-primary">₹{formatInr(currentBalanceDue)}</span>
                </div>
                
                <div className="space-y-1.5 pt-2">
                  <label className="block font-medium text-xs text-slate-700">Payment Amount To Pay (₹)</label>
                  <input 
                    type="number" 
                    className="w-full border p-2.5 rounded-lg text-lg font-semibold bg-background"
                    value={partialPayment || ''}
                    onChange={e => setPartialPayment(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>

                <div className="flex justify-between items-center pt-3 border-t bg-slate-50 p-3 rounded-lg">
                  <span className="font-bold text-slate-700 text-sm">Remaining Balance</span>
                  <span className={`text-lg font-bold ${balanceAfterInput > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ₹{formatInr(balanceAfterInput)}
                  </span>
                </div>
              </div>

              <div className="p-4 border-t flex flex-col gap-2 bg-slate-50">
                <button 
                  onClick={handleSavePartialPayment} 
                  className="w-full bg-orange-100 text-orange-700 py-2.5 rounded-xl font-semibold hover:bg-orange-200 transition-colors text-sm"
                >
                  Save Partial Payment
                </button>
                <button 
                  onClick={handleCompletePaymentFinal} 
                  className="w-full bg-primary text-primary-foreground py-2.5 rounded-xl font-semibold hover:bg-primary/90 transition-colors shadow-sm flex justify-center items-center text-sm"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Complete Payment (₹{formatInr(currentBalanceDue)})
                </button>
                <button 
                  onClick={() => setPaymentModal(null)} 
                  className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium mt-0.5"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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
                  <div className="grid grid-cols-12 gap-1 text-[11px] font-bold text-slate-500 border-b pb-1">
                    <div className="col-span-4">Item</div>
                    <div className="col-span-2 text-center">Qty</div>
                    <div className="col-span-2 text-center">Unit</div>
                    <div className="col-span-3 text-center">Rate (₹)</div>
                    <div className="col-span-1 text-center"></div>
                  </div>
                  {editBillItems.map((item, idx) => {
                    const currentUnit = item.unit || getItemUnit(item.name, 'purchasing', editingBill.shop?.shop_units || editingBill.shop)
                    const unitOptions = Array.from(new Set([...STANDARD_UNIT_OPTIONS, currentUnit])).filter(Boolean)
                    return (
                      <div key={idx} className="grid grid-cols-12 gap-1 items-center py-0.5">
                        <div className="col-span-4 text-xs font-medium text-slate-800 truncate" title={item.name}>{item.name}</div>
                        <input 
                          type="number"
                          min="0"
                          step="any"
                          className="col-span-2 border p-1 rounded text-xs text-center font-medium bg-background"
                          value={item.quantity || ''}
                          onChange={e => handleEditBillItemChange(idx, 'quantity', Number(e.target.value))}
                          placeholder="0"
                        />
                        <select
                          className="col-span-2 border p-1 rounded text-xs text-center font-medium bg-background cursor-pointer"
                          value={currentUnit}
                          onChange={e => handleEditBillItemChange(idx, 'unit', e.target.value)}
                        >
                          {unitOptions.map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                        <input 
                          type="number"
                          min="0"
                          step="0.01"
                          className="col-span-3 border p-1 rounded text-xs text-center font-medium bg-background"
                          value={item.rate || ''}
                          onChange={e => handleEditBillItemChange(idx, 'rate', Number(e.target.value))}
                          placeholder="0.00"
                        />
                        <div className="col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveEditBillItem(idx)}
                            className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
                            title="Remove Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Add Item Section */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-3 shadow-xs mt-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5 text-primary" /> Add Item
                    </span>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setAddItemMode('existing')}
                        className={`px-2.5 py-1 rounded-md transition-all ${
                          addItemMode === 'existing' 
                            ? 'bg-primary text-primary-foreground font-semibold shadow-xs' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Existing Item
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddItemMode('custom')}
                        className={`px-2.5 py-1 rounded-md transition-all ${
                          addItemMode === 'custom' 
                            ? 'bg-primary text-primary-foreground font-semibold shadow-xs' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Custom Item
                      </button>
                    </div>
                  </div>

                  {addItemMode === 'existing' ? (
                    <div className="space-y-2.5 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Select Item</label>
                          <select
                            className="w-full border p-1.5 rounded text-xs bg-background"
                            value={selectedExistingItem}
                            onChange={e => handleSelectExistingItem(e.target.value)}
                          >
                            <option value="">-- Select Predefined Item --</option>
                            {getPredefinedItemsForShop(editingBill.shop).map(item => (
                              <option key={item} value={item}>{getItemName(item, lang)}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Unit</label>
                          <select
                            className="w-full border p-1.5 rounded text-xs bg-background cursor-pointer"
                            value={existingUnit}
                            onChange={e => setExistingUnit(e.target.value)}
                          >
                            {STANDARD_UNIT_OPTIONS.map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 items-end">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity</label>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            className="w-full border p-1.5 rounded text-xs"
                            placeholder="0"
                            value={existingQty}
                            onChange={e => setExistingQty(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cost / Rate (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-full border p-1.5 rounded text-xs"
                            placeholder="0.00"
                            value={existingRate}
                            onChange={e => setExistingRate(e.target.value)}
                          />
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={handleAddExistingItem}
                            className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1 shadow-xs"
                          >
                            + Add Existing
                          </button>
                        </div>
                      </div>
                      {(Number(existingQty) > 0 && Number(existingRate) >= 0) && (
                        <div className="text-[11px] text-right font-semibold text-slate-600 pt-0.5">
                          Total: <span className="text-primary font-bold text-xs">₹{formatInr(Number(((Number(existingQty) || 0) * (Number(existingRate) || 0)).toFixed(2)))}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2.5 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">Item Name</label>
                        <input
                          type="text"
                          className="w-full border p-1.5 rounded text-xs"
                          placeholder="e.g. Glass Bottle"
                          value={customItemName}
                          onChange={e => setCustomItemName(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity</label>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            className="w-full border p-1.5 rounded text-xs"
                            placeholder="e.g. 150"
                            value={customQty}
                            onChange={e => setCustomQty(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity Type / Unit</label>
                          <div className="flex gap-1">
                            {['Nos', 'Kg'].map((u) => (
                              <button
                                key={u}
                                type="button"
                                onClick={() => setCustomUnit(u)}
                                className={`flex-1 py-1 rounded text-xs font-semibold border transition-all ${
                                  customUnit === u
                                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                                    : 'bg-background hover:bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {u}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 items-end">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cost / Rate (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-full border p-1.5 rounded text-xs"
                            placeholder="e.g. 1.50"
                            value={customRate}
                            onChange={e => setCustomRate(e.target.value)}
                          />
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={handleAddCustomItem}
                            className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1 shadow-xs"
                          >
                            + Add Custom
                          </button>
                        </div>
                      </div>

                      <div className="text-[11px] text-right font-semibold text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        Total: <span className="text-primary font-bold text-xs">₹{formatInr(Number(((Number(customQty) || 0) * (Number(customRate) || 0)).toFixed(2)))}</span>
                      </div>
                    </div>
                  )}
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

      {/* Delete Bill Confirmation Modal */}
      {deletingBill && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
              {lang === 'te' ? "బిల్లు తొలగింపు నిర్ధారణ" : "Delete Bill Confirmation"}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {lang === 'te'
                ? `మీరు ఈ బిల్లు #${deletingBill.billNumber || ''} (అమౌంట్: ₹${formatInr(deletingBill.grandTotal)}) ని తొలగించాలనుకుంటున్నారా? ఇది రీసైకిల్ బిన్‌కి తరలించబడుతుంది మరియు అన్ని లెక్కలు అప్‌డేట్ అవుతాయి.`
                : `Are you sure you want to delete Bill #${deletingBill.billNumber || ''} (Amount: ₹${formatInr(deletingBill.grandTotal)})? This action will move the bill to the Recycle Bin and recalculate session totals.`}
            </p>
            <div className="pt-2 flex gap-3">
              <button
                onClick={() => setDeletingBill(null)}
                className="flex-1 py-2.5 border rounded-xl font-semibold hover:bg-slate-100 transition-colors text-sm"
              >
                {t("cancel", lang)}
              </button>
              <button
                onClick={handleConfirmDeleteBill}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors shadow-sm text-sm"
              >
                {lang === 'te' ? "తొలగించు" : "Delete Bill"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
