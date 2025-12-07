import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

export default async function NoticesPage() {
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

  const { data: notices } = await supabase
    .from("notices")
    .select("*, profiles!notices_created_by_fkey(full_name)")
    .order("created_at", { ascending: false })

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} userName={profile.full_name} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="container max-w-4xl py-6 space-y-6">
          <div className="pl-12 md:pl-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Notices</h1>
            <p className="text-muted-foreground">Important announcements from the community</p>
          </div>

          {notices && notices.length > 0 ? (
            <div className="space-y-4">
              {notices.map((notice) => (
                <Card key={notice.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-xl">{notice.title}</CardTitle>
                      <Badge
                        variant={
                          notice.priority === "high"
                            ? "destructive"
                            : notice.priority === "medium"
                              ? "default"
                              : "secondary"
                        }
                      >
                        {notice.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{format(new Date(notice.created_at), "MMM dd, yyyy")}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap">{notice.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No notices available
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <MobileNav role={profile.role} />
    </div>
  )
}
