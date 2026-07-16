import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Download, Printer, FileSpreadsheet } from "lucide-react"
import { generateTablePDF } from "@/lib/pdfTemplate"
import * as XLSX from "xlsx"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"
import { formatDate } from "@/lib/utils"

export function Reports() {
  const { lang } = useOutletContext<{ lang: "en" | "te" }>()
  const [reportType, setReportType] = useState("Daily Purchase")
  
  // Default range: current month
  const [date, setDate] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
  })
  
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [buyerMap, setBuyerMap] = useState<Map<string, string>>(new Map())
  const [matMap, setMatMap] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    fetchReportData()
  }, [reportType, date, endDate])

  const setPresetDates = (preset: 'current' | 'previous') => {
    const today = new Date()
    if (preset === 'current') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
      setDate(firstDay)
      setEndDate(lastDay)
    } else if (preset === 'previous') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0]
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0]
      setDate(firstDay)
      setEndDate(lastDay)
    }
  }

  const fetchReportData = async () => {
    setLoading(true)
    try {
      // Load mappings if needed
      if (buyerMap.size === 0) {
        const { data: buyersData } = await supabase.from('buyers').select('name, name_te')
        const bMap = new Map<string, string>()
        buyersData?.forEach(b => b.name_te && bMap.set(b.name, b.name_te))
        setBuyerMap(bMap)
      }
      if (matMap.size === 0) {
        const { data: matsData } = await supabase.from('materials').select('name, name_te')
        const mMap = new Map<string, string>()
        matsData?.forEach(m => m.name_te && mMap.set(m.name, m.name_te))
        setMatMap(mMap)
      }

      if (reportType === "Daily Purchase") {
        const { data: purchases } = await supabase
          .from('purchases')
          .select('*, shops(name, name_te, type)')
          .eq('date', date)
        setData(purchases || [])
      } else if (reportType === "Daily Sales") {
        const { data: sales } = await supabase
          .from('sales')
          .select('*')
          .eq('date', date)
        setData(sales || [])
      } else if (reportType === "Stock Report") {
        const { data: stock } = await supabase
          .from('current_stock')
          .select('*')
        setData(stock || [])
      } else if (reportType === "Attendance") {
        const { data: attendance } = await supabase
          .from('attendance')
          .select('*, employees(name, name_te)')
          .eq('date', date)
        setData(attendance || [])
      } else if (reportType === "Expenses") {
        const { data: expenses } = await supabase
          .from('expenses')
          .select('*')
          .gte('date', date)
          .lte('date', endDate)
          .order('date', { ascending: false })
        setData(expenses || [])
      } else if (reportType === "Profit & Loss") {
        // Cash flow calculations
        const { data: purchases } = await supabase
          .from('purchases')
          .select('grand_total, payment_status, session_partial_payment, payment_date, date')
        
        let purchasePayments = 0
        purchases?.forEach(p => {
          const payDate = p.payment_date || p.date
          if (payDate >= date && payDate <= endDate) {
            if (p.payment_status === 'Completed') {
              purchasePayments += Number(p.grand_total)
            } else {
              purchasePayments += Number(p.session_partial_payment || 0)
            }
          }
        })

        const { data: sales } = await supabase
          .from('sales')
          .select('total_amount, payment_status, partial_payment, payment_date, date')
        
        let salesPayments = 0
        sales?.forEach(s => {
          const payDate = s.payment_date || s.date
          if (payDate >= date && payDate <= endDate) {
            if (s.payment_status === 'Completed') {
              salesPayments += Number(s.total_amount)
            } else {
              salesPayments += Number(s.partial_payment || 0)
            }
          }
        })

        // Worker salary based on attendance in date range
        const { data: att } = await supabase
          .from('attendance')
          .select('employee_id, status')
          .gte('date', date)
          .lte('date', endDate)
        
        const { data: emps } = await supabase
          .from('employees')
          .select('id, daily_wage')
        
        let workerSalary = 0
        if (att && emps) {
          const wageMap = new Map<string, number>()
          emps.forEach(e => wageMap.set(e.id, Number(e.daily_wage || 0)))
          att.forEach(a => {
            const wage = wageMap.get(a.employee_id) || 0
            if (a.status === 'Present') {
              workerSalary += wage
            } else if (a.status === 'Half Day') {
              workerSalary += wage * 0.5
            }
          })
        }

        // Expenses in date range
        let expenses = 0
        try {
          const { data: exp } = await supabase
            .from('expenses')
            .select('amount')
            .gte('date', date)
            .lte('date', endDate)
          expenses = exp?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
        } catch (e) {
          console.error("Expenses read error:", e)
        }

        const netProfit = salesPayments - (purchasePayments + workerSalary + expenses)

        setData([{
          salesPayments,
          purchasePayments,
          workerSalary,
          expenses,
          netProfit
        }])
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }
  const exportPDF = () => {
    let head: string[][] = []
    let body: any[][] = []

    if (reportType === "Daily Purchase") {
      head = [['S.No.', 'Bill No', 'Shop', 'Type', 'Amount (Rs)']];
      body = data.map((row, idx) => [
        idx + 1,
        `#${row.bill_number}`,
        lang === 'te' && row.shops?.name_te ? row.shops.name_te : row.shops?.name,
        row.shops?.type,
        row.grand_total
      ])
    } else if (reportType === "Daily Sales") {
      head = [['S.No.', 'Date', 'Buyer', 'Amount (Rs)']];
      body = data.map((row, idx) => [
        idx + 1,
        formatDate(row.date),
        lang === 'te' && buyerMap.has(row.buyer_name) ? buyerMap.get(row.buyer_name) : row.buyer_name,
        row.total_amount
      ])
    } else if (reportType === "Stock Report") {
      head = [['S.No.', 'Material', 'Category', 'Purchased', 'Sold', 'Current Stock']];
      body = data.map((row, idx) => [
        idx + 1,
        lang === 'te' && matMap.has(row.name) ? matMap.get(row.name) : row.name,
        row.category,
        row.total_purchased,
        row.total_sold,
        row.current_quantity
      ])
    } else if (reportType === "Attendance") {
      head = [['S.No.', 'Employee', 'Date', 'Status']];
      body = data.map((row, idx) => [
        idx + 1,
        lang === 'te' && row.employees?.name_te ? row.employees.name_te : row.employees?.name,
        formatDate(row.date),
        row.status
      ])
    } else if (reportType === "Expenses") {
      head = [['S.No.', 'Date', 'Category', 'Description', 'Amount (Rs)', 'Remarks']];
      body = data.map((row, idx) => [
        idx + 1,
        formatDate(row.date),
        row.category,
        row.description,
        row.amount,
        row.remarks || '-'
      ])
    } else if (reportType === "Profit & Loss") {
      head = [['Sales Payments', 'Purchase Payments', 'Worker Salary', 'Expenses', 'Net Profit/Loss']];
      body = data.map(row => [
        row.salesPayments,
        row.purchasePayments,
        row.workerSalary,
        row.expenses,
        row.netProfit
      ])
    }

    const metadata = [
      `Report Type: ${reportType}`,
      (reportType === "Stock Report" || reportType === "Daily Purchase" || reportType === "Daily Sales" || reportType === "Attendance")
        ? `Date: ${formatDate(date)}`
        : `Date Range: ${formatDate(date)} to ${formatDate(endDate)}`
    ]

    generateTablePDF({
      title: "REPORT",
      subHeader: lang === 'te' ? "విస్సాకోడేరు బ్రిడ్జ్ దగ్గర, భీమవరం[534201]." : "NEAR VISSAKODERU BRIDGE, BHIMAVARAM[534201].",
      filename: `${reportType.replace(" ", "_")}_${date}.pdf`,
      metadata,
      tableHead: head,
      tableBody: body
    }, 'download')
  }

  const exportExcel = () => {
    let sheetData: any[] = []
    
    if (reportType === "Daily Purchase") {
      sheetData = data.map((row, idx) => ({
        "S.No.": idx + 1,
        "Bill No": `#${row.bill_number}`,
        "Shop": row.shops?.name,
        "Type": row.shops?.type,
        "Amount (Rs)": row.grand_total
      }))
    } else if (reportType === "Daily Sales") {
      sheetData = data.map((row, idx) => ({
        "S.No.": idx + 1,
        "Date": formatDate(row.date),
        "Buyer": row.buyer_name,
        "Amount (Rs)": row.total_amount
      }))
    } else if (reportType === "Stock Report") {
      sheetData = data.map((row, idx) => ({
        "S.No.": idx + 1,
        "Material": row.name,
        "Category": row.category,
        "Purchased": row.total_purchased,
        "Sold": row.total_sold,
        "Current Stock": row.current_quantity
      }))
    } else if (reportType === "Attendance") {
      sheetData = data.map((row, idx) => ({
        "S.No.": idx + 1,
        "Employee": row.employees?.name,
        "Date": formatDate(row.date),
        "Status": row.status
      }))
    } else if (reportType === "Expenses") {
      sheetData = data.map((row, idx) => ({
        "S.No.": idx + 1,
        "Date": formatDate(row.date),
        "Category": row.category,
        "Description": row.description,
        "Amount (Rs)": row.amount,
        "Remarks": row.remarks || '-'
      }))
    } else if (reportType === "Profit & Loss") {
      sheetData = data.map(row => ({
        "Sales Payments (Rs)": row.salesPayments,
        "Purchase Payments (Rs)": row.purchasePayments,
        "Worker Salary (Rs)": row.workerSalary,
        "Expenses (Rs)": row.expenses,
        "Net Profit/Loss (Rs)": row.netProfit
      }))
    }

    const ws = XLSX.utils.json_to_sheet(sheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Report")
    XLSX.writeFile(wb, `${reportType.replace(" ", "_")}_${date}.xlsx`)
  }

  const isProfit = data[0]?.netProfit >= 0

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t("reports", lang)}</h1>

      <div className="bg-card p-6 rounded-xl border shadow-sm space-y-4">
        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("reportType", lang)}</label>
            <select className="w-full border p-2 rounded bg-background text-sm" value={reportType} onChange={e => setReportType(e.target.value)}>
              <option value="Daily Purchase">{lang === 'te' ? "రోజువారీ కొనుగోలు" : "Daily Purchase"}</option>
              <option value="Daily Sales">{lang === 'te' ? "రోజువారీ అమ్మకాలు" : "Daily Sales"}</option>
              <option value="Stock Report">{lang === 'te' ? "స్టాక్ నివేదిక" : "Stock Report"}</option>
              <option value="Attendance">{lang === 'te' ? "సిబ్బంది హాజరు" : "Attendance"}</option>
              <option value="Expenses">{lang === 'te' ? "ఖర్చుల నివేదిక" : "Expenses"}</option>
              <option value="Profit & Loss">{lang === 'te' ? "లాభ నష్టాలు" : "Profit & Loss"}</option>
            </select>
          </div>

          {(reportType === "Daily Purchase" || reportType === "Daily Sales" || reportType === "Attendance") && (
            <div>
              <label className="block text-sm font-medium mb-1">{t("date", lang)}</label>
              <input type="date" className="w-full border p-2 rounded bg-background text-sm" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          )}

          {(reportType === "Profit & Loss" || reportType === "Expenses") && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input type="date" className="w-full border p-2 rounded bg-background text-sm" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input type="date" className="w-full border p-2 rounded bg-background text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </>
          )}
        </div>

        {/* Date presets for Profit & Loss or Expenses */}
        {(reportType === "Profit & Loss" || reportType === "Expenses") && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setPresetDates('current')} className="text-xs px-3 py-1.5 border rounded hover:bg-muted font-semibold bg-background">Current Month</button>
            <button type="button" onClick={() => setPresetDates('previous')} className="text-xs px-3 py-1.5 border rounded hover:bg-muted font-semibold bg-background">Previous Month</button>
          </div>
        )}

        {/* Export Buttons */}
        <div className="flex flex-wrap justify-between items-center pt-2 border-t gap-2">
          <div className="text-sm font-medium text-muted-foreground">
            {reportType === "Profit & Loss" && data[0] && (
              <span>Net Profit/Loss: <strong className={isProfit ? "text-green-600 text-base" : "text-red-600 text-base"}>₹{Number(data[0].netProfit).toLocaleString('en-IN')}</strong></span>
            )}
            {reportType === "Expenses" && (
              <span>Total Expenses: <strong className="text-red-600 text-base">₹{data.reduce((sum, e) => sum + Number(e.amount || 0), 0).toLocaleString('en-IN')}</strong></span>
            )}
            {reportType === "Daily Purchase" && (
              <span>Total Purchase: <strong className="text-red-600 text-base">₹{data.reduce((sum, p) => sum + Number(p.grand_total || 0), 0).toLocaleString('en-IN')}</strong></span>
            )}
            {reportType === "Daily Sales" && (
              <span>Total Sales: <strong className="text-green-600 text-base">₹{data.reduce((sum, s) => sum + Number(s.total_amount || 0), 0).toLocaleString('en-IN')}</strong></span>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={exportPDF} className="bg-red-600 text-white px-4 py-2 rounded text-sm flex items-center hover:bg-red-700 shadow-sm font-semibold">
              <Download className="w-4 h-4 mr-2" /> PDF
            </button>
            <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded text-sm flex items-center hover:bg-green-700 shadow-sm font-semibold">
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </button>
            <button onClick={() => window.print()} className="border border-slate-300 bg-white px-4 py-2 rounded text-sm flex items-center hover:bg-slate-50 shadow-sm font-semibold">
              <Printer className="w-4 h-4 mr-2" /> Print
            </button>
          </div>
        </div>
      </div>

      {/* Report Table Display */}
      {reportType === "Profit & Loss" && data[0] ? (
        <div className="bg-card p-8 border rounded-xl shadow-sm max-w-md mx-auto space-y-4">
          <h2 className="text-lg font-bold text-center border-b pb-2 uppercase tracking-wide">
            {lang === 'te' ? "లాభ నష్టాల నివేదిక" : "Profit & Loss Breakdown"}
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">{lang === 'te' ? "మొత్తం అమ్మకాల చెల్లింపులు" : "Sales Payments"}</span>
              <span className="font-semibold text-green-600">₹{data[0].salesPayments.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">{lang === 'te' ? "కొనుగోలు చెల్లింపులు" : "Purchase Payments"}</span>
              <span className="font-semibold text-red-500">₹{data[0].purchasePayments.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">{lang === 'te' ? "సిబ్బంది జీతాలు" : "Worker Salary"}</span>
              <span className="font-semibold text-slate-700">₹{data[0].workerSalary.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground font-medium">{lang === 'te' ? "ఖర్చులు" : "Expenses"}</span>
              <span className="font-semibold text-slate-700">₹{data[0].expenses.toLocaleString('en-IN')}</span>
            </div>
            <div className="h-px bg-slate-200"></div>
            <div className="flex justify-between items-center pt-2">
              <span className="font-bold text-base text-foreground">{lang === 'te' ? "నికర లాభం / నష్టం" : "Net Profit/Loss"}</span>
              <span className={`text-lg font-extrabold ${isProfit ? 'text-green-600 animate-pulse' : 'text-red-600'}`}>
                ₹{data[0].netProfit.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto p-4">
            <table className="w-full text-sm text-left border">
              <thead className="bg-muted text-muted-foreground">
                {reportType === "Daily Purchase" && (
                  <tr>
                    <th className="px-4 py-3 border-b w-16">S.No.</th>
                    <th className="px-4 py-3 border-b">{t("billNo", lang)}</th>
                    <th className="px-4 py-3 border-b">{t("shopDetails", lang)}</th>
                    <th className="px-4 py-3 border-b">{t("type", lang)}</th>
                    <th className="px-4 py-3 border-b text-right">{t("amount", lang)}</th>
                  </tr>
                )}
                {reportType === "Daily Sales" && (
                  <tr>
                    <th className="px-4 py-3 border-b w-16">S.No.</th>
                    <th className="px-4 py-3 border-b">{t("date", lang)}</th>
                    <th className="px-4 py-3 border-b">{t("addBuyer", lang).replace("New ", "")}</th>
                    <th className="px-4 py-3 border-b text-right">{t("amount", lang)}</th>
                  </tr>
                )}
                {reportType === "Stock Report" && (
                  <tr>
                    <th className="px-4 py-3 border-b w-16">S.No.</th>
                    <th className="px-4 py-3 border-b">{t("name", lang)}</th>
                    <th className="px-4 py-3 border-b">{t("category", lang)}</th>
                    <th className="px-4 py-3 border-b text-center">{lang === 'te' ? "కొనుగోలు పరిమాణం" : "Purchased Qty"}</th>
                    <th className="px-4 py-3 border-b text-center">{lang === 'te' ? "అమ్మకం పరిమాణం" : "Sold Qty"}</th>
                    <th className="px-4 py-3 border-b text-right font-bold">{lang === 'te' ? "ప్రస్తుత స్టాక్" : "Current Stock"}</th>
                  </tr>
                )}
                {reportType === "Attendance" && (
                  <tr>
                    <th className="px-4 py-3 border-b w-16">S.No.</th>
                    <th className="px-4 py-3 border-b">{t("name", lang)}</th>
                    <th className="px-4 py-3 border-b">{t("date", lang)}</th>
                    <th className="px-4 py-3 border-b text-center">{t("status", lang)}</th>
                  </tr>
                )}
                {reportType === "Expenses" && (
                  <tr>
                    <th className="px-4 py-3 border-b w-16">S.No.</th>
                    <th className="px-4 py-3 border-b">{t("date", lang)}</th>
                    <th className="px-4 py-3 border-b">Category</th>
                    <th className="px-4 py-3 border-b">Description</th>
                    <th className="px-4 py-3 border-b text-right">Amount</th>
                    <th className="px-4 py-3 border-b">Remarks</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8">Loading data...</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No records found.</td></tr>
                ) : data.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                    {reportType === "Daily Purchase" && (
                      <>
                        <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3">#{row.bill_number}</td>
                        <td className="px-4 py-3 font-medium">{lang === 'te' && row.shops?.name_te ? row.shops.name_te : (row.shops?.name || 'Unknown')}</td>
                        <td className="px-4 py-3">{row.shops?.type}</td>
                        <td className="px-4 py-3 font-bold text-red-600 text-right">₹{row.grand_total}</td>
                      </>
                    )}
                    {reportType === "Daily Sales" && (
                      <>
                        <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3">{formatDate(row.date)}</td>
                        <td className="px-4 py-3 font-medium">{lang === 'te' && buyerMap.has(row.buyer_name) ? buyerMap.get(row.buyer_name) : (row.buyer_name || 'N/A')}</td>
                        <td className="px-4 py-3 font-bold text-green-600 text-right">₹{row.total_amount}</td>
                      </>
                    )}
                    {reportType === "Stock Report" && (
                      <>
                        <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3 font-medium">{lang === 'te' && matMap.has(row.name) ? matMap.get(row.name) : row.name}</td>
                        <td className="px-4 py-3">{row.category}</td>
                        <td className="px-4 py-3 text-center">{row.total_purchased}</td>
                        <td className="px-4 py-3 text-center text-red-500">{row.total_sold}</td>
                        <td className="px-4 py-3 font-bold text-blue-600 text-right">{row.current_quantity}</td>
                      </>
                    )}
                    {reportType === "Attendance" && (
                      <>
                        <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3 font-medium">{lang === 'te' && row.employees?.name_te ? row.employees.name_te : row.employees?.name}</td>
                        <td className="px-4 py-3">{formatDate(row.date)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${row.status === 'Present' ? 'bg-green-100 text-green-700' : row.status === 'Absent' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {row.status}
                          </span>
                        </td>
                      </>
                    )}
                    {reportType === "Expenses" && (
                      <>
                        <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-3">{formatDate(row.date)}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">
                            {row.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">{row.description}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">₹{row.amount}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{row.remarks || '-'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
