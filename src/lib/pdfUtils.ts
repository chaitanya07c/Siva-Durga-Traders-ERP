import { supabase } from "@/lib/supabase"
import type { Shop } from "@/types/database"
import { toast } from "sonner"
import { formatDate, formatFilenameDate } from "./utils"

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
  status: 'Pending' | 'Completed'
  bill_ids: string[]
  session_id?: string
  session_partial_payment?: number
  payment_date?: string | null
}

export type BillBreakdown = {
  id?: string
  billNumber: number | null
  date: string
  items: { id?: string, name: string, quantity: number, rate: number, total: number }[]
  grandTotal: number
  previous_balance?: number
  advance?: number
  remarks?: string | null
  session_id?: string
  shop?: Shop
  session_partial_payment?: number
  payment_date?: string | null
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
      previous_balance: fb.previous_balance,
      advance: fb.advance,
      remarks: fb.remarks,
      session_id: fb.session_id || fb.id,
      session_partial_payment: fb.session_partial_payment || 0,
      payment_date: fb.payment_date
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

  const shop = (fullBills && fullBills.length > 0) ? ((fullBills as any)[0].shops as Shop || fallbackShop) : fallbackShop

  return {
    shop,
    bills: reconstructedBills
  }
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
    
    const partialPayment = session.session_partial_payment || 0
    const balance = session.overallTotal - partialPayment
    
    let paymentStatus = "Pending"
    if (session.status === 'Completed' || balance === 0) {
      paymentStatus = "Completed"
    } else if (partialPayment > 0) {
      paymentStatus = "Partial Paid"
    }

        const historyMap = new Map<string, { date: string, amount: number }>()
    bills.forEach(b => {
      if (b.session_partial_payment && b.session_partial_payment > 0 && b.payment_date) {
        const sId = b.session_id || b.id || ''
        if (!historyMap.has(sId)) {
          historyMap.set(sId, {
            date: b.payment_date,
            amount: b.session_partial_payment
          })
        }
      }
    })
    const paymentHistory = Array.from(historyMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const documentData: PDFDocumentData = {
      title: "PURCHASE INVOICE",
      subHeader: lang === 'te' ? "విస్సాకోడేరు బ్రిడ్జ్ దగ్గర, భీమవరం[534201]." : "NEAR VISSAKODERU BRIDGE, BHIMAVARAM[534201].",
      filename: `${shop?.name || 'Shop'}_${formatFilenameDate(session.date || session.payment_date)}.pdf`,
      bills: bills.map(bill => {
        const shopName = lang === 'te' && bill.shop?.name_te ? bill.shop.name_te : (bill.shop?.name || shop?.name || 'Unknown Shop')
        const landmarkText = lang === 'te' && (bill.shop?.landmark_te || shop?.landmark_te) ? (bill.shop?.landmark_te || shop?.landmark_te) : (bill.shop?.landmark || shop?.landmark || '')
        const contactPerson = lang === 'te' && (bill.shop?.contact_person_te || shop?.contact_person_te) ? (bill.shop?.contact_person_te || shop?.contact_person_te) : (bill.shop?.contact_person || shop?.contact_person || '')
        const contactMobile = bill.shop?.mobile || shop?.mobile || ''
        const contactStr = contactPerson ? `${contactPerson} (${contactMobile})` : contactMobile

        const metadataLeft = [
          `Shop Name: ${shopName}`,
          `Landmark: ${landmarkText}`,
          `Contact: ${contactStr || '-'}`
        ]
        
        const metadataRight = [
          `Bill No: #${bill.billNumber || ''}`,
          `Date: ${formatDate(bill.date)}`
        ]

        const displayItems = (bill.items || []).filter((item: any) => item && item.quantity > 0 && item.total > 0).map(i => ({
          name: i.name,
          quantity: i.quantity,
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
        overallAmount: session.overallTotal || 0,
        balanceAmount: balance || 0,
        partialPaid: partialPayment || 0,
        status: paymentStatus,
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
      `${shop?.name || 'Shop'}_${formatFilenameDate(session.date || session.payment_date)}.pdf`,
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
    .select('id, date, grand_total, payment_status, shop_id, session_partial_payment, payment_date, shops(name, type)')
    .eq('session_id', session_id)
    .eq('payment_status', 'Pending')

  if (!data || data.length === 0) return null

  const session: GroupedSession = {
    id: session_id,
    session_id,
    session_partial_payment: data[0].session_partial_payment || 0,
    payment_date: data[0].payment_date,
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

export const belongsToPredefinedGroup = (shopName: string): boolean => {
  const nameLower = shopName.toLowerCase().trim();
  return nameLower === 'durga bar' || nameLower === 'durga wines' || nameLower === 'vijaya durga wines' ||
         nameLower === 'suchitra wines' ||
         nameLower === 'satya krishna bar' || nameLower === 'satya krishna wines' ||
         nameLower === 'jayaram wines' || nameLower === 'jayaram wines' || nameLower === 'vasu raju wines' || nameLower === 'venkateswara wines';
}

export const getPredefinedGroupShops = (allShops: Shop[], targetShop: Shop): Shop[] => {
  const tName = targetShop.name.toLowerCase().trim();

  if (tName === 'durga bar' || tName === 'durga wines' || tName === 'vijaya durga wines') {
    return allShops.filter(s => {
      const name = s.name.toLowerCase().trim();
      return name === 'durga bar' || name === 'durga wines' || name === 'vijaya durga wines';
    });
  }

  if (tName === 'suchitra wines') {
    return allShops.filter(s => {
      const name = s.name.toLowerCase().trim();
      const lmark = (s.landmark || '').toLowerCase().trim();
      return name === 'suchitra wines' && (lmark === 'padmalaya' || lmark === 'town hall' || lmark === 'fire office' || lmark === 'fire station');
    });
  }

  if (tName === 'satya krishna bar' || tName === 'satya krishna wines') {
    return allShops.filter(s => {
      const name = s.name.toLowerCase().trim();
      return name === 'satya krishna bar' || name === 'satya krishna wines';
    });
  }

  if (tName === 'jayaram wines' || tName === 'vasu raju wines' || tName === 'venkateswara wines') {
    return allShops.filter(s => {
      const name = s.name.toLowerCase().trim();
      return name === 'jayaram wines' || name === 'vasu raju wines' || name === 'venkateswara wines';
    });
  }

  return [];
}

export const generateCombinedGroupPDF = async (
  shopsInGroup: Shop[], 
  action: 'download' | 'print' | 'blob', 
  lang: 'en' | 'te' = 'en',
  targetShop: Shop,
  billIds?: string[],
  preloadedBills?: BillBreakdown[],
  date?: string
): Promise<Blob | undefined> => {
  const toastId = toast.loading("Generating Combined PDF...")
  try {
    const shopIds = shopsInGroup.map(s => s.id)
    let reconstructedBills: BillBreakdown[] = []

    if (preloadedBills && preloadedBills.length > 0) {
      reconstructedBills = preloadedBills.map(b => ({
        ...b,
        shop: b.shop || shopsInGroup.find(s => s.id === (b as any).shop_id) || targetShop
      }))
    } else {
      let query = supabase
        .from('purchases')
        .select('*, shops(*)')

      if (billIds && billIds.length > 0) {
        query = query.in('id', billIds)
      } else {
        query = query.in('shop_id', shopIds).eq('payment_status', 'Pending')
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
          return {
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
          shop: fb.shops as Shop,
          session_id: fb.session_id || fb.id,
          session_partial_payment: fb.session_partial_payment || 0,
          payment_date: fb.payment_date
        }
      })
    }

    const overallBillAmount = reconstructedBills.reduce((sum, b) => sum + b.grandTotal, 0)
    const amountPaid = reconstructedBills.reduce((sum, b) => sum + (b.session_partial_payment || 0), 0)
    const balanceAmount = overallBillAmount - amountPaid

    let paymentStatus = "Pending"
    if (balanceAmount === 0) {
      paymentStatus = "Completed"
    } else if (amountPaid > 0) {
      paymentStatus = "Partial Paid"
    }

    const historyMap = new Map<string, { date: string, amount: number }>()
    reconstructedBills.forEach(b => {
      if (b.session_partial_payment && b.session_partial_payment > 0 && b.payment_date) {
        const sId = b.session_id || b.id || ''
        if (!historyMap.has(sId)) {
          historyMap.set(sId, {
            date: b.payment_date,
            amount: b.session_partial_payment
          })
        }
      }
    })
    const paymentHistory = Array.from(historyMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const dateToUse = date || reconstructedBills[0]?.date
    const documentData: PDFDocumentData = {
      title: "PURCHASE INVOICE",
      subHeader: lang === 'te' ? "విస్సాకోడేరు బ్రిడ్జ్ దగ్గర, భీమవరం[534201]." : "NEAR VISSAKODERU BRIDGE, BHIMAVARAM[534201].",
      filename: `${targetShop.name || 'Group'}_${formatFilenameDate(dateToUse)}.pdf`,
      bills: reconstructedBills.map(bill => {
        const shopName = lang === 'te' && bill.shop?.name_te ? bill.shop.name_te : (bill.shop?.name || 'Unknown Shop')
        const landmarkText = lang === 'te' && bill.shop?.landmark_te ? bill.shop.landmark_te : (bill.shop?.landmark || '')
        const contactPerson = lang === 'te' && bill.shop?.contact_person_te ? bill.shop.contact_person_te : (bill.shop?.contact_person || '')
        const contactMobile = bill.shop?.mobile || ''
        const contactStr = contactPerson ? `${contactPerson} (${contactMobile})` : contactMobile

        const metadataLeft = [
          `Shop Name: ${shopName}`,
          `Landmark: ${landmarkText}`,
          `Contact: ${contactStr || '-'}`
        ]
        
        const metadataRight = [
          `Bill No: #${bill.billNumber || ''}`,
          `Date: ${formatDate(bill.date)}`
        ]

        const displayItems = (bill.items || []).filter((item: any) => item && item.quantity > 0 && item.total > 0).map(i => ({
          name: i.name,
          quantity: i.quantity,
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
        balanceAmount: balanceAmount,
        partialPaid: amountPaid,
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
      `${targetShop?.name || 'Group'}_${formatFilenameDate(date)}.pdf`,
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
