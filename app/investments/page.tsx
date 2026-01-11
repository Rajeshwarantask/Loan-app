import { redirect } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { InvestmentClient } from "@/components/investment/investment-client"

export const revalidate = 0
export const dynamic = "force-dynamic"

export default async function InvestmentsPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  if (profile?.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} userName={profile.full_name} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="container max-w-7xl py-6 px-4 md:px-6 space-y-6">
          <div className="pl-12 md:pl-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Investment Tracking</h1>
            <p className="text-sm md:text-base text-muted-foreground">Track and manage your investments efficiently</p>
          </div>

          <InvestmentClient userId={user.id} memberId={profile?.member_id || null} />
        </div>
      </main>

      <MobileNav role={profile.role} userName={profile.full_name} />
    </div>
  )
}
