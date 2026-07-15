import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import jsPDF from "jspdf"
import { t } from "./i18n"

const formatInr = (value: number) => new Intl.NumberFormat('en-IN').format(value)

const WEIGHT_ITEMS = ["Glass", "White Glass", "Colour Glass", "Atta", "Plastic", "Plastic Cover", "Iron"]

export const formatQuantity = (name: string, quantity: number) => {
  return WEIGHT_ITEMS.includes(name) ? `${quantity} Kg` : `${quantity}`
}

export type GroupedSaleSession = {
  id: string
  buyer_name: string
  date: string
  billsCount: number
  overallTotal: number
  status: 'Pending' | 'Completed'
  bill_ids: string[]
  partial_payment: number
  payment_date?: string | null
}

export type SalesBillBreakdown = {
  invoiceNumber: string | null
  date: string
  items: { name: string, quantity: number, rate: number, total: number }[]
  grandTotal: number
}

export const fetchSalesBillBreakdowns = async (session: GroupedSaleSession, lang?: 'en' | 'te'): Promise<SalesBillBreakdown[]> => {
  const { data: fullBills } = await supabase
    .from('sales')
    .select('*')
    .in('id', session.bill_ids)
    .order('created_at', { ascending: true })

  const reconstructedBills = fullBills?.map(fb => {
    const itemsJson = fb.items || {}
    const formattedItems = Object.values(itemsJson).map((i: any) => ({
      name: lang === 'te' && i.name_te ? i.name_te : i.name,
      quantity: i.quantity,
      rate: i.rate,
      total: i.total
    }))
    
    return {
      invoiceNumber: fb.invoice_number,
      date: fb.date,
      items: formattedItems,
      grandTotal: fb.total_amount
    }
  }) || []

  return reconstructedBills
}

export const generateSalesCombinedPDF = async (session: GroupedSaleSession, action: 'download' | 'print', lang: 'en' | 'te' = 'en') => {
  const toastId = toast.loading("Generating PDF...")
  try {
    const bills = await fetchSalesBillBreakdowns(session, lang)
    
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

      if (y + billHeight > 285) { 
        doc.addPage()
        y = 10 
      }

      doc.setDrawColor(0)
      doc.setLineWidth(0.4)
      doc.rect(10, y, 190, billHeight)

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
      
      doc.text(`${t('date', lang).toUpperCase()}:  ${bill.date}`, 140, y + 27)
      
      doc.line(10, y + 29, 200, y + 29)
      
      doc.text(`${t('addBuyer', lang).replace("New ", "").toUpperCase()}:  ${session.buyer_name}`, 12, y + 34)
      doc.text(`INV.NO:`, 140, y + 34)
      doc.setFontSize(14)
      doc.setTextColor(180, 0, 0)
      doc.text(`${bill.invoiceNumber || ''}`, 160, y + 34)
      doc.setTextColor(0)
      doc.setFontSize(12)
      
      doc.line(10, y + 36, 200, y + 36)
      
      doc.text(`Invoice Amount: Rs ${formatInr(bill.grandTotal)}`, 12, y + 41)
      
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
      
      doc.setFillColor(180, 200, 230)
      doc.rect(10, tableY, 190, grandTotalHeight, "FD")
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text(`${t('grandTotal', lang).toUpperCase()}:`, 155, tableY + 5.5, { align: "right" })
      doc.text(`${formatInr(bill.grandTotal)}`, 180, tableY + 5.5, { align: "center" })
      
      tableY += grandTotalHeight
      
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
      } else if (session.partial_payment > 0) {
        paymentStatus = t('partialPaid', lang)
      }

      doc.setFont("helvetica", "normal")
      doc.text(`${t('date', lang)} (Payment)    :    ${paymentDate}`, 15, tableY + 6.5)
      doc.text(`${t('status', lang)}    :    ${paymentStatus}`, 130, tableY + 6.5)
      
      y += billHeight + 10
    })

    const partialPayment = session.partial_payment || 0
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
      doc.setTextColor(180, 0, 0)
      doc.text(t('balanceAmount', lang), 45, currentY)
      doc.text(`Rs ${formatInr(balance)}`, 165, currentY, { align: "right" })
      doc.setTextColor(0)
    }

    toast.dismiss(toastId)
    if (action === 'download') {
      doc.save(`SalesCombinedBill_${session.buyer_name}_${session.date}.pdf`)
    } else {
      doc.autoPrint()
      window.open(doc.output('bloburl'), '_blank')
    }
  } catch (error) {
    toast.dismiss(toastId)
    toast.error("Error generating document")
  }
}

export const shareSalesWhatsApp = async (session: GroupedSaleSession, lang: 'en' | 'te' = 'en') => {
  const toastId = toast.loading("Preparing WhatsApp share...")
  try {
    const bills = await fetchSalesBillBreakdowns(session, lang)
    toast.dismiss(toastId)

    let text = `SIVA DURGA TRADERS\nDate: ${session.date}\nBuyer: ${session.buyer_name}\n\n`
    
    bills.forEach((b, i) => {
      text += `Invoice ${i + 1} (${b.invoiceNumber || 'No Inv'}): Rs ${formatInr(b.grandTotal)}\n`
    })
    if (bills.length > 1) {
      text += `\nOVERALL TOTAL: Rs ${formatInr(session.overallTotal)}\n`
    } else {
      text += `\n`
    }

    const partialPayment = session.partial_payment || 0
    const paymentDate = session.payment_date 
      ? session.payment_date.split('-').reverse().join('-') 
      : new Date().toISOString().split('T')[0].split('-').reverse().join('-')
      
    let paymentStatus = t('pending', lang)
    if (session.status === 'Completed') {
      paymentStatus = t('completed', lang)
    } else if (partialPayment > 0) {
      paymentStatus = t('partialPaid', lang)
    }

    text += `\n${t('paymentInfo', lang).toUpperCase()}\n`
    text += `${t('date', lang)}: ${paymentDate}\n`
    text += `${t('status', lang)}: ${paymentStatus}\n\n`

    if (partialPayment > 0 || session.overallTotal - partialPayment > 0) {
      text += `${t('paymentSummary', lang).toUpperCase()}\n`
      text += `${t('overallAmount', lang)}: Rs ${formatInr(session.overallTotal)}\n`
      if (partialPayment > 0 && session.overallTotal - partialPayment > 0) {
        text += `${t('partialPaid', lang)}: Rs ${formatInr(partialPayment)}\n`
        text += `${t('balanceAmount', lang)}: Rs ${formatInr(session.overallTotal - partialPayment)}\n`
      }
      text += `\n`
    }

    text += `Thank you!`

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  } catch (error) {
    toast.dismiss(toastId)
    toast.error("Error preparing WhatsApp message")
  }
}
