import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { formatDate } from "./utils"

import { formatQuantity, generateProfessionalPDF, type PDFDocumentData } from "./pdfTemplate"
export { formatQuantity }

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
    
    const partialPayment = session.partial_payment || 0
    const balance = session.overallTotal - partialPayment

    let paymentStatus = "Pending"
    if (session.status === 'Completed' || balance === 0) {
      paymentStatus = "Completed"
    } else if (partialPayment > 0) {
      paymentStatus = "Partial Paid"
    }

    const documentData: PDFDocumentData = {
      title: "SALES INVOICE",
      subHeader: lang === 'te' ? "విస్సాకోడేరు బ్రిడ్జ్ దగ్గర, భీమవరం[534201]." : "NEAR VISSAKODERU BRIDGE, BHIMAVARAM[534201].",
      filename: `SalesCombinedBill_${(session.buyer_name || 'Buyer').replace(/\s+/g, '_')}_${session.date || 'date'}.pdf`,
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
        balanceAmount: balance,
        partialPaid: partialPayment,
        status: paymentStatus
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
