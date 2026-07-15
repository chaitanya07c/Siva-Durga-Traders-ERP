import { supabase } from "@/lib/supabase"
import type { Shop } from "@/types/database"
import { toast } from "sonner"
import jsPDF from "jspdf"
import { t } from "./i18n"

const formatInr = (value: number) => new Intl.NumberFormat('en-IN').format(value)

const WEIGHT_ITEMS = ["Glass", "White Glass", "Colour Glass", "Atta", "Plastic", "Plastic Cover", "Iron"]

export const formatQuantity = (name: string, quantity: number) => {
  return WEIGHT_ITEMS.includes(name) ? `${quantity} Kg` : `${quantity}`
}

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
      session_id: fb.session_id || fb.id
    }
  }) || []

  return {
    shop: (fullBills as any)[0].shops as Shop,
    bills: reconstructedBills
  }
}

export const generateCombinedPDF = async (session: GroupedSession, action: 'download' | 'print' | 'blob', lang: 'en' | 'te' = 'en'): Promise<Blob | undefined> => {
  const toastId = toast.loading("Generating PDF...")
  try {
    const { shop, bills } = await fetchBillBreakdowns(session, lang)
    
    const doc = new jsPDF()
    let y = 10
    
    bills.forEach((bill) => {
      let displayItems = bill.items.filter((item: any) => item.quantity > 0 && item.total > 0)

      const rowHeight = 6.5
      const headerHeight = 43
      const tableHeaderHeight = 7
      const rowsHeight = displayItems.length * rowHeight
      const grandTotalHeight = 8
      const paymentHeight = 17
      const billHeight = headerHeight + tableHeaderHeight + rowsHeight + grandTotalHeight + paymentHeight

      // Check if we need a new page
      if (y + billHeight > 285) { 
        doc.addPage()
        y = 10 
      }

      // Draw bounding box
      doc.setDrawColor(0)
      doc.setLineWidth(0.4)
      doc.rect(10, y, 190, billHeight)

      // Header
      doc.setFont("helvetica", "bold")
      doc.setFontSize(22)
      doc.setTextColor(30, 60, 90)
      doc.text("SIVA DURGA TRADERS", 105, y + 8, { align: "center" })
      
      doc.setFontSize(10)
      doc.setTextColor(0)
      const subHeader = lang === 'te' ? "విస్సాకోడేరు బ్రిడ్జ్ దగ్గర, భీమవరం[534201]." : "NEAR VISSAKODERU BRIDGE, BHIMAVARAM[534201]."
      doc.text(subHeader, 105, y + 13, { align: "center" })
      
      doc.line(10, y + 15, 200, y + 15)
      
      doc.setFontSize(12)
      doc.text("G.Ravi Kumar(Chinni)", 12, y + 20)
      doc.text("Ph.No:9949835054", 140, y + 20)
      
      doc.line(10, y + 22, 200, y + 22)
      
      const landmarkText = lang === 'te' && shop.landmark_te ? shop.landmark_te : (shop.landmark || '')
      doc.text(`${t('landmark', lang).toUpperCase()}:  ${landmarkText}`, 12, y + 27)
      doc.text(`${t('date', lang).toUpperCase()}:  ${bill.date}`, 140, y + 27)
      
      doc.line(10, y + 29, 200, y + 29)
      
      const shopName = lang === 'te' && shop.name_te ? shop.name_te : shop.name
      doc.text(`${t('shopDetails', lang).toUpperCase()}:  ${shopName}`, 12, y + 34)
      doc.text(`${t('billNo', lang).toUpperCase()}:`, 140, y + 34)
      doc.setFontSize(14)
      doc.setTextColor(180, 0, 0)
      doc.text(`${bill.billNumber || ''}`, 158, y + 34)
      doc.setTextColor(0)
      doc.setFontSize(12)
      
      doc.line(10, y + 36, 200, y + 36)
      
      const contactPerson = lang === 'te' && shop.contact_person_te ? shop.contact_person_te : (shop.contact_person || '')
      doc.text(`${t('name', lang).toUpperCase()}:  ${contactPerson}`, 12, y + 41)
      doc.text(`${t('mobile', lang).toUpperCase()}:  ${shop.mobile || ''}`, 140, y + 41)
      
      // Table Header
      doc.setFillColor(180, 200, 230)
      doc.rect(10, y + 43, 190, tableHeaderHeight, "FD")
      
      doc.setFontSize(10)
      doc.text("NO", 12, y + 48)
      doc.text(t('category', lang).toUpperCase(), 25, y + 48)
      doc.text(t('quantity', lang).toUpperCase(), 100, y + 48, { align: "center" })
      doc.text(t('rate', lang).toUpperCase(), 140, y + 48, { align: "center" })
      doc.text(t('amount', lang).toUpperCase(), 180, y + 48, { align: "center" })
      
      let tableY = y + 50
      
      doc.setFont("helvetica", "normal")
      doc.setFontSize(11)
      
      displayItems.forEach((item: any, i: number) => {
        doc.text(`${i + 1}.`, 12, tableY + 4.5)
        doc.text(`${item.name}`, 25, tableY + 4.5)
        doc.text(`${formatQuantity(item.name, item.quantity)}`, 100, tableY + 4.5, { align: "center" })
        doc.text(`${formatInr(item.rate)}`, 140, tableY + 4.5, { align: "center" })
        doc.text(`${formatInr(item.total)}`, 180, tableY + 4.5, { align: "center" })
        
        doc.line(10, tableY + rowHeight, 200, tableY + rowHeight)
        tableY += rowHeight
      })
      
      doc.line(22, y + 43, 22, tableY)
      doc.line(80, y + 43, 80, tableY)
      doc.line(120, y + 43, 120, tableY)
      doc.line(160, y + 43, 160, tableY)
      
      // Grand Total
      doc.setFillColor(180, 200, 230)
      doc.rect(10, tableY, 190, grandTotalHeight, "FD")
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text(`${t('grandTotal', lang).toUpperCase()}:`, 155, tableY + 5.5, { align: "right" })
      doc.text(`${formatInr(bill.grandTotal)}`, 180, tableY + 5.5, { align: "center" })
      
      tableY += grandTotalHeight
      
      // Payment Section
      doc.setFillColor(180, 200, 230)
      doc.rect(10, tableY, 190, 7, "FD")
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.text(t('paymentInfo', lang).toUpperCase(), 105, tableY + 5, { align: "center" })
      
      tableY += 7
      
      const paymentDate = session.payment_date 
        ? session.payment_date.split('-').reverse().join('-') 
        : new Date().toISOString().split('T')[0].split('-').reverse().join('-')
        
      let paymentStatus = t('pending', lang)
      if (session.status === 'Completed') {
        paymentStatus = t('completed', lang)
      } else if ((session.session_partial_payment || 0) > 0) {
        paymentStatus = t('partialPaid', lang)
      }

      doc.setFont("helvetica", "normal")
      doc.text(`${t('date', lang)} (Payment)    :    ${paymentDate}`, 15, tableY + 6.5)
      doc.text(`${t('status', lang)}    :    ${paymentStatus}`, 130, tableY + 6.5)
      
      // Move y exactly to the bottom of the bounding box
      y += billHeight + 10 // 10mm spacing between bills
    })

    // PAYMENT SUMMARY (Always drawn at the very end)
    const partialPayment = session.session_partial_payment || 0
    const balance = session.overallTotal - partialPayment
    
    let summaryRows = 1
    if (partialPayment > 0) summaryRows++
    if (balance > 0) summaryRows++
    
    const summaryHeight = 7 + (summaryRows * 8)
    
    if (y + summaryHeight > 285) { 
      doc.addPage()
      y = 10 
    }
    
    doc.setDrawColor(0)
    doc.setLineWidth(0.4)
    doc.rect(30, y, 150, summaryHeight)
    
    doc.setFillColor(180, 200, 230)
    doc.rect(30, y, 150, 7, "FD")
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.text(t('paymentSummary', lang).toUpperCase(), 105, y + 5, { align: "center" })
    
    let currentY = y + 13
    doc.setFontSize(10)
    
    // Overall
    doc.setFont("helvetica", "bold")
    doc.text(t('overallAmount', lang), 45, currentY)
    doc.text(`Rs ${formatInr(session.overallTotal)}`, 165, currentY, { align: "right" })
    
    if (partialPayment > 0) {
      currentY += 8
      doc.line(30, currentY - 5, 180, currentY - 5)
      doc.setFont("helvetica", "normal")
      doc.text(t('partialPaid', lang), 45, currentY)
      doc.text(`Rs ${formatInr(partialPayment)}`, 165, currentY, { align: "right" })
    }
    
    if (balance > 0) {
      currentY += 8
      doc.line(30, currentY - 5, 180, currentY - 5)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(180, 0, 0) // Red
      doc.text(t('balanceAmount', lang), 45, currentY)
      doc.text(`Rs ${formatInr(balance)}`, 165, currentY, { align: "right" })
      doc.setTextColor(0)
    }

    toast.dismiss(toastId)
    if (action === 'download') {
      doc.save(`CombinedBill_${shop.name}_${session.date}.pdf`)
    } else if (action === 'print') {
      doc.autoPrint()
      window.open(doc.output('bloburl'), '_blank')
    } else if (action === 'blob') {
      return doc.output('blob')
    }
  } catch (error) {
    toast.dismiss(toastId)
    toast.error("Error generating document")
  }
}

export const shareWhatsApp = async (session: GroupedSession, lang: 'en' | 'te' = 'en') => {
  const toastId = toast.loading("Preparing PDF for sharing...")
  try {
    const { shop } = await fetchBillBreakdowns(session, lang)
    const pdfBlob = await generateCombinedPDF(session, 'blob', lang)
    
    if (!pdfBlob) {
      toast.dismiss(toastId)
      toast.error("Failed to generate PDF")
      return
    }

    const file = new File(
      [pdfBlob],
      `CombinedBill_${shop.name}_${session.date}.pdf`,
      { type: "application/pdf" }
    )

    toast.dismiss(toastId)

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: "Siva Durga Traders Bill",
          text: `Bill for ${shop.name} - Date: ${session.date}`,
          files: [file]
        })
      } catch (shareErr: any) {
        if (shareErr.name !== 'AbortError') {
          toast.error("Sharing failed. Downloading instead.")
          await generateCombinedPDF(session, 'download', lang)
        }
      }
    } else {
      await generateCombinedPDF(session, 'download', lang)
      alert("Your browser doesn't support direct PDF sharing.")
    }
  } catch (error) {
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
  targetShop: Shop
): Promise<Blob | undefined> => {
  const toastId = toast.loading("Generating Combined PDF...")
  try {
    const shopIds = shopsInGroup.map(s => s.id)
    const { data: purchases } = await supabase
      .from('purchases')
      .select('id, bill_number, date, shop_id, grand_total, session_partial_payment, payment_status')
      .in('shop_id', shopIds)
      .eq('payment_status', 'Pending')
      .order('date', { ascending: true })

    if (!purchases || purchases.length === 0) {
      toast.dismiss(toastId)
      toast.error("No pending bills found for this group.")
      return
    }

    // Group purchases by shop ID
    const shopPurchasesMap = new Map<string, typeof purchases>()
    purchases.forEach(p => {
      if (!shopPurchasesMap.has(p.shop_id)) {
        shopPurchasesMap.set(p.shop_id, [])
      }
      shopPurchasesMap.get(p.shop_id)!.push(p)
    })

    const doc = new jsPDF()
    let y = 10

    // Header
    doc.setFont("helvetica", "bold")
    doc.setFontSize(22)
    doc.setTextColor(30, 60, 90)
    doc.text("SIVA DURGA TRADERS", 105, y + 8, { align: "center" })
    
    doc.setFontSize(10)
    doc.setTextColor(0)
    const subHeader = lang === 'te' ? "విస్సాకోడేరు బ్రిడ్జ్ దగ్గర, భీమవరం[534201]." : "NEAR VISSAKODERU BRIDGE, BHIMAVARAM[534201]."
    doc.text(subHeader, 105, y + 13, { align: "center" })
    
    doc.line(10, y + 15, 200, y + 15)
    
    doc.setFontSize(12)
    doc.text("G.Ravi Kumar(Chinni)", 12, y + 20)
    doc.text("Ph.No:9949835054", 140, y + 20)
    
    doc.line(10, y + 22, 200, y + 22)
    
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text(lang === 'te' ? "కంబైన్డ్ పెండింగ్ బిల్లు" : "COMBINED PENDING BILL", 105, y + 28, { align: "center" })
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text(`${t('date', lang).toUpperCase()}: ${new Date().toISOString().split('T')[0].split('-').reverse().join('-')}`, 140, y + 28)

    y += 32

    let overallTotal = 0

    // Render each shop section
    shopsInGroup.forEach(shop => {
      const shopBills = shopPurchasesMap.get(shop.id) || []
      if (shopBills.length === 0) return

      // Check height for shop section
      const shopHeaderHeight = 10
      const tableHeaderHeight = 7
      const rowHeight = 7
      const shopFooterHeight = 8
      const sectionHeight = shopHeaderHeight + tableHeaderHeight + (shopBills.length * rowHeight) + shopFooterHeight + 5

      if (y + sectionHeight > 280) {
        doc.addPage()
        y = 10
      }

      // Draw Shop name & landmark
      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.setTextColor(30, 60, 90)
      const shopName = lang === 'te' && shop.name_te ? shop.name_te : shop.name
      const shopLandmark = lang === 'te' && shop.landmark_te ? shop.landmark_te : (shop.landmark || '')
      doc.text(`${shopName} ${shopLandmark ? `(${shopLandmark})` : ''}`, 12, y + 5)
      
      y += 7

      // Table Header
      doc.setFillColor(220, 230, 242)
      doc.rect(10, y, 190, tableHeaderHeight, "F")
      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(0)
      doc.text(lang === 'te' ? "బిల్ నంబర్" : "BILL NUMBER", 15, y + 5)
      doc.text(lang === 'te' ? "తేదీ" : "DATE", 70, y + 5)
      doc.text(lang === 'te' ? "బిల్ అమౌంట్" : "BILL AMOUNT", 130, y + 5)
      doc.text(lang === 'te' ? "పెండింగ్ అమౌంట్" : "PENDING AMOUNT", 185, y + 5, { align: "right" })

      y += tableHeaderHeight

      doc.setFont("helvetica", "normal")
      let shopSubtotal = 0

      shopBills.forEach(bill => {
        const pendingAmount = bill.grand_total - (bill.session_partial_payment || 0)
        shopSubtotal += pendingAmount
        overallTotal += pendingAmount

        // Draw Row
        doc.text(`${bill.bill_number}`, 15, y + 5)
        doc.text(`${bill.date.split('-').reverse().join('-')}`, 70, y + 5)
        doc.text(`Rs ${formatInr(bill.grand_total)}`, 130, y + 5)
        doc.text(`Rs ${formatInr(pendingAmount)}`, 185, y + 5, { align: "right" })

        // Draw thin line under row
        doc.setDrawColor(220)
        doc.setLineWidth(0.2)
        doc.line(10, y + rowHeight, 200, y + rowHeight)

        y += rowHeight
      })

      // Shop Subtotal
      doc.setFont("helvetica", "bold")
      doc.text(lang === 'te' ? "సబ్ టోటల్:" : "Subtotal:", 130, y + 5)
      doc.text(`Rs ${formatInr(shopSubtotal)}`, 185, y + 5, { align: "right" })

      y += shopFooterHeight + 2
    })

    // Overall Total Summary at the very bottom
    const summaryHeight = 15
    if (y + summaryHeight > 280) {
      doc.addPage()
      y = 10
    }

    doc.setDrawColor(30, 60, 90)
    doc.setLineWidth(0.5)
    doc.setFillColor(240, 244, 248)
    doc.rect(10, y, 190, summaryHeight, "FD")

    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(30, 60, 90)
    doc.text(lang === 'te' ? "మొత్తం పెండింగ్ అమౌంట్ (OVERALL TOTAL):" : "OVERALL TOTAL PENDING AMOUNT:", 15, y + 10)
    doc.setTextColor(180, 0, 0)
    doc.text(`Rs ${formatInr(overallTotal)}`, 185, y + 10, { align: "right" })

    toast.dismiss(toastId)
    const formattedName = targetShop.name.replace(/\s+/g, '_')
    if (action === 'download') {
      doc.save(`CombinedGroupBill_${formattedName}.pdf`)
    } else if (action === 'print') {
      doc.autoPrint()
      window.open(doc.output('bloburl'), '_blank')
    } else if (action === 'blob') {
      return doc.output('blob')
    }
  } catch (error) {
    toast.dismiss(toastId)
    toast.error("Error generating combined document")
  }
}

export const shareCombinedGroupWhatsApp = async (
  shopsInGroup: Shop[], 
  lang: 'en' | 'te' = 'en',
  targetShop: Shop
) => {
  const toastId = toast.loading("Preparing combined PDF for WhatsApp sharing...")
  try {
    const pdfBlob = await generateCombinedGroupPDF(shopsInGroup, 'blob', lang, targetShop)
    if (!pdfBlob) {
      toast.dismiss(toastId)
      toast.error("Failed to generate PDF")
      return
    }

    const file = new File(
      [pdfBlob],
      `CombinedGroupBill_${targetShop.name.replace(/\s+/g, '_')}.pdf`,
      { type: "application/pdf" }
    )

    toast.dismiss(toastId)

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: "Siva Durga Traders Combined Bill",
          text: `Combined bill for group starting from ${targetShop.name}`,
          files: [file]
        })
      } catch (shareErr: any) {
        if (shareErr.name !== 'AbortError') {
          toast.error("Sharing failed. Downloading instead.")
          await generateCombinedGroupPDF(shopsInGroup, 'download', lang, targetShop)
        }
      }
    } else {
      await generateCombinedGroupPDF(shopsInGroup, 'download', lang, targetShop)
      alert("Your browser doesn't support direct PDF sharing.")
    }
  } catch (error) {
    toast.dismiss(toastId)
    toast.error("Error sharing PDF")
  }
}
