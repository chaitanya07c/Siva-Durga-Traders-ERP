export type CashTransaction = {
  id: string
  date: string
  type: 'Received' | 'Paid'
  amount: number
  category: string
  remarks?: string | null
  source_module?: string | null
  source_id?: string | null
  created_at?: string
}

export type BankAccount = {
  id: string
  bank_name: string
  account_nickname: string
  account_number?: string | null
  opening_balance: number
  created_at?: string
}

export type BankTransaction = {
  id: string
  account_id: string
  date: string
  type: 'Credit' | 'Debit'
  amount: number
  category: string
  remarks?: string | null
  source_module?: string | null
  source_id?: string | null
  created_at?: string
}
