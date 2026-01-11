import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import Image from "next/image"
import { Download } from "lucide-react"

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

  const { data: notices } = await supabase.from("notices").select("*").order("created_at", { ascending: false })

  const { data: profiles } = await supabase.from("profiles").select("id, full_name")

  // Join profiles data with notices
  const noticesWithProfiles =
    notices?.map((notice) => ({
      ...notice,
      profiles: profiles?.find((p) => p.id === notice.created_by),
    })) || []

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={profile.role} userName={profile.full_name} />

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="container max-w-4xl py-6 space-y-6">
          <div className="pl-12 md:pl-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Notices</h1>
            <p className="text-muted-foreground">Important announcements from the community</p>
          </div>

          {noticesWithProfiles && noticesWithProfiles.length > 0 ? (
            <div className="space-y-4">
              {noticesWithProfiles.map((notice) => (
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
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground whitespace-pre-wrap">{notice.content}</p>

                    {notice.image_url && (
                      <div className="space-y-2">
                        <div className="relative w-full h-64 md:h-96 rounded-lg overflow-hidden border">
                          <Image
                            src={notice.image_url || "/placeholder.svg"}
                            alt={notice.title}
                            fill
                            className="object-contain"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          />
                        </div>
                        <Button variant="outline" size="sm" className="w-full sm:w-auto bg-transparent" asChild>
                          <a
                            href={notice.image_url}
                            download={`notice-${notice.id}-${format(new Date(notice.created_at), "yyyy-MM-dd")}.jpg`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download Image
                          </a>
                        </Button>
                      </div>
                    )}
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
