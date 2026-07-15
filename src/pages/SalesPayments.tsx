import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Printer, Download, Share2, CheckCircle2, Eye, Clock, Search } from "lucide-react"
import { toast } from "sonner"
import { fetchSalesBillBreakdowns, generateSalesCombinedPDF, shareSalesWhatsApp, formatQuantity } from "@/lib/salesPdfUtils"
import type { GroupedSaleSession, SalesBillBreakdown } from "@/lib/salesPdfUtils"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"

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
  const [partialPayment, setPartialPayment] = useState<number>(0)
  const [exportPromptSession, setExportPromptSession] = useState<GroupedSaleSession | null>(null)

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
      .select('id, date, total_amount, payment_status, buyer_name, partial_payment, payment_date')
      .order('date', { ascending: false })

    if (data) {
      // Calculate overall pending and completed amounts
      let pendingSum = 0
      let completedSum = 0
      data.forEach(d => {
        if (d.payment_status === 'Pending') {
          pendingSum += (d.total_amount - (d.partial_payment || 0))
        } else if (d.payment_status === 'Completed') {
          completedSum += d.total_amount
        }
      })
      setOverallPending(pendingSum)
      setOverallCompleted(completedSum)

      // Filter for active tab display
      const activeData = data.filter(d => d.payment_status === activeTab)

      // Group by buyer_name
      const groups = new Map<string, GroupedSaleSession>()
      
      activeData.forEach(d => {
        const rawName = d.buyer_name || 'Unknown Buyer'
        const key = lang === 'te' && buyerMap.has(rawName) ? buyerMap.get(rawName)! : rawName
        if (!groups.has(key)) {
          groups.set(key, {
            id: key,
            buyer_name: key,
            date: d.date, // Will keep the latest date
            billsCount: 0,
            overallTotal: 0,
            status: activeTab,
            bill_ids: [],
            partial_payment: 0,
            payment_date: d.payment_date
          })
        }
        
        const group = groups.get(key)!
        group.billsCount += 1
        group.overallTotal += d.total_amount
        group.bill_ids.push(d.id)
        // For partial payments on pending, we aggregate them or just take the max/sum. Since this is grouped by buyer, we sum partial payments across invoices.
        group.partial_payment += (d.partial_payment || 0)
        
        // Keep latest date
        if (new Date(d.date) > new Date(group.date)) {
          group.date = d.date
        }
        if (d.payment_date && (!group.payment_date || new Date(d.payment_date) > new Date(group.payment_date))) {
          group.payment_date = d.payment_date
        }
      })

      setGroupedSessions(Array.from(groups.values()))
    }
  }

  const handleCompletePaymentInitiate = (session: GroupedSaleSession) => {
    setPaymentModal(session)
    setPartialPayment(session.partial_payment || 0)
  }

  const handleSavePartialPayment = async () => {
    if (!paymentModal) return
    try {
      const today = new Date().toISOString().split('T')[0]
      // To keep it simple, we apply the total partial payment to the most recent bill or distribute it.
      // But since we group by buyer, if they pay partially, we should distribute it. 
      // A simpler approach for this app is to just update all bills for this buyer with partial_payment = partialPayment / bill_ids.length
      // Actually, since all bills for a buyer are grouped into one payment session:
      const perBillPartial = partialPayment / paymentModal.bill_ids.length
      await supabase.from('sales').update({ partial_payment: perBillPartial, payment_date: today }).in('id', paymentModal.bill_ids)
      
      toast.success("Partial payment saved successfully!")
      setPaymentModal(null)
      loadSessions()
    } catch (err: any) {
      toast.error(err.message || "Failed to save partial payment")
    }
  }

  const handleCompletePaymentFinal = async () => {
    if (!paymentModal) return
    try {
      const today = new Date().toISOString().split('T')[0]
      const perBillPartial = partialPayment / paymentModal.bill_ids.length
      await supabase.from('sales').update({ 
        payment_status: 'Completed', 
        partial_payment: perBillPartial,
        payment_date: today
      }).in('id', paymentModal.bill_ids)
      
      toast.success("Payment marked as Completed!")
      const sessionToExport = { ...paymentModal, partial_payment: partialPayment, payment_date: today, status: 'Completed' as const }
      setPaymentModal(null)
      setExportPromptSession(sessionToExport)
      loadSessions()
    } catch (err: any) {
      toast.error(err.message || "Failed to complete payment")
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

  const filteredSessions = groupedSessions.filter(s => 
    s.buyer_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t("salesPayments", lang)}</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pending Card */}
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

        {/* Completed Card */}
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
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No {activeTab.toLowerCase()} payments found.</td></tr>
              ) : (
                filteredSessions.map(session => (
                  <tr key={session.id} className="border-b hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-4 font-semibold text-primary">{session.buyer_name}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">{session.billsCount}</span>
                    </td>
                    <td className="px-4 py-4">{session.date}</td>
                    <td className="px-4 py-4 text-right font-bold text-[15px]">₹{formatInr(session.overallTotal)}</td>
                    <td className="px-4 py-4 text-center">
                      {session.status === 'Pending' ? (
                        <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold">Pending</span>
                      ) : (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">Completed</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleViewDetails(session)} 
                          className="text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded flex items-center text-xs font-medium"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> {t("viewDetails", lang)}
                        </button>

                        {session.status === 'Pending' && (
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
                <p className="text-sm text-muted-foreground">{detailsModal.session.buyer_name} • {detailsModal.session.date}</p>
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
                    <div className="bg-slate-100 px-4 py-2 border-b flex justify-between font-semibold">
                      <span>Invoice {index + 1} {bill.invoiceNumber ? `(#${bill.invoiceNumber})` : ''}</span>
                      <span>₹{formatInr(bill.grandTotal)}</span>
                    </div>
                    <div className="p-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-muted-foreground border-b text-left">
                            <tr>
                              <th className="pb-2">Item</th>
                              <th className="pb-2 text-center">Qty</th>
                              <th className="pb-2 text-right">Rate</th>
                              <th className="pb-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {bill.items.filter(i => i.quantity > 0).map((item, i) => (
                              <tr key={i}>
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
                  </div>
                ))}
              </div>
              
              {/* Payment Summary */}
              {((detailsModal.session.partial_payment || 0) > 0 || detailsModal.session.status === 'Completed') && (
                <div className="bg-card border rounded-lg overflow-hidden shadow-sm mt-6">
                  <div className="bg-slate-100 px-4 py-2 border-b font-semibold text-center tracking-wide text-sm">
                    PAYMENT SUMMARY
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium">Status</span>
                      <span className="font-semibold text-slate-900">{detailsModal.session.status === 'Completed' ? 'Completed' : 'Partial Payment'}</span>
                    </div>
                    {detailsModal.session.payment_date && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium">Payment Date</span>
                        <span className="font-semibold text-slate-900">{detailsModal.session.payment_date.split('-').reverse().join('-')}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground font-medium">Overall Bill Amount</span>
                      <span className="font-semibold text-slate-900">₹{formatInr(detailsModal.session.overallTotal)}</span>
                    </div>
                    {detailsModal.session.overallTotal - (detailsModal.session.partial_payment || 0) > 0 ? (
                      <>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground font-medium">Partial Amount Paid</span>
                          <span className="font-semibold text-green-600">₹{formatInr(detailsModal.session.partial_payment || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t">
                          <span className="font-bold text-slate-900">Balance Amount</span>
                          <span className="font-bold text-red-600 text-lg">₹{formatInr(detailsModal.session.overallTotal - (detailsModal.session.partial_payment || 0))}</span>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t sticky bottom-0 bg-background flex justify-end">
              <button 
                onClick={() => setDetailsModal(null)} 
                className="px-6 py-2 border rounded-lg font-medium hover:bg-muted"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Completion Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b bg-slate-50">
              <h2 className="text-xl font-bold text-center">Payment Summary</h2>
              <p className="text-sm text-center text-muted-foreground">{paymentModal.buyer_name} • {paymentModal.date}</p>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="font-medium text-slate-700">Overall Bill Amount</span>
                <span className="text-xl font-bold text-primary">₹{formatInr(paymentModal.overallTotal)}</span>
              </div>
              
              <div className="space-y-2">
                <label className="block font-medium text-sm text-slate-700">Amount Received (₹)</label>
                <input 
                  type="number" 
                  className="w-full border p-3 rounded-lg text-lg font-semibold"
                  value={partialPayment || ''}
                  onChange={e => setPartialPayment(Number(e.target.value))}
                  placeholder="0"
                />
              </div>

              <div className="flex justify-between items-center pt-4 border-t bg-slate-50 p-4 rounded-lg">
                <span className="font-bold text-slate-700">Balance Amount</span>
                <span className={`text-xl font-bold ${paymentModal.overallTotal - partialPayment > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ₹{formatInr(Math.max(0, paymentModal.overallTotal - partialPayment))}
                </span>
              </div>
            </div>

            <div className="p-4 border-t flex flex-col gap-2 bg-slate-50">
              <button 
                onClick={handleSavePartialPayment} 
                className="w-full bg-orange-100 text-orange-700 py-3 rounded-xl font-semibold hover:bg-orange-200 transition-colors"
              >
                Save Partial Payment
              </button>
              <button 
                onClick={handleCompletePaymentFinal} 
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors shadow-sm flex justify-center items-center"
              >
                <CheckCircle2 className="w-5 h-5 mr-2" /> Complete Payment
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
    </div>
  )
}
