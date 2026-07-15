import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Employee, Attendance as AttendanceType } from "@/types/database"
import { Users, Calendar as CalendarIcon, ClipboardList, Plus, Edit2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useOutletContext } from "react-router-dom"
import { t } from "@/lib/i18n"

export function Workers() {
  const { lang } = useOutletContext<{ lang: "en" | "te" }>()
  
  const [activeTab, setActiveTab] = useState<"List" | "Attendance" | "Calendar">("List")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendance, setAttendance] = useState<AttendanceType[]>([])
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null)
  
  // Date context
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  
  // Popup state for Calendar attendance editing
  const [activePopup, setActivePopup] = useState<{empId: string, dateStr: string, x: number, y: number} | null>(null)
  
  // Employee Form
  const [formData, setFormData] = useState<Partial<Employee>>({
    name: "", name_te: "", mobile: "", role: "Worker", joining_date: new Date().toISOString().split('T')[0], status: "Active", daily_wage: 0
  })

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    if (activeTab === "Calendar") {
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
    try {
      if (editingEmp) {
        await supabase.from('employees').update(formData).eq('id', editingEmp.id)
        toast.success("Worker updated")
      } else {
        await supabase.from('employees').insert([formData])
        toast.success("Worker added")
      }
      setIsModalOpen(false)
      fetchEmployees()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const deleteEmployee = async (id: string) => {
    if (!confirm("Delete this worker?")) return
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
    toast.success("Attendance marked")
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{lang === "te" ? "పనివారు" : "Workers"}</h1>
      </div>

      <div className="flex border-b bg-card rounded-t-xl px-2 pt-2">
        <button onClick={() => setActiveTab("List")} className={`px-4 py-2 font-medium flex items-center gap-2 ${activeTab === 'List' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>
          <Users className="w-4 h-4" /> {lang === "te" ? "జాబితా" : "Employee List"}
        </button>
        <button onClick={() => setActiveTab("Attendance")} className={`px-4 py-2 font-medium flex items-center gap-2 ${activeTab === 'Attendance' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>
          <ClipboardList className="w-4 h-4" /> {lang === "te" ? "హాజరు" : "Daily Attendance"}
        </button>
        <button onClick={() => setActiveTab("Calendar")} className={`px-4 py-2 font-medium flex items-center gap-2 ${activeTab === 'Calendar' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>
          <CalendarIcon className="w-4 h-4" /> {lang === "te" ? "క్యాలెండర్" : "Monthly Calendar"}
        </button>
      </div>

      <div className="bg-card border rounded-b-xl shadow-sm p-6 min-h-[500px]">
        {/* LIST VIEW */}
        {activeTab === "List" && (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={() => { setEditingEmp(null); setFormData({name: "", name_te: "", mobile: "", role: "Worker", joining_date: new Date().toISOString().split('T')[0], status: "Active", daily_wage: 0}); setIsModalOpen(true); }} className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-primary/90">
                <Plus className="w-4 h-4" /> {t("addWorker", lang)}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3">{t("name", lang)}</th>
                    <th className="px-4 py-3">{t("mobile", lang)}</th>
                    <th className="px-4 py-3">{t("role", lang)}</th>
                    <th className="px-4 py-3">{t("joiningDate", lang)}</th>
                    <th className="px-4 py-3">{t("status", lang)}</th>
                    <th className="px-4 py-3 text-right">{t("actions", lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => (
                    <tr key={emp.id} className="border-b">
                      <td className="px-4 py-3 font-medium">{lang === 'te' && emp.name_te ? emp.name_te : emp.name}</td>
                      <td className="px-4 py-3">{emp.mobile || '-'}</td>
                      <td className="px-4 py-3">{emp.role}</td>
                      <td className="px-4 py-3">{emp.joining_date}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${emp.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{emp.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => { setEditingEmp(emp); setFormData(emp); setIsModalOpen(true); }} className="text-blue-600 hover:bg-blue-50 p-2 rounded mr-1"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => deleteEmployee(emp.id)} className="text-red-600 hover:bg-red-50 p-2 rounded"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DAILY ATTENDANCE VIEW */}
        {activeTab === "Attendance" && (
          <div>
            <div className="flex gap-4 mb-6">
              <input type="date" className="border p-2 rounded" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.filter(e => e.status === 'Active').map(emp => {
                const currentStatus = attendance.find(a => a.employee_id === emp.id)?.status
                return (
                  <div key={emp.id} className="border p-4 rounded-lg shadow-sm flex flex-col gap-3">
                    <div className="font-semibold text-lg">{lang === 'te' && emp.name_te ? emp.name_te : emp.name}</div>
                    <div className="flex gap-2">
                      <button onClick={() => markAttendance(emp.id, 'Present', selectedDate)} className={`flex-1 py-2 rounded text-sm font-medium ${currentStatus === 'Present' ? 'bg-green-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>Present</button>
                      <button onClick={() => markAttendance(emp.id, 'Absent', selectedDate)} className={`flex-1 py-2 rounded text-sm font-medium ${currentStatus === 'Absent' ? 'bg-red-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>Absent</button>
                      <button onClick={() => markAttendance(emp.id, 'Half Day', selectedDate)} className={`flex-1 py-2 rounded text-sm font-medium ${currentStatus === 'Half Day' ? 'bg-yellow-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>Half Day</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* CALENDAR VIEW */}
        {activeTab === "Calendar" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="px-4 py-2 border rounded hover:bg-muted">Previous</button>
              <h2 className="text-xl font-bold">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="px-4 py-2 border rounded hover:bg-muted">Next</button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr className="bg-muted">
                    <th className="border p-2 text-left sticky left-0 bg-muted z-10 min-w-[150px]">Employee</th>
                    {[...Array(daysInMonth)].map((_, i) => (
                      <th key={i} className="border p-1 w-8">{i + 1}</th>
                    ))}
                    <th className="border p-2">P</th>
                    <th className="border p-2">A</th>
                    <th className="border p-2">H</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => {
                    const stats = getStats(emp.id)
                    return (
                      <tr key={emp.id} className="hover:bg-muted/30">
                        <td className="border p-2 text-left font-medium sticky left-0 bg-card z-10">{lang === 'te' && emp.name_te ? emp.name_te : emp.name}</td>
                        {[...Array(daysInMonth)].map((_, i) => {
                          const status = getAttendanceForDate(emp.id, i + 1)
                          let color = ""
                          let label = ""
                          if (status === 'Present') { color = "bg-green-500 text-white"; label = "P" }
                          if (status === 'Absent') { color = "bg-red-500 text-white"; label = "A" }
                          if (status === 'Half Day') { color = "bg-yellow-500 text-white"; label = "H" }
                          
                          const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
                          
                          return (
                            <td key={i} className={`border p-0 cursor-pointer hover:opacity-80 transition-opacity ${color}`}
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
      </div>

      {/* CRUD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background w-full max-w-md rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold mb-4">{editingEmp ? t("editWorker", lang) : t("addWorker", lang)}</h2>
            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t("name", lang)} *</label>
                <input required type="text" className="w-full border p-2 rounded" value={formData.name || ""} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("nameTe", lang)}</label>
                <input type="text" className="w-full border p-2 rounded" value={formData.name_te || ""} onChange={e => setFormData({...formData, name_te: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("mobile", lang)}</label>
                <input type="text" className="w-full border p-2 rounded" value={formData.mobile || ""} onChange={e => setFormData({...formData, mobile: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("role", lang)}</label>
                  <input type="text" className="w-full border p-2 rounded" value={formData.role || ""} onChange={e => setFormData({...formData, role: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("joiningDate", lang)}</label>
                  <input type="date" className="w-full border p-2 rounded" value={formData.joining_date || ""} onChange={e => setFormData({...formData, joining_date: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("status", lang)}</label>
                <select className="w-full border p-2 rounded" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t("dailyWage", lang)} *</label>
                <input required type="number" className="w-full border p-2 rounded" value={formData.daily_wage || ""} onChange={e => setFormData({...formData, daily_wage: Number(e.target.value)})} />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded hover:bg-muted">{t("cancel", lang)}</button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">{t("save", lang)}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
