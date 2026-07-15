import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Download, Printer, FileSpreadsheet } from "lucide-react"
import jsPDF from "jspdf"
import "jspdf-autotable"
import * as XLSX from "xlsx"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"

export function Reports() {
  const { lang } = useOutletContext<{ lang: "en" | "te" }>()
  const [reportType, setReportType] = useState("Daily Purchase")
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [buyerMap, setBuyerMap] = useState<Map<string, string>>(new Map())
  const [matMap, setMatMap] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    fetchReportData()
  }, [reportType, date])

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
      } else if (reportType === "Profit & Loss") {
        const { data: purchases } = await supabase.from('purchases').select('grand_total').gte('date', date).lte('date', endDate)
        const { data: sales } = await supabase.from('sales').select('total_amount').gte('date', date).lte('date', endDate)
        
        const totalPurchases = purchases?.reduce((sum: number, p: any) => sum + Number(p.grand_total), 0) || 0
        const totalSales = sales?.reduce((sum: number, s: any) => sum + Number(s.total_amount), 0) || 0
        
        setData([{ type: 'Profit & Loss', purchases: totalPurchases, sales: totalSales, profit: totalSales - totalPurchases }])
      } else if (reportType === "Attendance") {
        const { data: attendance } = await supabase.from('attendance').select('*, employees(name, name_te)').eq('date', date)
        setData(attendance || [])
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const exportPDF = () => {
    const doc = new jsPDF()
    doc.text(`Siva Durga Traders - ${reportType}`, 14, 15)
    doc.text(`Date: ${date}`, 14, 25)

    let head: string[][] = []
    let body: any[][] = []

    if (reportType === "Daily Purchase") {
      head = [['Bill No', 'Shop', 'Type', 'Amount (Rs)']];
      body = data.map(row => [row.bill_number, lang === 'te' && row.shops?.name_te ? row.shops.name_te : row.shops?.name, row.shops?.type, row.grand_total])
    } else if (reportType === "Daily Sales") {
      head = [['Date', 'Buyer', 'Amount (Rs)']];
      body = data.map(row => [row.date, lang === 'te' && buyerMap.has(row.buyer_name) ? buyerMap.get(row.buyer_name) : row.buyer_name, row.total_amount])
    } else if (reportType === "Stock Report") {
      head = [['Material', 'Category', 'Purchased', 'Sold', 'Current Stock']];
      body = data.map(row => [lang === 'te' && matMap.has(row.name) ? matMap.get(row.name) : row.name, row.category, row.total_purchased, row.total_sold, row.current_quantity])
    } else if (reportType === "Profit & Loss") {
      head = [['Total Purchases', 'Total Sales', 'Net Profit']];
      body = data.map(row => [row.purchases, row.sales, row.profit])
    } else if (reportType === "Attendance") {
      head = [['Employee', 'Date', 'Status']];
      body = data.map(row => [lang === 'te' && row.employees?.name_te ? row.employees.name_te : row.employees?.name, row.date, row.status])
    }

    // @ts-ignore
    doc.autoTable({ head, body, startY: 30 })
    doc.save(`${reportType.replace(" ", "_")}_${date}.pdf`)
  }

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data.map(item => {
      if (reportType === "Daily Purchase") {
        return { "Bill No": item.bill_number, "Shop": item.shops?.name, "Amount": item.grand_total }
      }
      return item
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Report")
    XLSX.writeFile(wb, `${reportType.replace(" ", "_")}_${date}.xlsx`)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t("reports", lang)}</h1>

      <div className="bg-card p-6 rounded-xl border shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">{t("reportType", lang)}</label>
            <select className="w-full border p-2 rounded" value={reportType} onChange={e => setReportType(e.target.value)}>
              <option value="Daily Purchase">{lang === 'te' ? "రోజువారీ కొనుగోలు" : "Daily Purchase"}</option>
              <option value="Daily Sales">{lang === 'te' ? "రోజువారీ అమ్మకాలు" : "Daily Sales"}</option>
              <option value="Stock Report">{lang === 'te' ? "స్టాక్ నివేదిక" : "Stock Report"}</option>
              <option value="Profit & Loss">{lang === 'te' ? "లాభ నష్టాలు" : "Profit & Loss"}</option>
              <option value="Attendance">{lang === 'te' ? "సిబ్బంది హాజరు" : "Attendance"}</option>
            </select>
          </div>
          {(reportType === "Daily Purchase" || reportType === "Daily Sales" || reportType === "Attendance") && (
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">{t("date", lang)}</label>
              <input type="date" className="w-full border p-2 rounded" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          )}
          {reportType === "Profit & Loss" && (
            <>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input type="date" className="w-full border p-2 rounded" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input type="date" className="w-full border p-2 rounded" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </>
          )}
          <div className="flex items-end gap-2">
            <button onClick={exportPDF} className="bg-red-600 text-white px-4 py-2 rounded flex items-center hover:bg-red-700">
              <Download className="w-4 h-4 mr-2" /> PDF
            </button>
            <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded flex items-center hover:bg-green-700">
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </button>
            <button onClick={() => window.print()} className="border border-slate-300 bg-white px-4 py-2 rounded flex items-center hover:bg-slate-50">
              <Printer className="w-4 h-4 mr-2" /> Print
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border">
            <thead className="bg-muted text-muted-foreground">
              {reportType === "Daily Purchase" && (
                <tr>
                  <th className="px-4 py-3 border-b">{t("billNo", lang)}</th>
                  <th className="px-4 py-3 border-b">{t("shopDetails", lang)}</th>
                  <th className="px-4 py-3 border-b">{t("type", lang)}</th>
                  <th className="px-4 py-3 border-b">{t("amount", lang)}</th>
                </tr>
              )}
              {reportType === "Daily Sales" && (
                <tr>
                  <th className="px-4 py-3 border-b">{t("date", lang)}</th>
                  <th className="px-4 py-3 border-b">{t("addBuyer", lang).replace("New ", "")}</th>
                  <th className="px-4 py-3 border-b">{t("amount", lang)}</th>
                </tr>
              )}
              {reportType === "Stock Report" && (
                <tr>
                  <th className="px-4 py-3 border-b">{t("name", lang)}</th>
                  <th className="px-4 py-3 border-b">{t("category", lang)}</th>
                  <th className="px-4 py-3 border-b">{lang === 'te' ? "కొనుగోలు పరిమాణం" : "Purchased Qty"}</th>
                  <th className="px-4 py-3 border-b">{lang === 'te' ? "అమ్మకం పరిమాణం" : "Sold Qty"}</th>
                  <th className="px-4 py-3 border-b font-bold">{lang === 'te' ? "ప్రస్తుత స్టాక్" : "Current Stock"}</th>
                </tr>
              )}
              {reportType === "Profit & Loss" && (
                <tr>
                  <th className="px-4 py-3 border-b">{lang === 'te' ? "మొత్తం కొనుగోళ్లు" : "Total Purchases"}</th>
                  <th className="px-4 py-3 border-b">{lang === 'te' ? "మొత్తం అమ్మకాలు" : "Total Sales"}</th>
                  <th className="px-4 py-3 border-b">{lang === 'te' ? "నికర లాభం / నష్టం" : "Net Profit / Loss"}</th>
                </tr>
              )}
              {reportType === "Attendance" && (
                <tr>
                  <th className="px-4 py-3 border-b">{t("name", lang)}</th>
                  <th className="px-4 py-3 border-b">{t("date", lang)}</th>
                  <th className="px-4 py-3 border-b">{t("status", lang)}</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8">Loading data...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No records found.</td></tr>
              ) : data.map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                  {reportType === "Daily Purchase" && (
                    <>
                      <td className="px-4 py-3">#{row.bill_number}</td>
                      <td className="px-4 py-3 font-medium">{lang === 'te' && row.shops?.name_te ? row.shops.name_te : (row.shops?.name || 'Unknown')}</td>
                      <td className="px-4 py-3">{row.shops?.type}</td>
                      <td className="px-4 py-3 font-bold text-green-600">₹{row.grand_total}</td>
                    </>
                  )}
                  {reportType === "Daily Sales" && (
                    <>
                      <td className="px-4 py-3">{row.date}</td>
                      <td className="px-4 py-3 font-medium">{lang === 'te' && buyerMap.has(row.buyer_name) ? buyerMap.get(row.buyer_name) : (row.buyer_name || 'N/A')}</td>
                      <td className="px-4 py-3 font-bold text-purple-600">₹{row.total_amount}</td>
                    </>
                  )}
                  {reportType === "Stock Report" && (
                    <>
                      <td className="px-4 py-3 font-medium">{lang === 'te' && matMap.has(row.name) ? matMap.get(row.name) : row.name}</td>
                      <td className="px-4 py-3">{row.category}</td>
                      <td className="px-4 py-3">{row.total_purchased}</td>
                      <td className="px-4 py-3 text-red-500">{row.total_sold}</td>
                      <td className="px-4 py-3 font-bold text-blue-600">{row.current_quantity}</td>
                    </>
                  )}
                  {reportType === "Profit & Loss" && (
                    <>
                      <td className="px-4 py-3 font-medium text-red-600">₹{row.purchases}</td>
                      <td className="px-4 py-3 font-medium text-green-600">₹{row.sales}</td>
                      <td className={`px-4 py-3 font-bold ${row.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>₹{row.profit}</td>
                    </>
                  )}
                  {reportType === "Attendance" && (
                    <>
                      <td className="px-4 py-3 font-medium">{lang === 'te' && row.employees?.name_te ? row.employees.name_te : row.employees?.name}</td>
                      <td className="px-4 py-3">{row.date}</td>
                      <td className={`px-4 py-3 font-bold ${row.status === 'Present' ? 'text-green-600' : row.status === 'Absent' ? 'text-red-600' : 'text-orange-500'}`}>{row.status}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
