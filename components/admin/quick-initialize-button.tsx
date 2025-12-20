"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

interface QuickInitializeButtonProps {
  isInitialized: boolean
}

export function QuickInitializeButton({ isInitialized }: QuickInitializeButtonProps) {
  const [isInitializing, setIsInitializing] = useState(false)
  const router = useRouter()

  const handleQuickInitialize = async () => {
    try {
      setIsInitializing(true)
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert("You must be logged in to initialize a month")
        return
      }

      const now = new Date()
      const month = now.getMonth() + 1
      const year = now.getFullYear()

      const periodKey = `${year}-${String(month).padStart(2, "0")}`

      console.log("[v0] Quick initializing for period_key:", periodKey, "user:", user.id)

      const { data, error } = await supabase.rpc("initialize_new_month", {
        p_period_key: periodKey,
        p_created_by: user.id,
      })

      if (error) {
        console.error("[v0] Error initializing month:", error)
        alert(`Failed to initialize month: ${error.message}`)
        return
      }

      console.log("[v0] Month initialized successfully:", data)
      alert(`Successfully initialized ${now.toLocaleString("default", { month: "long" })} ${year}!`)

      // Refresh the page to show updated data
      router.refresh()
    } catch (err) {
      console.error("[v0] Error in quick initialize:", err)
      alert("An error occurred while initializing the month")
    } finally {
      setIsInitializing(false)
    }
  }

  if (isInitialized) {
    return (
      <Button variant="destructive" size="default" disabled>
        Initialized
      </Button>
    )
  }

  return (
    <Button onClick={handleQuickInitialize} disabled={isInitializing} size="default">
      {isInitializing ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Initializing...
        </>
      ) : (
        "Initialize"
      )}
    </Button>
  )
}
