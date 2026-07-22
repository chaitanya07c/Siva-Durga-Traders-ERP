import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Printer, Download, Share2, CheckCircle2, Eye, Clock, Search } from "lucide-react"
import { toast } from "sonner"
import { fetchSalesBillBreakdowns, generateSalesCombinedPDF, shareSalesWhatsApp, formatQuantity } from "@/lib/salesPdfUtils"
import type { GroupedSaleSession, SalesBillBreakdown } from "@/lib/salesPdfUtils"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"
import { formatDate } from "@/lib/utils"

const formatInr = (value: number) => new Intl.NumberFormat('en-IN').format(value)

export function SalesPayments() {
  const { lang } = useOutletContext<{ lang: "en" | "te" }>()
  const [activeTab, setActiveTab] = useState<'Pending' | 'Completed'>('Pending')
  const [groupedSessions, setGroupedSessions] = useState<GroupedSaleSession[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [overallPending, setOverallPending] = useState(0)
  const [overallCompleted, setOverallCompleted] = useState(0)

  const [detailsModal, setDetailsModal] = useState<{ session: GroupedSaleSession, bills: SalesBillBreakdown[] } | null>(null)
  
  const [paymentModal, setPaymentModal] = useState<GroupedSaleSession | null>(null)
  const [exportPromptSession, setExportPromptSession] = useState<GroupedSaleSession | null>(null)
  const [salesGroupExportPrompt, setSalesGroupExportPrompt] = useState<{ session: GroupedSaleSession, label: string } | null>(null)

  // Edit Invoice states
  const [editingInvoice, setEditingInvoice] = useState<SalesBillBreakdown | null>(null)
  const [editInvoiceDate, setEditInvoiceDate] = useState("")
  const [editInvoiceRemarks, setEditInvoiceRemarks] = useState("")
  const [editInvoicePartialPayment, setEditInvoicePartialPayment] = useState(0)
  const [editInvoiceItems, setEditInvoiceItems] = useState<{ name: string, quantity: number, rate: number, total: number }[]>([])

  const [paymentInputAmount, setPaymentInputAmount] = useState<number>(0)

  useEffect(() => {
    loadSessions()
  }, [activeTab])

  const loadSessions = async () => {
    const { data: buyersData } = await supabase.from('buyers').select('name, name_te')
    const buyerMap = new Map<string, string>()
    if (buyersData) {
      buyersData.forEach(b => {
        if (b.name_te) buyerMap.set(b.name, b.name_te)
      })
    }

    const { data } = await supabase
      .from('sales')
      .select('id, date, total_amount, advance, payment_status, buyer_name, partial_payment, payment_date, payment_history')
      .order('date', { ascending: false })

    if (data) {
      // Calculate overall pending and completed amounts
      let pendingSum = 0
      let completedSum = 0
      data.forEach(d => {
        const adv = Number(d.advance || 0)
        const additionalPaid = Number(d.partial_payment || 0)
        const totalPaid = adv + additionalPaid
        const grandTotal = Number(d.total_amount || 0)
        const rem = Math.max(0, grandTotal - totalPaid)

        if (d.payment_status === 'Completed' || rem === 0) {
          completedSum += grandTotal
        } else {
          pendingSum += rem
        }
      })
      setOverallPending(pendingSum)
      setOverallCompleted(completedSum)

      // Filter for active tab display
      const activeData = data.filter(d => {
        const adv = Number(d.advance || 0)
        const additionalPaid = Number(d.partial_payment || 0)
        const totalPaid = adv + additionalPaid
        const grandTotal = Number(d.total_amount || 0)
        const rem = Math.max(0, grandTotal - totalPaid)
        const isComp = d.payment_status === 'Completed' || rem === 0

        return activeTab === 'Pending' ? !isComp : isComp
      })

      // Group by buyer_name
      const groups = new Map<string, GroupedSaleSession>()
      
      activeData.forEach(d => {
        const rawName = d.buyer_name || 'Unknown Buyer'
        const key = lang === 'te' && buyerMap.has(rawName) ? buyerMap.get(rawName)! : rawName
        const adv = Number(d.advance || 0)
        const additionalPaid = Number(d.partial_payment || 0)

        if (!groups.has(key)) {
          const initialStatus: 'Pending' | 'Partial Payment' | 'Completed' = (d.payment_status as any) || activeTab
          groups.set(key, {
            id: key,
            buyer_name: key,
            date: d.date,
            billsCount: 0,
            overallTotal: 0,
            advance: 0,
            status: initialStatus,
            bill_ids: [],
            partial_payment: 0,
            payment_date: d.payment_date,
            payment_history: []
          })
        }
        
        const group = groups.get(key)!
        group.billsCount += 1
        group.overallTotal += Number(d.total_amount || 0)
        group.advance = (group.advance || 0) + adv
        group.bill_ids.push(d.id)
        group.partial_payment += additionalPaid

        // Consolidate payment history entries
        const existingHistory = Array.isArray(d.payment_history) ? [...d.payment_history] : []
        let hasAdvInHist = false
        existingHistory.forEach(h => {
          if (h.remarks === "Advance Payment" || (adv > 0 && h.amount === adv)) {
            hasAdvInHist = true
          }
        })

        if (!hasAdvInHist && adv > 0) {
          existingHistory.unshift({
            id: d.id + '_adv',
            date: d.date,
            amount: adv,
            remainingBalance: Math.max(0, Number(d.total_amount || 0) - adv),
            remarks: "Advance Payment"
          })
        }

        group.payment_history = [...(group.payment_history || []), ...existingHistory]
        
        if (new Date(d.date) > new Date(group.date)) {
          group.date = d.date
        }
        if (d.payment_date && (!group.payment_date || new Date(d.payment_date) > new Date(group.payment_date))) {
          group.payment_date = d.payment_date
        }
      })

      // Recalculate status for each group
      groups.forEach(g => {
        const totalPaid = (g.advance || 0) + g.partial_payment
        const rem = Math.max(0, g.overallTotal - totalPaid)
        if (rem === 0 || g.status === 'Completed') {
          g.status = 'Completed'
        } else if (totalPaid > 0) {
          g.status = 'Partial Payment'
        } else {
          g.status = 'Pending'
        }
      })

      setGroupedSessions(Array.from(groups.values()))
    }
  }

  const handleCompletePaymentInitiate = (session: GroupedSaleSession) => {
    setPaymentModal(session)
    setPaymentInputAmount(0)
  }

  const handleSavePaymentWithHistory = async (isFinalComplete: boolean = false) => {
    if (!paymentModal) return
    try {
      const today = new Date().toISOString().split('T')[0]
      const groupAdv = Number(paymentModal.advance || 0)
      const groupAddPaid = Number(paymentModal.partial_payment || 0)
      const currentTotalPaid = groupAdv + groupAddPaid
      const overallTotal = Number(paymentModal.overallTotal || 0)
      const remainingBefore = Math.max(0, overallTotal - currentTotalPaid)

      let newAmountToPay = isFinalComplete ? remainingBefore : Number(paymentInputAmount || 0)
      if (newAmountToPay <= 0 && !isFinalComplete) {
        toast.error("Please enter a valid payment amount")
        return
      }
      if (newAmountToPay > remainingBefore) {
        newAmountToPay = remainingBefore
      }

      const newTotalAdditional = groupAddPaid + newAmountToPay
      const newTotalPaid = Math.min(overallTotal, groupAdv + newTotalAdditional)
      const newRemainingBalance = Math.max(0, overallTotal - newTotalPaid)

      let newStatus: 'Pending' | 'Partial Payment' | 'Completed' = 'Pending'
      if (newRemainingBalance === 0 || isFinalComplete) {
        newStatus = 'Completed'
      } else if (newTotalPaid > 0) {
        newStatus = 'Partial Payment'
      }

      // Fetch current bills to update individual partial_payment and payment_history
      const { data: currentBills } = await supabase
        .from('sales')
        .select('id, total_amount, advance, partial_payment, payment_history')
        .in('id', paymentModal.bill_ids)

      if (currentBills && currentBills.length > 0) {
        const perBillPaymentShare = newAmountToPay / currentBills.length

        for (const bill of currentBills) {
          const billTotal = Number(bill.total_amount || 0)
          const billAdv = Number(bill.advance || 0)
          const billOldAdditional = Number(bill.partial_payment || 0)
          const billNewAdditional = billOldAdditional + perBillPaymentShare
          const billTotalPaid = Math.min(billTotal, billAdv + billNewAdditional)
          const billRem = Math.max(0, billTotal - billTotalPaid)

          const existingHistory = Array.isArray(bill.payment_history) ? [...bill.payment_history] : []
          if (billAdv > 0) {
            let hasAdv = existingHistory.some(h => h.remarks === "Advance Payment" || h.amount === billAdv)
            if (!hasAdv) {
              existingHistory.unshift({
                id: bill.id + '_adv',
                date: today,
                amount: billAdv,
                remainingBalance: Math.max(0, billTotal - billAdv),
                remarks: "Advance Payment"
              })
            }
          }

          const newEntry = {
            id: crypto.randomUUID(),
            date: today,
            amount: perBillPaymentShare,
            remainingBalance: billRem
          }

          const updatedHistory = [...existingHistory, newEntry]

          await supabase.from('sales').update({
            partial_payment: billNewAdditional,
            payment_status: newStatus,
            payment_date: today,
            payment_history: updatedHistory
          }).eq('id', bill.id)
        }
      }

      toast.success(newStatus === 'Completed' ? "Payment marked as Completed!" : "Partial payment saved successfully!")
      
      const sessionToExport: GroupedSaleSession = { 
        ...paymentModal, 
        partial_payment: newTotalAdditional, 
        payment_date: today, 
        status: newStatus 
      }

      setPaymentModal(null)
      setPaymentInputAmount(0)

      if (newStatus === 'Completed') {
        setExportPromptSession(sessionToExport)
      }

      loadSessions()
    } catch (err: any) {
      toast.error(err.message || "Failed to save payment")
    }
  }

  const handleViewDetails = async (session: GroupedSaleSession) => {
    try {
      const bills = await fetchSalesBillBreakdowns(session, lang)
      setDetailsModal({ session, bills })
    } catch (err: any) {
      toast.error("Failed to load details")
    }
  }

  const handleEditInvoiceInitiate = (bill: SalesBillBreakdown) => {
    setEditingInvoice(bill)
    setEditInvoiceDate(bill.date)
    setEditInvoiceRemarks(bill.remarks || "")
    setEditInvoicePartialPayment(bill.partial_payment || 0)
    setEditInvoiceItems(bill.items.map(item => ({ ...item })))
  }

  const handleEditInvoiceItemChange = (index: number, field: 'quantity' | 'rate', value: number) => {
    setEditInvoiceItems(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      copy[index].total = Number((copy[index].quantity * copy[index].rate).toFixed(2))
      return copy
    })
  }

  const handleSaveEditedInvoice = async () => {
    if (!editingInvoice) return
    try {
      const totalAmount = editInvoiceItems.reduce((sum, item) => sum + item.total, 0)
      const itemsJson = editInvoiceItems.reduce((acc, curr) => ({
        ...acc,
        [curr.name]: curr
      }), {})

      const newStatus = (editInvoicePartialPayment >= totalAmount) 
        ? 'Completed' 
        : (editInvoicePartialPayment > 0 ? 'Partial Payment' : 'Pending')

      const { error } = await supabase
        .from('sales')
        .update({
          date: editInvoiceDate,
          total_amount: totalAmount,
          remarks: editInvoiceRemarks,
          partial_payment: editInvoicePartialPayment,
          payment_status: newStatus,
          items: itemsJson
        })
        .eq('id', editingInvoice.id)

      if (error) throw error

      toast.success("Sales Invoice updated successfully!")
      setEditingInvoice(null)

      await loadSessions()

      if (detailsModal) {
        const { data: updatedSales } = await supabase
          .from('sales')
          .select('total_amount')
          .in('id', detailsModal.session.bill_ids)

        const newOverallTotal = updatedSales?.reduce((sum, s) => sum + s.total_amount, 0) || 0

        const updatedSession = {
          ...detailsModal.session,
          overallTotal: newOverallTotal
        }

        const bills = await fetchSalesBillBreakdowns(updatedSession, lang)
        setDetailsModal({ session: updatedSession, bills })
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update invoice")
    }
  }

  const filteredSessions = groupedSessions.filter(s => 
    s.buyer_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t("salesPayments", lang)}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>

      <div className="flex justify-between items-center border-b pb-4">
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
            placeholder={t("searchBuyer", lang)} 
            className="pl-9 pr-4 py-2 border rounded-lg text-sm w-64"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card border rounded-xl shadow-sm overflow-hidden min-h-[500px]">
        <div className="overflow-x-auto p-4">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 font-semibold w-16">S.No.</th>
                <th className="px-4 py-3 font-semibold">{t("addBuyer", lang).replace("New ", "")}</th>
                <th className="px-4 py-3 font-semibold text-center">{t("invoiceCount", lang)}</th>
                <th className="px-4 py-3 font-semibold">{t("latestDate", lang)}</th>
                <th className="px-4 py-3 font-semibold text-right">{t("overallAmount", lang)}</th>
                <th className="px-4 py-3 font-semibold text-center">{t("status", lang)}</th>
                <th className="px-4 py-3 font-semibold text-right">{t("actions", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No {activeTab.toLowerCase()} payments found.</td></tr>
              ) : (
                filteredSessions.map((session, index) => (
                  <tr key={session.id} className="border-b hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-4 text-muted-foreground">{index + 1}</td>
                    <td className="px-4 py-4 font-semibold text-primary">{session.buyer_name}</td>
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
                        {session.status !== 'Completed' && session.billsCount >= 2 && (
                          <button 
                            onClick={() => {
                              setSalesGroupExportPrompt({
                                session,
                                label: lang === 'te' ? "కంబైన్డ్ ఇన్వాయిస్" : "Combined Invoice"
                              })
                            }}
                            className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded flex items-center text-xs font-semibold shadow-sm transition-colors"
                          >
                            {lang === 'te' ? "కంబైన్డ్ బిల్లు" : "Combined Bill"}
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
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {t("receivePayment", lang)}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {detailsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl flex flex-col">
            <div className="p-5 border-b flex justify-between items-center sticky top-0 bg-background z-10">
              <div>
                <h2 className="text-xl font-bold">Session Details</h2>
                <p className="text-sm text-muted-foreground">{detailsModal.session.buyer_name} • {formatDate(detailsModal.session.date)}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Overall Amount</div>
                <div className="text-2xl font-bold text-primary">₹{formatInr(detailsModal.session.overallTotal)}</div>
              </div>
            </div>
            
            <div className="p-6 space-y-6 bg-slate-50 flex-1">
              <div className="space-y-4">
                {detailsModal.bills.map((bill, index) => (
                  <div key={index} className="bg-card border rounded-lg overflow-hidden shadow-sm">
                    <div className="bg-slate-100 px-4 py-2 border-b flex justify-between items-center font-semibold">
                      <div className="flex items-center gap-2">
                        <span>Invoice {index + 1} {bill.invoiceNumber ? `(#${bill.invoiceNumber})` : ''}</span>
                        {detailsModal.session.status !== 'Completed' && (
                          <button
                            onClick={() => handleEditInvoiceInitiate(bill)}
                            className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors font-bold"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      <span>₹{formatInr(bill.grandTotal)}</span>
                    </div>
                    <div className="p-4">
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
                                <td className="py-2 text-center">{formatQuantity(item.name, item.quantity)}</td>
                                <td className="py-2 text-right">₹{item.rate}</td>
                                <td className="py-2 text-right font-medium">₹{formatInr(item.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Payment History Table for this Invoice */}
                    {Array.isArray(bill.payment_history) && bill.payment_history.length > 0 && (
                      <div className="p-4 border-t bg-slate-50/50 space-y-2">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{t("paymentHistorySection", lang)}</h4>
                        <div className="border rounded-lg overflow-hidden text-xs bg-background">
                          <table className="w-full text-left">
                            <thead className="bg-slate-100 font-semibold text-slate-600">
                              <tr>
                                <th className="p-2">#</th>
                                <th className="p-2">Date</th>
                                <th className="p-2 text-right">Amount Paid</th>
                                <th className="p-2 text-right">Running Balance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bill.payment_history.map((h, hIdx) => (
                                <tr key={hIdx} className="border-t">
                                  <td className="p-2 text-muted-foreground">{hIdx + 1}</td>
                                  <td className="p-2">{formatDate(h.date)}</td>
                                  <td className="p-2 text-right font-bold text-green-600">₹{formatInr(h.amount)}</td>
                                  <td className="p-2 text-right font-medium text-slate-700">₹{formatInr(h.remainingBalance || 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t bg-background flex items-center justify-end gap-3 sticky bottom-0 z-10">
              <button
                onClick={() => generateSalesCombinedPDF(detailsModal.session, 'download', lang, detailsModal.bills)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium text-sm flex items-center transition-colors border"
              >
                <Download className="w-4 h-4 mr-1.5" /> Download PDF
              </button>

              <button
                onClick={() => generateSalesCombinedPDF(detailsModal.session, 'print', lang, detailsModal.bills)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium text-sm flex items-center transition-colors border"
              >
                <Printer className="w-4 h-4 mr-1.5" /> Print Bill
              </button>

              <button
                onClick={() => shareSalesWhatsApp(detailsModal.session, lang, detailsModal.bills)}
                className="px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg font-medium text-sm flex items-center transition-colors border border-green-200"
              >
                <Share2 className="w-4 h-4 mr-1.5" /> Share via WhatsApp
              </button>

              <button 
                onClick={() => setDetailsModal(null)} 
                className="px-6 py-2 border rounded-lg font-medium hover:bg-muted ml-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Completion / Record Partial Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-lg rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b bg-slate-50 flex justify-between items-center sticky top-0 bg-background z-10">
              <div>
                <h2 className="text-xl font-bold">{t("paymentSummary", lang)}</h2>
                <p className="text-xs text-muted-foreground">{paymentModal.buyer_name} • {paymentModal.date}</p>
              </div>
              <button onClick={() => setPaymentModal(null)} className="text-slate-400 hover:text-slate-600 text-lg font-medium">✕</button>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border text-center">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{t("overallTotal", lang)}</p>
                  <p className="text-base font-bold text-slate-800">₹{formatInr(paymentModal.overallTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{t("advance", lang)}</p>
                  <p className="text-base font-bold text-purple-600">₹{formatInr(paymentModal.advance || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{t("amountPaid", lang)}</p>
                  <p className="text-base font-bold text-green-600">₹{formatInr((paymentModal.advance || 0) + paymentModal.partial_payment)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{t("balanceAmount", lang)}</p>
                  <p className="text-base font-bold text-red-600">₹{formatInr(Math.max(0, paymentModal.overallTotal - ((paymentModal.advance || 0) + paymentModal.partial_payment)))}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block font-medium text-sm text-slate-700">Enter Payment Amount Received Today (₹)</label>
                <input 
                  type="number" 
                  className="w-full border p-3 rounded-lg text-lg font-semibold bg-background"
                  value={paymentInputAmount || ''}
                  onChange={e => setPaymentInputAmount(Number(e.target.value))}
                  placeholder={`Max ₹${formatInr(Math.max(0, paymentModal.overallTotal - ((paymentModal.advance || 0) + paymentModal.partial_payment)))}`}
                />
              </div>

              {/* Payment History Preview */}
              {Array.isArray(paymentModal.payment_history) && paymentModal.payment_history.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <h3 className="text-sm font-bold text-slate-800">{t("paymentHistorySection", lang)}</h3>
                  <div className="border rounded-lg overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 font-semibold text-slate-600">
                        <tr>
                          <th className="p-2">#</th>
                          <th className="p-2">Date</th>
                          <th className="p-2 text-right font-semibold">Amount Paid</th>
                          <th className="p-2 text-right font-semibold">Running Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentModal.payment_history.map((h, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2 text-muted-foreground">{i + 1}</td>
                            <td className="p-2">
                              {formatDate(h.date)}
                              {h.remarks === "Advance Payment" && (
                                <span className="ml-1.5 bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded">Advance</span>
                              )}
                            </td>
                            <td className="p-2 text-right font-bold text-green-600">₹{formatInr(h.amount)}</td>
                            <td className="p-2 text-right font-medium text-slate-700">₹{formatInr(h.remainingBalance || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t flex flex-col gap-2 bg-slate-50">
              <button 
                onClick={() => handleSavePaymentWithHistory(false)} 
                className="w-full bg-orange-100 text-orange-700 py-3 rounded-xl font-semibold hover:bg-orange-200 transition-colors"
              >
                {t("savePartial", lang)}
              </button>
              <button 
                onClick={() => handleSavePaymentWithHistory(true)} 
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors shadow-sm flex justify-center items-center"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" /> {t("completePayment", lang)}
              </button>
              <button 
                onClick={() => setPaymentModal(null)} 
                className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium mt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
              <button onClick={() => generateSalesCombinedPDF(exportPromptSession, 'download', lang)} className="w-full flex items-center justify-center py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors">
                <Download className="w-5 h-5 mr-2" /> {t("downloadPdf", lang)}
              </button>
              <button onClick={() => generateSalesCombinedPDF(exportPromptSession, 'print', lang)} className="w-full flex items-center justify-center py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors">
                <Printer className="w-5 h-5 mr-2" /> {t("print", lang)}
              </button>
              <button onClick={() => shareSalesWhatsApp(exportPromptSession, lang)} className="w-full flex items-center justify-center py-3 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl font-medium transition-colors">
                <Share2 className="w-5 h-5 mr-2" /> {t("whatsAppShare", lang)}
              </button>
              <button onClick={() => setExportPromptSession(null)} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium mt-2">
                {t("close", lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b bg-slate-50 flex justify-between items-center sticky top-0 bg-background z-10">
              <div>
                <h2 className="text-xl font-bold">Edit Invoice</h2>
                <p className="text-xs text-muted-foreground">{editingInvoice.invoiceNumber ? `Invoice #${editingInvoice.invoiceNumber}` : 'Edit Invoice'}</p>
              </div>
              <button onClick={() => setEditingInvoice(null)} className="text-slate-400 hover:text-slate-600 text-lg font-medium">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Date</label>
                <input 
                  type="date"
                  className="w-full border p-2 rounded text-sm"
                  value={editInvoiceDate}
                  onChange={e => setEditInvoiceDate(e.target.value)}
                />
              </div>

              {/* Items Section */}
              <div className="space-y-2 border-t pt-3">
                <h3 className="text-sm font-bold text-slate-800 mb-1">Items Breakdown</h3>
                <div className="bg-slate-50 p-3 rounded-lg border space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-xs font-bold text-slate-500 border-b pb-1">
                    <div>Item</div>
                    <div className="text-center">Qty</div>
                    <div className="text-center">Rate (₹)</div>
                  </div>
                  {editInvoiceItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                      <div className="text-xs font-medium text-slate-800 truncate">{item.name}</div>
                      <input 
                        type="number"
                        className="border p-1 rounded text-xs text-center font-medium bg-background"
                        value={item.quantity || ''}
                        onChange={e => handleEditInvoiceItemChange(idx, 'quantity', Number(e.target.value))}
                        placeholder="0"
                      />
                      <input 
                        type="number"
                        step="0.01"
                        className="border p-1 rounded text-xs text-center font-medium bg-background"
                        value={item.rate || ''}
                        onChange={e => handleEditInvoiceItemChange(idx, 'rate', Number(e.target.value))}
                        placeholder="0.00"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-3">
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Partial Payment / Received (₹)</label>
                <input 
                  type="number"
                  className="w-full border p-2 rounded text-sm font-semibold"
                  value={editInvoicePartialPayment || ''}
                  onChange={e => setEditInvoicePartialPayment(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Remarks</label>
                <textarea 
                  className="w-full border p-2 rounded text-xs"
                  rows={2}
                  value={editInvoiceRemarks}
                  onChange={e => setEditInvoiceRemarks(e.target.value)}
                  placeholder="Enter remarks..."
                />
              </div>

              <div className="bg-slate-100 p-3 rounded-lg border space-y-1.5 text-sm font-semibold">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal Amount:</span>
                  <span>₹{formatInr(editInvoiceItems.reduce((sum, item) => sum + item.total, 0))}</span>
                </div>
                <div className="flex justify-between text-primary text-base font-bold">
                  <span>Grand Total:</span>
                  <span>₹{formatInr(editInvoiceItems.reduce((sum, item) => sum + item.total, 0))}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex gap-3">
              <button 
                onClick={() => setEditingInvoice(null)} 
                className="flex-1 py-2.5 border rounded-xl font-semibold hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEditedInvoice} 
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors shadow-sm"
              >
                Save Updates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sales Combined Export Prompt Modal */}
      {salesGroupExportPrompt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-sm rounded-2xl shadow-xl overflow-hidden flex flex-col items-center p-8 text-center">
            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mb-4">
              <Printer className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{salesGroupExportPrompt.label}</h2>
            <p className="text-muted-foreground text-sm mb-8">
              {lang === 'te' 
                ? "కంబైన్డ్ పిడిఎఫ్ ని డౌన్‌లోడ్ చేయండి, ప్రింట్ చేయండి లేదా షేర్ చేయండి." 
                : "Download, print, or share the combined PDF for this customer."}
            </p>
            
            <div className="w-full flex flex-col gap-3">
              <button 
                onClick={() => generateSalesCombinedPDF(salesGroupExportPrompt.session, 'download', lang)} 
                className="w-full flex items-center justify-center py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors"
              >
                <Download className="w-5 h-5 mr-2" /> {lang === 'te' ? "డౌన్‌లోడ్ PDF" : "Download PDF"}
              </button>
              <button 
                onClick={() => generateSalesCombinedPDF(salesGroupExportPrompt.session, 'print', lang)} 
                className="w-full flex items-center justify-center py-3 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors"
              >
                <Printer className="w-5 h-5 mr-2" /> {lang === 'te' ? "ప్రింట్ బిల్" : "Print Bill"}
              </button>
              <button 
                onClick={() => shareSalesWhatsApp(salesGroupExportPrompt.session, lang)} 
                className="w-full flex items-center justify-center py-3 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl font-medium transition-colors"
              >
                <Share2 className="w-5 h-5 mr-2" /> {lang === 'te' ? "వాట్సాప్ ద్వారా షేర్ చేయండి" : "Share via WhatsApp"}
              </button>
              <button 
                onClick={() => setSalesGroupExportPrompt(null)} 
                className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium mt-2"
              >
                {lang === 'te' ? "మూసివేయండి" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
