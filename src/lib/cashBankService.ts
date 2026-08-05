import { supabase } from "@/lib/supabase"
import type { CashTransaction, BankAccount, BankTransaction } from "@/types/cashBank"

const LOCAL_CASH_KEY = "sdt_trial_cash_transactions"
const LOCAL_BANK_ACC_KEY = "sdt_trial_bank_accounts"
const LOCAL_BANK_TX_KEY = "sdt_trial_bank_transactions"

function getLocal<T>(key: string, defaultVal: T[]): T[] {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : defaultVal
  } catch {
    return defaultVal
  }
}

function setLocal<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (err) {
    console.error("Failed to save to localStorage:", err)
  }
}

// -------------------------------------------------------------
// CASH TRANSACTIONS
// -------------------------------------------------------------

export async function getCashTransactions(): Promise<CashTransaction[]> {
  try {
    const { data, error } = await supabase
      .from('cash_transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (!error && data) {
      return data as CashTransaction[]
    }
  } catch (e) {
    // Ignore and fallback to local
  }
  return getLocal<CashTransaction>(LOCAL_CASH_KEY, []).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}

export async function addCashTransaction(
  tx: Omit<CashTransaction, 'id' | 'created_at'>
): Promise<CashTransaction> {
  const newTx: CashTransaction = {
    id: crypto.randomUUID(),
    date: tx.date,
    type: tx.type,
    amount: Number(tx.amount || 0),
    category: tx.category || 'General',
    remarks: tx.remarks || '',
    source_module: tx.source_module || 'manual',
    source_id: tx.source_id || null,
    created_at: new Date().toISOString()
  }

  try {
    const { data, error } = await supabase
      .from('cash_transactions')
      .insert([{
        date: newTx.date,
        type: newTx.type,
        amount: newTx.amount,
        category: newTx.category,
        remarks: newTx.remarks,
        source_module: newTx.source_module,
        source_id: newTx.source_id
      }])
      .select()
      .single()

    if (!error && data) {
      return data as CashTransaction
    }
  } catch (e) {
    // Fallback
  }

  const list = getLocal<CashTransaction>(LOCAL_CASH_KEY, [])
  list.unshift(newTx)
  setLocal(LOCAL_CASH_KEY, list)
  return newTx
}

export async function updateCashTransaction(
  id: string,
  tx: Partial<CashTransaction>
): Promise<void> {
  try {
    const { error } = await supabase
      .from('cash_transactions')
      .update(tx)
      .eq('id', id)

    if (!error) return
  } catch (e) {
    // Fallback
  }

  const list = getLocal<CashTransaction>(LOCAL_CASH_KEY, [])
  const idx = list.findIndex(item => item.id === id)
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...tx }
    setLocal(LOCAL_CASH_KEY, list)
  }
}

export async function deleteCashTransaction(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('cash_transactions')
      .delete()
      .eq('id', id)

    if (!error) return
  } catch (e) {
    // Fallback
  }

  const list = getLocal<CashTransaction>(LOCAL_CASH_KEY, [])
  const filtered = list.filter(item => item.id !== id)
  setLocal(LOCAL_CASH_KEY, filtered)
}

// -------------------------------------------------------------
// BANK ACCOUNTS
// -------------------------------------------------------------

export async function getBankAccounts(): Promise<BankAccount[]> {
  try {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .order('bank_name', { ascending: true })

    if (!error && data) {
      return data as BankAccount[]
    }
  } catch (e) {
    // Ignore and fallback
  }

  const initialDefaultAccounts: BankAccount[] = [
    { id: 'sbi-default', bank_name: 'State Bank of India', account_nickname: 'SBI Main', opening_balance: 50000 },
    { id: 'hdfc-default', bank_name: 'HDFC Bank', account_nickname: 'HDFC Current', opening_balance: 25000 }
  ]

  return getLocal<BankAccount>(LOCAL_BANK_ACC_KEY, initialDefaultAccounts)
}

export async function addBankAccount(
  acc: Omit<BankAccount, 'id' | 'created_at'>
): Promise<BankAccount> {
  const newAcc: BankAccount = {
    id: crypto.randomUUID(),
    bank_name: acc.bank_name,
    account_nickname: acc.account_nickname,
    account_number: acc.account_number || '',
    opening_balance: Number(acc.opening_balance || 0),
    created_at: new Date().toISOString()
  }

  try {
    const { data, error } = await supabase
      .from('bank_accounts')
      .insert([{
        bank_name: newAcc.bank_name,
        account_nickname: newAcc.account_nickname,
        account_number: newAcc.account_number,
        opening_balance: newAcc.opening_balance
      }])
      .select()
      .single()

    if (!error && data) {
      return data as BankAccount
    }
  } catch (e) {
    // Fallback
  }

  const list = await getBankAccounts()
  list.push(newAcc)
  setLocal(LOCAL_BANK_ACC_KEY, list)
  return newAcc
}

export async function updateBankAccount(
  id: string,
  acc: Partial<BankAccount>
): Promise<void> {
  try {
    const { error } = await supabase
      .from('bank_accounts')
      .update(acc)
      .eq('id', id)

    if (!error) return
  } catch (e) {
    // Fallback
  }

  const list = await getBankAccounts()
  const idx = list.findIndex(item => item.id === id)
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...acc }
    setLocal(LOCAL_BANK_ACC_KEY, list)
  }
}

export async function deleteBankAccount(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('id', id)

    if (!error) return
  } catch (e) {
    // Fallback
  }

  const list = await getBankAccounts()
  const filtered = list.filter(item => item.id !== id)
  setLocal(LOCAL_BANK_ACC_KEY, filtered)

  // Also remove transactions for this account
  const txList = getLocal<BankTransaction>(LOCAL_BANK_TX_KEY, [])
  setLocal(LOCAL_BANK_TX_KEY, txList.filter(t => t.account_id !== id))
}

// -------------------------------------------------------------
// BANK TRANSACTIONS
// -------------------------------------------------------------

export async function getBankTransactions(accountId?: string): Promise<BankTransaction[]> {
  try {
    let query = supabase
      .from('bank_transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (accountId) {
      query = query.eq('account_id', accountId)
    }

    const { data, error } = await query

    if (!error && data) {
      return data as BankTransaction[]
    }
  } catch (e) {
    // Fallback
  }

  const list = getLocal<BankTransaction>(LOCAL_BANK_TX_KEY, [])
  const filtered = accountId ? list.filter(t => t.account_id === accountId) : list
  return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export async function addBankTransaction(
  tx: Omit<BankTransaction, 'id' | 'created_at'>
): Promise<BankTransaction> {
  const newTx: BankTransaction = {
    id: crypto.randomUUID(),
    account_id: tx.account_id,
    date: tx.date,
    type: tx.type,
    amount: Number(tx.amount || 0),
    category: tx.category || 'General',
    remarks: tx.remarks || '',
    source_module: tx.source_module || 'manual',
    source_id: tx.source_id || null,
    created_at: new Date().toISOString()
  }

  try {
    const { data, error } = await supabase
      .from('bank_transactions')
      .insert([{
        account_id: newTx.account_id,
        date: newTx.date,
        type: newTx.type,
        amount: newTx.amount,
        category: newTx.category,
        remarks: newTx.remarks,
        source_module: newTx.source_module,
        source_id: newTx.source_id
      }])
      .select()
      .single()

    if (!error && data) {
      return data as BankTransaction
    }
  } catch (e) {
    // Fallback
  }

  const list = getLocal<BankTransaction>(LOCAL_BANK_TX_KEY, [])
  list.unshift(newTx)
  setLocal(LOCAL_BANK_TX_KEY, list)
  return newTx
}

export async function updateBankTransaction(
  id: string,
  tx: Partial<BankTransaction>
): Promise<void> {
  try {
    const { error } = await supabase
      .from('bank_transactions')
      .update(tx)
      .eq('id', id)

    if (!error) return
  } catch (e) {
    // Fallback
  }

  const list = getLocal<BankTransaction>(LOCAL_BANK_TX_KEY, [])
  const idx = list.findIndex(item => item.id === id)
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...tx }
    setLocal(LOCAL_BANK_TX_KEY, list)
  }
}

export async function deleteBankTransaction(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('bank_transactions')
      .delete()
      .eq('id', id)

    if (!error) return
  } catch (e) {
    // Fallback
  }

  const list = getLocal<BankTransaction>(LOCAL_BANK_TX_KEY, [])
  const filtered = list.filter(item => item.id !== id)
  setLocal(LOCAL_BANK_TX_KEY, filtered)
}
