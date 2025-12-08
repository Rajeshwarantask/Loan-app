import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { MonthlyCycleClient } from "@/components/admin/monthly-cycle-client"

export default async function MonthlyCyclesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  if (profile?.role !== "admin") {
    redirect("/")
  }

  // Fetch monthly records
  const { data: monthlyRecords } = await supabase
    .from("monthly_loan_records")
    .select(`
      *,
      profiles:user_id (
        id,
        full_name,
        email,
        member_id
      )
    `)
    .order("year_number", { ascending: false })
    .order("month_number", { ascending: false })

  // Fetch all members
  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, email, member_id, monthly_subscription")
    .eq("role", "member")
    .order("member_id")

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} userName={profile.full_name} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <MonthlyCycleClient monthlyRecords={monthlyRecords || []} members={members || []} />
      </main>

      <MobileNav role={profile.role} />
    </div>
  )
}
