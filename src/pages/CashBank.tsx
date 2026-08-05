import { useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { 
  Wallet, 
  Building2, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Edit2, 
  Trash2, 
  Search, 
  FileText, 
  Printer, 
  Info,
  Calendar,
  CheckCircle2
} from "lucide-react"
import { toast } from "sonner"
import type { CashTransaction, BankAccount, BankTransaction } from "@/types/cashBank"
import {
  getCashTransactions,
  addCashTransaction,
  updateCashTransaction,
  deleteCashTransaction,
  getBankAccounts,
  addBankAccount,
  updateBankAccount,
  deleteBankAccount,
  getBankTransactions,
  addBankTransaction,
  updateBankTransaction,
  deleteBankTransaction
} from "@/lib/cashBankService"

const formatInr = (val: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0)
const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

const CATEGORY_OPTIONS = [
  "Sales",
  "Purchasing",
  "Salary",
  "Expense",
  "Capital Inflow",
  "Owner Withdrawal",
  "Transfer",
  "Interest",
  "Other"
]

export function CashBank() {
  const { lang } = useOutletContext<{ lang: "en" | "te" }>()

  const [activeTab, setActiveTab] = useState<"cash" | "bank" | "reports">("cash")
  
  // Data States
  const [cashTxList, setCashTxList] = useState<CashTransaction[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [bankTxList, setBankTxList] = useState<BankTransaction[]>([])
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("")

  const [search, setSearch] = useState("")

  // Modal States
  const [cashModalOpen, setCashModalOpen] = useState(false)
  const [editingCashTx, setEditingCashTx] = useState<CashTransaction | null>(null)
  const [cashFormData, setCashFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Received' as 'Received' | 'Paid',
    amount: '',
    category: 'Sales',
    customCategory: '',
    remarks: ''
  })

  const [bankAccModalOpen, setBankAccModalOpen] = useState(false)
  const [editingBankAcc, setEditingBankAcc] = useState<BankAccount | null>(null)
  const [bankAccFormData, setBankAccFormData] = useState({
    bank_name: '',
    account_nickname: '',
    account_number: '',
    opening_balance: ''
  })

  const [bankTxModalOpen, setBankTxModalOpen] = useState(false)
  const [editingBankTx, setEditingBankTx] = useState<BankTransaction | null>(null)
  const [bankTxFormData, setBankTxFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Credit' as 'Credit' | 'Debit',
    amount: '',
    category: 'Sales',
    customCategory: '',
    remarks: ''
  })

  // Date Range for Reports
  const todayStr = new Date().toISOString().split('T')[0]
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  const [reportStartDate, setReportStartDate] = useState(firstDayOfMonth)
  const [reportEndDate, setReportEndDate] = useState(todayStr)

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    try {
      const [cashData, bankAccs, bankTx] = await Promise.all([
        getCashTransactions(),
        getBankAccounts(),
        getBankTransactions()
      ])

      setCashTxList(cashData)
      setBankAccounts(bankAccs)
      setBankTxList(bankTx)

      if (bankAccs.length > 0 && !selectedBankAccountId) {
        setSelectedBankAccountId(bankAccs[0].id)
      }
    } catch (err) {
      toast.error("Failed to load Cash & Bank data")
    }
  }

  // Calculate Overall Summaries
  const totalCashReceived = cashTxList.filter(t => t.type === 'Received').reduce((sum, t) => sum + Number(t.amount || 0), 0)
  const totalCashPaid = cashTxList.filter(t => t.type === 'Paid').reduce((sum, t) => sum + Number(t.amount || 0), 0)
  const currentCashBalance = totalCashReceived - totalCashPaid

  const getAccountCalculations = (accId: string) => {
    const acc = bankAccounts.find(a => a.id === accId)
    const opening = Number(acc?.opening_balance || 0)
    const accTxs = bankTxList.filter(t => t.account_id === accId)
    const credits = accTxs.filter(t => t.type === 'Credit').reduce((sum, t) => sum + Number(t.amount || 0), 0)
    const debits = accTxs.filter(t => t.type === 'Debit').reduce((sum, t) => sum + Number(t.amount || 0), 0)
    const currentBalance = opening + credits - debits
    return { opening, credits, debits, currentBalance }
  }

  const totalBankBalance = bankAccounts.reduce((sum, acc) => {
    const { currentBalance } = getAccountCalculations(acc.id)
    return sum + currentBalance
  }, 0)

  const totalAvailableBalance = currentCashBalance + totalBankBalance

  // -------------------------------------------------------------
  // CASH HANDLERS
  // -------------------------------------------------------------
  const openCashModal = (tx?: CashTransaction) => {
    if (tx) {
      setEditingCashTx(tx)
      const isStandardCat = CATEGORY_OPTIONS.includes(tx.category)
      setCashFormData({
        date: tx.date,
        type: tx.type,
        amount: String(tx.amount),
        category: isStandardCat ? tx.category : 'Other',
        customCategory: isStandardCat ? '' : tx.category,
        remarks: tx.remarks || ''
      })
    } else {
      setEditingCashTx(null)
      setCashFormData({
        date: new Date().toISOString().split('T')[0],
        type: 'Received',
        amount: '',
        category: 'Sales',
        customCategory: '',
        remarks: ''
      })
    }
    setCashModalOpen(true)
  }

  const handleSaveCashTx = async () => {
    const amt = Number(cashFormData.amount)
    if (!amt || amt <= 0) return toast.error("Please enter a valid amount")

    const finalCategory = cashFormData.category === 'Other' && cashFormData.customCategory.trim() 
      ? cashFormData.customCategory.trim() 
      : cashFormData.category

    try {
      if (editingCashTx) {
        await updateCashTransaction(editingCashTx.id, {
          date: cashFormData.date,
          type: cashFormData.type,
          amount: amt,
          category: finalCategory,
          remarks: cashFormData.remarks
        })
        toast.success("Cash transaction updated")
      } else {
        await addCashTransaction({
          date: cashFormData.date,
          type: cashFormData.type,
          amount: amt,
          category: finalCategory,
          remarks: cashFormData.remarks
        })
        toast.success("Cash transaction added")
      }
      setCashModalOpen(false)
      loadAllData()
    } catch (err: any) {
      toast.error(err.message || "Failed to save cash transaction")
    }
  }

  const handleDeleteCashTx = async (id: string) => {
    if (!confirm("Are you sure you want to delete this cash transaction?")) return
    try {
      await deleteCashTransaction(id)
      toast.success("Cash transaction deleted")
      loadAllData()
    } catch (err: any) {
      toast.error("Failed to delete transaction")
    }
  }

  // -------------------------------------------------------------
  // BANK ACCOUNT HANDLERS
  // -------------------------------------------------------------
  const openBankAccModal = (acc?: BankAccount) => {
    if (acc) {
      setEditingBankAcc(acc)
      setBankAccFormData({
        bank_name: acc.bank_name,
        account_nickname: acc.account_nickname,
        account_number: acc.account_number || '',
        opening_balance: String(acc.opening_balance)
      })
    } else {
      setEditingBankAcc(null)
      setBankAccFormData({
        bank_name: '',
        account_nickname: '',
        account_number: '',
        opening_balance: '0'
      })
    }
    setBankAccModalOpen(true)
  }

  const handleSaveBankAcc = async () => {
    if (!bankAccFormData.bank_name.trim()) return toast.error("Please enter bank name")
    if (!bankAccFormData.account_nickname.trim()) return toast.error("Please enter account nickname")

    try {
      if (editingBankAcc) {
        await updateBankAccount(editingBankAcc.id, {
          bank_name: bankAccFormData.bank_name,
          account_nickname: bankAccFormData.account_nickname,
          account_number: bankAccFormData.account_number,
          opening_balance: Number(bankAccFormData.opening_balance || 0)
        })
        toast.success("Bank account updated")
      } else {
        const created = await addBankAccount({
          bank_name: bankAccFormData.bank_name,
          account_nickname: bankAccFormData.account_nickname,
          account_number: bankAccFormData.account_number,
          opening_balance: Number(bankAccFormData.opening_balance || 0)
        })
        setSelectedBankAccountId(created.id)
        toast.success("Bank account created")
      }
      setBankAccModalOpen(false)
      loadAllData()
    } catch (err: any) {
      toast.error("Failed to save bank account")
    }
  }

  const handleDeleteBankAcc = async (id: string) => {
    if (!confirm("Deleting this bank account will also delete all associated transactions. Continue?")) return
    try {
      await deleteBankAccount(id)
      toast.success("Bank account deleted")
      setSelectedBankAccountId("")
      loadAllData()
    } catch (err) {
      toast.error("Failed to delete bank account")
    }
  }

  // -------------------------------------------------------------
  // BANK TRANSACTION HANDLERS
  // -------------------------------------------------------------
  const openBankTxModal = (tx?: BankTransaction) => {
    if (!selectedBankAccountId) return toast.error("Please create or select a bank account first")
    if (tx) {
      setEditingBankTx(tx)
      const isStandardCat = CATEGORY_OPTIONS.includes(tx.category)
      setBankTxFormData({
        date: tx.date,
        type: tx.type,
        amount: String(tx.amount),
        category: isStandardCat ? tx.category : 'Other',
        customCategory: isStandardCat ? '' : tx.category,
        remarks: tx.remarks || ''
      })
    } else {
      setEditingBankTx(null)
      setBankTxFormData({
        date: new Date().toISOString().split('T')[0],
        type: 'Credit',
        amount: '',
        category: 'Sales',
        customCategory: '',
        remarks: ''
      })
    }
    setBankTxModalOpen(true)
  }

  const handleSaveBankTx = async () => {
    if (!selectedBankAccountId) return toast.error("No bank account selected")
    const amt = Number(bankTxFormData.amount)
    if (!amt || amt <= 0) return toast.error("Please enter a valid amount")

    const finalCategory = bankTxFormData.category === 'Other' && bankTxFormData.customCategory.trim() 
      ? bankTxFormData.customCategory.trim() 
      : bankTxFormData.category

    try {
      if (editingBankTx) {
        await updateBankTransaction(editingBankTx.id, {
          date: bankTxFormData.date,
          type: bankTxFormData.type,
          amount: amt,
          category: finalCategory,
          remarks: bankTxFormData.remarks
        })
        toast.success("Bank transaction updated")
      } else {
        await addBankTransaction({
          account_id: selectedBankAccountId,
          date: bankTxFormData.date,
          type: bankTxFormData.type,
          amount: amt,
          category: finalCategory,
          remarks: bankTxFormData.remarks
        })
        toast.success("Bank transaction added")
      }
      setBankTxModalOpen(false)
      loadAllData()
    } catch (err: any) {
      toast.error("Failed to save bank transaction")
    }
  }

  const handleDeleteBankTx = async (id: string) => {
    if (!confirm("Are you sure you want to delete this bank transaction?")) return
    try {
      await deleteBankTransaction(id)
      toast.success("Bank transaction deleted")
      loadAllData()
    } catch (err) {
      toast.error("Failed to delete transaction")
    }
  }

  // Filtered Cash Tx List
  const filteredCashTx = cashTxList.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.category.toLowerCase().includes(q) ||
      (t.remarks && t.remarks.toLowerCase().includes(q)) ||
      t.type.toLowerCase().includes(q) ||
      t.amount.toString().includes(q)
    )
  })

  // Selected Bank Account & Tx List
  const selectedAccount = bankAccounts.find(a => a.id === selectedBankAccountId)
  const selectedAccCalcs = selectedBankAccountId ? getAccountCalculations(selectedBankAccountId) : { opening: 0, credits: 0, debits: 0, currentBalance: 0 }
  const filteredBankTx = bankTxList.filter(t => t.account_id === selectedBankAccountId).filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.category.toLowerCase().includes(q) ||
      (t.remarks && t.remarks.toLowerCase().includes(q)) ||
      t.type.toLowerCase().includes(q) ||
      t.amount.toString().includes(q)
    )
  })

  // -------------------------------------------------------------
  // REPORT CALCULATIONS
  // -------------------------------------------------------------
  const reportCashTx = cashTxList.filter(t => t.date >= reportStartDate && t.date <= reportEndDate)
  const reportCashReceived = reportCashTx.filter(t => t.type === 'Received').reduce((sum, t) => sum + Number(t.amount || 0), 0)
  const reportCashPaid = reportCashTx.filter(t => t.type === 'Paid').reduce((sum, t) => sum + Number(t.amount || 0), 0)
  const reportCashBalance = reportCashReceived - reportCashPaid

  const reportBankTx = bankTxList.filter(t => t.date >= reportStartDate && t.date <= reportEndDate)
  const reportBankCredits = reportBankTx.filter(t => t.type === 'Credit').reduce((sum, t) => sum + Number(t.amount || 0), 0)
  const reportBankDebits = reportBankTx.filter(t => t.type === 'Debit').reduce((sum, t) => sum + Number(t.amount || 0), 0)

  const handlePrintReport = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap justify-between items-center gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{lang === 'te' ? "నగదు & బ్యాంక్" : "Cash & Bank"}</h1>
            <span className="bg-amber-100 text-amber-800 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider border border-amber-300 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" /> TRIAL FEATURE (MANUAL ONLY)
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {lang === 'te' 
              ? "నగదు మరియు బ్యాంక్ రికార్డులను మ్యాన్యువల్ గా నిర్వహించండి. (మరే ఇతర మాడ్యూల్ నూ ప్రభావితం చేయదు)"
              : "Independent evaluation module for manual Cash & Bank account tracking."}
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {activeTab === 'cash' && (
            <button
              onClick={() => openCashModal()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold flex items-center shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" /> {lang === 'te' ? "నగదు లావాదేవీని జోడించండి" : "Add Cash Transaction"}
            </button>
          )}

          {activeTab === 'bank' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openBankAccModal()}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 border px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center transition-colors"
              >
                <Building2 className="w-4 h-4 mr-1.5" /> {lang === 'te' ? "కొత్త బ్యాంక్ ఖాతా" : "Add Bank Account"}
              </button>
              {selectedBankAccountId && (
                <button
                  onClick={() => openBankTxModal()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold flex items-center shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> {lang === 'te' ? "బ్యాంక్ లావాదేవీని జోడించండి" : "Add Bank Transaction"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* OVERALL DASHBOARD SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Cash Balance */}
        <div className="bg-card border rounded-xl p-4 shadow-sm space-y-1 relative overflow-hidden">
          <div className="flex justify-between items-center text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <span>{lang === 'te' ? "నగదు నిల్వ" : "Cash Balance"}</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600">₹{formatInr(currentCashBalance)}</div>
          <div className="text-[11px] text-muted-foreground flex justify-between pt-1 border-t">
            <span>In: ₹{formatInr(totalCashReceived)}</span>
            <span>Out: ₹{formatInr(totalCashPaid)}</span>
          </div>
        </div>

        {/* Bank Balance */}
        <div className="bg-card border rounded-xl p-4 shadow-sm space-y-1 relative overflow-hidden">
          <div className="flex justify-between items-center text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <span>{lang === 'te' ? "మొత్తం బ్యాంక్ నిల్వ" : "Total Bank Balance"}</span>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-blue-600">₹{formatInr(totalBankBalance)}</div>
          <div className="text-[11px] text-muted-foreground pt-1 border-t">
            <span>{bankAccounts.length} {lang === 'te' ? "బ్యాంక్ ఖాతాలు" : "Active Bank Accounts"}</span>
          </div>
        </div>

        {/* Total Available Balance */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 shadow-sm space-y-1 relative overflow-hidden">
          <div className="flex justify-between items-center text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <span>{lang === 'te' ? "మొత్తం అందుబాటులో ఉన్న నిల్వ" : "Total Available Balance"}</span>
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-primary">₹{formatInr(totalAvailableBalance)}</div>
          <div className="text-[11px] text-muted-foreground pt-1 border-t font-medium">
            <span>Cash + Bank Accounts Total</span>
          </div>
        </div>
      </div>

      {/* MAIN NAVIGATION TABS */}
      <div className="flex border-b space-x-4">
        <button
          onClick={() => setActiveTab('cash')}
          className={`pb-3 px-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'cash' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Wallet className="w-4 h-4" /> {lang === 'te' ? "నగదు ఖాతా" : "Cash Tab"}
        </button>

        <button
          onClick={() => setActiveTab('bank')}
          className={`pb-3 px-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'bank' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="w-4 h-4" /> {lang === 'te' ? "బ్యాంక్ ఖాతాలు" : "Bank Accounts Tab"}
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 px-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'reports' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="w-4 h-4" /> {lang === 'te' ? "నివేదికలు" : "Reports"}
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* CASH TAB CONTENT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'cash' && (
        <div className="space-y-4">
          {/* Search / Filter Bar */}
          <div className="flex justify-between items-center gap-4 bg-card p-3 rounded-lg border shadow-sm">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={lang === 'te' ? "నగదు లావాదేవీలను శోధించండి..." : "Search category, remarks, amount..."}
                className="w-full pl-9 pr-3 py-1.5 border rounded-md text-sm bg-background"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="text-xs text-muted-foreground font-medium">
              Showing {filteredCashTx.length} transactions
            </div>
          </div>

          {/* Cash Transactions Table */}
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground font-bold border-b text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 w-12">#</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Remarks</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCashTx.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No cash transactions found. Click "Add Cash Transaction" to create one.
                      </td>
                    </tr>
                  ) : (
                    filteredCashTx.map((tx, idx) => (
                      <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold">{formatDate(tx.date)}</td>
                        <td className="px-4 py-3">
                          {tx.type === 'Received' ? (
                            <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                              <ArrowDownLeft className="w-3.5 h-3.5" /> Received
                            </span>
                          ) : (
                            <span className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                              <ArrowUpRight className="w-3.5 h-3.5" /> Paid
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">{tx.category}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{tx.remarks || '-'}</td>
                        <td className={`px-4 py-3 text-right font-extrabold ${tx.type === 'Received' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.type === 'Received' ? '+' : '-'}₹{formatInr(tx.amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => openCashModal(tx)}
                              className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCashTx(tx.id)}
                              className="p-1 text-slate-500 hover:text-red-600 rounded hover:bg-slate-100"
                              title="Delete"
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
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* BANK ACCOUNTS TAB CONTENT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'bank' && (
        <div className="space-y-6">
          {/* Bank Accounts Grid Selector */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                {lang === 'te' ? "బ్యాంక్ ఖాతాలు" : "Select Bank Account"}
              </h2>
              <button
                onClick={() => openBankAccModal()}
                className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> {lang === 'te' ? "కొత్త ఖాతాను సృష్టించండి" : "Create New Bank Account"}
              </button>
            </div>

            {bankAccounts.length === 0 ? (
              <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
                No bank accounts found. Click "Add Bank Account" to create your first bank account (e.g. SBI, HDFC).
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {bankAccounts.map(acc => {
                  const isSelected = acc.id === selectedBankAccountId
                  const calcs = getAccountCalculations(acc.id)
                  return (
                    <div
                      key={acc.id}
                      onClick={() => setSelectedBankAccountId(acc.id)}
                      className={`cursor-pointer border rounded-xl p-4 transition-all relative ${
                        isSelected 
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-md' 
                          : 'bg-card hover:border-slate-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-extrabold text-base block text-foreground">{acc.account_nickname}</span>
                          <span className="text-xs text-muted-foreground">{acc.bank_name} {acc.account_number ? `(${acc.account_number})` : ''}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); openBankAccModal(acc) }}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteBankAcc(acc.id) }}
                            className="p-1 text-slate-400 hover:text-red-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t flex justify-between items-end">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Balance</span>
                          <span className="text-lg font-extrabold text-blue-600">₹{formatInr(calcs.currentBalance)}</span>
                        </div>
                        <div className="text-[11px] text-right text-muted-foreground font-medium">
                          <div>Opening: ₹{formatInr(calcs.opening)}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Selected Bank Account Details & Transactions */}
          {selectedAccount && (
            <div className="space-y-4 pt-2 border-t">
              <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 flex flex-wrap justify-between items-center gap-3">
                <div>
                  <div className="text-xs font-bold text-blue-900 uppercase tracking-wider">Active Bank Account Details</div>
                  <div className="text-lg font-bold text-blue-950">{selectedAccount.account_nickname} ({selectedAccount.bank_name})</div>
                </div>

                <div className="flex gap-6 text-xs font-semibold">
                  <div>
                    <span className="text-muted-foreground block">Opening Balance</span>
                    <span className="text-sm font-bold text-slate-800">₹{formatInr(selectedAccCalcs.opening)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Total Credits (+)</span>
                    <span className="text-sm font-bold text-emerald-600">₹{formatInr(selectedAccCalcs.credits)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Total Debits (-)</span>
                    <span className="text-sm font-bold text-rose-600">₹{formatInr(selectedAccCalcs.debits)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Current Balance</span>
                    <span className="text-base font-extrabold text-blue-700">₹{formatInr(selectedAccCalcs.currentBalance)}</span>
                  </div>
                </div>
              </div>

              {/* Transactions Table for selected account */}
              <div className="flex justify-between items-center gap-4 bg-card p-3 rounded-lg border shadow-sm">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder={lang === 'te' ? "బ్యాంక్ లావాదేవీలను శోధించండి..." : "Search category, remarks, amount..."}
                    className="w-full pl-9 pr-3 py-1.5 border rounded-md text-sm bg-background"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => openBankTxModal()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Transaction
                </button>
              </div>

              <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground font-bold border-b text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 w-12">#</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Remarks</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-center w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredBankTx.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                            No transactions recorded for this bank account yet. Click "Add Transaction" to create one.
                          </td>
                        </tr>
                      ) : (
                        filteredBankTx.map((tx, idx) => (
                          <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                            <td className="px-4 py-3 font-semibold">{formatDate(tx.date)}</td>
                            <td className="px-4 py-3">
                              {tx.type === 'Credit' ? (
                                <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <ArrowDownLeft className="w-3.5 h-3.5" /> Credit
                                </span>
                              ) : (
                                <span className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-xs font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                  <ArrowUpRight className="w-3.5 h-3.5" /> Debit
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-medium">{tx.category}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{tx.remarks || '-'}</td>
                            <td className={`px-4 py-3 text-right font-extrabold ${tx.type === 'Credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {tx.type === 'Credit' ? '+' : '-'}₹{formatInr(tx.amount)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center gap-1">
                                <button
                                  onClick={() => openBankTxModal(tx)}
                                  className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteBankTx(tx.id)}
                                  className="p-1 text-slate-500 hover:text-red-600 rounded hover:bg-slate-100"
                                  title="Delete"
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
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* REPORTS TAB CONTENT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-bold">{lang === 'te' ? "తేదీ శ్రేణి:" : "Date Range:"}</span>
              <input
                type="date"
                className="border p-2 rounded-md text-sm bg-background"
                value={reportStartDate}
                onChange={e => setReportStartDate(e.target.value)}
              />
              <span className="text-muted-foreground">-</span>
              <input
                type="date"
                className="border p-2 rounded-md text-sm bg-background"
                value={reportEndDate}
                onChange={e => setReportEndDate(e.target.value)}
              />
            </div>

            <button
              onClick={handlePrintReport}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 border px-4 py-2 rounded-lg text-sm font-semibold flex items-center transition-colors"
            >
              <Printer className="w-4 h-4 mr-1.5" /> Print Report
            </button>
          </div>

          {/* Cash Summary Report Card */}
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" /> Cash Report Summary
              </h2>
              <span className="text-xs text-muted-foreground font-medium">{formatDate(reportStartDate)} to {formatDate(reportEndDate)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 space-y-1">
                <div className="text-xs font-bold text-emerald-800 uppercase">Total Received</div>
                <div className="text-xl font-extrabold text-emerald-700">₹{formatInr(reportCashReceived)}</div>
              </div>
              <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 space-y-1">
                <div className="text-xs font-bold text-rose-800 uppercase">Total Paid</div>
                <div className="text-xl font-extrabold text-rose-700">₹{formatInr(reportCashPaid)}</div>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border space-y-1">
                <div className="text-xs font-bold text-slate-700 uppercase">Period Cash Balance</div>
                <div className="text-xl font-extrabold text-primary">₹{formatInr(reportCashBalance)}</div>
              </div>
            </div>
          </div>

          {/* Bank Accounts Report Card */}
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" /> Bank Accounts Report Summary
              </h2>
              <span className="text-xs text-muted-foreground font-medium">{formatDate(reportStartDate)} to {formatDate(reportEndDate)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 space-y-1">
                <div className="text-xs font-bold text-emerald-800 uppercase">Period Credits</div>
                <div className="text-xl font-extrabold text-emerald-700">₹{formatInr(reportBankCredits)}</div>
              </div>
              <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 space-y-1">
                <div className="text-xs font-bold text-rose-800 uppercase">Period Debits</div>
                <div className="text-xl font-extrabold text-rose-700">₹{formatInr(reportBankDebits)}</div>
              </div>
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 space-y-1">
                <div className="text-xs font-bold text-blue-800 uppercase">Total Closing Bank Balance</div>
                <div className="text-xl font-extrabold text-blue-700">₹{formatInr(totalBankBalance)}</div>
              </div>
            </div>

            {/* Per Bank Breakdown */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 font-bold border-b text-xs uppercase">
                  <tr>
                    <th className="p-3">Bank Account</th>
                    <th className="p-3 text-right">Opening</th>
                    <th className="p-3 text-right">Period Credits</th>
                    <th className="p-3 text-right">Period Debits</th>
                    <th className="p-3 text-right">Closing Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bankAccounts.map(acc => {
                    const calcs = getAccountCalculations(acc.id)
                    const pTx = bankTxList.filter(t => t.account_id === acc.id && t.date >= reportStartDate && t.date <= reportEndDate)
                    const pCredits = pTx.filter(t => t.type === 'Credit').reduce((sum, t) => sum + Number(t.amount || 0), 0)
                    const pDebits = pTx.filter(t => t.type === 'Debit').reduce((sum, t) => sum + Number(t.amount || 0), 0)
                    return (
                      <tr key={acc.id}>
                        <td className="p-3 font-semibold">{acc.account_nickname} ({acc.bank_name})</td>
                        <td className="p-3 text-right text-muted-foreground">₹{formatInr(calcs.opening)}</td>
                        <td className="p-3 text-right text-emerald-600 font-bold">+₹{formatInr(pCredits)}</td>
                        <td className="p-3 text-right text-rose-600 font-bold">-₹{formatInr(pDebits)}</td>
                        <td className="p-3 text-right font-extrabold text-blue-600">₹{formatInr(calcs.currentBalance)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CASH TRANSACTION MODAL */}
      {/* ------------------------------------------------------------- */}
      {cashModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-xl font-bold">{editingCashTx ? 'Edit Cash Transaction' : 'Add Cash Transaction'}</h2>
              <button onClick={() => setCashModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Date *</label>
                <input
                  type="date"
                  className="w-full border p-2 rounded text-sm bg-background font-medium"
                  value={cashFormData.date}
                  onChange={e => setCashFormData({ ...cashFormData, date: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Transaction Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCashFormData({ ...cashFormData, type: 'Received' })}
                    className={`py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 border transition-colors ${
                      cashFormData.type === 'Received' 
                        ? 'bg-emerald-600 text-white border-emerald-600' 
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4" /> Cash Received (In)
                  </button>

                  <button
                    type="button"
                    onClick={() => setCashFormData({ ...cashFormData, type: 'Paid' })}
                    className={`py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 border transition-colors ${
                      cashFormData.type === 'Paid' 
                        ? 'bg-rose-600 text-white border-rose-600' 
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" /> Cash Paid (Out)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border p-2.5 rounded-lg text-lg font-bold bg-background"
                  placeholder="0.00"
                  value={cashFormData.amount}
                  onChange={e => setCashFormData({ ...cashFormData, amount: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Category *</label>
                <select
                  className="w-full border p-2.5 rounded-lg text-sm bg-background font-medium mb-2"
                  value={cashFormData.category}
                  onChange={e => setCashFormData({ ...cashFormData, category: e.target.value })}
                >
                  {CATEGORY_OPTIONS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                {cashFormData.category === 'Other' && (
                  <input
                    type="text"
                    placeholder="Enter custom category name..."
                    className="w-full border p-2.5 rounded-lg text-sm bg-background"
                    value={cashFormData.customCategory}
                    onChange={e => setCashFormData({ ...cashFormData, customCategory: e.target.value })}
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Remarks / Note</label>
                <textarea
                  className="w-full border p-2 rounded text-sm bg-background"
                  rows={2}
                  placeholder="Optional details or description..."
                  value={cashFormData.remarks}
                  onChange={e => setCashFormData({ ...cashFormData, remarks: e.target.value })}
                />
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setCashModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCashTx}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 shadow-sm"
              >
                Save Cash Transaction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* BANK ACCOUNT MODAL */}
      {/* ------------------------------------------------------------- */}
      {bankAccModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-xl font-bold">{editingBankAcc ? 'Edit Bank Account' : 'Add Bank Account'}</h2>
              <button onClick={() => setBankAccModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Bank Name *</label>
                <input
                  type="text"
                  placeholder="e.g. State Bank of India, HDFC Bank, ICICI"
                  className="w-full border p-2.5 rounded-lg text-sm bg-background font-medium"
                  value={bankAccFormData.bank_name}
                  onChange={e => setBankAccFormData({ ...bankAccFormData, bank_name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Account Nickname *</label>
                <input
                  type="text"
                  placeholder="e.g. SBI Main, HDFC Current, ICICI Savings"
                  className="w-full border p-2.5 rounded-lg text-sm bg-background font-medium"
                  value={bankAccFormData.account_nickname}
                  onChange={e => setBankAccFormData({ ...bankAccFormData, account_nickname: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Account Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. ****4321"
                  className="w-full border p-2.5 rounded-lg text-sm bg-background"
                  value={bankAccFormData.account_number}
                  onChange={e => setBankAccFormData({ ...bankAccFormData, account_number: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Opening Balance (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border p-2.5 rounded-lg text-lg font-bold bg-background"
                  placeholder="0.00"
                  value={bankAccFormData.opening_balance}
                  onChange={e => setBankAccFormData({ ...bankAccFormData, opening_balance: e.target.value })}
                />
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setBankAccModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBankAcc}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 shadow-sm"
              >
                Save Bank Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* BANK TRANSACTION MODAL */}
      {/* ------------------------------------------------------------- */}
      {bankTxModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="p-5 border-b bg-slate-50 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{editingBankTx ? 'Edit Bank Transaction' : 'Add Bank Transaction'}</h2>
                <p className="text-xs text-muted-foreground">{selectedAccount?.account_nickname} ({selectedAccount?.bank_name})</p>
              </div>
              <button onClick={() => setBankTxModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Date *</label>
                <input
                  type="date"
                  className="w-full border p-2 rounded text-sm bg-background font-medium"
                  value={bankTxFormData.date}
                  onChange={e => setBankTxFormData({ ...bankTxFormData, date: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Transaction Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBankTxFormData({ ...bankTxFormData, type: 'Credit' })}
                    className={`py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 border transition-colors ${
                      bankTxFormData.type === 'Credit' 
                        ? 'bg-emerald-600 text-white border-emerald-600' 
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4" /> Credit (Deposit / In)
                  </button>

                  <button
                    type="button"
                    onClick={() => setBankTxFormData({ ...bankTxFormData, type: 'Debit' })}
                    className={`py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 border transition-colors ${
                      bankTxFormData.type === 'Debit' 
                        ? 'bg-rose-600 text-white border-rose-600' 
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4" /> Debit (Withdrawal / Out)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border p-2.5 rounded-lg text-lg font-bold bg-background"
                  placeholder="0.00"
                  value={bankTxFormData.amount}
                  onChange={e => setBankTxFormData({ ...bankTxFormData, amount: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Category *</label>
                <select
                  className="w-full border p-2.5 rounded-lg text-sm bg-background font-medium mb-2"
                  value={bankTxFormData.category}
                  onChange={e => setBankTxFormData({ ...bankTxFormData, category: e.target.value })}
                >
                  {CATEGORY_OPTIONS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                {bankTxFormData.category === 'Other' && (
                  <input
                    type="text"
                    placeholder="Enter custom category name..."
                    className="w-full border p-2.5 rounded-lg text-sm bg-background"
                    value={bankTxFormData.customCategory}
                    onChange={e => setBankTxFormData({ ...bankTxFormData, customCategory: e.target.value })}
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Remarks / Note</label>
                <textarea
                  className="w-full border p-2 rounded text-sm bg-background"
                  rows={2}
                  placeholder="Optional details or description..."
                  value={bankTxFormData.remarks}
                  onChange={e => setBankTxFormData({ ...bankTxFormData, remarks: e.target.value })}
                />
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setBankTxModalOpen(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBankTx}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 shadow-sm"
              >
                Save Bank Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
