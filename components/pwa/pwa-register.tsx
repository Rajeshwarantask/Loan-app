"use client"

import { useEffect } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function PWARegister() {
  useEffect(() => {
    // FIX #3: Register SW early if not already registered by layout
    if ("serviceWorker" in navigator) {
      const isPreviewEnv = window.location.hostname.includes("vusercontent.net")

      if (isPreviewEnv) {
        console.log(
          "[PWA] Service Worker registration skipped in preview environment. PWA features will work when deployed to production",
        )
        return
      }

      // Only register if not already registered by layout script
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          if (registrations.length === 0) {
            return navigator.serviceWorker.register("/sw.js")
          }
          return registrations[0]
        })
        .then((registration) => {
          console.log("[PWA] Service Worker active:", registration.scope)

          registration.addEventListener("updatefound", () => {
            console.log("[PWA] Service Worker update found")
          })
        })
        .catch((error) => {
          console.error("[PWA] Service Worker registration failed:", error)
        })
    } else {
      console.log("[PWA] Service Workers not supported")
    }

    // STEP 1: Silently capture install permission
    const captureInstallPrompt = (e: Event) => {
      console.log("[PWA] beforeinstallprompt event captured")
      e.preventDefault()

      const promptEvent = e as BeforeInstallPromptEvent

      // Store the prompt for later use (Step 3)
      window.__PWA_INSTALL_PROMPT__ = promptEvent

      // Dispatch custom event to notify install-prompt component
      window.dispatchEvent(new Event("pwa-install-ready"))

      console.log("[PWA] Install permission stored. Waiting for user login...")
    }

    window.addEventListener("beforeinstallprompt", captureInstallPrompt)

    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt)
    }
  }, [])

  return null
}
