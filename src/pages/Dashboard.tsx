import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { IndianRupee, Store, CreditCard, Users, Calendar } from "lucide-react"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"

const formatInr = (value: number) => {
  return new Intl.NumberFormat('en-IN').format(value)
}

export function Dashboard() {
  const { lang } = useOutletContext<{ lang: "en" | "te" }>()
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
    monthlyNetProfit: 0
  })

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    const today = new Date().toISOString().split('T')[0]
    const todayDate = new Date()
    const startOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1).toISOString().split('T')[0]
    const endOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).toISOString().split('T')[0]
    
    // Total Shops
    const { count: shopCount } = await supabase.from('shops').select('*', { count: 'exact', head: true })
    
    // Today's Purchases
    const { data: purchases } = await supabase.from('purchases').select('grand_total').eq('date', today)
    const todaysPurchase = purchases?.reduce((sum, p) => sum + Number(p.grand_total), 0) || 0

    // Today's Sales
    const { data: sales } = await supabase.from('sales').select('total_amount').eq('date', today)
    const todaysSales = sales?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0

    // Load ALL purchases to calculate overallPending and pendingShopsCount, and monthlyPurchasePayments
    const { data: allPurchases } = await supabase
      .from('purchases')
      .select('id, session_id, grand_total, payment_status, session_partial_payment, payment_date, date, shop_id, shops(name)')
    
    const pendingShopIds = new Set<string>()
    let monthlyPurchasePayments = 0

    // Group pending bills by session_id || id
    const pendingGroups = new Map<string, {
      shopName: string;
      session_id: string;
      grandTotal: number;
      partialPayment: number;
      bills: any[];
    }>()

    allPurchases?.forEach(p => {
      if (p.payment_status === 'Pending') {
        const key = p.session_id || p.id
        const shopName = (p.shops as any)?.name || 'Unknown'
        if (!pendingGroups.has(key)) {
          pendingGroups.set(key, {
            shopName,
            session_id: key,
            grandTotal: 0,
            partialPayment: Number(p.session_partial_payment || 0),
            bills: []
          })
        }
        const g = pendingGroups.get(key)!
        g.grandTotal += Number(p.grand_total || 0)
        g.bills.push(p)
        pendingShopIds.add(p.shop_id)
      }
    })

    let overallPending = 0
    pendingGroups.forEach(g => {
      overallPending += Math.max(0, g.grandTotal - g.partialPayment)
    })

    // Temporary debug logging
    console.log("=== DEBUG: Dashboard Pending Calculation ===")
    const loggedSessions = new Set<string>()
    allPurchases?.forEach(p => {
      const shopName = (p.shops as any)?.name || 'Unknown'
      const status = p.payment_status
      let totalPaid = 0
      let grandTotal = Number(p.grand_total || 0)
      let remainingBalance = 0
      let amountIncluded = 0

      if (status === 'Completed') {
        totalPaid = grandTotal
        remainingBalance = 0
        amountIncluded = 0
      } else {
        const key = p.session_id || p.id
        const g = pendingGroups.get(key)
        if (g) {
          totalPaid = g.partialPayment
          remainingBalance = Math.max(0, g.grandTotal - g.partialPayment)
          if (!loggedSessions.has(key)) {
            amountIncluded = remainingBalance
            loggedSessions.add(key)
          } else {
            amountIncluded = 0
          }
        }
      }

      console.log(`[DEBUG Dashboard] Bill ID: ${p.id} | Shop: ${shopName} | Grand Total: ${grandTotal} | Total Paid: ${totalPaid} | Remaining Balance: ${remainingBalance} | Status: ${status} | Amount Included: ${amountIncluded}`)
    })
    console.log(`[DEBUG Dashboard] Calculated overallPending: ${overallPending}`)

    allPurchases?.forEach(p => {
      // Cash flow Purchase Payments in current month
      const payDate = p.payment_date || p.date
      if (payDate >= startOfMonth && payDate <= endOfMonth) {
        if (p.payment_status === 'Completed') {
          monthlyPurchasePayments += Number(p.grand_total)
        } else {
          monthlyPurchasePayments += Number(p.session_partial_payment || 0)
        }
      }
    })

    // Load ALL sales to calculate monthlySalesPayments
    const { data: allSales } = await supabase
      .from('sales')
      .select('total_amount, payment_status, partial_payment, payment_date, date')
    
    let monthlySalesPayments = 0
    allSales?.forEach(s => {
      const payDate = s.payment_date || s.date
      if (payDate >= startOfMonth && payDate <= endOfMonth) {
        if (s.payment_status === 'Completed') {
          monthlySalesPayments += Number(s.total_amount)
        } else {
          monthlySalesPayments += Number(s.partial_payment || 0)
        }
      }
    })

    // Load Worker Salaries (based on attendance status and employee daily wage in current month)
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

    // Load Expenses in current month
    let monthlyExpenses = 0
    try {
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)
      
      monthlyExpenses = expensesData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
    } catch (e) {
      console.error("Expenses table not yet active:", e)
    }

    const monthlyNetProfit = monthlySalesPayments - (monthlyPurchasePayments + monthlyWorkerSalary + monthlyExpenses)

    setStats({
      todaysPurchase,
      todaysSales,
      totalShops: shopCount || 0,
      overallPending,
      pendingShopsCount: pendingShopIds.size,
      monthlySalesPayments,
      monthlyPurchasePayments,
      monthlyWorkerSalary,
      monthlyExpenses,
      monthlyNetProfit
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

      {/* Monthly Profit/Loss Card */}
      <div className="max-w-md bg-card border rounded-2xl shadow-md overflow-hidden">
        <div className="bg-muted px-6 py-4 border-b flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <span className="font-bold text-sm text-foreground uppercase tracking-wider">
              {lang === 'te' ? "ఈ నెల లాభ నష్టాల నివేదిక" : "Monthly Profit / Loss"}
            </span>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${isProfit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {isProfit ? (lang === 'te' ? 'లాభం' : 'Profit') : (lang === 'te' ? 'నష్టం' : 'Loss')}
          </span>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">{lang === 'te' ? "మొత్తం అమ్మకాల చెల్లింపులు" : "Total Sales Payments"}</span>
            <span className="font-semibold text-green-600">₹{formatInr(stats.monthlySalesPayments)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">{lang === 'te' ? "కొనుగోలు చెల్లింపులు" : "Purchase Payments"}</span>
            <span className="font-semibold text-red-500">₹{formatInr(stats.monthlyPurchasePayments)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">{lang === 'te' ? "సిబ్బంది జీతాలు" : "Worker Salary"}</span>
            <span className="font-semibold text-slate-700">₹{formatInr(stats.monthlyWorkerSalary)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">{lang === 'te' ? "ఖర్చులు" : "Expenses"}</span>
            <span className="font-semibold text-slate-700">₹{formatInr(stats.monthlyExpenses)}</span>
          </div>
          <div className="h-px bg-slate-200 pt-1"></div>
          <div className="flex justify-between items-center pt-2">
            <span className="font-bold text-base text-foreground">{lang === 'te' ? "నికర లాభం / నష్టం" : "Net Profit/Loss"}</span>
            <span className={`text-lg font-extrabold ${isProfit ? 'text-green-600 animate-pulse' : 'text-red-600'}`}>
              ₹{formatInr(stats.monthlyNetProfit)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
