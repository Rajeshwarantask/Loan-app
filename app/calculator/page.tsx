import { CalculatorClient } from "@/components/calculator/calculator-client"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"

export const metadata = {
  title: "Calculator",
  description: "Loan and Regular Calculator",
}

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
        <div className="container max-w-4xl py-6">
          <div className="pl-12 md:pl-0 mb-8">
            <h1 className="text-3xl font-bold mb-2">Calculator</h1>
            <p className="text-muted-foreground">Calculate loans or perform regular calculations</p>
          </div>

          <CalculatorClient />
        </div>
      </main>

      <MobileNav role={profile.role} />
    </div>
  )
}
