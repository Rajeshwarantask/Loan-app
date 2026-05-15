import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { PredictionBillClient } from "@/components/admin/prediction-bill-client"

export const revalidate = 0
export const dynamic = "force-dynamic"

export default async function PredictionBillPage() {
  const profile = await requireAdmin()
  const supabase = await createClient()

  // Get current date for period calculation
  const now = new Date()
  const currentPeriodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  // Calculate previous month
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevPeriodKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`

  // Fetch all users with member IDs
  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, member_id")
    .not("member_id", "is", null)
    .order("member_id")

  // Fetch previous month's loan payments and loans data
  const { data: prevMonthPayments } = await supabase
    .from("loan_payments")
    .select("user_id, member_id, full_name, loan_id, monthly_subscription, interest_paid, monthly_emi, remaining_balance")
    .eq("period_key", prevPeriodKey)

  const { data: activeLoans } = await supabase
    .from("loans")
    .select("user_id, member_id, full_name, id, loan_amount, status")
    .eq("status", "active")

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} userName={profile.full_name} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="container max-w-7xl py-6 px-4 md:px-6 space-y-6">
          <div>
            <div className="pl-12 md:pl-0">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Prediction Bill</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Preview expected payment for next month ({currentPeriodKey}) based on {prevPeriodKey} data
              </p>
            </div>
          </div>

          <PredictionBillClient
            users={users || []}
            prevMonthPayments={prevMonthPayments || []}
            activeLoans={activeLoans || []}
            currentPeriodKey={currentPeriodKey}
            prevPeriodKey={prevPeriodKey}
          />
        </div>
      </main>

      <MobileNav role={profile.role} />
    </div>
  )
}
