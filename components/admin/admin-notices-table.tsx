"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { Trash, ImageIcon, Eye } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { NoticePreviewDialog } from "./notice-preview-dialog"
import { useState } from "react"

interface Notice {
  id: string
  title: string
  content: string
  priority: string
  created_at: string
  image_url?: string | null
  image_path?: string | null
}

interface AdminNoticesTableProps {
  notices: Notice[]
}

export function AdminNoticesTable({ notices }: AdminNoticesTableProps) {
  const router = useRouter()
  const [previewNotice, setPreviewNotice] = useState<Notice | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const handleDelete = async (id: string, imagePath?: string | null) => {
    try {
      const supabase = createClient()

      if (imagePath) {
        const { error: storageError } = await supabase.storage.from("notice-images").remove([imagePath])

        if (storageError) {
          console.error("[v0] Error deleting image from storage:", storageError)
        }
      }

      // Delete notice from database
      await supabase.from("notices").delete().eq("id", id)
      router.refresh()
    } catch (error) {
      console.error("[v0] Error deleting notice:", error)
    }
  }

  const handlePreview = (notice: Notice) => {
    setPreviewNotice(notice)
    setPreviewOpen(true)
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Image</TableHead>
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
                      notice.priority === "high"
                        ? "destructive"
                        : notice.priority === "medium"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {notice.priority}
                  </Badge>
                </TableCell>
                <TableCell>
                  {notice.image_url ? (
                    <ImageIcon className="h-4 w-4 text-green-600" />
                  ) : (
                    <span className="text-muted-foreground text-xs">No image</span>
                  )}
                </TableCell>
                <TableCell>{format(new Date(notice.created_at), "MMM dd, yyyy")}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handlePreview(notice)} title="Preview">
                      <Eye className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(notice.id, notice.image_path)}
                      title="Delete"
                    >
                      <Trash className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <NoticePreviewDialog notice={previewNotice} open={previewOpen} onOpenChange={setPreviewOpen} />
    </>
  )
}
