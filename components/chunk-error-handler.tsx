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

        if (navigator.serviceWorker) {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach((registration) => registration.unregister())
          })
        }

        // Hard refresh with cache busting query parameter
        const redirectUrl = window.location.href.split("?")[0] + "?t=" + Date.now()
        window.location.href = redirectUrl
      }
    }

    window.addEventListener("error", handleError)
    return () => window.removeEventListener("error", handleError)
  }, [])

  return <>{children}</>
}
