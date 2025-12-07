import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminNoticesTable } from "@/components/admin/admin-notices-table"
import { AddNoticeDialog } from "@/components/admin/add-notice-dialog"

export default async function AdminNoticesPage() {
  const profile = await requireAdmin()
  const supabase = await createClient()

  const { data: notices } = await supabase.from("notices").select("*").order("created_at", { ascending: false })

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} userName={profile.full_name} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="container max-w-6xl py-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Manage Notices</h1>
              <p className="text-muted-foreground">Create and manage community announcements</p>
            </div>
            <AddNoticeDialog adminId={profile.id} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Notices</CardTitle>
            </CardHeader>
            <CardContent>
              <AdminNoticesTable notices={notices || []} />
            </CardContent>
          </Card>
        </div>
      </main>

      <MobileNav role={profile.role} />
    </div>
  )
}
