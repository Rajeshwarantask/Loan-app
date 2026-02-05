import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { NotificationPreferences } from "@/components/settings/notification-preferences"
import { InstallAppButton } from "@/components/app-alerts/install-app-button"

export default async function AppAlertsPage() {
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
        <div className="container max-w-3xl py-6 space-y-6">
          <div className="pl-12 md:pl-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">App & Alerts</h1>
            <p className="text-muted-foreground">Manage app installation and notification preferences</p>
          </div>

          {/* Install App Section */}
          <Card>
            <CardHeader>
              <CardTitle>Install App</CardTitle>
              <CardDescription>Add the Vizhuthugal Sangam app to your home screen for quick access</CardDescription>
            </CardHeader>
            <CardContent>
              <InstallAppButton />
            </CardContent>
          </Card>

          {/* Push Notifications Section */}
          <NotificationPreferences userId={profile.id} />
        </div>
      </main>

      <MobileNav role={profile.role} />
    </div>
  )
}
