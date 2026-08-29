import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Calendar, Wallet, AlertCircle, Info, Download, FileSpreadsheet, Printer } from "lucide-react"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"
import { toLocalDateString, getStartOfMonthString } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"
import { toast } from "sonner"

const formatInr = (value: number) => {
  return new Intl.NumberFormat('en-IN').format(value)
}

export function Reports() {
  const { lang } = useOutletContext<{ lang: "en" | "te" }>()

  const getTodayStr = () => toLocalDateString()
  const getFirstDayOfMonthStr = () => getStartOfMonthString()

  const [startDate, setStartDate] = useState<string>(getFirstDayOfMonthStr())
  const [endDate, setEndDate] = useState<string>(getTodayStr())

  const [loading, setLoading] = useState(true)
  const [hasNoData, setHasNoData] = useState(false)
  const [isInvalidRange, setIsInvalidRange] = useState(false)

  // Period / Date Range Stats
  const [stats, setStats] = useState({
    // Payment History Purchasing
    purchasingOverallPayment: 0,
    purchasingOverallCompleted: 0,
    purchasingOverallPending: 0,
    purchasingOverallAdvance: 0,

    // Payment History Sales
    salesOverallSalesAmount: 0,
    salesOverallCompleted: 0,
    salesOverallPending: 0,
    salesOverallAdvance: 0,

    // Profit / Loss
    periodSalesPayments: 0,
    periodPurchasePayments: 0,
    periodWorkerSalary: 0,
    periodExpenses: 0,
    periodNetProfit: 0
  })

  // Lifetime / Overall Summary Stats
  const [overallStats, setOverallStats] = useState({
    purchasingOverallPayment: 0,
    purchasingOverallCompleted: 0,
    purchasingOverallPending: 0,
    purchasingOverallAdvance: 0,

    salesOverallSalesAmount: 0,
    salesOverallCompleted: 0,
    salesOverallPending: 0,
    salesOverallAdvance: 0,

    overallSalesPayments: 0,
    overallPurchasePayments: 0,
    overallWorkerSalary: 0,
    overallExpenses: 0,
    overallNetProfit: 0
  })

  useEffect(() => {
    fetchReportData()
  }, [startDate, endDate])

  const fetchReportData = async () => {
    if (!startDate || !endDate) return

    // Always fetch overall/lifetime data regardless of date selection validity
    fetchOverallLifetimeStats()

    // Validation: Start Date cannot be greater than End Date
    if (startDate > endDate) {
      setIsInvalidRange(true)
      setHasNoData(false)
      setLoading(false)
      setStats({
        purchasingOverallPayment: 0,
        purchasingOverallCompleted: 0,
        purchasingOverallPending: 0,
        purchasingOverallAdvance: 0,
        salesOverallSalesAmount: 0,
        salesOverallCompleted: 0,
        salesOverallPending: 0,
        salesOverallAdvance: 0,
        periodSalesPayments: 0,
        periodPurchasePayments: 0,
        periodWorkerSalary: 0,
        periodExpenses: 0,
        periodNetProfit: 0
      })
      return
    }

    setIsInvalidRange(false)
    setLoading(true)

    try {
      // -------------------------------------------------------------
      // 1. PAYMENT HISTORY (PURCHASING) FOR DATE RANGE
      // -------------------------------------------------------------
      const { data: rangePurchases } = await supabase
        .from('purchases')
        .select('id, session_id, grand_total, advance, payment_status, session_partial_payment, payment_date, date, shop_id')
        .gte('date', startDate)
        .lte('date', endDate)

      let purchasingOverallPayment = 0
      let purchasingOverallCompleted = 0

      const pendingGroups = new Map<string, {
        grandTotal: number;
        partialPayment: number;
        advanceSum: number;
      }>()

      rangePurchases?.forEach(p => {
        const gTotal = Number(p.grand_total || 0)
        const adv = Number(p.advance || 0)

        purchasingOverallPayment += gTotal

        if (p.payment_status === 'Completed') {
          purchasingOverallCompleted += gTotal
        } else {
          const key = p.session_id || p.id
          if (!pendingGroups.has(key)) {
            pendingGroups.set(key, {
              grandTotal: 0,
              partialPayment: Number(p.session_partial_payment || 0),
              advanceSum: 0
            })
          }
          const g = pendingGroups.get(key)!
          g.grandTotal += gTotal
          g.advanceSum += adv
        }
      })

      let purchasingOverallPending = 0
      let purchasingOverallAdvance = 0
      pendingGroups.forEach(g => {
        purchasingOverallPending += Math.max(0, g.grandTotal - g.partialPayment)
        purchasingOverallAdvance += (g.advanceSum + g.partialPayment)
      })

      // -------------------------------------------------------------
      // 2. PAYMENT HISTORY (SALES) FOR DATE RANGE
      // -------------------------------------------------------------
      const { data: rangeSales } = await supabase
        .from('sales')
        .select('buyer_name, total_amount, advance, payment_status, partial_payment, payment_date, payment_history, date')
        .gte('date', startDate)
        .lte('date', endDate)

      let salesOverallSalesAmount = 0
      let salesOverallCompleted = 0
      let salesOverallPending = 0
      let salesOverallAdvance = 0

      const salesPendingMap = new Map<string, {
        buyer_name: string;
        overallTotal: number;
        advance: number;
        partial_payment: number;
        payment_history: { id?: string, date: string, amount: number, remarks?: string }[];
      }>()

      rangeSales?.forEach(s => {
        const gTotal = Number(s.total_amount || 0)
        const adv = Number(s.advance || 0)
        salesOverallSalesAmount += gTotal

        if (s.payment_status === 'Completed') {
          salesOverallCompleted += gTotal
        } else {
          const rawName = s.buyer_name || 'Unknown Buyer'
          if (!salesPendingMap.has(rawName)) {
            salesPendingMap.set(rawName, {
              buyer_name: rawName,
              overallTotal: 0,
              advance: 0,
              partial_payment: Number(s.partial_payment || 0),
              payment_history: []
            })
          }
          const grp = salesPendingMap.get(rawName)!
          grp.overallTotal += gTotal
          grp.advance += adv
          if (s.partial_payment && Number(s.partial_payment) > grp.partial_payment) {
            grp.partial_payment = Number(s.partial_payment)
          }

          if (Array.isArray(s.payment_history)) {
            s.payment_history.forEach((h: any) => {
              if (h && Number(h.amount) > 0 && h.date) {
                if (h.remarks === "Advance Payment") return
                const histKey = h.id || `${h.date}_${h.amount}`
                if (!grp.payment_history.some((ex: any) => (ex.id || `${ex.date}_${ex.amount}`) === histKey)) {
                  grp.payment_history.push(h)
                }
              }
            })
          }
        }
      })

      salesPendingMap.forEach(grp => {
        const historyPaid = grp.payment_history.reduce((sum, h) => sum + Number(h.amount || 0), 0)
        const actualPaid = historyPaid > 0 ? historyPaid : (grp.partial_payment || 0)
        const totalPaid = grp.advance + actualPaid
        const rem = Math.max(0, Number((grp.overallTotal - totalPaid).toFixed(2)))

        if (rem === 0) {
          salesOverallCompleted += grp.overallTotal
        } else {
          salesOverallPending += rem
          salesOverallAdvance += totalPaid
        }
      })

      // -------------------------------------------------------------
      // 3. WORKER SALARY & EXPENSES FOR DATE RANGE
      // -------------------------------------------------------------
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('employee_id, status')
        .gte('date', startDate)
        .lte('date', endDate)

      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, daily_wage')

      let periodWorkerSalary = 0
      if (attendanceData && employeesData) {
        const wageMap = new Map<string, number>()
        employeesData.forEach(e => wageMap.set(e.id, Number(e.daily_wage || 0)))

        attendanceData.forEach(att => {
          const dailyWage = wageMap.get(att.employee_id) || 0
          if (att.status === 'Present') {
            periodWorkerSalary += dailyWage
          } else if (att.status === 'Half Day') {
            periodWorkerSalary += dailyWage * 0.5
          }
        })
      }

      let periodExpenses = 0
      try {
        const { data: expensesData } = await supabase
          .from('expenses')
          .select('amount')
          .gte('date', startDate)
          .lte('date', endDate)

        periodExpenses = expensesData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
      } catch (e) {
        console.error("Expenses table read error:", e)
      }

      const periodSalesPayments = salesOverallSalesAmount
      const periodPurchasePayments = purchasingOverallPayment
      const periodNetProfit = periodSalesPayments - (periodPurchasePayments + periodWorkerSalary + periodExpenses)

      const noData = (purchasingOverallPayment === 0) &&
                     (salesOverallSalesAmount === 0) &&
                     (periodWorkerSalary === 0) &&
                     (periodExpenses === 0)

      setHasNoData(noData)

      setStats({
        purchasingOverallPayment,
        purchasingOverallCompleted,
        purchasingOverallPending,
        purchasingOverallAdvance,

        salesOverallSalesAmount,
        salesOverallCompleted,
        salesOverallPending,
        salesOverallAdvance,

        periodSalesPayments,
        periodPurchasePayments,
        periodWorkerSalary,
        periodExpenses,
        periodNetProfit
      })
    } catch (e) {
      console.error("Error loading report stats:", e)
    } finally {
      setLoading(false)
    }
  }

  const fetchOverallLifetimeStats = async () => {
    try {
      // 1. ALL PURCHASES (LIFETIME)
      const { data: allPurchases } = await supabase
        .from('purchases')
        .select('id, session_id, grand_total, advance, payment_status, session_partial_payment')

      let lifetimePurchasingPayment = 0
      let lifetimePurchasingCompleted = 0

      const lifetimePendingGroups = new Map<string, {
        grandTotal: number;
        partialPayment: number;
        advanceSum: number;
      }>()

      allPurchases?.forEach(p => {
        const gTotal = Number(p.grand_total || 0)
        const adv = Number(p.advance || 0)

        lifetimePurchasingPayment += gTotal

        if (p.payment_status === 'Completed') {
          lifetimePurchasingCompleted += gTotal
        } else {
          const key = p.session_id || p.id
          if (!lifetimePendingGroups.has(key)) {
            lifetimePendingGroups.set(key, {
              grandTotal: 0,
              partialPayment: Number(p.session_partial_payment || 0),
              advanceSum: 0
            })
          }
          const g = lifetimePendingGroups.get(key)!
          g.grandTotal += gTotal
          g.advanceSum += adv
        }
      })

      let lifetimePurchasingPending = 0
      let lifetimePurchasingAdvance = 0
      lifetimePendingGroups.forEach(g => {
        lifetimePurchasingPending += Math.max(0, g.grandTotal - g.partialPayment)
        lifetimePurchasingAdvance += (g.advanceSum + g.partialPayment)
      })

      // 2. ALL SALES (LIFETIME)
      const { data: allSales } = await supabase
        .from('sales')
        .select('buyer_name, total_amount, advance, payment_status, partial_payment, payment_history')

      let lifetimeSalesAmount = 0
      let lifetimeSalesCompleted = 0
      let lifetimeSalesPending = 0
      let lifetimeSalesAdvance = 0

      const lifetimeSalesPendingMap = new Map<string, {
        buyer_name: string;
        overallTotal: number;
        advance: number;
        partial_payment: number;
        payment_history: { id?: string, date: string, amount: number, remarks?: string }[];
      }>()

      allSales?.forEach(s => {
        const gTotal = Number(s.total_amount || 0)
        const adv = Number(s.advance || 0)
        lifetimeSalesAmount += gTotal

        if (s.payment_status === 'Completed') {
          lifetimeSalesCompleted += gTotal
        } else {
          const rawName = s.buyer_name || 'Unknown Buyer'
          if (!lifetimeSalesPendingMap.has(rawName)) {
            lifetimeSalesPendingMap.set(rawName, {
              buyer_name: rawName,
              overallTotal: 0,
              advance: 0,
              partial_payment: Number(s.partial_payment || 0),
              payment_history: []
            })
          }
          const grp = lifetimeSalesPendingMap.get(rawName)!
          grp.overallTotal += gTotal
          grp.advance += adv
          if (s.partial_payment && Number(s.partial_payment) > grp.partial_payment) {
            grp.partial_payment = Number(s.partial_payment)
          }

          if (Array.isArray(s.payment_history)) {
            s.payment_history.forEach((h: any) => {
              if (h && Number(h.amount) > 0 && h.date) {
                if (h.remarks === "Advance Payment") return
                const histKey = h.id || `${h.date}_${h.amount}`
                if (!grp.payment_history.some((ex: any) => (ex.id || `${ex.date}_${ex.amount}`) === histKey)) {
                  grp.payment_history.push(h)
                }
              }
            })
          }
        }
      })

      lifetimeSalesPendingMap.forEach(grp => {
        const historyPaid = grp.payment_history.reduce((sum, h) => sum + Number(h.amount || 0), 0)
        const actualPaid = historyPaid > 0 ? historyPaid : (grp.partial_payment || 0)
        const totalPaid = grp.advance + actualPaid
        const rem = Math.max(0, Number((grp.overallTotal - totalPaid).toFixed(2)))

        if (rem === 0) {
          lifetimeSalesCompleted += grp.overallTotal
        } else {
          lifetimeSalesPending += rem
          lifetimeSalesAdvance += totalPaid
        }
      })

      // 3. ALL ATTENDANCE & EMPLOYEES (LIFETIME)
      const { data: allAttendance } = await supabase.from('attendance').select('employee_id, status')
      const { data: allEmployees } = await supabase.from('employees').select('id, daily_wage')

      let lifetimeWorkerSalary = 0
      if (allAttendance && allEmployees) {
        const wageMap = new Map<string, number>()
        allEmployees.forEach(e => wageMap.set(e.id, Number(e.daily_wage || 0)))

        allAttendance.forEach(att => {
          const dailyWage = wageMap.get(att.employee_id) || 0
          if (att.status === 'Present') {
            lifetimeWorkerSalary += dailyWage
          } else if (att.status === 'Half Day') {
            lifetimeWorkerSalary += dailyWage * 0.5
          }
        })
      }

      // 4. ALL EXPENSES (LIFETIME)
      let lifetimeExpenses = 0
      try {
        const { data: allExpensesData } = await supabase.from('expenses').select('amount')
        lifetimeExpenses = allExpensesData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
      } catch (e) {
        console.error("Expenses lifetime fetch error:", e)
      }

      const lifetimeNetProfit = lifetimeSalesAmount - (lifetimePurchasingPayment + lifetimeWorkerSalary + lifetimeExpenses)

      setOverallStats({
        purchasingOverallPayment: lifetimePurchasingPayment,
        purchasingOverallCompleted: lifetimePurchasingCompleted,
        purchasingOverallPending: lifetimePurchasingPending,
        purchasingOverallAdvance: lifetimePurchasingAdvance,

        salesOverallSalesAmount: lifetimeSalesAmount,
        salesOverallCompleted: lifetimeSalesCompleted,
        salesOverallPending: lifetimeSalesPending,
        salesOverallAdvance: lifetimeSalesAdvance,

        overallSalesPayments: lifetimeSalesAmount,
        overallPurchasePayments: lifetimePurchasingPayment,
        overallWorkerSalary: lifetimeWorkerSalary,
        overallExpenses: lifetimeExpenses,
        overallNetProfit: lifetimeNetProfit
      })
    } catch (e) {
      console.error("Error fetching overall lifetime stats:", e)
    }
  }

  // -------------------------------------------------------------
  // PDF EXPORT
  // -------------------------------------------------------------
  const exportPDF = (action: 'download' | 'print' = 'download') => {
    if (isInvalidRange) {
      toast.error("Please select a valid date range")
      return
    }

    const startFmt = startDate.split('-').reverse().join('-')
    const endFmt = endDate.split('-').reverse().join('-')
    const filename = `Reports_${startFmt}_to_${endFmt}.pdf`

    const doc = new jsPDF()

    // Header
    doc.setFont("helvetica", "bold")
    doc.setFontSize(20)
    doc.setTextColor(30, 60, 90)
    doc.text("SIVA DURGA TRADERS", 15, 20)

    doc.setFontSize(8.5)
    doc.setTextColor(100, 110, 120)
    doc.text(lang === 'te' ? "విస్సాకోడేరు బ్రిడ్జ్ దగ్గర, భీమవరం[534201]." : "NEAR VISSAKODERU BRIDGE, BHIMAVARAM[534201].", 15, 25)

    doc.setFontSize(9.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(60, 70, 80)
    doc.text("G.Ravi Kumar(Chinni) | Ph.No: 9949835054", 15, 30)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(16)
    doc.setTextColor(30, 60, 150)
    doc.text("REPORTS", 195, 20, { align: "right" })

    doc.setFontSize(9.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(80, 80, 80)
    doc.text(`Date Range: ${startFmt} to ${endFmt}`, 195, 27, { align: "right" })

    doc.setDrawColor(200, 205, 210)
    doc.setLineWidth(0.8)
    doc.line(15, 33, 195, 33)

    let y = 42

    const addSection = (title: string, dataRows: [string, string][]) => {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(11)
      doc.setTextColor(40, 50, 70)
      doc.text(title, 15, y)
      y += 4

      autoTable(doc, {
        head: [['Metric', 'Amount']],
        body: dataRows,
        startY: y,
        theme: 'plain',
        headStyles: {
          fillColor: [50, 70, 100],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9.5
        },
        bodyStyles: {
          fontSize: 9.5,
          textColor: [40, 40, 40]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        tableLineColor: [210, 215, 220],
        tableLineWidth: 0.3,
        styles: {
          lineColor: [230, 235, 240],
          lineWidth: 0.3
        },
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 60, halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 15, right: 15 }
      })

      y = ((doc as any).lastAutoTable?.finalY || (y + 40)) + 10
    }

    // Section 1: Payment History (Purchasing)
    addSection("Payment History (Purchasing)", [
      ["Overall Payment Amount", `Rs ${formatInr(stats.purchasingOverallPayment)}`],
      ["Overall Completed Amount", `Rs ${formatInr(stats.purchasingOverallCompleted)}`],
      ["Overall Pending Amount", `Rs ${formatInr(stats.purchasingOverallPending)}`],
      ["Overall Advance Paid", `Rs ${formatInr(stats.purchasingOverallAdvance)}`]
    ])

    // Section 2: Payment History (Sales)
    addSection("Payment History (Sales)", [
      ["Overall Sales Amount", `Rs ${formatInr(stats.salesOverallSalesAmount)}`],
      ["Overall Completed Amount", `Rs ${formatInr(stats.salesOverallCompleted)}`],
      ["Overall Pending Amount", `Rs ${formatInr(stats.salesOverallPending)}`],
      ["Overall Advance Received", `Rs ${formatInr(stats.salesOverallAdvance)}`]
    ])

    // Section 3: Profit / Loss
    addSection("Profit / Loss", [
      ["Overall Sales Amount", `Rs ${formatInr(stats.periodSalesPayments)}`],
      ["Overall Payment Amount", `Rs ${formatInr(stats.periodPurchasePayments)}`],
      ["Worker Salary", `Rs ${formatInr(stats.periodWorkerSalary)}`],
      ["Expenses", `Rs ${formatInr(stats.periodExpenses)}`],
      ["Net Profit / Loss", `Rs ${formatInr(stats.periodNetProfit)}`]
    ])

    // Footer: Generated Date & Time
    const now = new Date()
    const genDateTime = `${now.toLocaleDateString('en-IN')} ${now.toLocaleTimeString('en-IN')}`
    doc.setFont("helvetica", "italic")
    doc.setFontSize(8.5)
    doc.setTextColor(130, 130, 130)
    doc.text(`Generated on: ${genDateTime}`, 15, 285)

    if (action === 'download') {
      doc.save(filename)
    } else if (action === 'print') {
      doc.autoPrint()
      window.open(doc.output('bloburl'), '_blank')
    }
  }

  // -------------------------------------------------------------
  // EXCEL EXPORT
  // -------------------------------------------------------------
  const exportExcel = () => {
    if (isInvalidRange) {
      toast.error("Please select a valid date range")
      return
    }

    const startFmt = startDate.split('-').reverse().join('-')
    const endFmt = endDate.split('-').reverse().join('-')
    const filename = `Reports_${startFmt}_to_${endFmt}.xlsx`

    const sheetData = [
      { "Section": "REPORT INFORMATION", "Metric": "Date Range", "Amount (Rs)": `${startFmt} to ${endFmt}` },
      { "Section": "", "Metric": "", "Amount (Rs)": "" },
      { "Section": "Payment History (Purchasing)", "Metric": "Overall Payment Amount", "Amount (Rs)": stats.purchasingOverallPayment },
      { "Section": "Payment History (Purchasing)", "Metric": "Overall Completed Amount", "Amount (Rs)": stats.purchasingOverallCompleted },
      { "Section": "Payment History (Purchasing)", "Metric": "Overall Pending Amount", "Amount (Rs)": stats.purchasingOverallPending },
      { "Section": "Payment History (Purchasing)", "Metric": "Overall Advance Paid", "Amount (Rs)": stats.purchasingOverallAdvance },
      { "Section": "", "Metric": "", "Amount (Rs)": "" },
      { "Section": "Payment History (Sales)", "Metric": "Overall Sales Amount", "Amount (Rs)": stats.salesOverallSalesAmount },
      { "Section": "Payment History (Sales)", "Metric": "Overall Completed Amount", "Amount (Rs)": stats.salesOverallCompleted },
      { "Section": "Payment History (Sales)", "Metric": "Overall Pending Amount", "Amount (Rs)": stats.salesOverallPending },
      { "Section": "Payment History (Sales)", "Metric": "Overall Advance Received", "Amount (Rs)": stats.salesOverallAdvance },
      { "Section": "", "Metric": "", "Amount (Rs)": "" },
      { "Section": "Profit / Loss", "Metric": "Overall Sales Amount", "Amount (Rs)": stats.periodSalesPayments },
      { "Section": "Profit / Loss", "Metric": "Overall Payment Amount", "Amount (Rs)": stats.periodPurchasePayments },
      { "Section": "Profit / Loss", "Metric": "Worker Salary", "Amount (Rs)": stats.periodWorkerSalary },
      { "Section": "Profit / Loss", "Metric": "Expenses", "Amount (Rs)": stats.periodExpenses },
      { "Section": "Profit / Loss", "Metric": "Net Profit / Loss", "Amount (Rs)": stats.periodNetProfit }
    ]

    const ws = XLSX.utils.json_to_sheet(sheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Reports")
    XLSX.writeFile(wb, filename)
  }

  const isProfit = stats.periodNetProfit >= 0
  const isOverallProfit = overallStats.overallNetProfit >= 0

  return (
    <div className="space-y-6">
      {/* Header & Date Range Filter & Export Actions */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-card border rounded-2xl p-4 md:p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold">{t("reports", lang)}</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {lang === 'te' ? "ఎంచుకున్న తేదీల ఆధారంగా నివేదికలను వీక్షించండి" : "View custom period reports by selecting a date range"}
          </p>
        </div>

        {/* Date Range Selector & Action Buttons Container */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Date Pickers */}
          <div className="flex items-center gap-2 bg-muted/40 p-1.5 px-3 rounded-xl border w-full sm:w-auto">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full text-xs font-medium">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground whitespace-nowrap">{lang === 'te' ? "ప్రారంభం:" : "From:"}</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-background border rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                />
              </div>

              <span className="text-muted-foreground hidden sm:inline">–</span>

              <div className="flex items-center gap-1">
                <span className="text-muted-foreground whitespace-nowrap">{lang === 'te' ? "ముగింపు:" : "To:"}</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-background border rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
            <button
              onClick={() => exportPDF('download')}
              className="bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center shadow-sm transition-colors shrink-0"
            >
              <Download className="w-4 h-4 mr-1.5" />
              {lang === 'te' ? "PDF డౌన్‌లోడ్" : "Download PDF"}
            </button>

            <button
              onClick={exportExcel}
              className="bg-green-600 hover:bg-green-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center shadow-sm transition-colors shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />
              {lang === 'te' ? "ఎక్సెల్ ఎగుమతి" : "Export Excel"}
            </button>

            <button
              onClick={() => exportPDF('print')}
              className="border border-slate-300 dark:border-slate-700 bg-card hover:bg-muted text-foreground px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center shadow-sm transition-colors shrink-0"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              {lang === 'te' ? "ప్రింట్" : "Print Report"}
            </button>
          </div>
        </div>
      </div>

      {/* Validation Message */}
      {isInvalidRange && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center space-x-3 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>
            {lang === 'te'
              ? "ప్రారంభ తేదీ ముగింపు తేదీ కంటే ఎక్కువగా ఉండకూడదు. దయచేసి సరైన తేదీ పరిధిని ఎంచుకోండి."
              : "Start Date cannot be greater than End Date. Please select a valid date range."}
          </span>
        </div>
      )}

      {/* No Data Notice */}
      {!isInvalidRange && hasNoData && !loading && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex items-center space-x-3 text-amber-700 dark:text-amber-300 text-sm">
          <Info className="w-5 h-5 shrink-0 text-amber-600" />
          <span>
            {lang === 'te'
              ? "ఎంచుకున్న తేదీ పరిధిలో ఏ రికార్డులు కనుగొనబడలేదు."
              : "No records found for the selected date range."}
          </span>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-sm font-medium">
          {lang === 'te' ? "డేటా లోడ్ అవుతోంది..." : "Loading report data..."}
        </div>
      ) : (
        /* Date-Range Report Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* 1. Payment History (Purchasing) Card */}
          <div className="bg-card border rounded-2xl shadow-md overflow-hidden">
            <div className="bg-muted px-6 py-4 border-b flex items-center space-x-2">
              <Wallet className="w-5 h-5 text-muted-foreground" />
              <span className="font-bold text-sm text-foreground uppercase tracking-wider">
                {t("paymentHistoryPurchasing", lang)}
              </span>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{t("overallPaymentAmount", lang)}</span>
                <span className="font-semibold text-foreground">₹{formatInr(stats.purchasingOverallPayment)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{t("overallCompletedAmount", lang)}</span>
                <span className="font-semibold text-green-600">₹{formatInr(stats.purchasingOverallCompleted)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{t("overallPendingAmount", lang)}</span>
                <span className="font-semibold text-orange-500">₹{formatInr(stats.purchasingOverallPending)}</span>
              </div>
              <div className="h-px bg-slate-200 dark:bg-slate-800 pt-1"></div>
              <div className="flex justify-between items-center text-sm pt-1">
                <span className="text-muted-foreground font-medium">{t("overallAdvancePaid", lang)}</span>
                <span className="font-semibold text-purple-600">₹{formatInr(stats.purchasingOverallAdvance)}</span>
              </div>
            </div>
          </div>

          {/* 2. Payment History (Sales) Card */}
          <div className="bg-card border rounded-2xl shadow-md overflow-hidden">
            <div className="bg-muted px-6 py-4 border-b flex items-center space-x-2">
              <Wallet className="w-5 h-5 text-muted-foreground" />
              <span className="font-bold text-sm text-foreground uppercase tracking-wider">
                {t("paymentHistorySales", lang)}
              </span>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{t("overallSalesAmount", lang)}</span>
                <span className="font-semibold text-foreground">₹{formatInr(stats.salesOverallSalesAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{t("overallCompletedAmount", lang)}</span>
                <span className="font-semibold text-green-600">₹{formatInr(stats.salesOverallCompleted)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{t("overallPendingAmount", lang)}</span>
                <span className="font-semibold text-orange-500">₹{formatInr(stats.salesOverallPending)}</span>
              </div>
              <div className="h-px bg-slate-200 dark:bg-slate-800 pt-1"></div>
              <div className="flex justify-between items-center text-sm pt-1">
                <span className="text-muted-foreground font-medium">{t("overallAdvanceReceived", lang)}</span>
                <span className="font-semibold text-purple-600">₹{formatInr(stats.salesOverallAdvance)}</span>
              </div>
            </div>
          </div>

          {/* 3. Profit / Loss Card */}
          <div className="bg-card border rounded-2xl shadow-md overflow-hidden">
            <div className="bg-muted px-6 py-4 border-b flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <span className="font-bold text-sm text-foreground uppercase tracking-wider">
                  {lang === 'te' ? "లాభ నష్టాల నివేదిక" : "Profit / Loss"}
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${isProfit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isProfit ? (lang === 'te' ? 'లాభం' : 'Profit') : (lang === 'te' ? 'నష్టం' : 'Loss')}
              </span>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{lang === 'te' ? "మొత్తం అమ్మకాల మొత్తం" : "Overall Sales Amount"}</span>
                <span className="font-semibold text-green-600">₹{formatInr(stats.periodSalesPayments)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{lang === 'te' ? "మొత్తం చెల్లింపు మొత్తం" : "Overall Payment Amount"}</span>
                <span className="font-semibold text-red-500">₹{formatInr(stats.periodPurchasePayments)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{lang === 'te' ? "సిబ్బంది జీతాలు" : "Worker Salary"}</span>
                <span className="font-semibold text-slate-700">₹{formatInr(stats.periodWorkerSalary)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{lang === 'te' ? "ఖర్చులు" : "Expenses"}</span>
                <span className="font-semibold text-slate-700">₹{formatInr(stats.periodExpenses)}</span>
              </div>
              <div className="h-px bg-slate-200 dark:bg-slate-800 pt-1"></div>
              <div className="flex justify-between items-center pt-2">
                <span className="font-bold text-base text-foreground">{lang === 'te' ? "నికర లాభం / నష్టం" : "Net Profit/Loss"}</span>
                <span className={`text-lg font-extrabold ${isProfit ? 'text-green-600 animate-pulse' : 'text-red-600'}`}>
                  ₹{formatInr(stats.periodNetProfit)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OVERALL SUMMARY SECTION (LIFETIME DATA - NOT AFFECTED BY DATE RANGE FILTER) */}
      <div className="space-y-4 pt-6 border-t">
        <div className="flex items-center space-x-2">
          <Wallet className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-bold text-foreground">
            {t("overallSummary", lang)}
          </h2>
          <span className="text-xs text-muted-foreground">
            ({lang === 'te' ? "మొత్తం జీవితకాల సమాచారం" : "Lifetime overall metrics"})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* 1. Overall Payment History (Purchasing) Card */}
          <div className="bg-card border rounded-2xl shadow-md overflow-hidden">
            <div className="bg-muted px-6 py-4 border-b flex items-center space-x-2">
              <Wallet className="w-5 h-5 text-muted-foreground" />
              <span className="font-bold text-sm text-foreground uppercase tracking-wider">
                {t("paymentHistoryPurchasing", lang)}
              </span>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{t("overallPaymentAmount", lang)}</span>
                <span className="font-semibold text-foreground">₹{formatInr(overallStats.purchasingOverallPayment)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{t("overallCompletedAmount", lang)}</span>
                <span className="font-semibold text-green-600">₹{formatInr(overallStats.purchasingOverallCompleted)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{t("overallPendingAmount", lang)}</span>
                <span className="font-semibold text-orange-500">₹{formatInr(overallStats.purchasingOverallPending)}</span>
              </div>
              <div className="h-px bg-slate-200 dark:bg-slate-800 pt-1"></div>
              <div className="flex justify-between items-center text-sm pt-1">
                <span className="text-muted-foreground font-medium">{t("overallAdvancePaid", lang)}</span>
                <span className="font-semibold text-purple-600">₹{formatInr(overallStats.purchasingOverallAdvance)}</span>
              </div>
            </div>
          </div>

          {/* 2. Overall Payment History (Sales) Card */}
          <div className="bg-card border rounded-2xl shadow-md overflow-hidden">
            <div className="bg-muted px-6 py-4 border-b flex items-center space-x-2">
              <Wallet className="w-5 h-5 text-muted-foreground" />
              <span className="font-bold text-sm text-foreground uppercase tracking-wider">
                {t("paymentHistorySales", lang)}
              </span>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{t("overallSalesAmount", lang)}</span>
                <span className="font-semibold text-foreground">₹{formatInr(overallStats.salesOverallSalesAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{t("overallCompletedAmount", lang)}</span>
                <span className="font-semibold text-green-600">₹{formatInr(overallStats.salesOverallCompleted)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{t("overallPendingAmount", lang)}</span>
                <span className="font-semibold text-orange-500">₹{formatInr(overallStats.salesOverallPending)}</span>
              </div>
              <div className="h-px bg-slate-200 dark:bg-slate-800 pt-1"></div>
              <div className="flex justify-between items-center text-sm pt-1">
                <span className="text-muted-foreground font-medium">{t("overallAdvanceReceived", lang)}</span>
                <span className="font-semibold text-purple-600">₹{formatInr(overallStats.salesOverallAdvance)}</span>
              </div>
            </div>
          </div>

          {/* 3. Overall Profit / Loss Card */}
          <div className="bg-card border rounded-2xl shadow-md overflow-hidden">
            <div className="bg-muted px-6 py-4 border-b flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <span className="font-bold text-sm text-foreground uppercase tracking-wider">
                  {lang === 'te' ? "మొత్తం లాభ నష్టాల నివేదిక" : "Overall Profit / Loss"}
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${isOverallProfit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isOverallProfit ? (lang === 'te' ? 'లాభం' : 'Profit') : (lang === 'te' ? 'నష్టం' : 'Loss')}
              </span>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{lang === 'te' ? "మొత్తం అమ్మకాల మొత్తం" : "Overall Sales Amount"}</span>
                <span className="font-semibold text-green-600">₹{formatInr(overallStats.overallSalesPayments)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{lang === 'te' ? "మొత్తం చెల్లింపు మొత్తం" : "Overall Payment Amount"}</span>
                <span className="font-semibold text-red-500">₹{formatInr(overallStats.overallPurchasePayments)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{lang === 'te' ? "సిబ్బంది జీతాలు" : "Worker Salary"}</span>
                <span className="font-semibold text-slate-700">₹{formatInr(overallStats.overallWorkerSalary)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">{lang === 'te' ? "ఖర్చులు" : "Expenses"}</span>
                <span className="font-semibold text-slate-700">₹{formatInr(overallStats.overallExpenses)}</span>
              </div>
              <div className="h-px bg-slate-200 dark:bg-slate-800 pt-1"></div>
              <div className="flex justify-between items-center pt-2">
                <span className="font-bold text-base text-foreground">{lang === 'te' ? "నికర లాభం / నష్టం" : "Net Profit/Loss"}</span>
                <span className={`text-lg font-extrabold ${isOverallProfit ? 'text-green-600 animate-pulse' : 'text-red-600'}`}>
                  ₹{formatInr(overallStats.overallNetProfit)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
