"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { LayoutDashboard, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

export function RoleSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [hasLoan, setHasLoan] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const currentView = searchParams.get("view") === "user" ? "user" : "admin"

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (profile?.role !== "admin") { setLoading(false); return }
      setIsAdmin(true)

      const { data: loan } = await supabase
        .from("loans")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle()

      setHasLoan(!!loan)
      setLoading(false)
    }
    check()
  }, [])

  const switchTo = (view: "admin" | "user") => {
    const params = new URLSearchParams(searchParams.toString())
    if (view === "user") {
      params.set("view", "user")
    } else {
      params.delete("view")
    }
    const query = params.toString()
    router.push(`${pathname}${query ? `?${query}` : ""}`)
  }

  if (loading || !isAdmin || !hasLoan) return null

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
      <button
        onClick={() => switchTo("admin")}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all",
          currentView === "admin"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Admin
      </button>
      <button
        onClick={() => switchTo("user")}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all",
          currentView === "user"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <LayoutDashboard className="h-3.5 w-3.5" />
        My View
      </button>
    </div>
  )
}
