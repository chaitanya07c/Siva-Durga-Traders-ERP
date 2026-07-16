import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { t } from "./i18n"
import { formatDate } from "./utils"

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
  id?: string
  invoiceNumber: string | null
  date: string
  items: { name: string, quantity: number, rate: number, total: number }[]
  grandTotal: number
  remarks?: string | null
  partial_payment?: number
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
      id: fb.id,
      invoiceNumber: fb.invoice_number,
      date: fb.date,
      items: formattedItems,
      grandTotal: fb.total_amount,
      remarks: fb.remarks,
      partial_payment: fb.partial_payment
    }
  }) || []

  return reconstructedBills
}

export const generateSalesCombinedPDF = async (
  session: GroupedSaleSession, 
  action: 'download' | 'print' | 'blob', 
  lang: 'en' | 'te' = 'en',
  preloadedBills?: SalesBillBreakdown[]
): Promise<Blob | undefined> => {
  const toastId = toast.loading("Generating PDF...")
  try {
    let bills = preloadedBills
    if (!bills) {
      bills = await fetchSalesBillBreakdowns(session, lang)
    }
    
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
      doc.text(lang === 'te' ? "అమ్మకపు ఇన్వాయిస్" : "SALES INVOICE", 195, startY + 8, { align: "right" })

      doc.setDrawColor(226, 232, 240) // slate-200
      doc.setLineWidth(0.8)
      doc.line(15, startY + 22, 195, startY + 22)
      return startY + 26
    }

    y = printHeader(y)

    bills.forEach((bill, billIndex) => {
      let displayItems = (bill.items || []).filter((item: any) => item && item.quantity > 0 && item.total > 0)
      
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
      
      doc.text(`Buyer Name: ${session?.buyer_name || 'Unknown'}`, 15, y + 4)
      
      const invNoStr = bill.invoiceNumber ? `#${bill.invoiceNumber}` : '-'
      doc.text(`Invoice No: ${invNoStr}`, 135, y + 4)
      doc.text(`Date: ${formatDate(bill.date || new Date().toISOString())}`, 135, y + 9)

      const startTableY = y + 15

      autoTable(doc, {
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

      y = (doc as any).lastAutoTable.finalY + 5

      doc.setFont("helvetica", "bold")
      doc.setFontSize(10.5)
      doc.setTextColor(15, 23, 42)
      doc.text(`${t('grandTotal', lang).toUpperCase()}:`, 155, y, { align: "right" })
      doc.text(`Rs ${formatInr(bill.grandTotal)}`, 195, y, { align: "right" })

      y += 8
    })

    const isCompleted = session.status === 'Completed'
    const partialPayment = isCompleted ? session.overallTotal : (session.partial_payment || 0)
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
      const filename = `SalesCombinedBill_${(session?.buyer_name || 'Buyer').replace(/\s+/g, '_')}_${session.date || 'date'}.pdf`
      doc.save(filename)
    } else if (action === 'print') {
      doc.autoPrint()
      window.open(doc.output('bloburl'), '_blank')
    } else if (action === 'blob') {
      return doc.output('blob')
    }
  } catch (error) {
    console.error("Failed to generate Sales PDF:", error)
    toast.dismiss(toastId)
    toast.error("Error generating document")
  }
}

export const shareSalesWhatsApp = async (
  session: GroupedSaleSession, 
  lang: 'en' | 'te' = 'en',
  preloadedBills?: SalesBillBreakdown[]
) => {
  const toastId = toast.loading("Preparing PDF for sharing...")
  try {
    const pdfBlob = await generateSalesCombinedPDF(session, 'blob', lang, preloadedBills)
    
    if (!pdfBlob) {
      toast.dismiss(toastId)
      toast.error("Failed to generate PDF")
      return
    }

    const file = new File(
      [pdfBlob],
      `SalesCombinedBill_${(session?.buyer_name || 'Buyer').replace(/\s+/g, '_')}_${session.date || 'date'}.pdf`,
      { type: "application/pdf" }
    )

    toast.dismiss(toastId)

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: "Siva Durga Traders Bill",
          text: `Bill for ${session?.buyer_name || 'Buyer'} - Date: ${session.date || ''}`,
          files: [file]
        })
      } catch (shareErr: any) {
        if (shareErr.name !== 'AbortError') {
          console.error("WhatsApp share failed:", shareErr)
          toast.error("Sharing failed. Downloading instead.")
          await generateSalesCombinedPDF(session, 'download', lang, preloadedBills)
        }
      }
    } else {
      await generateSalesCombinedPDF(session, 'download', lang, preloadedBills)
      alert("Your browser doesn't support direct PDF sharing.")
    }
  } catch (error) {
    console.error("Failed to share Sales PDF via WhatsApp:", error)
    toast.dismiss(toastId)
    toast.error("Error sharing PDF")
  }
}
