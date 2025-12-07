import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"

export async function RecentNotices() {
  const supabase = await createClient()

  const { data: notices } = await supabase
    .from("notices")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Notices</CardTitle>
        <Link href="/notices" className="text-sm text-primary hover:underline">
          View All
        </Link>
      </CardHeader>
      <CardContent>
        {notices && notices.length > 0 ? (
          <div className="space-y-4">
            {notices.map((notice) => (
              <div key={notice.id} className="space-y-2 pb-4 border-b last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-medium leading-none">{notice.title}</h4>
                  <Badge
                    variant={
                      notice.priority === "high"
                        ? "destructive"
                        : notice.priority === "medium"
                          ? "default"
                          : "secondary"
                    }
                    className="text-xs"
                  >
                    {notice.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{notice.content}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(notice.created_at), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No notices available
          </div>
        )}
      </CardContent>
    </Card>
  )
}
