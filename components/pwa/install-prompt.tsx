"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Download } from "lucide-react"
import Image from "next/image"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const DISMISS_COOLDOWN = 60 * 60 * 1000 // 1 hour

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    console.log("[PWA] InstallPrompt component mounted")

    const isInstalled = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes("android-app://")

    const isDismissed = () => {
      const dismissedTime = localStorage.getItem("pwa-install-dismissed")
      return (
        dismissedTime !== null &&
        Date.now() - Number(dismissedTime) < DISMISS_COOLDOWN
      )
    }

    // STEP 2 & 3: Show dialog when user logs in
    const handleUserLogin = () => {
      console.log("[PWA] User login detected")

      // Check if install permission is available and conditions are met
      const hasInstallPrompt = !!(window as any).__PWA_INSTALL_PROMPT__
      const canShowPrompt = hasInstallPrompt && !isDismissed() && !isInstalled()

      console.log("[PWA] Install check:", {
        hasInstallPrompt,
        isDismissed: isDismissed(),
        isInstalled: isInstalled(),
        canShowPrompt,
      })

      if (canShowPrompt) {
        console.log("[PWA] Showing install prompt dialog")
        // Small delay to ensure UI is ready
        setTimeout(() => setShowPrompt(true), 500)
      }
    }

    window.addEventListener("user-logged-in", handleUserLogin)

    return () => {
      window.removeEventListener("user-logged-in", handleUserLogin)
    }
  }, [])

  const handleInstall = async () => {
    const promptEvent = (window as any).__PWA_INSTALL_PROMPT__ as BeforeInstallPromptEvent

    if (!promptEvent) {
      console.warn("[PWA] Install prompt not available")
      setShowPrompt(false)
      localStorage.setItem("pwa-install-dismissed", Date.now().toString())
      return
    }

    try {
      console.log("[PWA] Triggering install prompt")
      await promptEvent.prompt()

      const { outcome } = await promptEvent.userChoice
      console.log("[PWA] Install outcome:", outcome)

      if (outcome === "accepted") {
        console.log("[PWA] User accepted install")
      } else {
        console.log("[PWA] User dismissed install")
      }
    } catch (err) {
      console.error("[PWA] Install error:", err)
    }

    // Clear the stored prompt
    (window as any).__PWA_INSTALL_PROMPT__ = null
    setShowPrompt(false)

    // Set dismiss cooldown
    localStorage.setItem("pwa-install-dismissed", Date.now().toString())
  }

  const handleDismiss = () => {
    console.log("[PWA] User dismissed install prompt")
    localStorage.setItem("pwa-install-dismissed", Date.now().toString())
    setShowPrompt(false)
  }

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="max-w-xs w-80 rounded-2xl p-8 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Close Button (X) */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          aria-label="Close"
        >
          <svg
            className="w-5 h-5 text-slate-600 dark:text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Content */}
        <div className="flex flex-col items-center justify-center space-y-4">
          {/* App Logo */}
          <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Image
              src="/app-logo.png"
              alt="Vizhuthugal Sangam"
              width={96}
              height={96}
              className="w-full h-full object-cover"
            />
          </div>

          {/* App Name */}
          <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white">
            Vizhuthugal Sangam
          </h2>

          {/* Install Button */}
          <Button
            onClick={handleInstall}
            className="w-full mt-4 bg-primary hover:bg-primary/90 text-white rounded-lg py-3 font-semibold flex items-center justify-center gap-2"
            size="lg"
          >
            <Download className="h-5 w-5" />
            Install App
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
