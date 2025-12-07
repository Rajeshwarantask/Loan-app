export type UserRole = "user" | "admin"

export interface Profile {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  member_id: string | null
  monthly_subscription: number
  fine: number
  whatsapp_link: string | null
  created_at: string
  updated_at: string
}

export interface Loan {
  id: string
  user_id: string
  amount: number
  interest_rate: number
  duration_months: number
  purpose: string | null
  status: "pending" | "approved" | "rejected" | "active" | "completed"
  loan_balance: number
  installment_loan_taken: number
  installment_duration_months: number
  monthly_emi_amount: number
  emi_balance: number
  emi_monthly_interest: number
  requested_at: string
  approved_at: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
}

export interface LoanPayment {
  id: string
  loan_id: string
  user_id: string
  month_year: string
  principal_paid: number
  interest_paid: number
  remaining_balance: number
  status: "paid" | "unpaid" | "missed" | "partial"
  payment_date: string | null
  created_at: string
  updated_at: string
}

export interface MonthlyContribution {
  id: string
  user_id: string
  month_year: string
  amount: number
  status: "paid" | "unpaid" | "missed"
  payment_date: string | null
  created_at: string
  updated_at: string
}

export interface Notice {
  id: string
  title: string
  content: string
  created_by: string
  priority: "low" | "medium" | "high"
  created_at: string
  updated_at: string
}

export interface LoanRequest {
  id: string
  user_id: string
  amount: number
  duration_months: number
  purpose: string
  status: "pending" | "approved" | "rejected"
  reviewed_by: string | null
  reviewed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CommunityFund {
  id: string
  month_year: string
  total_contributions: number
  total_loans_issued: number
  total_interest_collected: number
  available_balance: number
  created_at: string
  updated_at: string
}

export interface MemberCashBillData {
  user_id: string
  member_id: string
  name: string
  subscription_income: number
  principal_balance: number
  monthly_interest: number
  updated_principal_balance: number
  monthly_installment: number
  installment_interest: number
  interest_months_remaining: number
  total_loan_balance: number
  fine: number
  total_to_be_paid: number
}
