import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { BulkSettingsClient } from "@/components/admin/bulk-settings-client"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"

export const revalidate = 0
export const dynamic = "force-dynamic"

export default async function BulkSettingsPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single()

  if (profile?.role !== "admin") {
    redirect("/dashboard")
  }

  // Fetch distinct period_keys and statuses for filtering
  const { data: periods } = await supabase
    .from("monthly_loan_records")
    .select("period_key")
    .order("period_key", { ascending: false })

  const uniquePeriods = [...new Set(periods?.map((p) => p.period_key) || [])]

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} userName={profile.full_name || ""} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <BulkSettingsClient periods={uniquePeriods} />
      </main>

      <MobileNav role={profile.role} />
    </div>
  )
}
