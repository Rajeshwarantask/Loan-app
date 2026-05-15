"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react"

interface DebugNotificationSaverProps {
  userId: string
}

export function DebugNotificationSaver({ userId }: DebugNotificationSaverProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSaveTestSubscription = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      console.log("[DEBUG] Starting manual subscription creation...")

      // Step 1: Check if service worker is ready
      console.log("[DEBUG] Checking service worker...")
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service Worker not supported")
      }

      const registration = await navigator.serviceWorker.ready
      console.log("[DEBUG] Service worker ready:", registration.scope)

      // Step 2: Check if already subscribed
      console.log("[DEBUG] Checking existing subscriptions...")
      let subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        console.log("[DEBUG] Already subscribed, using existing subscription")
        setResult({ message: "Already subscribed", subscription: subscription.toJSON() })
      } else {
        // Step 3: Create new subscription
        console.log("[DEBUG] Creating new subscription...")
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        
        if (!vapidKey) {
          throw new Error("VAPID key not configured")
        }

        console.log("[DEBUG] VAPID key length:", vapidKey.length)

        // Convert VAPID key
        const padding = "=".repeat((4 - (vapidKey.length % 4)) % 4)
        const base64 = (vapidKey + padding).replace(/\-/g, "+").replace(/_/g, "/")
        const rawData = window.atob(base64)
        const applicationServerKey = new Uint8Array(rawData.length)
        for (let i = 0; i < rawData.length; ++i) {
          applicationServerKey[i] = rawData.charCodeAt(i)
        }

        console.log("[DEBUG] VAPID key converted to Uint8Array, length:", applicationServerKey.length)

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })

        console.log("[DEBUG] New subscription created")
        setResult({ message: "New subscription created", subscription: subscription.toJSON() })
      }

      // Step 4: Save to database
      console.log("[DEBUG] Saving subscription to database...")
      const response = await fetch("/api/notifications/save-test-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          subscription: subscription.toJSON(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save subscription")
      }

      console.log("[DEBUG] Subscription saved successfully:", data)
      setResult({ ...data, subscription: subscription.toJSON() })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error"
      console.error("[DEBUG] Error:", errorMsg)
      setError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔧 Debug: Manual Subscription
        </CardTitle>
        <CardDescription>Test subscription creation and saving directly</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleSaveTestSubscription} disabled={isLoading} className="w-full">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Test Subscription Creation
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <div className="font-semibold">{result.message}</div>
              <div className="mt-2 text-sm">
                <div>
                  <strong>Endpoint:</strong>
                  <div className="break-words font-mono text-xs">{result.subscription?.endpoint.substring(0, 100)}...</div>
                </div>
                <div className="mt-2">
                  <strong>Keys:</strong>
                  <div className="font-mono text-xs">
                    p256dh: {result.subscription?.keys?.p256dh ? "✓" : "✗"}
                    {result.subscription?.keys?.p256dh && ` (${result.subscription.keys.p256dh.length} chars)`}
                  </div>
                  <div className="font-mono text-xs">
                    auth: {result.subscription?.keys?.auth ? "✓" : "✗"}
                    {result.subscription?.keys?.auth && ` (${result.subscription.keys.auth.length} chars)`}
                  </div>
                </div>
                {result.data && (
                  <div className="mt-2">
                    <strong>Database Save Result:</strong>
                    <div className="font-mono text-xs">{JSON.stringify(result.data, null, 2).substring(0, 200)}</div>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
