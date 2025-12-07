import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { LoanOverview } from "@/components/dashboard/loan-overview"
import { RecentNotices } from "@/components/dashboard/recent-notices"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()

  if (!profile) {
    redirect("/auth/login")
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} userName={profile.full_name} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="container max-w-7xl py-6 px-4 md:px-6 space-y-6">
          <div className="pl-12 md:pl-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground">Welcome back, {profile.full_name}</p>
          </div>

          <DashboardStats userId={user.id} role={profile.role} />

          <div className="grid gap-6 lg:grid-cols-2">
            <LoanOverview userId={user.id} role={profile.role} />
            <RecentNotices />
          </div>
        </div>
      </main>

      <MobileNav role={profile.role} />
    </div>
  )
}
