import { supabase } from "@/lib/supabase"
import type { Shop } from "@/types/database"
import { toast } from "sonner"
import { formatDate, getItemUnit, getCombinableShops } from "./utils"

import { formatQuantity, generateProfessionalPDF, type PDFDocumentData } from "./pdfTemplate"
export { formatQuantity }

export type GroupedSession = {
  id: string
  shop_id: string
  shop_name: string
  shop_type: string
  date: string
  billsCount: number
  overallTotal: number
  status: 'Pending' | 'Completed' | 'Partial Payment'
  bill_ids: string[]
  session_id?: string
  session_partial_payment?: number
  payment_date?: string | null
  payment_history?: { id?: string, date: string, amount: number, remainingBalance?: number, remarks?: string }[]
}

export type BillBreakdown = {
  id?: string
  billNumber: number | null
  date: string
  items: { id?: string, name: string, quantity: number, rate: number, total: number, unit?: string }[]
  grandTotal: number
  previous_balance?: number
  advance?: number
  remarks?: string | null
  session_id?: string
  shop_id?: string
  shop?: Shop
  session_partial_payment?: number
  payment_date?: string | null
  payment_status?: string
  payment_history?: { id?: string, date: string, amount: number, remainingBalance?: number, remarks?: string }[]
}

export const fetchBillBreakdowns = async (session: GroupedSession, lang?: 'en' | 'te'): Promise<{shop: Shop, bills: BillBreakdown[]}> => {
  const { data: fullBills } = await supabase
    .from('purchases')
    .select('*, shops(*)')
    .in('id', session.bill_ids)
    .order('bill_number', { ascending: true })

  const { data: allItems } = await supabase
    .from('purchase_items')
    .select('*, materials(name, name_te)')
    .in('purchase_id', session.bill_ids)
    
  const reconstructedBills = fullBills?.map(fb => {
    const itemsForBill = allItems?.filter(i => i.purchase_id === fb.id) || []
    const formattedItems = itemsForBill.map(i => {
      const matName = lang === 'te' && i.materials?.name_te ? i.materials.name_te : ((i.materials as any)?.name || 'Unknown')
      const shopObj = (Array.isArray(fb.shops) ? fb.shops[0] : fb.shops) as Shop
      return {
        id: i.id,
        name: i.item_name || matName,
        quantity: i.quantity,
        unit: getItemUnit(i.item_name || matName, 'purchasing', shopObj?.shop_units || shopObj, i.unit),
        rate: i.rate,
        total: i.total
      }
    })
    
    const shopObj = (Array.isArray(fb.shops) ? fb.shops[0] : fb.shops) as Shop
    return {
      id: fb.id,
      billNumber: fb.bill_number,
      date: fb.date,
      items: formattedItems,
      grandTotal: fb.grand_total,
      previous_balance: fb.previous_balance,
      advance: fb.advance,
      remarks: fb.remarks,
      session_id: fb.session_id || fb.id,
      shop_id: fb.shop_id,
      shop: shopObj,
      session_partial_payment: fb.session_partial_payment || 0,
      payment_date: fb.payment_date,
      payment_status: fb.payment_status,
      payment_history: fb.payment_history || []
    }
  }) || []

  const fallbackShop: Shop = {
    id: session.shop_id || '',
    name: session.shop_name || 'Unknown',
    type: session.shop_type || 'Unknown',
    mobile: null,
    status: 'Active',
    address: null,
    name_te: null,
    landmark: null,
    whatsapp: null,
    address_te: null,
    created_at: new Date().toISOString(),
    shop_rates: {},
    landmark_te: null,
    purchase_rate: null,
    contact_person: null,
    contact_person_te: null,
    marked_for_loading: false,
    marked_for_combined_bill: false
  }

  const shop = (fullBills && fullBills.length > 0) ? (((Array.isArray((fullBills as any)[0].shops) ? (fullBills as any)[0].shops[0] : (fullBills as any)[0].shops) as Shop) || fallbackShop) : fallbackShop

  return {
    shop,
    bills: reconstructedBills
  }
}

const isValidFieldValue = (val: unknown): val is string => {
  if (val === null || val === undefined) return false
  const str = String(val).trim()
  if (!str) return false
  if (str === '-' || str === '--' || str === '---' || str === 'N/A' || str === 'n/a') return false
  if (str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'unknown') return false
  return true
}

// Header drawing is now imported from pdfTemplate.ts

export const generateCombinedPDF = async (
  session: GroupedSession, 
  action: 'download' | 'print' | 'blob', 
  lang: 'en' | 'te' = 'en',
  preloadedBills?: BillBreakdown[],
  preloadedShop?: Shop
): Promise<Blob | undefined> => {
  const toastId = toast.loading("Generating PDF...")
  try {
    let bills = preloadedBills
    let shop = preloadedShop

    if (!bills || !shop) {
      const breakdown = await fetchBillBreakdowns(session, lang)
      if (!bills) bills = breakdown.bills
      if (!shop) shop = breakdown.shop
    }
    
    // Ensure missing shops on preloaded bills are resolved
    const missingShopBillIds = bills.filter(b => !b.shop && (b.id || b.shop_id)).map(b => b.id).filter(Boolean) as string[]
    if (missingShopBillIds.length > 0) {
      const { data: dbBills } = await supabase
        .from('purchases')
        .select('id, shop_id, shops(*)')
        .in('id', missingShopBillIds)
      
      if (dbBills && dbBills.length > 0) {
        const shopMap = new Map<string, Shop>()
        dbBills.forEach((dbB: any) => {
          const sObj = (Array.isArray(dbB.shops) ? dbB.shops[0] : dbB.shops) as Shop
          if (sObj) shopMap.set(dbB.id, sObj)
        })
        bills = bills.map(b => {
          if (!b.shop && b.id && shopMap.has(b.id)) {
            return { ...b, shop: shopMap.get(b.id) }
          }
          return b
        })
      }
    }
    
    // 1. Gather all genuine payment history entries from session and bills
    const historyMap = new Map<string, { id?: string, date: string, amount: number, remainingBalance?: number, remarks?: string }>()

    if (Array.isArray(session.payment_history) && session.payment_history.length > 0) {
      session.payment_history.forEach(h => {
        if (h && Number(h.amount) > 0 && h.date) {
          if (h.remarks === "Advance Payment") return
          const key = (h as any).id || `${h.date}_${h.amount}`
          if (!historyMap.has(key)) {
            historyMap.set(key, { id: (h as any).id, date: h.date, amount: Number(h.amount), remarks: h.remarks })
          }
        }
      })
    }

    bills.forEach(b => {
      if (Array.isArray(b.payment_history) && b.payment_history.length > 0) {
        b.payment_history.forEach(h => {
          if (h && Number(h.amount) > 0 && h.date) {
            if (h.remarks === "Advance Payment") return
            const key = (h as any).id || `${h.date}_${h.amount}`
            if (!historyMap.has(key)) {
              historyMap.set(key, { id: (h as any).id, date: h.date, amount: Number(h.amount), remarks: h.remarks })
            }
          }
        })
      }
    })

    let paymentHistory = Array.from(historyMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const totalAdvance = bills.reduce((sum, b) => sum + (b.advance || 0), 0)
    const overallBillAmount = bills.reduce((sum, b) => sum + (b.grandTotal || 0), 0)
    const partialPaymentsSum = bills.reduce((sum, b) => sum + (b.session_partial_payment || 0), 0)
    const legacyPartial = partialPaymentsSum || session.session_partial_payment || 0
    const totalHistoryPaid = paymentHistory.reduce((sum, h) => sum + Number(h.amount || 0), 0)
    const totalPaid = totalAdvance + (totalHistoryPaid > 0 ? totalHistoryPaid : legacyPartial)
    const balance = Math.max(0, Number((overallBillAmount - totalPaid).toFixed(2)))
    
    let paymentStatus = "Pending"
    if (session.status === 'Completed' || balance === 0) {
      paymentStatus = "Completed"
    } else if (totalPaid > 0) {
      paymentStatus = "Partial Paid"
    }

    const latestDateFromBills = bills.map(b => b.payment_date).filter(Boolean).sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0]
    const latestDateFromHistory = paymentHistory.length > 0 ? paymentHistory[paymentHistory.length - 1].date : null
    const effectivePaymentDate = session.payment_date || latestDateFromBills || latestDateFromHistory || session.date

    // Fallback for legacy bills without payment_history JSONB
    if (paymentHistory.length === 0) {
      if (paymentStatus === 'Completed') {
        const legacyPaid = overallBillAmount - totalAdvance
        if (legacyPaid > 0) {
          paymentHistory = [{
            date: effectivePaymentDate,
            amount: legacyPaid
          }]
        }
      } else if (paymentStatus === 'Partial Paid' && legacyPartial > 0) {
        paymentHistory = [{
          date: effectivePaymentDate,
          amount: legacyPartial
        }]
      }
    }

    const documentData: PDFDocumentData = {
      title: "PURCHASE INVOICE",
      subHeader: lang === 'te' ? "విస్సాకోడేరు బ్రిడ్జ్ దగ్గర, భీమవరం[534201]." : "NEAR VISSAKODERU BRIDGE, BHIMAVARAM[534201].",
      filename: `${shop?.name || 'Shop'}.pdf`,
      bills: bills.map(bill => {
        const currentShop = bill.shop || shop
        const shopName = lang === 'te' && currentShop?.name_te ? currentShop.name_te : (currentShop?.name || 'Unknown Shop')
        const landmarkText = lang === 'te' && currentShop?.landmark_te ? currentShop.landmark_te : (currentShop?.landmark || '')
        const contactPerson = lang === 'te' && currentShop?.contact_person_te ? currentShop.contact_person_te : (currentShop?.contact_person || '')
        const contactMobile = currentShop?.mobile || ''
        const contactStr = contactPerson ? `${contactPerson} (${contactMobile})` : contactMobile

        const metadataLeft: string[] = []
        if (isValidFieldValue(shopName)) {
          metadataLeft.push(`Shop Name: ${shopName.trim()}`)
        }
        if (isValidFieldValue(landmarkText)) {
          metadataLeft.push(`Landmark: ${landmarkText.trim()}`)
        }
        if (isValidFieldValue(contactStr)) {
          metadataLeft.push(`Contact: ${contactStr.trim()}`)
        }
        
        const metadataRight: string[] = []
        if (isValidFieldValue(bill.billNumber)) {
          metadataRight.push(`Bill No: #${bill.billNumber}`)
        }
        if (isValidFieldValue(bill.date)) {
          metadataRight.push(`Date: ${formatDate(bill.date)}`)
        }

        const displayItems = (bill.items || []).filter((item: any) => item && item.quantity > 0 && item.total > 0).map((i: any) => ({
          name: i.name,
          quantity: i.quantity,
          unit: getItemUnit(i.name, 'purchasing', currentShop?.shop_units || currentShop, i.unit),
          rate: i.rate,
          total: i.total
        }))

        return {
          metadataLeft,
          metadataRight,
          items: displayItems,
          grandTotal: bill.grandTotal || 0
        }
      }),
      paymentSummary: {
        overallAmount: overallBillAmount,
        advanceAmount: totalAdvance,
        balanceAmount: balance,
        partialPaid: totalHistoryPaid > 0 ? totalHistoryPaid : legacyPartial,
        status: paymentStatus,
        paymentDate: effectivePaymentDate,
        completedDate: effectivePaymentDate,
        paymentHistory
      }
    }

    toast.dismiss(toastId)
    return await generateProfessionalPDF(documentData, action)
  } catch (error) {
    console.error("Failed to generate Combined PDF:", error)
    toast.dismiss(toastId)
    toast.error("Error generating document")
  }
}

export const shareWhatsApp = async (
  session: GroupedSession, 
  lang: 'en' | 'te' = 'en',
  preloadedBills?: BillBreakdown[],
  preloadedShop?: Shop
) => {
  const toastId = toast.loading("Preparing PDF for sharing...")
  try {
    let shop = preloadedShop
    if (!shop) {
      const breakdown = await fetchBillBreakdowns(session, lang)
      shop = breakdown.shop
    }
    const pdfBlob = await generateCombinedPDF(session, 'blob', lang, preloadedBills, shop)
    
    if (!pdfBlob) {
      toast.dismiss(toastId)
      toast.error("Failed to generate PDF")
      return
    }

    const file = new File(
      [pdfBlob],
      `${shop?.name || 'Shop'}.pdf`,
      { type: "application/pdf" }
    )

    toast.dismiss(toastId)

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file]
        })
      } catch (shareErr: any) {
        if (shareErr.name !== 'AbortError') {
          console.error("WhatsApp share failed:", shareErr)
          toast.error("Sharing failed. Downloading instead.")
          await generateCombinedPDF(session, 'download', lang, preloadedBills, shop)
        }
      }
    } else {
      await generateCombinedPDF(session, 'download', lang, preloadedBills, shop)
      alert("Your browser doesn't support direct PDF sharing.")
    }
  } catch (error) {
    console.error("Failed to share via WhatsApp:", error)
    toast.dismiss(toastId)
    toast.error("Error sharing PDF")
  }
}

export const buildCurrentSession = async (session_id: string): Promise<GroupedSession | null> => {
  const { data } = await supabase
    .from('purchases')
    .select('id, date, grand_total, payment_status, shop_id, session_partial_payment, payment_date, payment_history, shops(name, type)')
    .eq('session_id', session_id)
    .in('payment_status', ['Pending', 'Partial Payment'])

  if (!data || data.length === 0) return null

  const session: GroupedSession = {
    id: session_id,
    session_id,
    session_partial_payment: data[0].session_partial_payment || 0,
    payment_date: data[0].payment_date,
    payment_history: data[0].payment_history || [],
    shop_id: data[0].shop_id,
    shop_name: (data[0].shops as any)?.name || 'Unknown',
    shop_type: (data[0].shops as any)?.type || 'Unknown',
    date: data[0].date,
    billsCount: data.length,
    overallTotal: data.reduce((sum, d) => sum + d.grand_total, 0),
    status: 'Pending',
    bill_ids: data.map(d => d.id)
  }
  return session
}

export const belongsToPredefinedGroup = (shopOrName: Shop | string, allShops?: Shop[]): boolean => {
  if (typeof shopOrName === 'object' && shopOrName && allShops) {
    const combinable = getCombinableShops(shopOrName, allShops)
    return combinable.length > 1
  }
  const shopName = typeof shopOrName === 'string' ? shopOrName : (shopOrName?.name || '')
  const nameLower = shopName.toLowerCase().trim();
  return nameLower === 'durga bar' || nameLower === 'durga wines' || nameLower === 'vijaya durga wines' ||
         nameLower === 'suchitra wines' ||
         nameLower === 'satya krishna bar' || nameLower === 'satya krishna wines' ||
         nameLower === 'jayaram wines' || nameLower === 'jayaram wines' || nameLower === 'vasu raju wines' || nameLower === 'venkateswara wines';
}

export const getPredefinedGroupShops = (allShops: Shop[], targetShop: Shop): Shop[] => {
  return getCombinableShops(targetShop, allShops)
}

export const getCombinableGroupShops = (allShops: Shop[], targetShop: Shop): Shop[] => {
  return getCombinableShops(targetShop, allShops)
}

export const generateCombinedGroupPDF = async (
  shopsInGroup: Shop[], 
  action: 'download' | 'print' | 'blob', 
  lang: 'en' | 'te' = 'en',
  targetShop: Shop,
  billIds?: string[],
  preloadedBills?: BillBreakdown[],
  _date?: string
): Promise<Blob | undefined> => {
  const toastId = toast.loading("Generating Combined PDF...")
  try {
    const shopIds = shopsInGroup.map(s => s.id)
    let reconstructedBills: BillBreakdown[] = []

    if (preloadedBills && preloadedBills.length > 0) {
      reconstructedBills = preloadedBills.map(b => ({
        ...b,
        shop: b.shop || shopsInGroup.find(s => s.id === b.shop_id || s.id === (b as any).shop_id)
      }))

      const missingShopBillIds = reconstructedBills.filter(b => !b.shop && (b.id || b.shop_id)).map(b => b.id).filter(Boolean) as string[]
      if (missingShopBillIds.length > 0) {
        const { data: dbBills } = await supabase
          .from('purchases')
          .select('id, shop_id, shops(*)')
          .in('id', missingShopBillIds)
        
        if (dbBills && dbBills.length > 0) {
          const shopMap = new Map<string, Shop>()
          dbBills.forEach((dbB: any) => {
            const sObj = (Array.isArray(dbB.shops) ? dbB.shops[0] : dbB.shops) as Shop
            if (sObj) shopMap.set(dbB.id, sObj)
          })
          reconstructedBills = reconstructedBills.map(b => {
            if (!b.shop && b.id && shopMap.has(b.id)) {
              return { ...b, shop: shopMap.get(b.id) }
            }
            return b
          })
        }
      }

      // Final fallback to targetShop if still missing
      reconstructedBills = reconstructedBills.map(b => ({
        ...b,
        shop: b.shop || targetShop
      }))
    } else {
      let query = supabase
        .from('purchases')
        .select('*, shops(*)')

      if (billIds && billIds.length > 0) {
        query = query.in('id', billIds)
      } else {
        query = query.in('shop_id', shopIds).in('payment_status', ['Pending', 'Partial Payment'])
      }

      const { data: fullBills, error: fetchError } = await query.order('date', { ascending: true })

      if (fetchError) {
        console.error("Failed to query group purchases:", fetchError)
        toast.dismiss(toastId)
        toast.error("Database error while generating PDF.")
        return
      }

      if (!fullBills || fullBills.length === 0) {
        toast.dismiss(toastId)
        toast.error("No pending bills found for this group.")
        return
      }

      const activeBillIds = fullBills.map(b => b.id)
      const { data: allItems, error: itemsError } = await supabase
        .from('purchase_items')
        .select('*, materials(name, name_te)')
        .in('purchase_id', activeBillIds)

      if (itemsError) {
        console.error("Failed to query purchase items for group:", itemsError)
        toast.dismiss(toastId)
        toast.error("Database error loading items breakdown.")
        return
      }

      reconstructedBills = fullBills.map(fb => {
        const itemsForBill = allItems?.filter(i => i.purchase_id === fb.id) || []
        const formattedItems = itemsForBill.map(i => {
          const matName = lang === 'te' && i.materials?.name_te ? i.materials.name_te : ((i.materials as any)?.name || 'Unknown')
          const shopObj = ((Array.isArray(fb.shops) ? fb.shops[0] : fb.shops) as Shop) || targetShop
          return {
            name: i.item_name || matName,
            quantity: i.quantity,
            unit: getItemUnit(i.item_name || matName, 'purchasing', shopObj?.shop_units || shopObj, i.unit),
            rate: i.rate,
            total: i.total
          }
        })
        
        const shopObj = ((Array.isArray(fb.shops) ? fb.shops[0] : fb.shops) as Shop) || targetShop
        return {
          id: fb.id,
          billNumber: fb.bill_number,
          date: fb.date,
          items: formattedItems,
          grandTotal: fb.grand_total,
          previous_balance: fb.previous_balance || 0,
          advance: fb.advance || 0,
          remarks: fb.remarks,
          shop_id: fb.shop_id,
          shop: shopObj,
          session_id: fb.session_id || fb.id,
          session_partial_payment: fb.session_partial_payment || 0,
          payment_date: fb.payment_date,
          payment_history: fb.payment_history || []
        }
      })
    }

    // 1. Gather all genuine payment history entries from reconstructed bills
    const historyMap = new Map<string, { id?: string, date: string, amount: number, remainingBalance?: number, remarks?: string }>()
    reconstructedBills.forEach(b => {
      if (Array.isArray(b.payment_history) && b.payment_history.length > 0) {
        b.payment_history.forEach(h => {
          if (h && Number(h.amount) > 0 && h.date) {
            if (h.remarks === "Advance Payment") return
            const key = (h as any).id || `${h.date}_${h.amount}`
            if (!historyMap.has(key)) {
              historyMap.set(key, { id: (h as any).id, date: h.date, amount: Number(h.amount), remarks: h.remarks })
            }
          }
        })
      }
    })

    let paymentHistory = Array.from(historyMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const totalAdvance = reconstructedBills.reduce((sum, b) => sum + (b.advance || 0), 0)
    const overallBillAmount = reconstructedBills.reduce((sum, b) => sum + b.grandTotal, 0)
    const partialPaymentsSum = reconstructedBills.reduce((sum, b) => sum + (b.session_partial_payment || 0), 0)
    const totalHistoryPaid = paymentHistory.reduce((sum, h) => sum + Number(h.amount || 0), 0)
    const totalPaid = totalAdvance + (totalHistoryPaid > 0 ? totalHistoryPaid : partialPaymentsSum)
    const balanceAmount = Math.max(0, Number((overallBillAmount - totalPaid).toFixed(2)))

    let paymentStatus = "Pending"
    if (balanceAmount === 0) {
      paymentStatus = "Completed"
    } else if (totalPaid > 0) {
      paymentStatus = "Partial Paid"
    }

    const latestDateFromBills = reconstructedBills.map(b => b.payment_date).filter(Boolean).sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0]
    const latestDateFromHistory = paymentHistory.length > 0 ? paymentHistory[paymentHistory.length - 1].date : null
    const effectivePaymentDate = latestDateFromBills || latestDateFromHistory || _date || new Date().toISOString().split('T')[0]

    // Fallback for legacy bills without payment_history JSONB
    if (paymentHistory.length === 0) {
      if (paymentStatus === 'Completed') {
        const legacyPaid = overallBillAmount - totalAdvance
        if (legacyPaid > 0) {
          paymentHistory = [{
            date: effectivePaymentDate,
            amount: legacyPaid
          }]
        }
      } else if (paymentStatus === 'Partial Paid' && partialPaymentsSum > 0) {
        paymentHistory = [{
          date: effectivePaymentDate,
          amount: partialPaymentsSum
        }]
      }
    }

    const documentData: PDFDocumentData = {
      title: "PURCHASE INVOICE",
      subHeader: lang === 'te' ? "విస్సాకోడేరు బ్రిడ్జ్ దగ్గర, భీమవరం[534201]." : "NEAR VISSAKODERU BRIDGE, BHIMAVARAM[534201].",
      filename: `${targetShop.name || 'Group'}.pdf`,
      bills: reconstructedBills.map(bill => {
        const shopName = lang === 'te' && bill.shop?.name_te ? bill.shop.name_te : (bill.shop?.name || 'Unknown Shop')
        const landmarkText = lang === 'te' && bill.shop?.landmark_te ? bill.shop.landmark_te : (bill.shop?.landmark || '')
        const contactPerson = lang === 'te' && bill.shop?.contact_person_te ? bill.shop.contact_person_te : (bill.shop?.contact_person || '')
        const contactMobile = bill.shop?.mobile || ''
        const contactStr = contactPerson ? `${contactPerson} (${contactMobile})` : contactMobile

        const metadataLeft: string[] = []
        if (isValidFieldValue(shopName)) {
          metadataLeft.push(`Shop Name: ${shopName.trim()}`)
        }
        if (isValidFieldValue(landmarkText)) {
          metadataLeft.push(`Landmark: ${landmarkText.trim()}`)
        }
        if (isValidFieldValue(contactStr)) {
          metadataLeft.push(`Contact: ${contactStr.trim()}`)
        }
        
        const metadataRight: string[] = []
        if (isValidFieldValue(bill.billNumber)) {
          metadataRight.push(`Bill No: #${bill.billNumber}`)
        }
        if (isValidFieldValue(bill.date)) {
          metadataRight.push(`Date: ${formatDate(bill.date)}`)
        }

        const displayItems = (bill.items || []).filter((item: any) => item && item.quantity > 0 && item.total > 0).map((i: any) => ({
          name: i.name,
          quantity: i.quantity,
          unit: getItemUnit(i.name, 'purchasing', bill.shop?.shop_units || bill.shop, i.unit),
          rate: i.rate,
          total: i.total
        }))

        return {
          metadataLeft,
          metadataRight,
          items: displayItems,
          grandTotal: bill.grandTotal || 0
        }
      }),
      paymentSummary: {
        overallAmount: overallBillAmount,
        advanceAmount: totalAdvance,
        balanceAmount: balanceAmount,
        partialPaid: partialPaymentsSum,
        status: paymentStatus,
        paymentHistory
      }
    }

    toast.dismiss(toastId)
    return await generateProfessionalPDF(documentData, action)
  } catch (error) {
    console.error("Failed to generate Combined PDF:", error)
    toast.dismiss(toastId)
    toast.error("Error generating combined document")
  }
}

export const shareCombinedGroupWhatsApp = async (
  shopsInGroup: Shop[], 
  lang: 'en' | 'te' = 'en',
  targetShop: Shop,
  billIds?: string[],
  preloadedBills?: BillBreakdown[],
  date?: string
) => {
  const toastId = toast.loading("Preparing combined PDF for WhatsApp sharing...")
  try {
    const pdfBlob = await generateCombinedGroupPDF(shopsInGroup, 'blob', lang, targetShop, billIds, preloadedBills, date)
    if (!pdfBlob) {
      toast.dismiss(toastId)
      toast.error("Failed to generate PDF")
      return
    }

    const file = new File(
      [pdfBlob],
      `${targetShop?.name || 'Group'}.pdf`,
      { type: "application/pdf" }
    )

    toast.dismiss(toastId)

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file]
        })
      } catch (shareErr: any) {
        if (shareErr.name !== 'AbortError') {
          console.error("WhatsApp share failed:", shareErr)
          toast.error("Sharing failed. Downloading instead.")
          await generateCombinedGroupPDF(shopsInGroup, 'download', lang, targetShop, billIds, preloadedBills, date)
        }
      }
    } else {
      await generateCombinedGroupPDF(shopsInGroup, 'download', lang, targetShop, billIds, preloadedBills, date)
      alert("Your browser doesn't support direct PDF sharing.")
    }
  } catch (error) {
    console.error("Error sharing Combined PDF:", error)
    toast.dismiss(toastId)
    toast.error("Error sharing PDF")
  }
}
