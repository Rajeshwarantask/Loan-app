import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PushNotificationTester } from "@/components/admin/push-notification-tester"
import { DebugNotificationSaver } from "@/components/admin/debug-notification-saver"

export const metadata = {
  title: "Push Notification Testing | Vizhuthugal Sangam Admin",
  description: "Test and debug push notifications",
}

export const dynamic = "force-dynamic"

export default async function PushNotificationTestPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

  if (profile?.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <MobileNav />

        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Push Notification Tester</h1>
            <p className="text-muted-foreground">Diagnose and test push notification delivery</p>
          </div>

          <div className="grid gap-6">
            <PushNotificationTester />

            <DebugNotificationSaver userId={user.id} />

            <Card>
              <CardHeader>
                <CardTitle>Troubleshooting Guide</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold mb-2">VAPID Keys Not Configured</h4>
                  <p className="text-muted-foreground">
                    Run: <code className="bg-muted px-2 py-1 rounded">npm run generate-vapid</code> in your terminal to
                    generate keys.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">No Subscriptions Found</h4>
                  <p className="text-muted-foreground">
                    Make sure you have:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                    <li>Installed the app as PWA (not just browser)</li>
                    <li>Granted notification permissions</li>
                    <li>The service worker is registered and active</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Check Browser Console</h4>
                  <p className="text-muted-foreground">
                    Open DevTools (F12) → Console tab to see detailed logs starting with [Push] or [TEST].
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Check System Notifications</h4>
                  <p className="text-muted-foreground">
                    Look in your OS notification center (top-right corner on most systems) for the test notification.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
