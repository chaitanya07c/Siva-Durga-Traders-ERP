import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { formatDate, formatFilenameDate } from "./utils"

import { formatQuantity, generateProfessionalPDF, type PDFDocumentData } from "./pdfTemplate"
export { formatQuantity }

export type GroupedSaleSession = {
  id: string
  buyer_name: string
  date: string
  billsCount: number
  overallTotal: number
  advance?: number
  status: 'Pending' | 'Partial Payment' | 'Completed'
  bill_ids: string[]
  partial_payment: number
  payment_date?: string | null
  payment_history?: { date: string, amount: number, remainingBalance?: number, remarks?: string }[]
}

export type SalesBillBreakdown = {
  id?: string
  invoiceNumber: string | null
  date: string
  items: { name: string, quantity: number, rate: number, total: number }[]
  grandTotal: number
  advance?: number
  remarks?: string | null
  partial_payment?: number
  payment_date?: string | null
  payment_history?: { date: string, amount: number, remainingBalance?: number, remarks?: string }[]
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
      advance: fb.advance || 0,
      remarks: fb.remarks,
      partial_payment: fb.partial_payment,
      payment_date: fb.payment_date,
      payment_history: fb.payment_history || []
    }
  }) || []

  return reconstructedBills
}

// Header is imported from pdfTemplate

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
    
    const totalAdvance = session.advance !== undefined ? session.advance : bills.reduce((sum, b) => sum + (b.advance || 0), 0)
    const additionalPayments = session.partial_payment || 0
    const totalPaid = totalAdvance + additionalPayments
    const balance = Math.max(0, session.overallTotal - totalPaid)

    let paymentStatus = "Pending"
    if (session.status === 'Completed' || balance === 0) {
      paymentStatus = "Completed"
    } else if (totalPaid > 0) {
      paymentStatus = "Partial Paid"
    }

    // Consolidate payment history from bills
    const historyList: { date: string, amount: number, remarks?: string }[] = []
    bills.forEach(b => {
      let hasAdvanceInHistory = false
      if (Array.isArray(b.payment_history) && b.payment_history.length > 0) {
        b.payment_history.forEach(h => {
          if (h.amount > 0 && h.date) {
            if (h.remarks === "Advance Payment" || (b.advance && h.amount === b.advance)) {
              hasAdvanceInHistory = true
            }
            historyList.push({ date: h.date, amount: h.amount, remarks: h.remarks })
          }
        })
      }

      if (!hasAdvanceInHistory && b.advance && b.advance > 0) {
        historyList.unshift({
          date: b.date,
          amount: b.advance,
          remarks: "Advance Payment"
        })
      }
    })

    // Fallback if payment history array was not present but additional payment was made
    if (historyList.length === 0 && totalPaid > 0) {
      if (totalAdvance > 0) {
        historyList.push({ date: session.date, amount: totalAdvance, remarks: "Advance Payment" })
      }
      if (additionalPayments > 0) {
        historyList.push({ date: session.payment_date || session.date, amount: additionalPayments })
      }
    }

    // Sort ascending by date
    const sortedHistory = historyList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const documentData: PDFDocumentData = {
      title: "SALES INVOICE",
      subHeader: lang === 'te' ? "విస్సాకోడేరు బ్రిడ్జ్ దగ్గర, భీమవరం[534201]." : "NEAR VISSAKODERU BRIDGE, BHIMAVARAM[534201].",
      filename: `${session.buyer_name || 'Buyer'}_${formatFilenameDate(session.date || session.payment_date)}.pdf`,
      bills: bills.map(bill => {
        const metadataLeft = [
          `Buyer Name: ${session.buyer_name || 'Unknown'}`,
          `Remarks: ${bill.remarks || '-'}`
        ]
        
        const metadataRight = [
          `Invoice No: #${bill.invoiceNumber || ''}`,
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
        advanceAmount: totalAdvance,
        balanceAmount: balance,
        partialPaid: totalPaid,
        status: paymentStatus,
        paymentHistory: sortedHistory
      }
    }

    toast.dismiss(toastId)
    return await generateProfessionalPDF(documentData, action)
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
      `${session?.buyer_name || 'Buyer'}_${formatFilenameDate(session.date || session.payment_date)}.pdf`,
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
