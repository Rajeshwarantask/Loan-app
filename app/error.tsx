"use client"

import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error for debugging
    console.error("[v0] Chunk loading error:", error.message)
  }, [error])

  // Check if this is a chunk loading error
  const isChunkError =
    error.message?.includes("Failed to load chunk") ||
    error.message?.includes("404") ||
    error.message?.includes("Cannot find module")

  const handleRefresh = () => {
    if (isChunkError) {
      // Use window.location.reload(true) for hard refresh, or navigate with cache-busting
      if (navigator.serviceWorker) {
        // Clear all service workers to remove cached chunks
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => registration.unregister())
        })
      }
      // Hard refresh - bypass cache entirely
      window.location.href = window.location.href + "?t=" + Date.now()
      setTimeout(() => {
        window.location.reload(true) // Force hard refresh if href doesn't work
      }, 100)
    } else {
      reset()
    }
  }

  return (
    <html>
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            fontFamily: "system-ui, -apple-system, sans-serif",
            backgroundColor: "#f5f5f5",
            padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "40px",
              borderRadius: "8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              maxWidth: "500px",
              textAlign: "center",
            }}
          >
            <h1 style={{ margin: "0 0 16px 0", color: "#1f2937" }}>
              {isChunkError ? "Application Update Available" : "Something went wrong"}
            </h1>
            <p style={{ color: "#6b7280", margin: "0 0 24px 0" }}>
              {isChunkError
                ? "The app needs to be refreshed to load the latest version."
                : "An unexpected error occurred. Please try again."}
            </p>
            <button
              onClick={handleRefresh}
              style={{
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                padding: "12px 24px",
                borderRadius: "6px",
                fontSize: "16px",
                cursor: "pointer",
                fontWeight: "500",
              }}
            >
              {isChunkError ? "Refresh Application" : "Try Again"}
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
