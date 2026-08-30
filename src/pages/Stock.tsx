import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Calendar, Boxes, TrendingUp, AlertCircle, Info, Download, FileSpreadsheet, Printer } from "lucide-react"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"
import { toLocalDateString, getStartOfMonthString, getItemUnit } from "@/lib/utils"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"
import { toast } from "sonner"

const DEFAULT_PURCHASE_CATEGORIES = [
  "Beer",
  "L.C.'s",
  "Full's",
  "Atta",
  "Plastic",
  "Glass"
]

const formatQuantity = (val: number) => {
  return new Intl.NumberFormat('en-IN').format(val)
}

const getItemDisplayName = (name: string, lang: 'en' | 'te') => {
  if (lang === 'te') {
    if (name === "Beer") return "బీర్"
    if (name === "L.C.'s") return "ఎల్.సి.లు"
    if (name === "Full's") return "ఫుల్స్"
    if (name === "Atta") return "అట్ట"
    if (name === "Plastic") return "ప్లాస్టిక్"
    if (name === "Glass") return "గ్లాస్"
    if (name === "Nibe Box") return "నిబ్ బాక్స్"
    if (name === "Beer Box") return "బీర్ బాక్స్"
  }
  return name
}

const getGroupedSalesItems = (itemNames: string[], materialsList: any[], lang: 'en' | 'te') => {
  const matMap = new Map<string, any>()
  materialsList.forEach(m => {
    if (m.name) {
      matMap.set(m.name, m)
    }
  })

  // Collect ordered categories from materialsList
  const categoryOrder: { key: string; name: string; name_te?: string }[] = []
  const categoryKeys = new Set<string>()

  materialsList.forEach(m => {
    const catKey = m.category || "Other"
    if (!categoryKeys.has(catKey)) {
      categoryKeys.add(catKey)
      categoryOrder.push({
        key: catKey,
        name: m.category || "Other",
        name_te: m.category_te || ""
      })
    }
  })

  // Group items
  const groupedMap = new Map<string, string[]>()
  categoryOrder.forEach(c => groupedMap.set(c.key, []))

  itemNames.forEach(itemName => {
    const mat = matMap.get(itemName)
    const catKey = mat?.category || "Other"
    if (!groupedMap.has(catKey)) {
      groupedMap.set(catKey, [])
      categoryOrder.push({
        key: catKey,
        name: catKey,
        name_te: mat?.category_te || ""
      })
    }
    groupedMap.get(catKey)!.push(itemName)
  })

  return categoryOrder
    .map(c => {
      const items = groupedMap.get(c.key) || []
      const displayName = (lang === 'te' && c.name_te) ? c.name_te : c.name
      return {
        key: c.key,
        displayName,
        items
      }
    })
    .filter(group => group.items.length > 0)
}

export function Stock() {
  const { lang } = useOutletContext<{ lang: "en" | "te" }>()

  const [activeTab, setActiveTab] = useState<"Purchasing" | "Sales">("Purchasing")

  const getTodayStr = () => toLocalDateString()
  const getFirstDayOfMonthStr = () => getStartOfMonthString()

  const [startDate, setStartDate] = useState<string>(getFirstDayOfMonthStr())
  const [endDate, setEndDate] = useState<string>(getTodayStr())

  const [loading, setLoading] = useState(true)
  const [isInvalidRange, setIsInvalidRange] = useState(false)

  // Purchasing Stock Data
  const [purchasingRangeStock, setPurchasingRangeStock] = useState<Record<string, number>>({})
  const [purchasingOverallStock, setPurchasingOverallStock] = useState<Record<string, number>>({})
  const [purchasingItemNames, setPurchasingItemNames] = useState<string[]>(DEFAULT_PURCHASE_CATEGORIES)

  // Sales Stock Data
  const [salesRangeStock, setSalesRangeStock] = useState<Record<string, number>>({})
  const [salesOverallStock, setSalesOverallStock] = useState<Record<string, number>>({})
  const [salesSoldItemNames, setSalesSoldItemNames] = useState<string[]>([])
  const [hasNoSalesPeriodData, setHasNoSalesPeriodData] = useState(false)

  // Dynamic Units State
  const [materialsList, setMaterialsList] = useState<any[]>([])
  const [shopUnitsMap, setShopUnitsMap] = useState<Record<string, string>>({})

  useEffect(() => {
    if (activeTab === "Purchasing") {
      fetchPurchasingStockData()
    } else {
      fetchSalesStockData()
    }
  }, [startDate, endDate, activeTab])

  // -------------------------------------------------------------
  // FETCH PURCHASING STOCK DATA
  // -------------------------------------------------------------
  const fetchPurchasingStockData = async () => {
    if (!startDate || !endDate) return

    if (startDate > endDate) {
      setIsInvalidRange(true)
      setLoading(false)
      setPurchasingRangeStock({})
      return
    }

    setIsInvalidRange(false)
    setLoading(true)

    try {
      const { data: shopsData } = await supabase.from('shops').select('shop_units')
      const combinedUnits: Record<string, string> = {}
      shopsData?.forEach((s: any) => {
        if (s.shop_units) {
          Object.assign(combinedUnits, s.shop_units)
        }
      })
      setShopUnitsMap(combinedUnits)

      const { data: allPurchaseItems } = await supabase
        .from('purchase_items')
        .select('item_name, quantity, purchase_id, purchases(date), materials(name)')

      const overallMap: Record<string, number> = {}
      const itemSet = new Set<string>(DEFAULT_PURCHASE_CATEGORIES)

      allPurchaseItems?.forEach((item: any) => {
        const name = item.item_name || item.materials?.name
        if (!name) return

        itemSet.add(name)
        const qty = Number(item.quantity || 0)
        overallMap[name] = (overallMap[name] || 0) + qty
      })

      itemSet.forEach(cat => {
        if (overallMap[cat] === undefined) overallMap[cat] = 0
      })

      const rangeMap: Record<string, number> = {}
      allPurchaseItems?.forEach((item: any) => {
        const purchaseDate = item.purchases?.date
        if (!purchaseDate) return
        if (purchaseDate >= startDate && purchaseDate <= endDate) {
          const name = item.item_name || item.materials?.name
          if (!name) return
          const qty = Number(item.quantity || 0)
          rangeMap[name] = (rangeMap[name] || 0) + qty
        }
      })

      itemSet.forEach(cat => {
        if (rangeMap[cat] === undefined) rangeMap[cat] = 0
      })

      setPurchasingItemNames(Array.from(itemSet))
      setPurchasingOverallStock(overallMap)
      setPurchasingRangeStock(rangeMap)
    } catch (e) {
      console.error("Error fetching purchasing stock data:", e)
    } finally {
      setLoading(false)
    }
  }

  // -------------------------------------------------------------
  // FETCH SALES STOCK DATA
  // -------------------------------------------------------------
  const fetchSalesStockData = async () => {
    if (!startDate || !endDate) return

    if (startDate > endDate) {
      setIsInvalidRange(true)
      setHasNoSalesPeriodData(false)
      setLoading(false)
      setSalesRangeStock({})
      return
    }

    setIsInvalidRange(false)
    setLoading(true)

    try {
      const { data: matsData } = await supabase.from('materials').select('*')
      if (matsData) setMaterialsList(matsData)

      const { data: allSales } = await supabase
        .from('sales')
        .select('date, items')

      const overallMap: Record<string, number> = {}
      const itemSet = new Set<string>()

      allSales?.forEach((sale: any) => {
        const itemsObj = sale.items || {}
        Object.entries(itemsObj)
          .filter(([k]) => k !== '_additional_expenses')
          .forEach(([_, item]: any) => {
            const name = item.name
            if (!name) return

            itemSet.add(name)
            const qty = Number(item.quantity || 0)
            overallMap[name] = (overallMap[name] || 0) + qty
          })
      })

      const uniqueSoldItems = Array.from(itemSet).sort()

      const rangeMap: Record<string, number> = {}
      let periodTotalSold = 0

      allSales?.forEach((sale: any) => {
        const saleDate = sale.date
        if (!saleDate) return
        if (saleDate >= startDate && saleDate <= endDate) {
          const itemsObj = sale.items || {}
          Object.entries(itemsObj)
            .filter(([k]) => k !== '_additional_expenses')
            .forEach(([_, item]: any) => {
              const name = item.name
              if (!name) return

              const qty = Number(item.quantity || 0)
              rangeMap[name] = (rangeMap[name] || 0) + qty
              periodTotalSold += qty
            })
        }
      })

      setHasNoSalesPeriodData(periodTotalSold === 0)
      setSalesSoldItemNames(uniqueSoldItems)
      setSalesOverallStock(overallMap)
      setSalesRangeStock(rangeMap)
    } catch (e) {
      console.error("Error fetching sales stock data:", e)
    } finally {
      setLoading(false)
    }
  }

  // -------------------------------------------------------------
  // PDF EXPORT
  // -------------------------------------------------------------
  const exportPDF = (action: 'download' | 'print' = 'download') => {
    if (isInvalidRange) {
      toast.error(lang === 'te' ? "దయచేసి సరైన తేదీ పరిధిని ఎంచుకోండి" : "Please select a valid date range")
      return
    }

    const startFmt = startDate.split('-').reverse().join('-')
    const endFmt = endDate.split('-').reverse().join('-')
    const moduleTitle = activeTab === "Purchasing" ? "PURCHASING STOCK REPORT" : "SALES STOCK REPORT"
    const filename = `${activeTab}_Stock_${startFmt}_to_${endFmt}.pdf`

    const doc = new jsPDF()

    // Business Header
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
    doc.setFontSize(14)
    doc.setTextColor(30, 60, 150)
    doc.text(moduleTitle, 195, 20, { align: "right" })

    doc.setFontSize(9.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(80, 80, 80)
    doc.text(`Date Range: ${startFmt} to ${endFmt}`, 195, 27, { align: "right" })

    doc.setDrawColor(200, 205, 210)
    doc.setLineWidth(0.8)
    doc.line(15, 33, 195, 33)

    let y = 42

    const itemNames = activeTab === "Purchasing" ? purchasingItemNames : salesSoldItemNames
    const rangeData = activeTab === "Purchasing" ? purchasingRangeStock : salesRangeStock
    const overallData = activeTab === "Purchasing" ? purchasingOverallStock : salesOverallStock
    const qtyColHeader = activeTab === "Purchasing" ? "Purchased Quantity" : "Sold Quantity"

    const addStockSection = (title: string, stockData: Record<string, number>) => {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(11)
      doc.setTextColor(40, 50, 70)
      doc.text(title, 15, y)
      y += 4

      const tableRows = itemNames.map(item => [
        getItemDisplayName(item, 'en'),
        formatQuantity(stockData[item] || 0),
        getItemUnit(item, activeTab === 'Purchasing' ? 'purchasing' : 'sales', activeTab === 'Purchasing' ? shopUnitsMap : materialsList)
      ])

      if (tableRows.length === 0) {
        doc.setFont("helvetica", "italic")
        doc.setFontSize(9.5)
        doc.setTextColor(120, 120, 120)
        doc.text("No data available for this period.", 15, y + 4)
        y += 12
        return
      }

      autoTable(doc, {
        head: [['Item Name', qtyColHeader, 'Unit']],
        body: tableRows,
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
          0: { cellWidth: 90 },
          1: { cellWidth: 55, halign: 'right', fontStyle: 'bold' },
          2: { cellWidth: 35, halign: 'center' }
        },
        margin: { left: 15, right: 15 }
      })

      y = ((doc as any).lastAutoTable?.finalY || (y + 40)) + 10
    }

    addStockSection(`Period ${activeTab} Stock (${startFmt} to ${endFmt})`, rangeData)
    addStockSection(`Overall ${activeTab} Stock (Lifetime)`, overallData)

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
    }
  }

  // -------------------------------------------------------------
  // EXCEL EXPORT
  // -------------------------------------------------------------
  const exportExcel = () => {
    if (isInvalidRange) {
      toast.error(lang === 'te' ? "దయచేసి సరైన తేదీ పరిధిని ఎంచుకోండి" : "Please select a valid date range")
      return
    }

    const startFmt = startDate ? startDate.split('-').reverse().join('-') : 'Start'
    const endFmt = endDate ? endDate.split('-').reverse().join('-') : 'End'
    const filename = `${activeTab}_Stock_${startDate || 'start'}_to_${endDate || 'end'}.xlsx`
    const qtyColHeader = activeTab === 'Purchasing' ? 'Purchased Quantity' : 'Sold Quantity'
    const itemNames = activeTab === 'Purchasing' ? purchasingItemNames : salesSoldItemNames
    const rangeData = activeTab === 'Purchasing' ? purchasingRangeStock : salesRangeStock
    const overallData = activeTab === 'Purchasing' ? purchasingOverallStock : salesOverallStock

    const sheetData: any[] = [
      { "Section": "REPORT INFORMATION", "Item Name": "Date Range", [qtyColHeader]: `${startFmt} to ${endFmt}`, "Unit": "" },
      { "Section": "", "Item Name": "", [qtyColHeader]: "", "Unit": "" },
      { "Section": `PERIOD ${activeTab.toUpperCase()} STOCK`, "Item Name": "", [qtyColHeader]: "", "Unit": "" }
    ]

    itemNames.forEach(item => {
      sheetData.push({
        "Section": `Period ${activeTab} Stock`,
        "Item Name": item,
        [qtyColHeader]: rangeData[item] || 0,
        "Unit": getItemUnit(item, activeTab === 'Purchasing' ? 'purchasing' : 'sales', activeTab === 'Purchasing' ? shopUnitsMap : materialsList)
      })
    })

    sheetData.push({ "Section": "", "Item Name": "", [qtyColHeader]: "", "Unit": "" })
    sheetData.push({ "Section": `OVERALL ${activeTab.toUpperCase()} STOCK (LIFETIME)`, "Item Name": "", [qtyColHeader]: "", "Unit": "" })

    itemNames.forEach(item => {
      sheetData.push({
        "Section": `Overall ${activeTab} Stock`,
        "Item Name": item,
        [qtyColHeader]: overallData[item] || 0,
        "Unit": getItemUnit(item, activeTab === 'Purchasing' ? 'purchasing' : 'sales', activeTab === 'Purchasing' ? shopUnitsMap : materialsList)
      })
    })

    const ws = XLSX.utils.json_to_sheet(sheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${activeTab} Stock`)
    XLSX.writeFile(wb, filename)
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <h1 className="text-2xl font-bold">{t("stock", lang)}</h1>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("Purchasing")}
          className={`px-6 py-3 font-medium text-sm transition-colors ${
            activeTab === "Purchasing"
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {lang === 'te' ? "కొనుగోళ్ల స్టాక్" : "Purchasing Stock"}
        </button>
        <button
          onClick={() => setActiveTab("Sales")}
          className={`px-6 py-3 font-medium text-sm transition-colors ${
            activeTab === "Sales"
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {lang === 'te' ? "అమ్మకాల స్టాక్" : "Sales Stock"}
        </button>
      </div>

      {/* Header & Date Selector & Export Actions */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-card border rounded-2xl p-4 md:p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-bold">
            {activeTab === "Purchasing"
              ? (lang === 'te' ? "కొనుగోళ్ల స్టాక్ నివేదిక" : "Purchasing Stock")
              : (lang === 'te' ? "అమ్మకాల స్టాక్ నివేదిక" : "Sales Stock")}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {activeTab === "Purchasing"
              ? (lang === 'te' ? "కొనుగోళ్ల డేటా ఆధారంగా స్టాక్ నివేదికలను వీక్షించండి" : "View item stock calculated exclusively from purchasing data")
              : (lang === 'te' ? "అమ్మకాల డేటా ఆధారంగా అమ్మిన స్టాక్ నివేదికలను వీక్షించండి" : "View item quantities sold calculated exclusively from sales records")}
          </p>
        </div>

        {/* Date Selector & Action Buttons Container */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Date Selector */}
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

      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-sm font-medium">
          {lang === 'te' ? "డేటా లోడ్ అవుతోంది..." : "Loading stock data..."}
        </div>
      ) : activeTab === "Purchasing" ? (
        /* ==================== PURCHASING STOCK TAB ==================== */
        <>
          {/* DATE RANGE PURCHASING STOCK SECTION */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b pb-2">
              <Boxes className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">
                {lang === 'te' ? "ఎంచుకున్న కాలవ్యవధి కొనుగోళ్ల స్టాక్" : "Period Stock"}
              </h2>
              <span className="text-xs text-muted-foreground">
                ({startDate.split('-').reverse().join('-')} to {endDate.split('-').reverse().join('-')})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {purchasingItemNames.map((item) => {
                const qty = purchasingRangeStock[item] || 0
                return (
                  <div
                    key={`pur-range-${item}`}
                    className="bg-card p-5 rounded-2xl border shadow-sm flex flex-col justify-between hover:border-primary/50 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {getItemDisplayName(item, lang)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("purchasedQuantity", lang)}
                      </p>
                    </div>
                    <div className="mt-4 flex items-baseline justify-between">
                      <h3 className="text-2xl font-extrabold text-foreground">
                        {formatQuantity(qty)}
                      </h3>
                      <span className="text-xs font-medium text-slate-500 bg-muted px-2 py-0.5 rounded-full">
                        {getItemUnit(item, 'purchasing', shopUnitsMap)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* OVERALL PURCHASING STOCK SECTION */}
          <div className="space-y-4 pt-6">
            <div className="flex items-center space-x-2 border-b pb-2">
              <Boxes className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-bold text-foreground">
                {t("overallStock", lang)}
              </h2>
              <span className="text-xs text-muted-foreground">
                ({lang === 'te' ? "మొత్తం జీవితకాల సమాచారం" : "Lifetime purchased totals"})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {purchasingItemNames.map((item) => {
                const qty = purchasingOverallStock[item] || 0
                return (
                  <div
                    key={`pur-overall-${item}`}
                    className="bg-card p-5 rounded-2xl border shadow-sm flex flex-col justify-between hover:border-purple-500/50 transition-colors"
                  >
                    <div>
                      <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                        {getItemDisplayName(item, lang)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("purchasedQuantity", lang)}
                      </p>
                    </div>
                    <div className="mt-4 flex items-baseline justify-between">
                      <h3 className="text-2xl font-extrabold text-foreground">
                        {formatQuantity(qty)}
                      </h3>
                      <span className="text-xs font-medium text-purple-700 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-full">
                        {getItemUnit(item, 'purchasing', shopUnitsMap)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      ) : (
        /* ==================== SALES STOCK TAB ==================== */
        <>
          {/* DATE RANGE SALES STOCK SECTION */}
          <div className="space-y-6">
            <div className="flex items-center space-x-2 border-b pb-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">
                {t("periodSalesStock", lang)}
              </h2>
              <span className="text-xs text-muted-foreground">
                ({startDate.split('-').reverse().join('-')} to {endDate.split('-').reverse().join('-')})
              </span>
            </div>

            {hasNoSalesPeriodData ? (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex items-center space-x-3 text-amber-700 dark:text-amber-300 text-sm">
                <Info className="w-5 h-5 shrink-0 text-amber-600" />
                <span>
                  {t("noSalesDataAvailable", lang)}
                </span>
              </div>
            ) : (
              <div className="space-y-6">
                {getGroupedSalesItems(salesSoldItemNames, materialsList, lang).map((group) => (
                  <div key={`range-group-${group.key}`} className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        {group.displayName}
                      </h3>
                      <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full border">
                        {group.items.length} {group.items.length === 1 ? (lang === 'te' ? 'వస్తువు' : 'item') : (lang === 'te' ? 'వస్తువులు' : 'items')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                      {group.items.map((item) => {
                        const qty = salesRangeStock[item] || 0
                        return (
                          <div
                            key={`sale-range-${item}`}
                            className="bg-card p-5 rounded-2xl border shadow-sm flex flex-col justify-between hover:border-primary/50 transition-colors"
                          >
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {getItemDisplayName(item, lang)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {t("soldQuantity", lang)}
                              </p>
                            </div>
                            <div className="mt-4 flex items-baseline justify-between">
                              <h3 className="text-2xl font-extrabold text-foreground">
                                {formatQuantity(qty)}
                              </h3>
                              <span className="text-xs font-medium text-slate-500 bg-muted px-2 py-0.5 rounded-full">
                                {getItemUnit(item, 'sales', materialsList)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* OVERALL SALES STOCK SECTION */}
          <div className="space-y-6 pt-6">
            <div className="flex items-center space-x-2 border-b pb-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-bold text-foreground">
                {t("overallSalesStock", lang)}
              </h2>
              <span className="text-xs text-muted-foreground">
                ({lang === 'te' ? "మొత్తం జీవితకాల అమ్మకాల సమాచారం" : "Lifetime sales totals"})
              </span>
            </div>

            {salesSoldItemNames.length === 0 ? (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex items-center space-x-3 text-amber-700 dark:text-amber-300 text-sm">
                <Info className="w-5 h-5 shrink-0 text-amber-600" />
                <span>
                  {lang === 'te' ? "ఏ రికార్డులు కనుగొనబడలేదు." : "No sales records found."}
                </span>
              </div>
            ) : (
              <div className="space-y-6">
                {getGroupedSalesItems(salesSoldItemNames, materialsList, lang).map((group) => (
                  <div key={`overall-group-${group.key}`} className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        {group.displayName}
                      </h3>
                      <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                        {group.items.length} {group.items.length === 1 ? (lang === 'te' ? 'వస్తువు' : 'item') : (lang === 'te' ? 'వస్తువులు' : 'items')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                      {group.items.map((item) => {
                        const qty = salesOverallStock[item] || 0
                        return (
                          <div
                            key={`sale-overall-${item}`}
                            className="bg-card p-5 rounded-2xl border shadow-sm flex flex-col justify-between hover:border-purple-500/50 transition-colors"
                          >
                            <div>
                              <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                                {getItemDisplayName(item, lang)}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {t("soldQuantity", lang)}
                              </p>
                            </div>
                            <div className="mt-4 flex items-baseline justify-between">
                              <h3 className="text-2xl font-extrabold text-foreground">
                                {formatQuantity(qty)}
                              </h3>
                              <span className="text-xs font-medium text-purple-700 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-full">
                                {getItemUnit(item, 'sales', materialsList)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
