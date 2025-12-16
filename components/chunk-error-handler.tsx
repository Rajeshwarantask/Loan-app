"use client"

import { useEffect, type ReactNode } from "react"

export function ChunkErrorHandler({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Listen for chunk errors
    const handleError = (event: ErrorEvent) => {
      if (
        event.message?.includes("Failed to load chunk") ||
        event.message?.includes("Cannot find module") ||
        event.filename?.includes("_next/static/chunks")
      ) {
        console.error("[v0] Chunk loading error detected:", event.message)
        // Clear localStorage to remove stale service worker
        try {
          localStorage.clear()
        } catch (e) {
          console.error("[v0] Failed to clear localStorage:", e)
        }
        // Reload with cache bust
        window.location.href = window.location.origin
      }
    }

    window.addEventListener("error", handleError)
    return () => window.removeEventListener("error", handleError)
  }, [])

  return <>{children}</>
}
