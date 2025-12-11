import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { BulkSettingsClient } from "@/components/admin/bulk-settings-client"

export default async function BulkSettingsPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (profile?.role !== "admin") {
    redirect("/dashboard")
  }

  // Fetch distinct period_keys and statuses for filtering
  const { data: periods } = await supabase
    .from("monthly_loan_records")
    .select("period_key")
    .order("period_key", { ascending: false })

  const uniquePeriods = [...new Set(periods?.map((p) => p.period_key) || [])]

  return <BulkSettingsClient periods={uniquePeriods} />
}
