import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Phone, Mail, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function ContactPage() {
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

  // Get admin contacts
  const { data: admins } = await supabase.from("profiles").select("*").eq("role", "admin").limit(5)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} userName={profile.full_name} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="container max-w-4xl py-6 space-y-6">
          <div className="pl-12 md:pl-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Contact Admin</h1>
            <p className="text-muted-foreground">Reach out to administrators for support or inquiries</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Important Information</CardTitle>
              <CardDescription>
                All monetary transactions happen offline. Use these contact methods to coordinate with admins for
                payments or loan disbursements.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <MessageCircle className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Payment Updates</h3>
                    <p className="text-sm text-muted-foreground">
                      After making an offline payment, contact an admin to update your payment status in the system.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <Phone className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Loan Disbursement</h3>
                    <p className="text-sm text-muted-foreground">
                      Once your loan is approved, contact an admin to arrange the cash transfer.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {admins && admins.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Administrator Contacts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {admins.map((admin) => (
                    <div
                      key={admin.id}
                      className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="font-medium">{admin.full_name}</p>
                        <div className="mt-2 space-y-1">
                          {admin.email && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="h-4 w-4" />
                              <a href={`mailto:${admin.email}`} className="hover:underline">
                                {admin.email}
                              </a>
                            </div>
                          )}
                          {admin.phone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="h-4 w-4" />
                              <a href={`tel:${admin.phone}`} className="hover:underline">
                                {admin.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                      {admin.whatsapp_link && (
                        <Button size="sm" variant="default" asChild>
                          <Link href={admin.whatsapp_link} target="_blank">
                            <MessageCircle className="h-4 w-4 mr-2" />
                            WhatsApp
                          </Link>
                        </Button>
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
