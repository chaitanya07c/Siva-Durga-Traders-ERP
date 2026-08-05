/**
 * Future Financial Ledger Integration Specifications
 *
 * NOTE: Currently inactive per user directive.
 * This specification ensures existing modules (Purchasing Payments, Sales Payments,
 * Worker Salaries, Expenses) remain future-ready for automated Cash & Bank tracking.
 *
 * Future Automated Flows (WHEN ENABLED):
 * 1. Customer Payment Received (Sales) -> Mode: 'Bank' (e.g. SBI) -> Auto-increases SBI Balance.
 * 2. Customer Payment Received (Sales) -> Mode: 'Cash' -> Auto-increases Cash Balance.
 * 3. Salary Paid (Workers) -> Mode: 'Cash' -> Auto-decreases Cash Balance.
 * 4. Purchase Payment Made -> Mode: 'Bank' (e.g. HDFC) -> Auto-decreases HDFC Balance.
 * 5. Purchase Payment Made -> Mode: 'Cash' -> Auto-decreases Cash Balance.
 * 6. Expense Paid -> Mode: 'Bank' / 'Cash' -> Auto-decreases corresponding Balance.
 */

export type PaymentMethod = 'Cash' | 'Bank' | 'Cheque' | 'UPI'

export type FinancialTransactionEvent = {
  sourceModule: 'Purchasing' | 'Sales' | 'Salaries' | 'Expenses'
  sourceId: string
  date: string
  amount: number
  paymentMethod: PaymentMethod
  bankAccountName?: string | null
  bankAccountId?: string | null
  remarks?: string | null
}

/**
 * Placeholder hook for future automatic financial integration.
 * DO NOT execute or connect until explicitly requested by user.
 */
export async function recordFinancialEvent(_event: FinancialTransactionEvent): Promise<void> {
  // Inactive stub for future automated ledger recording.
  return Promise.resolve()
}
