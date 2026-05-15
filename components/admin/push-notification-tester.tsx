"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useUser } from "@/hooks/use-user"

interface TestResult {
  success: boolean
  user?: string
  subscriptions?: number
  vapidConfigured?: boolean
  sendResult?: any
  error?: string
}

export function PushNotificationTester() {
  const { user } = useUser()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)

  const handleTestNotification = async () => {
    if (!user) {
      setResult({ success: false, error: "User not logged in" })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      console.log("[v0] [Tester] Sending test notification for user:", user.id)
      
      // Call the test send endpoint directly for maximum debugging
      console.log("[v0] [Tester] Calling /api/notifications/send-test endpoint...")
      const response = await fetch("/api/notifications/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      })

      const result = await response.json()
      console.log("[v0] [Tester] API response:", result)
      
      // Format result for display
      setResult({
        success: result.success || false,
        subscriptions: result.total || 0,
        sendResult: result,
        error: result.error,
      })
    } catch (error) {
      console.error("[v0] [Tester] Error:", error)
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-blue-200">
      <CardHeader className="bg-blue-50">
        <CardTitle>Push Notification Tester</CardTitle>
        <CardDescription>Send a test push notification to verify the system is working</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <Button onClick={handleTestNotification} disabled={loading || !user} size="lg" className="w-full">
          {loading ? "Sending..." : "Send Test Notification"}
        </Button>

        {result && (
          <Alert className={result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
            <AlertDescription className="text-sm space-y-2">
              <div className="font-semibold">{result.success ? "✓ Test Sent" : "✗ Test Failed"}</div>

              {result.user && <div>User: {result.user}</div>}

              {result.subscriptions !== undefined && (
                <div>Active Subscriptions: {result.subscriptions}</div>
              )}

              {result.vapidConfigured !== undefined && (
                <div className={result.vapidConfigured ? "text-green-700" : "text-red-700"}>
                  VAPID Keys: {result.vapidConfigured ? "✓ Configured" : "✗ Not Configured"}
                </div>
              )}

              {result.sendResult && (
                <div className="text-xs bg-white p-2 rounded border border-gray-200 mt-2 max-h-40 overflow-auto font-mono">
                  {JSON.stringify(result.sendResult, null, 2)}
                </div>
              )}

              {result.error && <div className="text-red-600 font-semibold">Error: {result.error}</div>}
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-gray-500 space-y-1 pt-4 border-t">
          <p>• Make sure your device has the app installed as PWA</p>
          <p>• Check your browser console for detailed logs</p>
          <p>• Verify VAPID keys are set in environment variables</p>
          <p>• Look for notification in system tray or notification center</p>
        </div>
      </CardContent>
    </Card>
  )
}
