import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { IndianRupee, Store, CreditCard, Users, Calendar, Wallet } from "lucide-react"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"
import { toLocalDateString, getStartOfMonthString, getEndOfMonthString, getMsUntilNextMidnight } from "@/lib/utils"

const formatInr = (value: number) => {
  return new Intl.NumberFormat('en-IN').format(value)
}

export function Dashboard() {
  const { lang } = useOutletContext<{ lang: "en" | "te" }>()
  const currentDateKeyRef = useRef<string>("")

  const [stats, setStats] = useState({
    todaysPurchase: 0,
    todaysSales: 0,
    totalShops: 0,
    overallPending: 0,
    pendingShopsCount: 0,
    monthlySalesPayments: 0,
    monthlyPurchasePayments: 0,
    monthlyWorkerSalary: 0,
    monthlyExpenses: 0,
    monthlyNetProfit: 0,
    overallPaymentAmount: 0,
    overallCompletedAmount: 0,
    overallPendingAmount: 0,
    overallAdvancePaid: 0,
    overallSalesAmount: 0,
    overallSalesCompletedAmount: 0,
    overallSalesPendingAmount: 0,
    overallSalesAdvanceReceived: 0
  })

  useEffect(() => {
    loadStats()

    // 1. Precise Midnight Timer (triggers at 12:00:00 AM local timezone)
    let midnightTimerId: ReturnType<typeof setTimeout>

    const scheduleMidnightTimer = () => {
      const ms = getMsUntilNextMidnight()
      midnightTimerId = setTimeout(() => {
        const checkToday = toLocalDateString(new Date())
        if (currentDateKeyRef.current !== checkToday) {
          currentDateKeyRef.current = checkToday
          loadStats()
        }
        scheduleMidnightTimer()
      }, ms + 250)
    }

    scheduleMidnightTimer()

    // 2. Periodic Guard Interval (every 10 seconds)
    // Ensures date changes are caught even if system sleep/browser throttling delayed setTimeout
    const intervalId = setInterval(() => {
      const checkToday = toLocalDateString(new Date())
      if (currentDateKeyRef.current && currentDateKeyRef.current !== checkToday) {
        currentDateKeyRef.current = checkToday
        loadStats()
      }
    }, 10000)

    // 3. Tab Focus and Visibility Change Handlers
    const checkAndRefreshIfDateChanged = () => {
      const checkToday = toLocalDateString(new Date())
      if (currentDateKeyRef.current && currentDateKeyRef.current !== checkToday) {
        currentDateKeyRef.current = checkToday
        loadStats()
      }
    }

    window.addEventListener('focus', checkAndRefreshIfDateChanged)
    document.addEventListener('visibilitychange', checkAndRefreshIfDateChanged)

    return () => {
      clearTimeout(midnightTimerId)
      clearInterval(intervalId)
      window.removeEventListener('focus', checkAndRefreshIfDateChanged)
      document.removeEventListener('visibilitychange', checkAndRefreshIfDateChanged)
    }
  }, [])

  const loadStats = async () => {
    const now = new Date()
    const today = toLocalDateString(now)
    currentDateKeyRef.current = today
    
    // Automatically determine current month date range from system date
    const startOfMonth = getStartOfMonthString(now)
    const endOfMonth = getEndOfMonthString(now)

    // 1. Total Shops
    const { count: shopCount } = await supabase.from('shops').select('*', { count: 'exact', head: true })
    
    // 2. Today's Purchases
    const { data: purchases } = await supabase.from('purchases').select('grand_total').eq('date', today)
    const todaysPurchase = purchases?.reduce((sum, p) => sum + Number(p.grand_total), 0) || 0

    // 3. Today's Sales
    const { data: sales } = await supabase.from('sales').select('total_amount').eq('date', today)
    const todaysSales = sales?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0

    // 4. Overall Pending & Pending Shops Count across ALL purchases (lifetime metric for stat card)
    const { data: allPurchasesLifetime } = await supabase
      .from('purchases')
      .select('id, session_id, grand_total, advance, payment_status, session_partial_payment, shop_id')

    const pendingShopIds = new Set<string>()
    let overallPendingAmountStatCard = 0

    const lifetimePendingGroups = new Map<string, { grandTotal: number; partialPayment: number }>()

    allPurchasesLifetime?.forEach(p => {
      if (p.payment_status !== 'Completed') {
        const key = p.session_id || p.id
        if (!lifetimePendingGroups.has(key)) {
          lifetimePendingGroups.set(key, {
            grandTotal: 0,
            partialPayment: Number(p.session_partial_payment || 0)
          })
        }
        const g = lifetimePendingGroups.get(key)!
        g.grandTotal += Number(p.grand_total || 0)
        pendingShopIds.add(p.shop_id)
      }
    })

    lifetimePendingGroups.forEach(g => {
      overallPendingAmountStatCard += Math.max(0, g.grandTotal - g.partialPayment)
    })

    // -------------------------------------------------------------
    // CURRENT MONTH PURCHASES FOR DASHBOARD CARDS
    // -------------------------------------------------------------
    const { data: monthPurchases } = await supabase
      .from('purchases')
      .select('id, session_id, grand_total, advance, payment_status, session_partial_payment, payment_date, date, shop_id')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)

    let overallPaymentAmount = 0
    let overallCompletedAmount = 0

    const pendingGroups = new Map<string, {
      grandTotal: number;
      partialPayment: number;
      advanceSum: number;
    }>()

    monthPurchases?.forEach(p => {
      const gTotal = Number(p.grand_total || 0)
      const adv = Number(p.advance || 0)

      overallPaymentAmount += gTotal

      if (p.payment_status === 'Completed') {
        overallCompletedAmount += gTotal
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

    let overallPendingAmount = 0
    let overallAdvancePaid = 0
    pendingGroups.forEach(g => {
      overallPendingAmount += Math.max(0, g.grandTotal - g.partialPayment)
      overallAdvancePaid += (g.advanceSum + g.partialPayment)
    })

    // -------------------------------------------------------------
    // CURRENT MONTH SALES FOR DASHBOARD CARDS
    // -------------------------------------------------------------
    const { data: monthSales } = await supabase
      .from('sales')
      .select('buyer_name, total_amount, advance, payment_status, partial_payment, payment_date, payment_history, date')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)

    let overallSalesAmount = 0
    let overallSalesCompletedAmount = 0
    let overallSalesPendingAmount = 0
    let overallSalesAdvanceReceived = 0

    const salesPendingMap = new Map<string, {
      buyer_name: string;
      overallTotal: number;
      advance: number;
      partial_payment: number;
      payment_history: { id?: string, date: string, amount: number, remarks?: string }[];
    }>()

    monthSales?.forEach(s => {
      const gTotal = Number(s.total_amount || 0)
      const adv = Number(s.advance || 0)
      overallSalesAmount += gTotal

      if (s.payment_status === 'Completed') {
        overallSalesCompletedAmount += gTotal
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
        overallSalesCompletedAmount += grp.overallTotal
      } else {
        overallSalesPendingAmount += rem
        overallSalesAdvanceReceived += grp.advance
      }
    })

    // -------------------------------------------------------------
    // CURRENT MONTH WORKER SALARIES & EXPENSES
    // -------------------------------------------------------------
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('employee_id, status')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)

    const { data: employeesData } = await supabase
      .from('employees')
      .select('id, daily_wage')

    let monthlyWorkerSalary = 0
    if (attendanceData && employeesData) {
      const wageMap = new Map<string, number>()
      employeesData.forEach(e => wageMap.set(e.id, Number(e.daily_wage || 0)))

      attendanceData.forEach(att => {
        const dailyWage = wageMap.get(att.employee_id) || 0
        if (att.status === 'Present') {
          monthlyWorkerSalary += dailyWage
        } else if (att.status === 'Half Day') {
          monthlyWorkerSalary += dailyWage * 0.5
        }
      })
    }

    let monthlyExpenses = 0
    try {
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)
      
      monthlyExpenses = expensesData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
    } catch (e) {
      console.error("Expenses table read error:", e)
    }

    const monthlyNetProfit = overallSalesAmount - (overallPaymentAmount + monthlyWorkerSalary + monthlyExpenses)

    setStats({
      todaysPurchase,
      todaysSales,
      totalShops: shopCount || 0,
      overallPending: overallPendingAmountStatCard,
      pendingShopsCount: pendingShopIds.size,
      monthlySalesPayments: overallSalesAmount,
      monthlyPurchasePayments: overallPaymentAmount,
      monthlyWorkerSalary,
      monthlyExpenses,
      monthlyNetProfit,
      overallPaymentAmount,
      overallCompletedAmount,
      overallPendingAmount,
      overallAdvancePaid,
      overallSalesAmount,
      overallSalesCompletedAmount,
      overallSalesPendingAmount,
      overallSalesAdvanceReceived
    })
  }

  const getTitle = (title: string) => {
    if (lang === 'te') {
      if (title === "Today's Purchase Amount") return "నేటి కొనుగోలు మొత్తం"
      if (title === "Today's Sales Amount") return "నేటి అమ్మకాల మొత్తం"
      if (title === "Total Shops") return "మొత్తం దుకాణాలు"
      if (title === "Total Pending Shops for Payment") return "చెల్లింపు పెండింగ్ ఉన్న మొత్తం దుకాణాలు"
      if (title === "Overall Pending Amount") return "మొత్తం పెండింగ్ అమౌంట్"
    }
    return title
  }

  const statCards = [
    { title: "Today's Purchase Amount", value: `₹${formatInr(stats.todaysPurchase)}`, icon: IndianRupee, color: "text-red-500", bg: "bg-red-100 dark:bg-red-950" },
    { title: "Today's Sales Amount", value: `₹${formatInr(stats.todaysSales)}`, icon: IndianRupee, color: "text-green-500", bg: "bg-green-100 dark:bg-green-950" },
    { title: "Total Shops", value: stats.totalShops.toString(), icon: Store, color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-950" },
    { title: "Total Pending Shops for Payment", value: stats.pendingShopsCount.toString(), icon: Users, color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-950" },
    { title: "Overall Pending Amount", value: `₹${formatInr(stats.overallPending)}`, icon: CreditCard, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-950" },
  ]

  const isProfit = stats.monthlyNetProfit >= 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("dashboard", lang)}</h1>
      
      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="bg-card p-6 rounded-xl border shadow-sm flex items-center space-x-4">
              <div className={`p-3 rounded-lg ${stat.bg} shrink-0`}>
                <Icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground truncate">{getTitle(stat.title)}</p>
                <h3 className="text-xl font-bold truncate mt-1">{stat.value}</h3>
              </div>
            </div>
          )
        })}
      </div>

      {/* Payment History & Current Month Profit/Loss Section Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Payment History (Purchasing) Card - Current Month */}
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
              <span className="font-semibold text-foreground">₹{formatInr(stats.overallPaymentAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">{t("overallCompletedAmount", lang)}</span>
              <span className="font-semibold text-green-600">₹{formatInr(stats.overallCompletedAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">{t("overallPendingAmount", lang)}</span>
              <span className="font-semibold text-orange-500">₹{formatInr(stats.overallPendingAmount)}</span>
            </div>
            <div className="h-px bg-slate-200 dark:bg-slate-800 pt-1"></div>
            <div className="flex justify-between items-center text-sm pt-1">
              <span className="text-muted-foreground font-medium">{t("overallAdvancePaid", lang)}</span>
              <span className="font-semibold text-purple-600">₹{formatInr(stats.overallAdvancePaid)}</span>
            </div>
          </div>
        </div>

        {/* Payment History (Sales) Card - Current Month */}
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
              <span className="font-semibold text-foreground">₹{formatInr(stats.overallSalesAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">{t("overallCompletedAmount", lang)}</span>
              <span className="font-semibold text-green-600">₹{formatInr(stats.overallSalesCompletedAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">{t("overallPendingAmount", lang)}</span>
              <span className="font-semibold text-orange-500">₹{formatInr(stats.overallSalesPendingAmount)}</span>
            </div>
            <div className="h-px bg-slate-200 dark:bg-slate-800 pt-1"></div>
            <div className="flex justify-between items-center text-sm pt-1">
              <span className="text-muted-foreground font-medium">{t("overallAdvanceReceived", lang)}</span>
              <span className="font-semibold text-purple-600">₹{formatInr(stats.overallSalesAdvanceReceived)}</span>
            </div>
          </div>
        </div>

        {/* Overall Profit/Loss Card - Current Month */}
        <div className="bg-card border rounded-2xl shadow-md overflow-hidden">
          <div className="bg-muted px-6 py-4 border-b flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <span className="font-bold text-sm text-foreground uppercase tracking-wider">
                {lang === 'te' ? "మొత్తం లాభ నష్టాల నివేదిక" : "Overall Profit / Loss"}
              </span>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${isProfit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {isProfit ? (lang === 'te' ? 'లాభం' : 'Profit') : (lang === 'te' ? 'నష్టం' : 'Loss')}
            </span>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">{lang === 'te' ? "మొత్తం అమ్మకాల మొత్తం" : "Overall Sales Amount"}</span>
              <span className="font-semibold text-green-600">₹{formatInr(stats.overallSalesAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">{lang === 'te' ? "మొత్తం చెల్లింపు మొత్తం" : "Overall Payment Amount"}</span>
              <span className="font-semibold text-red-500">₹{formatInr(stats.overallPaymentAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">{lang === 'te' ? "సిబ్బంది జీతాలు" : "Worker Salary"}</span>
              <span className="font-semibold text-slate-700">₹{formatInr(stats.monthlyWorkerSalary)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">{lang === 'te' ? "ఖర్చులు" : "Expenses"}</span>
              <span className="font-semibold text-slate-700">₹{formatInr(stats.monthlyExpenses)}</span>
            </div>
            <div className="h-px bg-slate-200 dark:bg-slate-800 pt-1"></div>
            <div className="flex justify-between items-center pt-2">
              <span className="font-bold text-base text-foreground">{lang === 'te' ? "నికర లాభం / నష్టం" : "Net Profit/Loss"}</span>
              <span className={`text-lg font-extrabold ${isProfit ? 'text-green-600 animate-pulse' : 'text-red-600'}`}>
                ₹{formatInr(stats.monthlyNetProfit)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
