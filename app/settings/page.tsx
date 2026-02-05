import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SettingsForm } from "@/components/settings/settings-form"
import { LogoutButton } from "@/components/auth/logout-button"
import { Phone, MessageCircle, Instagram } from "lucide-react"

export default async function SettingsPage() {
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
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">Manage your account settings and preferences</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent>
              <SettingsForm profile={profile} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>User Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{profile.full_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Role</span>
                <span className="font-medium capitalize">{profile.role}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Member Since</span>
                <span className="font-medium">{new Date(profile.created_at).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>App Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Version</span>
                <span className="font-medium">1.1.0</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Developer</span>
                <span className="font-medium">Rajeshwaran Manikandan</span>
              </div>

              <div className="pt-4 border-t">
                <p className="mb-3 font-semibold text-popover-foreground">Contact Developer</p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="flex-1 bg-transparent"
                  >
                    <a
                      href="https://wa.me/919025294435"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="h-4 w-4 mr-2 text-[rgba(55,230,55,1)]" />
                      WhatsApp
                    </a>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="flex-1 bg-transparent"
                  >
                    <a
                      href="https://www.instagram.com/r_a_j_e_s_h__._/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Instagram className="h-4 w-4 mr-2 text-destructive" />
                      Instagram
                    </a>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="flex-1 bg-transparent"
                  >
                    <a
                      href="tel:+919025294435"
                    >
                      <Phone className="h-4 w-4 mr-2 text-primary" />
                      Call
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Sign out of your account</CardDescription>
            </CardHeader>
            <CardContent>
              <LogoutButton />
            </CardContent>
          </Card>
        </div>
      </main>

      <MobileNav role={profile.role} />
    </div>
  )
}
