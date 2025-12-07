import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { LoanManagementClient } from "@/components/admin/loan-management-client"

export default async function AdminLoansPage() {
  const profile = await requireAdmin()
  const supabase = await createClient()

  const { data: loans } = await supabase
    .from("loans")
    .select(`
      *,
      profiles!loans_user_id_fkey(id, full_name, email, member_id, phone)
    `)
    .order("created_at", { ascending: false })

  // Fetch loan payments for history
  const { data: payments } = await supabase
    .from("loan_payments")
    .select("*")
    .order("payment_date", { ascending: false })

  const { data: users } = await supabase.from("profiles").select("id, full_name, email, member_id").order("full_name")

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} userName={profile.full_name} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <LoanManagementClient loans={loans || []} payments={payments || []} users={users || []} />
      </main>

      <MobileNav role={profile.role} />
    </div>
  )
}
