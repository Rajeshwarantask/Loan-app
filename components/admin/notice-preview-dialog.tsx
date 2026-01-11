"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Notice {
  id: string
  title: string
  content: string
  priority: string
  created_at: string
  image_url?: string | null
  image_path?: string | null
}

interface NoticePreviewDialogProps {
  notice: Notice | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NoticePreviewDialog({ notice, open, onOpenChange }: NoticePreviewDialogProps) {
  if (!notice) return null

  const handleDownload = () => {
    if (notice.image_url) {
      const link = document.createElement("a")
      link.href = notice.image_url
      link.download = `notice-${notice.id}-${format(new Date(notice.created_at), "yyyy-MM-dd")}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{notice.title}</span>
            <Badge
              variant={
                notice.priority === "high" ? "destructive" : notice.priority === "medium" ? "default" : "secondary"
              }
            >
              {notice.priority}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Date</p>
            <p className="text-sm">{format(new Date(notice.created_at), "MMMM dd, yyyy")}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Content</p>
            <p className="text-sm whitespace-pre-wrap">{notice.content}</p>
          </div>

          {notice.image_url && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Attached Image</p>
              <div className="space-y-3">
                <img
                  src={notice.image_url || "/placeholder.svg"}
                  alt={notice.title}
                  className="w-full rounded-lg border shadow-sm object-contain max-h-[400px]"
                />
                <Button onClick={handleDownload} variant="outline" size="sm" className="w-full bg-transparent">
                  <Download className="h-4 w-4 mr-2" />
                  Download Image
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
