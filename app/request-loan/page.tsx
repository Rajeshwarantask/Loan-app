import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { LoanRequestForm } from "@/components/loan-request/loan-request-form"
import { Badge } from "@/components/ui/badge"

export default async function RequestLoanPage() {
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

  // Get user's pending requests
  const { data: pendingRequests } = await supabase
    .from("loan_requests")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  // Get user's recent requests
  const { data: recentRequests } = await supabase
    .from("loan_requests")
    .select("*")
    .eq("user_id", user.id)
    .neq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(5)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} userName={profile.full_name} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="container max-w-4xl py-6 space-y-6">
          <div className="pl-12 md:pl-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Request a Loan</h1>
            <p className="text-muted-foreground">Submit a loan request for admin review</p>
          </div>

          <LoanRequestForm userId={user.id} />

          {pendingRequests && pendingRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Requests</CardTitle>
                <CardDescription>Your requests awaiting admin review</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="font-medium">₹{Number(request.amount).toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">{request.purpose}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="secondary">Pending</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {recentRequests && recentRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Request History</CardTitle>
                <CardDescription>Your recent loan requests and their status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentRequests.map((request) => (
                    <div key={request.id} className="border-b pb-4 last:border-0 last:pb-0 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">₹{Number(request.amount).toLocaleString()}</p>
                          {request.approved_amount && request.approved_amount !== request.amount && (
                            <p className="text-sm text-green-600 font-medium">
                              Approved: ₹{Number(request.approved_amount).toLocaleString()}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground">{request.purpose}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge
                          variant={
                            request.status === "approved"
                              ? "default"
                              : request.status === "rejected"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {request.status}
                        </Badge>
                      </div>
                      {request.admin_remark && (
                        <div className="mt-2 p-3 bg-muted rounded-md">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Admin Note:</p>
                          <p className="text-sm">{request.admin_remark}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <MobileNav role={profile.role} />
    </div>
  )
}
