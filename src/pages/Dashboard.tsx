import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { IndianRupee, Store, FileText, CheckCircle, Users, TrendingUp } from "lucide-react"
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
    pendingBills: 0,
    completedBills: 0,
    employeesPresent: 0,
    todaysProfit: 0
  })

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    const today = new Date().toISOString().split('T')[0]
    
    // Total Shops
    const { count: shopCount } = await supabase.from('shops').select('*', { count: 'exact', head: true })
    
    // Pending Bills (Shops marked for loading)
    const { count: pendingCount } = await supabase.from('shops').select('*', { count: 'exact', head: true }).eq('marked_for_loading', true)
    
    // Completed Bills (Completed Loading today)
    const { count: completedCount } = await supabase.from('completed_loadings').select('*', { count: 'exact', head: true }).eq('loading_date', today)

    // Employees Present Today
    const { count: presentCount } = await supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('date', today).eq('status', 'Present')

    // Today's Purchases
    const { data: purchases } = await supabase.from('purchases').select('grand_total').eq('date', today)
    const todaysPurchase = purchases?.reduce((sum, p) => sum + Number(p.grand_total), 0) || 0

    // Today's Sales
    const { data: sales } = await supabase.from('sales').select('total_amount').eq('date', today)
    const todaysSales = sales?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0

    const todaysProfit = todaysSales - todaysPurchase

    setStats({
      todaysPurchase,
      todaysSales,
      totalShops: shopCount || 0,
      pendingBills: pendingCount || 0,
      completedBills: completedCount || 0,
      employeesPresent: presentCount || 0,
      todaysProfit
    })
  }

  const getTitle = (title: string) => {
    if (lang === 'te') {
      if (title === "Today's Purchase Amount") return "నేటి కొనుగోలు మొత్తం"
      if (title === "Today's Sales Amount") return "నేటి అమ్మకాల మొత్తం"
      if (title === "Today's Profit") return "నేటి లాభం"
      if (title === "Total Shops") return "మొత్తం దుకాణాలు"
      if (title === "Pending Loading Bills") return "పెండింగ్ లోడింగ్ బిల్లులు"
      if (title === "Completed Loading Bills") return "పూర్తయిన లోడింగ్ బిల్లులు"
      if (title === "Employees Present") return "హాజరైన సిబ్బంది"
    }
    return title
  }

  const statCards = [
    { title: "Today's Purchase Amount", value: `₹${formatInr(stats.todaysPurchase)}`, icon: IndianRupee, color: "text-red-500", bg: "bg-red-100 dark:bg-red-950" },
    { title: "Today's Sales Amount", value: `₹${formatInr(stats.todaysSales)}`, icon: IndianRupee, color: "text-green-500", bg: "bg-green-100 dark:bg-green-950" },
    { title: "Today's Profit", value: `₹${formatInr(stats.todaysProfit)}`, icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-950" },
    { title: "Total Shops", value: stats.totalShops.toString(), icon: Store, color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-950" },
    { title: "Pending Loading Bills", value: stats.pendingBills.toString(), icon: FileText, color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-950" },
    { title: "Completed Loading Bills", value: stats.completedBills.toString(), icon: CheckCircle, color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-950" },
    { title: "Employees Present", value: stats.employeesPresent.toString(), icon: Users, color: "text-cyan-500", bg: "bg-cyan-100 dark:bg-cyan-950" },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("dashboard", lang)}</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <div key={index} className="bg-card p-6 rounded-xl border shadow-sm flex items-center space-x-4">
              <div className={`p-3 rounded-lg ${stat.bg}`}>
                <Icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{getTitle(stat.title)}</p>
                <h3 className={`text-2xl font-bold ${stat.value.startsWith('₹-') ? 'text-red-600' : ''}`}>{stat.value}</h3>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
