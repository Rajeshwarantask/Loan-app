"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { X, Download } from "lucide-react"
import Image from "next/image"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

// ✅ Global backup (important for Chrome behavior)
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)

  // ✅ Tracks if Chrome approved install
  const [canInstall, setCanInstall] = useState(false)

  useEffect(() => {
    console.log("[PWA] InstallPrompt mounted")

    // 🔹 Capture Chrome install permission
    const captureInstallPrompt = (e: Event) => {
      console.log("[PWA] beforeinstallprompt fired")
      e.preventDefault()

      const promptEvent = e as BeforeInstallPromptEvent
      globalDeferredPrompt = promptEvent
      setDeferredPrompt(promptEvent)
      setCanInstall(true)
    }

    window.addEventListener("beforeinstallprompt", captureInstallPrompt)

    // 🔹 Show dialog AFTER login
    const handleLoginSuccess = () => {
      console.log("[PWA] User logged in")

      const dismissedTime = localStorage.getItem("pwa-install-dismissed")
      const dismissed =
        dismissedTime !== null &&
        Date.now() - Number(dismissedTime) < 7 * 24 * 60 * 60 * 1000

      const isInstalled =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes("android-app://")

      if (canInstall && !dismissed && !isInstalled) {
        console.log("[PWA] Showing install prompt after login")
        setTimeout(() => setShowPrompt(true), 500)
      }
    }

    window.addEventListener("user-logged-in", handleLoginSuccess)

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        captureInstallPrompt
      )
      window.removeEventListener(
        "user-logged-in",
        handleLoginSuccess
      )
    }
  }, [canInstall])

  // 🔹 Install handler
  const handleInstall = async () => {
    const promptToUse = deferredPrompt || globalDeferredPrompt

    if (!promptToUse) {
      console.warn("[PWA] Install clicked without prompt")
      setShowPrompt(false)
      localStorage.setItem(
        "pwa-install-dismissed",
        Date.now().toString()
      )
      return
    }

    try {
      await promptToUse.prompt()
      const { outcome } = await promptToUse.userChoice
      console.log("[PWA] Install outcome:", outcome)
    } catch (err) {
      console.error("[PWA] Install failed:", err)
    }

    globalDeferredPrompt = null
    setDeferredPrompt(null)
    setShowPrompt(false)

    localStorage.setItem(
      "pwa-install-dismissed",
      Date.now().toString()
    )
  }

  // 🔹 Dismiss handler
  const handleDismiss = () => {
    localStorage.setItem(
      "pwa-install-dismissed",
      Date.now().toString()
    )
    setShowPrompt(false)
  }

  if (!showPrompt) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 z-[100]"
        onClick={handleDismiss}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <Card className="border-2 shadow-2xl bg-background w-full max-w-sm pointer-events-auto relative">
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-3 right-3 h-8 w-8"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>

          <CardContent className="p-6 pt-12">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-md">
                <Image
                  src="/app-logo.png"
                  alt="Vizhuthugal Sangam"
                  width={80}
                  height={80}
                />
              </div>

              <h3 className="font-semibold text-lg">
                Install Vizhuthugal Sangam
              </h3>

              <p className="text-sm text-muted-foreground">
                Get quick access to your loans and finances.
                Works offline after installation.
              </p>

              <Button
                onClick={handleInstall}
                className="w-full"
                size="lg"
              >
                <Download className="h-4 w-4 mr-2" />
                Install App
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
