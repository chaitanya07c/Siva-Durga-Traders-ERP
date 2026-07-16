import { supabase } from "@/lib/supabase"
import type { Shop } from "@/types/database"
import { toast } from "sonner"
import jsPDF from "jspdf"
import { t } from "./i18n"
import { formatDate } from "./utils"

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
    let y = 15

    const printHeader = (startY: number) => {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(22)
      doc.setTextColor(30, 41, 59) // slate-800
      doc.text("SIVA DURGA TRADERS", 15, startY + 8)
      
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139) // slate-500
      const subHeader = lang === 'te' ? "విస్సాకోడేరు బ్రిడ్జ్ దగ్గర, భీమవరం[534201]." : "NEAR VISSAKODERU BRIDGE, BHIMAVARAM[534201]."
      doc.text(subHeader, 15, startY + 13)

      doc.setFontSize(10)
      doc.setTextColor(71, 85, 105) // slate-600
      doc.text("G.Ravi Kumar(Chinni)  |  Ph.No: 9949835054", 15, startY + 18)

      doc.setFont("helvetica", "bold")
      doc.setFontSize(16)
      doc.setTextColor(30, 58, 138) // deep blue
      doc.text(lang === 'te' ? "కొనుగోలు ఇన్వాయిస్" : "PURCHASE INVOICE", 195, startY + 8, { align: "right" })

      doc.setDrawColor(226, 232, 240) // slate-200
      doc.setLineWidth(0.8)
      doc.line(15, startY + 22, 195, startY + 22)
      return startY + 26
    }

    y = printHeader(y)

    bills.forEach((bill, billIndex) => {
      let displayItems = bill.items.filter((item: any) => item.quantity > 0 && item.total > 0)
      
      const infoHeight = 22
      const tableHeaderHeight = 8
      const rowHeight = 7.5
      const tableHeight = tableHeaderHeight + (displayItems.length * rowHeight)
      const footerHeight = 12
      const estimatedHeight = infoHeight + tableHeight + footerHeight

      if (y + estimatedHeight > 280) {
        doc.addPage()
        y = 15
        y = printHeader(y)
      }

      if (billIndex > 0 && y > 45) {
        doc.setDrawColor(226, 232, 240)
        doc.setLineWidth(0.5)
        doc.line(15, y, 195, y)
        y += 8
      }

      // Bill / Invoice Details Row
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10.5)
      doc.setTextColor(30, 41, 59)
      
      const shopName = lang === 'te' && shop.name_te ? shop.name_te : shop.name
      doc.text(`Shop Name: ${shopName}`, 15, y + 4)
      
      const billNoStr = bill.billNumber ? `#${bill.billNumber}` : '-'
      doc.text(`Bill No: ${billNoStr}`, 135, y + 4)
      doc.text(`Date: ${formatDate(bill.date)}`, 135, y + 9)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(71, 85, 105)
      const landmarkText = lang === 'te' && shop.landmark_te ? shop.landmark_te : (shop.landmark || '-')
      doc.text(`Landmark: ${landmarkText}`, 15, y + 9)

      const contactPerson = lang === 'te' && shop.contact_person_te ? shop.contact_person_te : (shop.contact_person || '-')
      const contactInfo = contactPerson !== '-' ? `${contactPerson} ${shop.mobile ? `(${shop.mobile})` : ''}` : (shop.mobile || '-')
      doc.text(`Contact: ${contactInfo}`, 15, y + 14)

      const startTableY = y + 18

      // @ts-ignore
      doc.autoTable({
        startY: startTableY,
        margin: { left: 15, right: 15 },
        head: [['No', t('category', lang).toUpperCase(), t('quantity', lang).toUpperCase(), t('rate', lang).toUpperCase(), t('amount', lang).toUpperCase()]],
        body: displayItems.map((item: any, idx: number) => [
          idx + 1,
          item.name,
          formatQuantity(item.name, item.quantity),
          `Rs ${formatInr(item.rate)}`,
          `Rs ${formatInr(item.total)}`
        ]),
        theme: 'striped',
        styles: {
          fontSize: 9,
          cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
          textColor: [51, 65, 85],
          lineColor: [241, 245, 249],
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [71, 85, 105], // Slate-600
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'left' },
          2: { halign: 'center', cellWidth: 25 },
          3: { halign: 'right', cellWidth: 28 },
          4: { halign: 'right', cellWidth: 32 }
        }
      })

      // @ts-ignore
      y = doc.lastAutoTable.finalY + 5

      doc.setFont("helvetica", "bold")
      doc.setFontSize(10.5)
      doc.setTextColor(15, 23, 42)
      doc.text(`${t('grandTotal', lang).toUpperCase()}:`, 155, y, { align: "right" })
      doc.text(`Rs ${formatInr(bill.grandTotal)}`, 195, y, { align: "right" })

      y += 8
    })

    const isCompleted = session.status === 'Completed'
    const partialPayment = isCompleted ? session.overallTotal : (session.session_partial_payment || 0)
    const balance = isCompleted ? 0 : (session.overallTotal - partialPayment)

    let summaryRows = 1
    if (partialPayment > 0) summaryRows++
    if (balance > 0) summaryRows++
    summaryRows++ // status row

    const summaryHeight = 8 + (summaryRows * 8.5) + 3
    
    if (y + summaryHeight > 280) { 
      doc.addPage()
      y = 15 
    }

    doc.setFillColor(248, 250, 252) // slate-50
    doc.setDrawColor(226, 232, 240) // slate-200
    doc.setLineWidth(0.5)
    doc.roundedRect(45, y, 120, summaryHeight, 3, 3, "FD")

    doc.setFont("helvetica", "bold")
    doc.setFontSize(10.5)
    doc.setTextColor(15, 23, 42)
    doc.text(t('paymentSummary', lang).toUpperCase(), 105, y + 6, { align: "center" })

    doc.setDrawColor(226, 232, 240)
    doc.line(45, y + 9, 165, y + 9)

    let currentY = y + 15
    doc.setFontSize(9.5)
    
    doc.setFont("helvetica", "bold")
    doc.text(t('overallAmount', lang), 55, currentY)
    doc.text(`Rs ${formatInr(session.overallTotal)}`, 155, currentY, { align: "right" })
    
    if (partialPayment > 0) {
      currentY += 8.5
      doc.line(45, currentY - 5, 165, currentY - 5)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(71, 85, 105)
      doc.text(t('partialPaid', lang), 55, currentY)
      doc.text(`Rs ${formatInr(partialPayment)}`, 155, currentY, { align: "right" })
      doc.setTextColor(0)
    }
    
    if (balance > 0) {
      currentY += 8.5
      doc.line(45, currentY - 5, 165, currentY - 5)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(185, 28, 28) // red-700
      doc.text(t('balanceAmount', lang), 55, currentY)
      doc.text(`Rs ${formatInr(balance)}`, 155, currentY, { align: "right" })
      doc.setTextColor(0)
    }

    currentY += 8.5
    doc.line(45, currentY - 5, 165, currentY - 5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(isCompleted ? "#15803d" : "#d97706") // green-700 or amber-600
    const paymentStatusStr = isCompleted ? t('completed', lang) : (partialPayment > 0 ? t('partialPaid', lang) : t('pending', lang))
    doc.text(lang === 'te' ? "పేమెంట్ స్థితి" : "Payment Status", 55, currentY)
    doc.text(paymentStatusStr, 155, currentY, { align: "right" })
    doc.setTextColor("#000000")

    toast.dismiss(toastId)
    if (action === 'download') {
      doc.save(`CombinedBill_${shop.name.replace(/\s+/g, '_')}_${session.date}.pdf`)
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
  targetShop: Shop,
  billIds?: string[]
): Promise<Blob | undefined> => {
  const toastId = toast.loading("Generating Combined PDF...")
  try {
    const shopIds = shopsInGroup.map(s => s.id)
    
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

    const activeShopIds = new Set(fullBills.map(b => b.shop_id))
    const filteredShopsInGroup = shopsInGroup.filter(s => activeShopIds.has(s.id))
    console.log("Generating Combined PDF for shops in group:", filteredShopsInGroup.map(s => s.name))

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

    const reconstructedBills = fullBills.map(fb => {
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
        session_partial_payment: fb.session_partial_payment || 0
      }
    })

    const doc = new jsPDF()
    let y = 15

    const printHeader = (startY: number) => {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(22)
      doc.setTextColor(30, 41, 59) // slate-800
      doc.text("SIVA DURGA TRADERS", 15, startY + 8)
      
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139) // slate-500
      const subHeader = lang === 'te' ? "విస్సాకోడేరు బ్రిడ్జ్ దగ్గర, భీమవరం[534201]." : "NEAR VISSAKODERU BRIDGE, BHIMAVARAM[534201]."
      doc.text(subHeader, 15, startY + 13)

      doc.setFontSize(10)
      doc.setTextColor(71, 85, 105) // slate-600
      doc.text("G.Ravi Kumar(Chinni)  |  Ph.No: 9949835054", 15, startY + 18)

      doc.setFont("helvetica", "bold")
      doc.setFontSize(16)
      doc.setTextColor(30, 58, 138) // deep blue
      doc.text(lang === 'te' ? "గ్రూప్ కొనుగోలు ఇన్వాయిస్" : "GROUP PURCHASE INVOICE", 195, startY + 8, { align: "right" })

      doc.setDrawColor(226, 232, 240) // slate-200
      doc.setLineWidth(0.8)
      doc.line(15, startY + 22, 195, startY + 22)
      return startY + 26
    }

    y = printHeader(y)

    reconstructedBills.forEach((bill, billIndex) => {
      let displayItems = bill.items.filter((item: any) => item.quantity > 0 && item.total > 0)
      
      const infoHeight = 22
      const tableHeaderHeight = 8
      const rowHeight = 7.5
      const tableHeight = tableHeaderHeight + (displayItems.length * rowHeight)
      const footerHeight = 12
      const estimatedHeight = infoHeight + tableHeight + footerHeight

      if (y + estimatedHeight > 280) {
        doc.addPage()
        y = 15
        y = printHeader(y)
      }

      if (billIndex > 0 && y > 45) {
        doc.setDrawColor(226, 232, 240)
        doc.setLineWidth(0.5)
        doc.line(15, y, 195, y)
        y += 8
      }

      // Bill Details Row
      doc.setFont("helvetica", "bold")
      doc.setFontSize(10.5)
      doc.setTextColor(30, 41, 59)
      
      const shopName = lang === 'te' && bill.shop.name_te ? bill.shop.name_te : bill.shop.name
      doc.text(`Shop Name: ${shopName}`, 15, y + 4)
      
      const billNoStr = bill.billNumber ? `#${bill.billNumber}` : '-'
      doc.text(`Bill No: ${billNoStr}`, 135, y + 4)
      doc.text(`Date: ${formatDate(bill.date)}`, 135, y + 9)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(9)
      doc.setTextColor(71, 85, 105)
      const landmarkText = lang === 'te' && bill.shop.landmark_te ? bill.shop.landmark_te : (bill.shop.landmark || '-')
      doc.text(`Landmark: ${landmarkText}`, 15, y + 9)

      const contactPerson = lang === 'te' && bill.shop.contact_person_te ? bill.shop.contact_person_te : (bill.shop.contact_person || '-')
      const contactInfo = contactPerson !== '-' ? `${contactPerson} ${bill.shop.mobile ? `(${bill.shop.mobile})` : ''}` : (bill.shop.mobile || '-')
      doc.text(`Contact: ${contactInfo}`, 15, y + 14)

      const startTableY = y + 18

      // @ts-ignore
      doc.autoTable({
        startY: startTableY,
        margin: { left: 15, right: 15 },
        head: [['No', t('category', lang).toUpperCase(), t('quantity', lang).toUpperCase(), t('rate', lang).toUpperCase(), t('amount', lang).toUpperCase()]],
        body: displayItems.map((item: any, idx: number) => [
          idx + 1,
          item.name,
          formatQuantity(item.name, item.quantity),
          `Rs ${formatInr(item.rate)}`,
          `Rs ${formatInr(item.total)}`
        ]),
        theme: 'striped',
        styles: {
          fontSize: 9,
          cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 3 },
          textColor: [51, 65, 85],
          lineColor: [241, 245, 249],
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [71, 85, 105], // Slate-600
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'left' },
          2: { halign: 'center', cellWidth: 25 },
          3: { halign: 'right', cellWidth: 28 },
          4: { halign: 'right', cellWidth: 32 }
        }
      })

      // @ts-ignore
      y = doc.lastAutoTable.finalY + 5

      doc.setFont("helvetica", "bold")
      doc.setFontSize(10.5)
      doc.setTextColor(15, 23, 42)
      doc.text(`${t('grandTotal', lang).toUpperCase()}:`, 155, y, { align: "right" })
      doc.text(`Rs ${formatInr(bill.grandTotal)}`, 195, y, { align: "right" })

      y += 8
    })

    // PAYMENT SUMMARY (Always drawn at the very end)
    const isCompleted = targetShop.status === 'Completed' || reconstructedBills.every(b => b.grandTotal - b.session_partial_payment <= 0)
    const overallBillAmount = reconstructedBills.reduce((sum, b) => sum + b.grandTotal, 0)
    const amountPaid = isCompleted ? overallBillAmount : reconstructedBills.reduce((sum, b) => sum + b.session_partial_payment, 0)
    const balanceAmount = isCompleted ? 0 : (overallBillAmount - amountPaid)

    let summaryRows = 1
    if (amountPaid > 0) summaryRows++
    if (balanceAmount > 0) summaryRows++
    summaryRows++ // status row

    const summaryHeight = 8 + (summaryRows * 8.5) + 3

    if (y + summaryHeight > 280) { 
      doc.addPage()
      y = 15 
    }

    doc.setFillColor(248, 250, 252) // slate-50
    doc.setDrawColor(226, 232, 240) // slate-200
    doc.setLineWidth(0.5)
    doc.roundedRect(45, y, 120, summaryHeight, 3, 3, "FD")

    doc.setFont("helvetica", "bold")
    doc.setFontSize(10.5)
    doc.setTextColor(15, 23, 42)
    doc.text(t('paymentSummary', lang).toUpperCase(), 105, y + 6, { align: "center" })

    doc.setDrawColor(226, 232, 240)
    doc.line(45, y + 9, 165, y + 9)

    let currentY = y + 15
    doc.setFontSize(9.5)

    doc.setFont("helvetica", "bold")
    doc.text(lang === 'te' ? "మొత్తం బిల్ అమౌంట్" : "Overall Bill Amount", 55, currentY)
    doc.text(`Rs ${formatInr(overallBillAmount)}`, 155, currentY, { align: "right" })

    if (amountPaid > 0) {
      currentY += 8.5
      doc.line(45, currentY - 5, 165, currentY - 5)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(71, 85, 105)
      doc.text(lang === 'te' ? "చెల్లించిన అమౌంట్" : "Amount Paid", 55, currentY)
      doc.text(`Rs ${formatInr(amountPaid)}`, 155, currentY, { align: "right" })
      doc.setTextColor(0)
    }

    if (balanceAmount > 0) {
      currentY += 8.5
      doc.line(45, currentY - 5, 165, currentY - 5)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(185, 28, 28) // red-700
      doc.text(lang === 'te' ? "బాకీ అమౌంట్" : "Balance Amount", 55, currentY)
      doc.text(`Rs ${formatInr(balanceAmount)}`, 155, currentY, { align: "right" })
      doc.setTextColor(0)
    }

    currentY += 8.5
    doc.line(45, currentY - 5, 165, currentY - 5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(isCompleted ? "#15803d" : "#d97706") // green-700 or amber-600
    const paymentStatusStr = isCompleted ? t('completed', lang) : (amountPaid > 0 ? t('partialPaid', lang) : t('pending', lang))
    doc.text(lang === 'te' ? "పేమెంట్ స్థితి" : "Payment Status", 55, currentY)
    doc.text(paymentStatusStr, 155, currentY, { align: "right" })
    doc.setTextColor("#000000")

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
    console.error("Failed to generate Combined PDF:", error)
    toast.dismiss(toastId)
    toast.error("Error generating combined document")
  }
}

export const shareCombinedGroupWhatsApp = async (
  shopsInGroup: Shop[], 
  lang: 'en' | 'te' = 'en',
  targetShop: Shop,
  billIds?: string[]
) => {
  const toastId = toast.loading("Preparing combined PDF for WhatsApp sharing...")
  try {
    const pdfBlob = await generateCombinedGroupPDF(shopsInGroup, 'blob', lang, targetShop, billIds)
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
          console.error("WhatsApp share failed:", shareErr)
          toast.error("Sharing failed. Downloading instead.")
          await generateCombinedGroupPDF(shopsInGroup, 'download', lang, targetShop, billIds)
        }
      }
    } else {
      await generateCombinedGroupPDF(shopsInGroup, 'download', lang, targetShop, billIds)
      alert("Your browser doesn't support direct PDF sharing.")
    }
  } catch (error) {
    console.error("Error sharing Combined PDF:", error)
    toast.dismiss(toastId)
    toast.error("Error sharing PDF")
  }
}
