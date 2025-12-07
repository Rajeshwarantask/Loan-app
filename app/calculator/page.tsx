import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { LoanCalculatorForm } from "@/components/calculator/loan-calculator-form"

export default async function CalculatorPage() {
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
        <div className="container max-w-5xl py-6 space-y-6">
          <div className="pl-12 md:pl-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Loan Calculator</h1>
            <p className="text-muted-foreground">Calculate your loan EMI and view month-wise breakdown</p>
          </div>

          <LoanCalculatorForm />
        </div>
      </main>

      <MobileNav role={profile.role} />
    </div>
  )
}
