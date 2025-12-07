import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth-helpers"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { AdminSettingsClient } from "@/components/admin/admin-settings-client"

export default async function AdminSettingsPage() {
  const profile = await requireAdmin()
  const supabase = await createClient()

  // Fetch current settings
  const { data: settings, error } = await supabase.from("system_settings").select("*").order("setting_key")

  if (error) {
    console.error("[v0] Error fetching settings:", error)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar role={profile.role} userName={profile.full_name} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <MobileNav role={profile.role} userName={profile.full_name} />

        <main className="flex-1 overflow-y-auto">
          <AdminSettingsClient settings={settings || []} />
        </main>
      </div>
    </div>
  )
}
