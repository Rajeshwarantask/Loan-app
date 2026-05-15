"use client"

import { useEffect } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function PWARegister() {
  useEffect(() => {
    // Register SW in all environments (including preview for testing)
    if ("serviceWorker" in navigator) {
      // Only skip registration in localhost during development (if needed)
      // const isDev = window.location.hostname === "localhost"
      // if (isDev) return

      console.log("[PWA] Registering Service Worker from:", window.location.hostname)

      // Check if already registered
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          if (registrations.length === 0) {
            console.log("[PWA] No existing registrations, registering new service worker...")
            return navigator.serviceWorker.register("/sw.js")
          } else {
            console.log("[PWA] Service Worker already registered, count:", registrations.length)
            return registrations[0]
          }
        })
        .then((registration) => {
          console.log("[PWA] Service Worker registered successfully")
          console.log("[PWA] Service Worker scope:", registration.scope)
          console.log("[PWA] Service Worker active:", !!registration.active)
          console.log("[PWA] Service Worker installing:", !!registration.installing)
          console.log("[PWA] Service Worker waiting:", !!registration.waiting)

          registration.addEventListener("updatefound", () => {
            console.log("[PWA] Service Worker update found")
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                console.log("[PWA] New Service Worker state:", newWorker.state)
              })
            }
          })

          // Check current controller
          if (navigator.serviceWorker.controller) {
            console.log("[PWA] Service Worker controller is active")
          } else {
            console.log("[PWA] No Service Worker controller yet - will activate on next page load")
          }
        })
        .catch((error) => {
          console.error("[PWA] Service Worker registration failed:", error)
          console.error("[PWA] Error message:", error?.message)
        })
    } else {
      console.log("[PWA] Service Workers not supported in this browser")
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
