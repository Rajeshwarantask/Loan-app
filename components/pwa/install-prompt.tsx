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

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    console.log("[v0] InstallPrompt mounted")

    const captureInstallPrompt = (e: Event) => {
      console.log("[v0] beforeinstallprompt event captured")
      e.preventDefault()
      globalDeferredPrompt = e as BeforeInstallPromptEvent
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener("beforeinstallprompt", captureInstallPrompt)

    const checkAuthentication = () => {
      const hasCookie = document.cookie.includes("sb-access-token") || document.cookie.includes("sb-refresh-token")
      console.log("[v0] User authenticated:", hasCookie)
      return hasCookie
    }

    const isInstalled =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes("android-app://")

    const dismissed = localStorage.getItem("pwa-install-dismissed")

    console.log("[v0] PWA Status - Installed:", isInstalled, "Dismissed:", dismissed)

    if (checkAuthentication() && !isInstalled && !dismissed) {
      console.log("[v0] Showing PWA install prompt")
      setTimeout(() => {
        setShowPrompt(true)
      }, 1000)
    }

    const handleLoginSuccess = () => {
      console.log("[v0] Login success event received")
      if (!isInstalled && !dismissed) {
        setTimeout(() => {
          setShowPrompt(true)
        }, 500)
      }
    }

    window.addEventListener("user-logged-in", handleLoginSuccess)

    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt)
      window.removeEventListener("user-logged-in", handleLoginSuccess)
    }
  }, [])

  const handleInstall = async () => {
    console.log("[v0] Install button clicked")

    const promptToUse = deferredPrompt || globalDeferredPrompt

    if (!promptToUse) {
      console.log("[v0] No deferred prompt available")
      setShowPrompt(false)
      localStorage.setItem("pwa-install-dismissed", "true")
      return
    }

    try {
      console.log("[v0] Triggering native install prompt")
      await promptToUse.prompt()
      const { outcome } = await promptToUse.userChoice
      console.log("[v0] User choice:", outcome)

      if (outcome === "accepted") {
        console.log("[v0] PWA installed successfully")
      } else {
        console.log("[v0] PWA installation dismissed")
      }

      globalDeferredPrompt = null
      setDeferredPrompt(null)
    } catch (error) {
      console.error("[v0] Install error:", error)
    }

    setShowPrompt(false)
    localStorage.setItem("pwa-install-dismissed", "true")
  }

  const handleDismiss = () => {
    console.log("[v0] Install prompt dismissed")
    localStorage.setItem("pwa-install-dismissed", "true")
    setShowPrompt(false)
  }

  if (!showPrompt) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[100]" onClick={handleDismiss} />

      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <Card className="border-2 shadow-2xl bg-background w-full max-w-sm pointer-events-auto relative">
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-3 right-3 h-8 w-8 rounded-full hover:bg-muted"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>

          <CardContent className="p-6 pt-12">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-md">
                <Image src="/app-logo.png" alt="Vizhuthugal Sangam" width={80} height={80} className="object-cover" />
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Install Vizhuthugal Sangam</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Get quick access to your loans and finances. Works offline after installation.
                </p>
              </div>

              <Button onClick={handleInstall} className="w-full" size="lg">
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
