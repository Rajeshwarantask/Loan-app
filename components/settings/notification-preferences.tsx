"use client"

import { useState, useEffect } from "react"
import { Bell, Check, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getPushSubscriptionStatus,
  savePushSubscription,
  removePushSubscription,
} from "@/lib/utils/push-notifications"

interface NotificationPreferencesProps {
  userId: string
}

export function NotificationPreferences({ userId }: NotificationPreferencesProps) {
  const [isEnabled, setIsEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [supported, setSupported] = useState(true)

  // Check subscription status on mount
  useEffect(() => {
    checkSubscriptionStatus()
  }, [])

  const checkSubscriptionStatus = async () => {
    try {
      const status = await getPushSubscriptionStatus()
      setIsEnabled(status)
    } catch (err) {
      setSupported(false)
    }
  }

  const handleToggle = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      if (isEnabled) {
        // Disable notifications
        const unsubscribed = await unsubscribeFromPushNotifications()
        if (unsubscribed) {
          const removed = await removePushSubscription(userId)
          if (removed) {
            setIsEnabled(false)
            setSuccess(true)
            setTimeout(() => setSuccess(false), 3000)
          }
        }
      } else {
        // Enable notifications
        try {
          const subscription = await subscribeToPushNotifications()
          if (subscription) {
            const saved = await savePushSubscription(subscription, userId)
            if (saved) {
              setIsEnabled(true)
              setSuccess(true)
              setTimeout(() => setSuccess(false), 3000)
            }
          } else {
            setError("Failed to enable notifications. Please check your browser permissions.")
          }
        } catch (subscriptionError) {
          const errorMsg = subscriptionError instanceof Error ? subscriptionError.message : "Failed to enable notifications"
          setError(errorMsg)
          console.error("[Notifications] Enable error:", subscriptionError)
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred"
      setError(errorMsg)
      console.error("[Notifications] Toggle error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!supported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            Push notifications are not supported on this device or browser.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>Get reminders for EMI due dates and payment updates</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium text-slate-900 dark:text-white">
                {isEnabled ? "Notifications Enabled" : "Notifications Disabled"}
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {isEnabled
                  ? "You'll receive reminders for EMI due dates and payment confirmations."
                  : "Enable notifications to get important reminders and updates."}
              </p>
            </div>
            {isEnabled && <Check className="h-5 w-5 text-green-600 dark:text-green-400" />}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{isEnabled ? "Notifications enabled successfully!" : "Notifications disabled successfully!"}</p>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="font-medium text-slate-900 dark:text-white">Notification Types</h4>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              EMI Due Date Reminders
            </li>
            <li className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              Payment Confirmations
            </li>
            <li className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              Important Account Updates
            </li>
          </ul>
        </div>

        <Button
          onClick={handleToggle}
          disabled={isLoading}
          variant={isEnabled ? "destructive" : "default"}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEnabled ? "Disabling..." : "Enabling..."}
            </>
          ) : isEnabled ? (
            "Disable Notifications"
          ) : (
            "Enable Notifications"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
