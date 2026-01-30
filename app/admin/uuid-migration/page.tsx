import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { UUIDMigrationClient } from "@/components/admin/uuid-migration-client"

export const revalidate = 0
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function AdminUUIDMigrationPage() {
  const profile = await requireAdmin()
  const supabase = await createClient()

  // Fetch all users (both authenticated and legacy)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, member_id")
    .order("full_name")

  // Fetch migration history for audit trail
  const { data: migrationLogs } = await supabase
    .from("uuid_migration_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} userName={profile.full_name} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <UUIDMigrationClient profiles={profiles || []} migrationLogs={migrationLogs || []} />
      </main>

      <MobileNav role={profile.role} />
    </div>
  )
}
