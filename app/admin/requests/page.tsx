import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoanRequestsTable } from "@/components/admin/loan-requests-table"
import { LoanRequestHistoryTable } from "@/components/admin/loan-request-history-table"

export default async function AdminRequestsPage() {
  const profile = await requireAdmin()
  const supabase = await createClient()

  const { data: requests } = await supabase.from("loan_requests").select("*").order("created_at", { ascending: false })

  const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, member_id")

  // Join profiles data with requests
  const requestsWithProfiles =
    requests?.map((request) => ({
      ...request,
      profiles: profiles?.find((p) => p.id === request.user_id) || { full_name: "Unknown", email: "", member_id: "" },
    })) || []

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} userName={profile.full_name} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="container max-w-7xl py-6 space-y-6">
          <div className="pl-12 md:pl-0">
            <h1 className="text-3xl font-semibold tracking-tight">Loan Requests</h1>
            <p className="text-muted-foreground">Review and approve user loan requests</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Pending Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <LoanRequestsTable
                requests={requestsWithProfiles?.filter((r) => r.status === "pending") || []}
                adminId={profile.id}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Request History</CardTitle>
            </CardHeader>
            <CardContent>
              <LoanRequestHistoryTable requests={requestsWithProfiles?.filter((r) => r.status !== "pending") || []} />
            </CardContent>
          </Card>
        </div>
      </main>

      <MobileNav role={profile.role} />
    </div>
  )
}
