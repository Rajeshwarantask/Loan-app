"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Check, Info } from "lucide-react"

export function UpdateAppButton() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdated, setIsUpdated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return
    }

    let registration: ServiceWorkerRegistration | null = null

    const checkForUpdates = () => {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          if (registrations.length === 0) return

          registration = registrations[0]

          // Check for updates every 30 seconds
          const updateCheckInterval = setInterval(() => {
            registration?.update().catch((err) => {
              console.error("[PWA] Update check failed:", err)
            })
          }, 30000)

          // Listen for new service worker
          registration.addEventListener("updatefound", () => {
            console.log("[PWA] Update found - new service worker installing")
            setUpdateAvailable(true)
          })

          return () => clearInterval(updateCheckInterval)
        })
        .catch((err) => {
          console.error("[PWA] Failed to check for updates:", err)
        })
    }

    // Check immediately on mount
    checkForUpdates()
  }, [])

  const handleUpdate = async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service Workers not supported")
      }

      const registrations = await navigator.serviceWorker.getRegistrations()
      if (registrations.length === 0) {
        throw new Error("No service worker registration found")
      }

      const registration = registrations[0]

      // Check for updates
      await registration.update()

      // Listen for the new service worker to become active
      if (registration.waiting) {
        console.log("[PWA] Waiting service worker found, notifying to skip waiting")
        setRefreshing(true)

        // Send skip waiting message to activate new service worker
        registration.waiting.postMessage({ type: "SKIP_WAITING" })

        // Listen for the controller change
        let refreshing = false
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return
          refreshing = true
          console.log("[PWA] Service Worker updated, reloading page")
          setIsUpdated(true)
          setUpdateAvailable(false)

          // Reload page after a brief delay
          setTimeout(() => {
            window.location.reload()
          }, 1000)
        })
      } else if (registration.installing) {
        console.log("[PWA] Service worker installing...")
        setRefreshing(true)

        // Wait for the installing service worker to activate
        registration.installing.addEventListener("statechange", () => {
          if (registration.installing?.state === "activated") {
            console.log("[PWA] New service worker activated, reloading page")
            setIsUpdated(true)
            setUpdateAvailable(false)
            setTimeout(() => {
              window.location.reload()
            }, 1000)
          }
        })
      } else {
        // No updates available
        setUpdateAvailable(false)
        setError("App is already up to date!")
      }
    } catch (err) {
      console.error("[PWA] Update failed:", err)
      setError(err instanceof Error ? err.message : "Failed to update app")
    } finally {
      setIsLoading(false)
    }
  }

  // If not installed or no updates available, don't show anything
  const isInstalled =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any)?.standalone ||
    document.referrer?.includes("android-app://")

  if (!isInstalled) {
    return null
  }

  if (isUpdated) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
        <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
        <div>
          <p className="font-medium text-green-900 dark:text-green-100">✓ App Updated Successfully</p>
          <p className="text-sm text-green-800 dark:text-green-200">
            Your app has been updated to the latest version. The page will reload in a moment.
          </p>
        </div>
      </div>
    )
  }

  if (updateAvailable) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950 md:flex-row md:items-center">
          <div className="flex items-center gap-3 flex-1">
            <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium text-blue-900 dark:text-blue-100">Update Available</h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                A new version of the app is available. Update now for the latest features and improvements.
              </p>
            </div>
          </div>
          <Button
            onClick={handleUpdate}
            disabled={isLoading || refreshing}
            variant="default"
            className="flex-shrink-0"
          >
            {refreshing ? (
              <>
                <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                Updating...
              </>
            ) : isLoading ? (
              <>
                <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Update App
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200 border border-amber-200 dark:border-amber-900">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>
    )
  }

  return null
}
