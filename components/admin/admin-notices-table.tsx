"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { Trash } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface Notice {
  id: string
  title: string
  content: string
  priority: string
  created_at: string
}

interface AdminNoticesTableProps {
  notices: Notice[]
}

export function AdminNoticesTable({ notices }: AdminNoticesTableProps) {
  const router = useRouter()

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from("notices").delete().eq("id", id)
    router.refresh()
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Content</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {notices.map((notice) => (
            <TableRow key={notice.id}>
              <TableCell className="font-medium">{notice.title}</TableCell>
              <TableCell className="max-w-md truncate">{notice.content}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    notice.priority === "high" ? "destructive" : notice.priority === "medium" ? "default" : "secondary"
                  }
                >
                  {notice.priority}
                </Badge>
              </TableCell>
              <TableCell>{format(new Date(notice.created_at), "MMM dd, yyyy")}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="ghost" onClick={() => handleDelete(notice.id)}>
                  <Trash className="h-4 w-4 text-red-600" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
