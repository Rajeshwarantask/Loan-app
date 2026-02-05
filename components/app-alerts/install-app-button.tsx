"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, Download, Check, Info } from "lucide-react"
import Image from "next/image"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallAppButton() {
  const [canInstall, setCanInstall] = useState(true) // Default to true for fallback support
  const [isInstalled, setIsInstalled] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [userAgent, setUserAgent] = useState("")
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)

  useEffect(() => {
    const checkInstallStatus = () => {
      // Check if already installed
      const installed =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes("android-app://")

      setIsInstalled(installed)

      // Detect OS 
      const ua = window.navigator.userAgent
      setUserAgent(ua)
      setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream)
      setIsAndroid(/Android/.test(ua))
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      console.log("[PWA] beforeinstallprompt event fired")
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setCanInstall(true)
    }

    const handleAppInstalled = () => {
      console.log("[PWA] appinstalled event fired")
      setIsInstalled(true)
      setCanInstall(false)
      setDeferredPrompt(null)
    }

    checkInstallStatus()
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  const handleInstall = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // If native prompt is available, use it
      if (deferredPrompt) {
        console.log("[PWA] Using native install prompt")
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice

        if (outcome === "accepted") {
          setIsInstalled(true)
          setCanInstall(false)
        } else {
          setError("Installation was cancelled")
        }
        setDeferredPrompt(null)
      } else if (isIOS) {
        // iOS: Show instructions for manual installation
        setError(
          "iOS: Tap the Share button (↗️) at the bottom, then select 'Add to Home Screen' to install the app."
        )
      } else if (isAndroid) {
        // Android: Try to trigger install prompt or show instructions
        console.log("[PWA] Android device - attempting native install")
        setError(
          "Android: Tap the menu (⋯) or install icon, then select 'Install app' or 'Add to Home Screen'."
        )
      } else {
        setError(
          "Installation is not available on this browser. Please ensure you're using a recent version of Chrome, Edge, Safari, or Firefox."
        )
      }
    } catch (err) {
      console.error("[PWA] Install error:", err)
      setError(err instanceof Error ? err.message : "Failed to initiate app installation")
    } finally {
      setIsLoading(false)
    }
  }

  if (isInstalled) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
        <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
        <div>
          <p className="font-medium text-green-900 dark:text-green-100">✓ App Installed Successfully</p>
          <p className="text-sm text-green-800 dark:text-green-200">
            Vizhuthugal Sangam is installed on your device. You can access it from your home screen or app drawer.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Install Card */}
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700 md:flex-row md:items-center">
        <div className="flex items-center gap-3 flex-1">
          <div className="h-12 w-12 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0">
            <Image
              src="/app-logo.png"
              alt="Vizhuthugal Sangam"
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-slate-900 dark:text-white">Vizhuthugal Sangam</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Install for faster access and offline support</p>
          </div>
        </div>
        <Button onClick={handleInstall} disabled={isLoading} className="flex-shrink-0">
          {isLoading ? (
            <>
              <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              Installing...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Install App
            </>
          )}
        </Button>
      </div>

      {/* Info Message for Browsers Without beforeinstallprompt */}
      {!deferredPrompt && (isIOS || isAndroid) && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            {isIOS
              ? "iOS: Tap Share (↗️) → Add to Home Screen to install this app"
              : "Android: Tap the menu or install icon → Add to Home Screen"}
          </p>
        </div>
      )}

      {/* Error/Instructions Message */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200 border border-amber-200 dark:border-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* PWA Benefits */}
      <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 space-y-2">
        <h4 className="font-medium text-slate-900 dark:text-white text-sm">Why install the app?</h4>
        <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
          <li>✓ Fast access from your home screen</li>
          <li>✓ Works offline after first load</li>
          <li>✓ Better performance</li>
          <li>✓ Native app-like experience</li>
        </ul>
      </div>
    </div>
  )
}
