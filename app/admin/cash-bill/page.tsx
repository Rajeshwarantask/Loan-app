import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { CashBillDownloadClient } from "@/components/admin/cash-bill-download-client"

interface User {
  id: string
  full_name: string
  member_id: string
}

interface AvailableMonth {
  period_key: string
  period_year: number
  period_month: number
}

export const revalidate = 0
export const dynamic = "force-dynamic"

export default async function CashBillPage() {
  const profile = await requireAdmin()
  const supabase = await createClient()

  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, member_id")
    .not("member_id", "is", null)
    .order("member_id")

  // Fetch available months from loan_payments (distinct period_key values)
  const { data: availableMonthsData } = await supabase
    .from("loan_payments")
    .select("period_key, period_year, period_month")
    .order("period_key", { ascending: false })

  // Remove duplicates and sort
  const uniqueMonths = Array.from(
    new Map(
      (availableMonthsData || []).map((m) => [m.period_key, { period_key: m.period_key, period_year: m.period_year, period_month: m.period_month }])
    ).values()
  ) as AvailableMonth[]

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} userName={profile.full_name} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="container max-w-7xl py-6 px-4 md:px-6 space-y-6">
          <div>
            <div className="pl-12 md:pl-0">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Cash Bill Statement</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Download monthly cash bill meeting statements
              </p>
            </div>
          </div>

          <CashBillDownloadClient users={users || []} availableMonths={uniqueMonths} />
        </div>
      </main>

      <MobileNav role={profile.role} />
    </div>
  )
}
