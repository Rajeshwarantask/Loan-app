import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UsersTable } from "@/components/admin/users-table"
import { AddUserDialog } from "@/components/admin/add-user-dialog"

export default async function AdminUsersPage() {
  const profile = await requireAdmin()
  const supabase = await createClient()

  const { data: users } = await supabase.from("profiles").select("*").order("created_at", { ascending: false })

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} userName={profile.full_name} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="container max-w-7xl py-6 px-4 md:px-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="pl-12 md:pl-0">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">User Management</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Manage community members and their information
              </p>
            </div>
            <AddUserDialog />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
            </CardHeader>
            <CardContent>
              <UsersTable users={users || []} />
            </CardContent>
          </Card>
        </div>
      </main>

      <MobileNav role={profile.role} />
    </div>
  )
}
