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
  vehicleNumber?: string | null
  driverName?: string | null
  driverPhone?: string | null
  date: string
  items: { name: string, quantity: number, rate: number, total: number, unit?: string }[]
  itemsTotal?: number
  additionalExpenses?: { name: string, amount: number }[]
  additionalExpensesTotal?: number
  grandTotal: number
  advance?: number
  remarks?: string | null
  partial_payment?: number
  payment_date?: string | null
  payment_status?: 'Pending' | 'Partial Payment' | 'Completed'
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
    const formattedItems = Object.entries(itemsJson)
      .filter(([k]) => k !== '_additional_expenses')
      .map(([_, i]: [string, any]) => ({
        name: lang === 'te' && i.name_te ? i.name_te : i.name,
        quantity: i.quantity,
        unit: i.unit,
        rate: i.rate,
        total: i.total
      }))

    const itemsTotal = formattedItems.reduce((sum: number, item: any) => sum + (Number(item.total) || 0), 0)
    const rawExpenses = Array.isArray(fb.additional_expenses) && fb.additional_expenses.length > 0
      ? fb.additional_expenses
      : (Array.isArray(fb.items?._additional_expenses) ? fb.items._additional_expenses : [])

    const expensesArray: { name: string, amount: number }[] = rawExpenses.map((e: any) => ({
      name: String(e.name || ''),
      amount: Number(e.amount || 0)
    }))
    const expensesTotal = expensesArray.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0)
    const grandTotal = Number(fb.total_amount ?? (itemsTotal + expensesTotal))
    
    return {
      id: fb.id,
      invoiceNumber: fb.invoice_number,
      vehicleNumber: fb.vehicle_number,
      driverName: fb.driver_name,
      driverPhone: fb.driver_phone,
      date: fb.date,
      items: formattedItems,
      itemsTotal,
      additionalExpenses: expensesArray,
      additionalExpensesTotal: expensesTotal,
      grandTotal,
      advance: fb.advance || 0,
      remarks: fb.remarks,
      partial_payment: fb.partial_payment,
      payment_date: fb.payment_date,
      payment_status: fb.payment_status,
      payment_history: fb.payment_history || []
    }
  }) || []

  return reconstructedBills
}

const isValidFieldValue = (val: unknown): val is string => {
  if (val === null || val === undefined) return false
  const str = String(val).trim()
  if (!str) return false
  if (str === '-' || str === '--' || str === '---' || str === 'N/A' || str === 'n/a') return false
  if (str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'unknown') return false
  return true
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
    
    // Consolidate payment history from bills and session
    const historyMap = new Map<string, { date: string, amount: number, remarks?: string }>()
    
    // Check session.payment_history first
    if (Array.isArray(session.payment_history) && session.payment_history.length > 0) {
      session.payment_history.forEach(h => {
        if (h && Number(h.amount) > 0 && h.date) {
          if (h.remarks === "Advance Payment") return
          const key = (h as any).id || `${h.date}_${h.amount}`
          if (!historyMap.has(key)) {
            historyMap.set(key, { date: h.date, amount: Number(h.amount), remarks: h.remarks })
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
              historyMap.set(key, { date: h.date, amount: Number(h.amount), remarks: h.remarks })
            }
          }
        })
      }
    })

    const historyList = Array.from(historyMap.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const totalActualPayments = historyList.reduce((sum, h) => sum + Number(h.amount || 0), 0)
    const additionalPayments = totalActualPayments > 0 ? totalActualPayments : (session.partial_payment || 0)
    const sessionAdvance = Number(session.advance || 0)
    const billAdvance = bills.reduce((sum, b) => sum + Number(b.advance || 0), 0)
    const totalPaid = Math.max(sessionAdvance, totalActualPayments > 0 ? (sessionAdvance > totalActualPayments ? sessionAdvance : totalActualPayments) : (billAdvance + additionalPayments))
    const balance = Math.max(0, Number((session.overallTotal - totalPaid).toFixed(2)))

    let paymentStatus = "Pending"
    if (balance === 0) {
      paymentStatus = "Completed"
    } else if (totalPaid > 0) {
      paymentStatus = "Partial Paid"
    } else {
      paymentStatus = "Pending"
    }

    const sortedHistory = historyList

    const latestDateFromBills = bills.map(b => b.payment_date).filter(Boolean).sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0]
    const latestDateFromHistory = sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1].date : null
    const effectivePaymentDate = session.payment_date || latestDateFromHistory || latestDateFromBills || session.date

    // Fetch buyer phone number if available
    let buyerMobile: string | null = null
    if (isValidFieldValue(session.buyer_name)) {
      const { data: bData } = await supabase.from('buyers').select('mobile').eq('name', session.buyer_name.trim()).maybeSingle()
      if (bData && isValidFieldValue(bData.mobile)) {
        buyerMobile = bData.mobile.trim()
      }
    }

    const safeBuyerName = isValidFieldValue(session.buyer_name) ? session.buyer_name.trim() : 'Buyer'

    const documentData: PDFDocumentData = {
      title: "SALES INVOICE",
      subHeader: lang === 'te' ? "విస్సాకోడేరు బ్రిడ్జ్ దగ్గర, భీమవరం[534201]." : "NEAR VISSAKODERU BRIDGE, BHIMAVARAM[534201].",
      filename: `${safeBuyerName}_${formatFilenameDate(session.date || session.payment_date)}.pdf`,
      bills: bills.map(bill => {
        const metadataLeft: string[] = []

        if (isValidFieldValue(session.buyer_name)) {
          metadataLeft.push(`Buyer Name: ${session.buyer_name.trim()}`)
        }
        if (isValidFieldValue(buyerMobile)) {
          metadataLeft.push(`Phone No: ${buyerMobile.trim()}`)
        }
        if (isValidFieldValue(bill.vehicleNumber)) {
          metadataLeft.push(`Vehicle No: ${bill.vehicleNumber!.trim()}`)
        }
        if (isValidFieldValue(bill.driverName)) {
          metadataLeft.push(`Driver Name: ${bill.driverName!.trim()}`)
        }
        if (isValidFieldValue(bill.driverPhone)) {
          metadataLeft.push(`Driver Phone: ${bill.driverPhone!.trim()}`)
        }
        if (isValidFieldValue(bill.remarks)) {
          metadataLeft.push(`Remarks: ${bill.remarks!.trim()}`)
        }

        const metadataRight: string[] = []
        if (isValidFieldValue(bill.invoiceNumber)) {
          metadataRight.push(`Invoice No: #${bill.invoiceNumber!.trim()}`)
        }
        if (isValidFieldValue(bill.date)) {
          metadataRight.push(`Date: ${formatDate(bill.date)}`)
        }

        const displayItems = (bill.items || []).filter((item: any) => item && item.quantity > 0 && item.total > 0).map((i: any) => ({
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          rate: i.rate,
          total: i.total
        }))

        return {
          metadataLeft,
          metadataRight,
          items: displayItems,
          itemsTotal: bill.itemsTotal,
          additionalExpenses: bill.additionalExpenses,
          additionalExpensesTotal: bill.additionalExpensesTotal,
          grandTotal: bill.grandTotal || 0
        }
      }),
      paymentSummary: {
        overallAmount: session.overallTotal || 0,
        advanceAmount: totalPaid,
        balanceAmount: balance,
        partialPaid: totalPaid,
        status: paymentStatus,
        paymentDate: effectivePaymentDate,
        completedDate: effectivePaymentDate,
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

    const safeBuyerName = isValidFieldValue(session?.buyer_name) ? session.buyer_name.trim() : 'Buyer'
    const file = new File(
      [pdfBlob],
      `${safeBuyerName}_${formatFilenameDate(session.date || session.payment_date)}.pdf`,
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
