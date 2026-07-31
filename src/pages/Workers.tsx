import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Employee, Attendance as AttendanceType } from "@/types/database"
import { Users, Calendar as CalendarIcon, ClipboardList, Plus, Edit2, Trash2, IndianRupee, Download, Printer, FileSpreadsheet, Search } from "lucide-react"
import { toast } from "sonner"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"
import { formatDate } from "@/lib/utils"
import { generateTablePDF } from "@/lib/pdfTemplate"
import * as XLSX from "xlsx"

export function Workers() {
  const { lang } = useOutletContext<{ lang: "en" | "te" }>()
  
  const [activeTab, setActiveTab] = useState<"List" | "Attendance" | "Calendar" | "Salary">("List")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendance, setAttendance] = useState<AttendanceType[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null)
  
  // Date context
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  
  // Popup state for Calendar attendance editing
  const [activePopup, setActivePopup] = useState<{empId: string, dateStr: string, x: number, y: number} | null>(null)
  
  // Employee Form
  const [formData, setFormData] = useState<Partial<Employee>>({
    name: "", name_te: "", gender: "Gents", mobile: "", role: "Worker", joining_date: new Date().toISOString().split('T')[0], status: "Active", daily_wage: 0
  })

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    if (activeTab === "Calendar" || activeTab === "Salary") {
      fetchMonthAttendance()
    } else if (activeTab === "Attendance") {
      fetchDailyAttendance()
    }
  }, [activeTab, currentMonth, selectedDate])

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('*').order('name')
    if (data) setEmployees(data)
  }

  const fetchDailyAttendance = async () => {
    const { data } = await supabase.from('attendance').select('*').eq('date', selectedDate)
    if (data) setAttendance(data)
  }

  const fetchMonthAttendance = async () => {
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString().split('T')[0]
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).toISOString().split('T')[0]
    const { data } = await supabase.from('attendance').select('*').gte('date', start).lte('date', end)
    if (data) setAttendance(data)
  }

  // --- EMPLOYEE CRUD ---
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name?.trim()) return toast.error("Please enter worker name")
    if (!formData.gender) return toast.error("Please select gender")

    try {
      const payload = {
        name: formData.name,
        name_te: formData.name_te || "",
        gender: formData.gender || "Gents",
        mobile: formData.mobile || "",
        role: formData.role || "Worker",
        joining_date: formData.joining_date || new Date().toISOString().split('T')[0],
        daily_wage: Number(formData.daily_wage || 0),
        status: formData.status || "Active"
      }

      if (editingEmp) {
        await supabase.from('employees').update(payload).eq('id', editingEmp.id)
        toast.success(lang === 'te' ? "పనిమనిషి వివరాలు అప్‌డేట్ చేయబడ్డాయి" : "Worker updated")
      } else {
        await supabase.from('employees').insert([payload])
        toast.success(lang === 'te' ? "కొత్త పనిమనిషి జోడించబడ్డారు" : "Worker added")
      }
      setIsModalOpen(false)
      fetchEmployees()
    } catch (err: any) {
      toast.error(err.message || "Failed to save worker")
    }
  }

  const deleteEmployee = async (id: string) => {
    if (!confirm(lang === 'te' ? "ఈ పనిమనిషిని తొలగించాలనుకుంటున్నారా?" : "Delete this worker?")) return
    await supabase.from('employees').delete().eq('id', id)
    fetchEmployees()
  }

  const markAttendance = async (empId: string, status: string, date: string) => {
    const existing = attendance.find(a => a.employee_id === empId && a.date === date)
    if (existing) {
      await supabase.from('attendance').update({ status }).eq('id', existing.id)
    } else {
      await supabase.from('attendance').insert([{ employee_id: empId, date, status }])
    }
    toast.success(lang === 'te' ? "హాజరు నమోదయ్యాయి" : "Attendance marked")
    setActivePopup(null)
    if (activeTab === "Calendar") fetchMonthAttendance()
    else fetchDailyAttendance()
  }

  // --- CALENDAR LOGIC ---
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
  const daysInMonth = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth())
  
  const getAttendanceForDate = (empId: string, day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return attendance.find(a => a.employee_id === empId && a.date === dateStr)?.status
  }

  const getStats = (empId: string) => {
    const empAtt = attendance.filter(a => a.employee_id === empId)
    return {
      present: empAtt.filter(a => a.status === 'Present').length,
      absent: empAtt.filter(a => a.status === 'Absent').length,
      half: empAtt.filter(a => a.status === 'Half Day').length,
    }
  }

  // Helper filters
  const filteredEmployees = employees.filter(emp => {
    const nameStr = (emp.name || "").toLowerCase()
    const nameTeStr = (emp.name_te || "").toLowerCase()
    const mobileStr = (emp.mobile || "").toLowerCase()
    const roleStr = (emp.role || "").toLowerCase()
    const q = searchQuery.toLowerCase()
    return nameStr.includes(q) || nameTeStr.includes(q) || mobileStr.includes(q) || roleStr.includes(q)
  })

  const gentsList = filteredEmployees.filter(e => (e.gender || '').toLowerCase() !== 'ladies')
  const ladiesList = filteredEmployees.filter(e => (e.gender || '').toLowerCase() === 'ladies')

  // --- EXPORTS FOR CALENDAR ---
  const exportCalendarPDF = () => {
    const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })
    const dayCols = Array.from({ length: daysInMonth }, (_, i) => String(i + 1))
    const head = [['S.No.', 'Employee Name', 'Gender', ...dayCols, 'P', 'A', 'H']]
    
    const body = employees.map((emp, index) => {
      const stats = getStats(emp.id)
      const empName = lang === 'te' && emp.name_te ? emp.name_te : emp.name
      const genderLabel = (emp.gender || '').toLowerCase() === 'ladies' ? 'Ladies' : 'Gents'
      const rowData = [
        String(index + 1),
        empName,
        genderLabel
      ]
      for (let day = 1; day <= daysInMonth; day++) {
        const status = getAttendanceForDate(emp.id, day)
        let code = "-"
        if (status === 'Present') code = "P"
        if (status === 'Absent') code = "A"
        if (status === 'Half Day') code = "H"
        rowData.push(code)
      }
      rowData.push(String(stats.present), String(stats.absent), String(stats.half))
      return rowData
    })

    generateTablePDF({
      title: "ATTENDANCE CALENDAR",
      subHeader: lang === 'te' ? "విస్సాకోడేరు బ్రిడ్జ్ దగ్గర, భీమవరం[534201]." : "NEAR VISSAKODERU BRIDGE, BHIMAVARAM[534201].",
      filename: `Attendance_${monthName.replace(" ", "_")}.pdf`,
      metadata: [`Month: ${monthName}`],
      orientation: 'landscape',
      tableHead: head,
      tableBody: body
    }, 'download')
  }

  const exportCalendarExcel = () => {
    const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })
    const sheetData = employees.map((emp, index) => {
      const stats = getStats(emp.id)
      const empName = lang === 'te' && emp.name_te ? emp.name_te : emp.name
      const row: Record<string, any> = {
        "S.No.": index + 1,
        "Employee Name": empName,
        "Gender": (emp.gender || '').toLowerCase() === 'ladies' ? 'Ladies' : 'Gents'
      }
      for (let day = 1; day <= daysInMonth; day++) {
        const status = getAttendanceForDate(emp.id, day)
        let code = "-"
        if (status === 'Present') code = "P"
        if (status === 'Absent') code = "A"
        if (status === 'Half Day') code = "H"
        row[String(day)] = code
      }
      row["Present (P)"] = stats.present
      row["Absent (A)"] = stats.absent
      row["Half Day (H)"] = stats.half
      return row
    })

    const totalSalaryPayable = employees.reduce((sum, emp) => {
      const stats = getStats(emp.id)
      return sum + (stats.present + stats.half * 0.5) * Number(emp.daily_wage || 0)
    }, 0)

    sheetData.push({
      "S.No.": "",
      "Employee Name": "",
      "Gender": "",
      "Daily Salary (Rs)": "",
      "Present Days": "",
      "Half Days": "",
      "Absent Days": "Total",
      "Salary Payable (Rs)": `₹${totalSalaryPayable.toLocaleString('en-IN')}`
    })

    const ws = XLSX.utils.json_to_sheet(sheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Attendance")
    XLSX.writeFile(wb, `Attendance_${monthName.replace(" ", "_")}.xlsx`)
  }

  // --- EXPORTS FOR SALARY SHEET ---
  const exportSalaryPDF = () => {
    const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })
    const head = [['S.No.', 'Employee Name', 'Gender', 'Daily Salary', 'Present', 'Half Day', 'Absent', 'Salary Payable']]
    
    const body: any[][] = employees.map((emp, index) => {
      const stats = getStats(emp.id)
      const salaryPayable = (stats.present + stats.half * 0.5) * Number(emp.daily_wage || 0)
      const empName = lang === 'te' && emp.name_te ? emp.name_te : emp.name
      return [
        String(index + 1),
        empName,
        (emp.gender || '').toLowerCase() === 'ladies' ? 'Ladies' : 'Gents',
        `Rs ${Number(emp.daily_wage).toLocaleString('en-IN')}`,
        String(stats.present),
        String(stats.half),
        String(stats.absent),
        `Rs ${salaryPayable.toLocaleString('en-IN')}`
      ]
    })

    const totalSalaryPayable = employees.reduce((sum, emp) => {
      const stats = getStats(emp.id)
      const salaryPayable = (stats.present + stats.half * 0.5) * Number(emp.daily_wage || 0)
      return sum + salaryPayable
    }, 0)

    body.push([
      "",
      "",
      "",
      "",
      "",
      "",
      "Total",
      `Rs ${totalSalaryPayable.toLocaleString('en-IN')}`
    ])

    generateTablePDF({
      title: "SALARY SHEET",
      subHeader: lang === 'te' ? "విస్సాకోడేరు బ్రిడ్జ్ దగ్గర, భీమవరం[534201]." : "NEAR VISSAKODERU BRIDGE, BHIMAVARAM[534201].",
      filename: `Salary_Sheet_${monthName.replace(" ", "_")}.pdf`,
      metadata: [`Month: ${monthName}`],
      tableHead: head,
      tableBody: body
    }, 'download')
  }

  const exportSalaryExcel = () => {
    const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })
    const sheetData = employees.map((emp, index) => {
      const stats = getStats(emp.id)
      const salaryPayable = (stats.present + stats.half * 0.5) * Number(emp.daily_wage || 0)
      const empName = lang === 'te' && emp.name_te ? emp.name_te : emp.name
      return {
        "S.No.": index + 1,
        "Employee Name": empName,
        "Gender": (emp.gender || '').toLowerCase() === 'ladies' ? 'Ladies' : 'Gents',
        "Daily Salary (Rs)": Number(emp.daily_wage),
        "Present Days": stats.present,
        "Half Days": stats.half,
        "Absent Days": stats.absent,
        "Salary Payable (Rs)": salaryPayable
      }
    })

    const totalSalaryPayable = employees.reduce((sum, emp) => {
      const stats = getStats(emp.id)
      const salaryPayable = (stats.present + stats.half * 0.5) * Number(emp.daily_wage || 0)
      return sum + salaryPayable
    }, 0)

    sheetData.push({
      "S.No.": "TOTAL",
      "Employee Name": "",
      "Gender": "",
      "Daily Salary (Rs)": "",
      "Present Days": "",
      "Half Days": "",
      "Absent Days": "",
      "Salary Payable (Rs)": totalSalaryPayable
    } as any)

    const ws = XLSX.utils.json_to_sheet(sheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Salaries")
    XLSX.writeFile(wb, `Salary_Sheet_${monthName.replace(" ", "_")}.xlsx`)
  }

  const openAddModal = (defaultGender: 'Gents' | 'Ladies' = 'Gents') => {
    setEditingEmp(null)
    setFormData({
      name: "",
      name_te: "",
      gender: defaultGender,
      mobile: "",
      role: "Worker",
      joining_date: new Date().toISOString().split('T')[0],
      status: "Active",
      daily_wage: 0
    })
    setIsModalOpen(true)
  }

  const openEditModal = (emp: Employee) => {
    setEditingEmp(emp)
    setFormData({
      ...emp,
      gender: emp.gender || ((emp as any).gender === 'Ladies' ? 'Ladies' : 'Gents')
    })
    setIsModalOpen(true)
  }

  const renderWorkerTable = (list: Employee[], sectionTitle: string, genderTag: 'Gents' | 'Ladies') => (
    <div className="bg-card border rounded-2xl shadow-sm overflow-hidden space-y-3 p-4 md:p-5">
      <div className="flex justify-between items-center border-b pb-3">
        <div className="flex items-center space-x-2">
          <span className="text-xl">{genderTag === 'Gents' ? '👨' : '👩'}</span>
          <h2 className="text-lg font-bold text-foreground">
            {sectionTitle}
          </h2>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
            genderTag === 'Gents' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300'
          }`}>
            {list.length}
          </span>
        </div>
        <button 
          onClick={() => openAddModal(genderTag)} 
          className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          {lang === 'te' ? `+ ${genderTag === 'Gents' ? 'జెండ్స్' : 'లేడీస్'} జోడించు` : `+ Add ${genderTag}`}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-muted/70">
            <tr>
              <th className="px-4 py-3 w-14 font-semibold">S.No.</th>
              <th className="px-4 py-3 font-semibold">{t("name", lang)}</th>
              <th className="px-4 py-3 font-semibold">{t("gender", lang)}</th>
              <th className="px-4 py-3 font-semibold">{t("mobile", lang)}</th>
              <th className="px-4 py-3 font-semibold">{t("role", lang)}</th>
              <th className="px-4 py-3 font-semibold">{t("joiningDate", lang)}</th>
              <th className="px-4 py-3 font-semibold text-right">{lang === 'te' ? "రోజువారీ జీతం" : "Daily Salary"}</th>
              <th className="px-4 py-3 font-semibold text-center">{t("status", lang)}</th>
              <th className="px-4 py-3 text-right font-semibold">{t("actions", lang)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground text-xs">
                  {lang === 'te'
                    ? `ఏ ${genderTag === 'Gents' ? 'జెండ్స్' : 'లేడీస్'} పనివారు కనుగొనబడలేదు.`
                    : `No ${genderTag} workers found.`}
                </td>
              </tr>
            ) : (
              list.map((emp, index) => (
                <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3.5 text-muted-foreground font-medium">{index + 1}</td>
                  <td className="px-4 py-3.5 font-bold text-foreground">
                    {lang === 'te' && emp.name_te ? emp.name_te : emp.name}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                      (emp.gender || '').toLowerCase() === 'ladies' ? 'bg-pink-50 text-pink-700 border border-pink-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {(emp.gender || '').toLowerCase() === 'ladies' ? (lang === 'te' ? 'లేడీస్' : 'Ladies') : (lang === 'te' ? 'జెండ్స్' : 'Gents')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground font-medium">{emp.mobile || '-'}</td>
                  <td className="px-4 py-3.5 text-foreground">{emp.role}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{formatDate(emp.joining_date)}</td>
                  <td className="px-4 py-3.5 text-right font-extrabold text-foreground">
                    ₹{Number(emp.daily_wage || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      emp.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => openEditModal(emp)} 
                        className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 p-1.5 rounded-lg transition-colors"
                        title="Edit Worker"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteEmployee(emp.id)} 
                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 p-1.5 rounded-lg transition-colors"
                        title="Delete Worker"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Title & Top Search & Global Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            {lang === "te" ? "పనివారు" : "Workers"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lang === 'te' ? "జెండ్స్ మరియు లేడీస్ పనివారి వివరాలను నిర్వహించండి" : "Manage Gents and Ladies workers information, daily wages, and attendance"}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder={lang === 'te' ? "పనివారిని వెతకండి..." : "Search workers..."}
              className="pl-9 pr-4 py-2 w-full border rounded-xl text-xs bg-background focus:ring-2 focus:ring-primary/50 outline-none"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <button 
            onClick={() => openAddModal('Gents')} 
            className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-primary/90 transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" /> {t("addWorker", lang)}
          </button>
        </div>
      </div>

      {/* Sub-Tabs View Switcher */}
      <div className="flex border-b bg-card rounded-t-xl px-2 pt-2 flex-wrap">
        <button onClick={() => setActiveTab("List")} className={`px-4 py-2 font-medium flex items-center gap-2 ${activeTab === 'List' ? 'border-b-2 border-primary text-primary font-bold' : 'text-muted-foreground hover:text-foreground'}`}>
          <Users className="w-4 h-4" /> {lang === "te" ? "జాబితా" : "Worker List"}
        </button>
        <button onClick={() => setActiveTab("Attendance")} className={`px-4 py-2 font-medium flex items-center gap-2 ${activeTab === 'Attendance' ? 'border-b-2 border-primary text-primary font-bold' : 'text-muted-foreground hover:text-foreground'}`}>
          <ClipboardList className="w-4 h-4" /> {lang === "te" ? "హాజరు" : "Daily Attendance"}
        </button>
        <button onClick={() => setActiveTab("Calendar")} className={`px-4 py-2 font-medium flex items-center gap-2 ${activeTab === 'Calendar' ? 'border-b-2 border-primary text-primary font-bold' : 'text-muted-foreground hover:text-foreground'}`}>
          <CalendarIcon className="w-4 h-4" /> {lang === "te" ? "క్యాలెండర్" : "Monthly Calendar"}
        </button>
        <button onClick={() => setActiveTab("Salary")} className={`px-4 py-2 font-medium flex items-center gap-2 ${activeTab === 'Salary' ? 'border-b-2 border-primary text-primary font-bold' : 'text-muted-foreground hover:text-foreground'}`}>
          <IndianRupee className="w-4 h-4" /> {lang === "te" ? "జీతాలు" : "Salary Sheet"}
        </button>
      </div>

      <div className="bg-card border rounded-b-xl shadow-sm p-4 md:p-6 min-h-[500px]">
        {/* ==================== WORKER LIST VIEW (STACKED GENTS & LADIES SECTIONS) ==================== */}
        {activeTab === "List" && (
          <div className="space-y-8">
            {/* SECTION 1: GENTS WORKERS */}
            {renderWorkerTable(
              gentsList,
              lang === 'te' ? "జెండ్స్ పనివారు" : "Gents Workers",
              'Gents'
            )}

            {/* SECTION 2: LADIES WORKERS (IMMEDIATELY BELOW GENTS SECTION) */}
            {renderWorkerTable(
              ladiesList,
              lang === 'te' ? "లేడీస్ పనివారు" : "Ladies Workers",
              'Ladies'
            )}
          </div>
        )}

        {/* ==================== DAILY ATTENDANCE VIEW ==================== */}
        {activeTab === "Attendance" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-muted-foreground">{lang === 'te' ? "తేదీ ఎంచుకోండి:" : "Select Date:"}</label>
                <input type="date" className="border p-2 rounded-xl text-xs font-semibold bg-background" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
              </div>

              <div className="text-xs font-semibold text-muted-foreground">
                {lang === 'te' ? `మొత్తం పనివారు : ${filteredEmployees.filter(e => e.status === 'Active').length}` : `Total Active Workers : ${filteredEmployees.filter(e => e.status === 'Active').length}`}
              </div>
            </div>

            {/* GENTS DAILY ATTENDANCE SECTION */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 border-b pb-1">
                <span>👨</span> {lang === 'te' ? "జెండ్స్ పనివారు హాజరు" : "Gents Workers Attendance"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {gentsList.filter(e => e.status === 'Active').map((emp, index) => {
                  const currentStatus = attendance.find(a => a.employee_id === emp.id)?.status
                  return (
                    <div key={emp.id} className="border p-4 rounded-xl shadow-sm flex flex-col gap-3 bg-card hover:border-primary/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-base text-foreground">{lang === 'te' && emp.name_te ? emp.name_te : emp.name}</div>
                        <span className="text-xs text-muted-foreground font-bold">#{index + 1}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => markAttendance(emp.id, 'Present', selectedDate)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${currentStatus === 'Present' ? 'bg-green-600 text-white shadow-sm' : 'bg-muted hover:bg-muted/80 text-foreground'}`}>Present</button>
                        <button onClick={() => markAttendance(emp.id, 'Absent', selectedDate)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${currentStatus === 'Absent' ? 'bg-red-600 text-white shadow-sm' : 'bg-muted hover:bg-muted/80 text-foreground'}`}>Absent</button>
                        <button onClick={() => markAttendance(emp.id, 'Half Day', selectedDate)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${currentStatus === 'Half Day' ? 'bg-yellow-500 text-white shadow-sm' : 'bg-muted hover:bg-muted/80 text-foreground'}`}>Half Day</button>
                      </div>
                    </div>
                  )
                })}
                {gentsList.filter(e => e.status === 'Active').length === 0 && (
                  <div className="col-span-full py-4 text-center text-muted-foreground text-xs font-medium">No active Gents workers</div>
                )}
              </div>
            </div>

            {/* LADIES DAILY ATTENDANCE SECTION */}
            <div className="space-y-3 pt-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 border-b pb-1">
                <span>👩</span> {lang === 'te' ? "లేడీస్ పనివారు హాజరు" : "Ladies Workers Attendance"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ladiesList.filter(e => e.status === 'Active').map((emp, index) => {
                  const currentStatus = attendance.find(a => a.employee_id === emp.id)?.status
                  return (
                    <div key={emp.id} className="border p-4 rounded-xl shadow-sm flex flex-col gap-3 bg-card hover:border-pink-500/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-base text-foreground">{lang === 'te' && emp.name_te ? emp.name_te : emp.name}</div>
                        <span className="text-xs text-muted-foreground font-bold">#{index + 1}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => markAttendance(emp.id, 'Present', selectedDate)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${currentStatus === 'Present' ? 'bg-green-600 text-white shadow-sm' : 'bg-muted hover:bg-muted/80 text-foreground'}`}>Present</button>
                        <button onClick={() => markAttendance(emp.id, 'Absent', selectedDate)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${currentStatus === 'Absent' ? 'bg-red-600 text-white shadow-sm' : 'bg-muted hover:bg-muted/80 text-foreground'}`}>Absent</button>
                        <button onClick={() => markAttendance(emp.id, 'Half Day', selectedDate)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${currentStatus === 'Half Day' ? 'bg-yellow-500 text-white shadow-sm' : 'bg-muted hover:bg-muted/80 text-foreground'}`}>Half Day</button>
                      </div>
                    </div>
                  )
                })}
                {ladiesList.filter(e => e.status === 'Active').length === 0 && (
                  <div className="col-span-full py-4 text-center text-muted-foreground text-xs font-medium">No active Ladies workers</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== MONTHLY CALENDAR VIEW ==================== */}
        {activeTab === "Calendar" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b pb-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="px-4 py-2 border rounded-xl hover:bg-muted font-semibold text-xs transition-colors">Previous Month</button>
                <h2 className="text-lg font-bold min-w-[150px] text-center">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="px-4 py-2 border rounded-xl hover:bg-muted font-semibold text-xs transition-colors">Next Month</button>
              </div>

              {/* Exports */}
              <div className="flex gap-2">
                <button onClick={exportCalendarPDF} className="bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-xl text-xs flex items-center font-semibold shadow-sm transition-colors">
                  <Download className="w-4 h-4 mr-1.5" /> PDF
                </button>
                <button onClick={exportCalendarExcel} className="bg-green-600 hover:bg-green-700 text-white px-3.5 py-2 rounded-xl text-xs flex items-center font-semibold shadow-sm transition-colors">
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Excel
                </button>
                <button onClick={() => exportCalendarPDF()} className="border border-slate-300 bg-card hover:bg-muted px-3.5 py-2 rounded-xl text-xs flex items-center font-semibold shadow-sm transition-colors">
                  <Printer className="w-4 h-4 mr-1.5" /> Print
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto relative rounded-xl border max-h-[60vh]">
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr className="bg-muted sticky top-0 z-20">
                    <th className="border p-2 text-left sticky left-0 bg-muted z-30 min-w-[50px] w-12">S.No.</th>
                    <th className="border p-2 text-left sticky left-[48px] bg-muted z-30 min-w-[150px]">Employee</th>
                    <th className="border p-2">Gender</th>
                    {[...Array(daysInMonth)].map((_, i) => {
                      const isDayToday = currentMonth.getFullYear() === new Date().getFullYear() && currentMonth.getMonth() === new Date().getMonth() && (i + 1) === new Date().getDate()
                      return (
                        <th key={i} className={`border p-1 w-8 ${isDayToday ? 'bg-primary text-primary-foreground font-extrabold border-primary' : ''}`}>
                          {i + 1}
                        </th>
                      )
                    })}
                    <th className="border p-2">P</th>
                    <th className="border p-2">A</th>
                    <th className="border p-2">H</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp, index) => {
                    const stats = getStats(emp.id)
                    return (
                      <tr key={emp.id} className="hover:bg-muted/30">
                        <td className="border p-2 text-left text-muted-foreground sticky left-0 bg-card z-10 w-12">{index + 1}</td>
                        <td className="border p-2 text-left font-medium sticky left-[48px] bg-card z-10">{lang === 'te' && emp.name_te ? emp.name_te : emp.name}</td>
                        <td className="border p-2 text-muted-foreground font-semibold">{(emp.gender || '').toLowerCase() === 'ladies' ? 'Ladies' : 'Gents'}</td>
                        {[...Array(daysInMonth)].map((_, i) => {
                          const status = getAttendanceForDate(emp.id, i + 1)
                          let color = ""
                          let label = ""
                          if (status === 'Present') { color = "bg-green-500 text-white"; label = "P" }
                          if (status === 'Absent') { color = "bg-red-500 text-white"; label = "A" }
                          if (status === 'Half Day') { color = "bg-yellow-500 text-white"; label = "H" }
                          
                          const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
                          
                          const isDayToday = currentMonth.getFullYear() === new Date().getFullYear() && currentMonth.getMonth() === new Date().getMonth() && (i + 1) === new Date().getDate()

                          return (
                            <td key={i} className={`border p-0 cursor-pointer hover:opacity-80 transition-opacity ${color} ${isDayToday ? 'ring-2 ring-primary/80 ring-offset-1 font-bold' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const rect = (e.target as HTMLElement).getBoundingClientRect()
                                  setActivePopup({
                                    empId: emp.id,
                                    dateStr,
                                    x: rect.left + window.scrollX,
                                    y: rect.bottom + window.scrollY
                                  })
                                }}>
                              {label || "-"}
                            </td>
                          )
                        })}
                        <td className="border p-2 font-bold text-green-600">{stats.present}</td>
                        <td className="border p-2 font-bold text-red-600">{stats.absent}</td>
                        <td className="border p-2 font-bold text-yellow-600">{stats.half}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Present</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Absent</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-500 rounded-sm"></div> Half Day</span>
            </div>

            {/* Attendance Edit Popup */}
            {activePopup && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setActivePopup(null)}></div>
                <div 
                  className="absolute z-50 bg-white border shadow-lg rounded-md overflow-hidden flex flex-col w-32"
                  style={{ top: activePopup.y, left: activePopup.x }}
                >
                  <button 
                    onClick={() => markAttendance(activePopup.empId, 'Present', activePopup.dateStr)}
                    className="px-4 py-2 text-sm text-left hover:bg-green-50 text-green-700 flex items-center gap-2 border-b"
                  >
                    <div className="w-2 h-2 rounded-full bg-green-500"></div> Present
                  </button>
                  <button 
                    onClick={() => markAttendance(activePopup.empId, 'Absent', activePopup.dateStr)}
                    className="px-4 py-2 text-sm text-left hover:bg-red-50 text-red-700 flex items-center gap-2 border-b"
                  >
                    <div className="w-2 h-2 rounded-full bg-red-500"></div> Absent
                  </button>
                  <button 
                    onClick={() => markAttendance(activePopup.empId, 'Half Day', activePopup.dateStr)}
                    className="px-4 py-2 text-sm text-left hover:bg-yellow-50 text-yellow-700 flex items-center gap-2"
                  >
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div> Half Day
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ==================== SALARY SHEET VIEW ==================== */}
        {activeTab === "Salary" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b pb-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="px-4 py-2 border rounded-xl hover:bg-muted font-semibold text-xs transition-colors">Previous Month</button>
                <h2 className="text-lg font-bold min-w-[150px] text-center">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="px-4 py-2 border rounded-xl hover:bg-muted font-semibold text-xs transition-colors">Next Month</button>
              </div>

              <div className="flex gap-2">
                <button onClick={exportSalaryPDF} className="bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-xl text-xs flex items-center font-semibold shadow-sm transition-colors">
                  <Download className="w-4 h-4 mr-1.5" /> PDF
                </button>
                <button onClick={exportSalaryExcel} className="bg-green-600 hover:bg-green-700 text-white px-3.5 py-2 rounded-xl text-xs flex items-center font-semibold shadow-sm transition-colors">
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Excel
                </button>
                <button onClick={() => exportSalaryPDF()} className="border border-slate-300 bg-card hover:bg-muted px-3.5 py-2 rounded-xl text-xs flex items-center font-semibold shadow-sm transition-colors">
                  <Printer className="w-4 h-4 mr-1.5" /> Print
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border rounded-xl shadow-sm">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-muted/70">
                  <tr>
                    <th className="px-4 py-3 w-14 font-semibold">S.No.</th>
                    <th className="px-4 py-3 font-semibold">{t("name", lang)}</th>
                    <th className="px-4 py-3 font-semibold">{t("gender", lang)}</th>
                    <th className="px-4 py-3 font-semibold">{lang === 'te' ? "రోజువారీ జీతం" : "Daily Salary"}</th>
                    <th className="px-4 py-3 text-center font-semibold">Present</th>
                    <th className="px-4 py-3 text-center font-semibold">Half Day</th>
                    <th className="px-4 py-3 text-center font-semibold">Absent</th>
                    <th className="px-4 py-3 text-right font-semibold">{lang === 'te' ? "చెల్లించవలసిన జీతం" : "Salary Payable"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredEmployees.map((emp, index) => {
                    const stats = getStats(emp.id)
                    const payable = (stats.present + stats.half * 0.5) * Number(emp.daily_wage || 0)
                    return (
                      <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground font-medium">{index + 1}</td>
                        <td className="px-4 py-3 font-bold text-foreground">{lang === 'te' && emp.name_te ? emp.name_te : emp.name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            (emp.gender || '').toLowerCase() === 'ladies' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {(emp.gender || '').toLowerCase() === 'ladies' ? 'Ladies' : 'Gents'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold">₹{Number(emp.daily_wage || 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-center text-green-600 font-bold">{stats.present}</td>
                        <td className="px-4 py-3 text-center text-yellow-600 font-bold">{stats.half}</td>
                        <td className="px-4 py-3 text-center text-red-600 font-bold">{stats.absent}</td>
                        <td className="px-4 py-3 text-right font-extrabold text-green-700 text-base">₹{payable.toLocaleString('en-IN')}</td>
                      </tr>
                    )
                  })}
                  <tr className="bg-muted/50 font-bold border-t-2 border-slate-300">
                    <td className="px-4 py-3" colSpan={6}></td>
                    <td className="px-4 py-3 text-center font-bold">{lang === 'te' ? "మొత్తం చెల్లించవలసిన జీతం" : "Total Salary Payable"}</td>
                    <td className="px-4 py-3 text-right text-green-700 text-base font-extrabold">
                      ₹{filteredEmployees.reduce((sum, emp) => {
                        const stats = getStats(emp.id)
                        return sum + (stats.present + stats.half * 0.5) * Number(emp.daily_wage || 0)
                      }, 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ==================== ADD / EDIT WORKER MODAL WITH MANDATORY GENDER FIELD ==================== */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="p-5 border-b bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">
                {editingEmp ? (lang === 'te' ? "పనిమనిషి వివరాలను సవరించండి" : "Edit Worker Info") : (lang === 'te' ? "కొత్త పనిమనిషిని జోడించండి" : "Add New Worker")}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{t("name", lang)} (English) *</label>
                <input 
                  required 
                  type="text" 
                  className="w-full border p-2.5 rounded-xl text-sm font-semibold bg-background" 
                  value={formData.name || ""} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="e.g. Chinna Rao"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{t("nameTe", lang)} (తెలుగు)</label>
                <input 
                  type="text" 
                  className="w-full border p-2.5 rounded-xl text-sm font-semibold bg-background" 
                  value={formData.name_te || ""} 
                  onChange={e => setFormData({...formData, name_te: e.target.value})} 
                  placeholder="ఉదా. చిన్న రావు"
                />
              </div>

              {/* MANDATORY GENDER SELECTION FIELD */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  {t("gender", lang)} <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: 'Gents' })}
                    className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      formData.gender === 'Gents' || !formData.gender || formData.gender === 'gents'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-card hover:bg-muted text-foreground border-slate-300'
                    }`}
                  >
                    <span>👨</span> {t("gents", lang)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: 'Ladies' })}
                    className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      formData.gender === 'Ladies' || formData.gender === 'ladies'
                        ? 'bg-pink-600 text-white border-pink-600 shadow-sm'
                        : 'bg-card hover:bg-muted text-foreground border-slate-300'
                    }`}
                  >
                    <span>👩</span> {t("ladies", lang)}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{t("mobile", lang)}</label>
                <input 
                  type="text" 
                  className="w-full border p-2.5 rounded-xl text-sm font-semibold bg-background" 
                  value={formData.mobile || ""} 
                  onChange={e => setFormData({...formData, mobile: e.target.value})} 
                  placeholder="e.g. 9876543210"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">{t("role", lang)}</label>
                  <input 
                    type="text" 
                    className="w-full border p-2.5 rounded-xl text-sm font-semibold bg-background" 
                    value={formData.role || ""} 
                    onChange={e => setFormData({...formData, role: e.target.value})} 
                    placeholder="Worker / Loading"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">{t("joiningDate", lang)}</label>
                  <input 
                    type="date" 
                    className="w-full border p-2.5 rounded-xl text-sm font-semibold bg-background" 
                    value={formData.joining_date || ""} 
                    onChange={e => setFormData({...formData, joining_date: e.target.value})} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">{lang === 'te' ? "రోజువారీ జీతం (₹) *" : "Daily Salary (₹) *"}</label>
                  <input 
                    required 
                    type="number" 
                    className="w-full border p-2.5 rounded-xl text-sm font-semibold bg-background" 
                    value={formData.daily_wage || ""} 
                    onChange={e => setFormData({...formData, daily_wage: Number(e.target.value)})} 
                    placeholder="e.g. 500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">{t("status", lang)}</label>
                  <select 
                    className="w-full border p-2.5 rounded-xl text-sm font-semibold bg-background" 
                    value={formData.status} 
                    onChange={e => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 py-2.5 border rounded-xl font-semibold hover:bg-muted transition-colors text-sm"
                >
                  {t("cancel", lang)}
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors shadow-sm text-sm"
                >
                  {t("save", lang)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
