"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types"
import { UserCog } from "lucide-react"

interface PromoteUserDialogProps {
  user: Profile
  open: boolean
  onClose: () => void
}

export function PromoteUserDialog({ user, open, onClose }: PromoteUserDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const newRole = user.role === "user" ? "admin" : "user"

  const handlePromote = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          role: newRole,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (updateError) throw updateError

      onClose()
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            {newRole === "admin" ? "Promote to Admin" : "Demote to User"}
          </DialogTitle>
          <DialogDescription>
            {newRole === "admin"
              ? `Are you sure you want to promote ${user.full_name} to Admin? They will have full access to all admin features including user management, loan approvals, and system settings.`
              : `Are you sure you want to demote ${user.full_name} to User? They will lose access to all admin features and only see their own data.`}
          </DialogDescription>
        </DialogHeader>
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handlePromote} disabled={isLoading}>
            {isLoading ? "Updating..." : newRole === "admin" ? "Promote to Admin" : "Demote to User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
