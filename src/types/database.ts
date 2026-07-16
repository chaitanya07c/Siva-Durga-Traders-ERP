export type Shop = {
  id: string
  name: string
  name_te?: string | null
  type: string
  landmark: string | null
  landmark_te?: string | null
  contact_person: string | null
  contact_person_te?: string | null
  mobile: string | null
  whatsapp: string | null
  address: string | null
  address_te?: string | null
  purchase_rate: string | null
  status: string
  marked_for_loading: boolean
  marked_for_combined_bill: boolean
  shop_rates: Record<string, number>
  created_at: string
}

export type Material = {
  id: string
  name: string
  name_te?: string | null
  category: string
  category_te?: string | null
  default_cost: number
  created_at: string
}

export type Purchase = {
  id: string
  bill_number: number
  date: string
  shop_id: string
  previous_balance: number
  advance: number
  grand_total: number
  payment_status: string
  remarks: string | null
  session_id: string
  session_partial_payment: number
  payment_date: string | null
  created_at: string
}

export type PurchaseItem = {
  id: string
  purchase_id: string
  material_id: string
  quantity: number
  unit: string
  rate: number
  total: number
}

export type Sale = {
  id: string
  date: string
  buyer_name: string | null
  invoice_number: string | null
  total_amount: number
  items?: Record<string, any>
  payment_status: string
  partial_payment: number
  payment_date: string | null
  remarks: string | null
  created_at: string
}

export type SaleItem = {
  id: string
  sale_id: string
  material_id: string
  quantity: number
  unit: string
  rate: number
  total: number
}

export type Employee = {
  id: string
  name: string
  name_te?: string | null
  mobile: string | null
  role: string
  joining_date: string
  daily_wage: number
  status: string
  created_at: string
}

export type Attendance = {
  id: string
  employee_id: string
  date: string
  status: string
  created_at: string
}

export type CompletedLoading = {
  id: string
  shop_id: string
  shop_name: string
  shop_type: string
  loading_date: string
  completed_at: string
  purchase_bill_number: number | null
  purchase_amount: number
  created_at: string
}

export type Buyer = {
  id: string
  name: string
  name_te?: string | null
  created_at: string
}

export type Expense = {
  id: string
  date: string
  category: string
  description: string
  amount: number
  remarks: string | null
  created_at: string
}
