import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { MonthlyCycleClient } from "@/components/admin/monthly-cycle-client"

export const revalidate = 0
export const dynamic = "force-dynamic"

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

  const { data: monthlyRecords } = await supabase
    .from("monthly_loan_records")
    .select("*")
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })

  const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, member_id")

  // Join profiles data with monthly records
  const recordsWithProfiles =
    monthlyRecords
      ?.map((record) => ({
        ...record,
        profiles: profiles?.find((p) => p.id === record.user_id),
      }))
      .filter((record) => record.profiles) || []

  const { data: members } = await supabase.from("profiles").select("id, full_name, email, member_id").order("member_id")

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} userName={profile.full_name} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <MonthlyCycleClient monthlyRecords={recordsWithProfiles || []} members={members || []} />
      </main>

      <MobileNav role={profile.role} />
    </div>
  )
}
