import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { InvestmentClient } from "@/components/investment/investment-client"

export default async function InvestmentsPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Investment Tracking</h1>
        <p className="text-muted-foreground">Track and manage your investments efficiently</p>
      </div>

      <InvestmentClient userId={user.id} memberId={profile?.member_id || null} />
    </div>
  )
}
