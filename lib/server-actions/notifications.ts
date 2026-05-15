"use server"

import { createClient } from "@/lib/supabase/server"

interface NotificationRequest {
  type: "payment" | "loan_approval" | "loan_rejection" | "penalty" | "notice" | "loan_created" | "loan_topup"
  userId?: string
  userIds?: string[]
  title: string
  body: string
  data?: Record<string, any>
}

/**
 * Server Action to trigger push notifications
 * This is more reliable than fetch() calls in client components
 * as it ensures the request completes even if browser tab closes
 */
export async function triggerNotification(request: NotificationRequest) {
  try {
    console.log("[v0] [SA] Server action - Triggering notification:", {
      type: request.type,
      userId: request.userId,
      userIds: request.userIds?.length,
      title: request.title,
    })

    const supabase = await createClient()

    let userIds: string[] = []

    if (request.userId) {
      userIds = [request.userId]
      console.log("[v0] [SA] Notification target: Single user -", request.userId)
    } else if (request.userIds) {
      userIds = request.userIds
      console.log("[v0] [SA] Notification target: Multiple users -", userIds.length)
    }

    if (userIds.length === 0) {
      console.error("[v0] [SA] No users specified for notification")
      return { success: false, error: "No users specified" }
    }

    // Get all push subscriptions for these users
    console.log("[v0] [SA] Fetching subscriptions for user IDs:", userIds)
    const { data: subscriptions, error: fetchError } = await supabase
      .from("push_subscriptions")
      .select("user_id, subscription, enabled")
      .in("user_id", userIds)
      .eq("enabled", true)
    
    console.log("[v0] [SA] Query result:", {
      subscriptionCount: subscriptions?.length || 0,
      userIdsInSubscriptions: subscriptions?.map(s => s.user_id) || [],
    })

    if (fetchError) {
      console.error("[SA] Error fetching subscriptions:", fetchError)
      return { success: false, error: "Failed to fetch subscriptions" }
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[SA] No active subscriptions for ${userIds.length} users`)
      return { success: true, sent: 0, message: "No active subscriptions" }
    }

    console.log(`[SA] Found ${subscriptions.length} active subscriptions, sending notifications...`)

    // Import web-push and send directly
    const webpush = require("web-push")

    // Configure VAPID keys
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY

    if (!publicKey || !privateKey) {
      console.error("[SA] VAPID keys not configured")
      return { success: false, error: "VAPID keys not configured" }
    }

    webpush.setVapidDetails("mailto:admin@vizhuthugal.com", publicKey, privateKey)

    // Create the notification payload
    const message = {
      title: request.title || "Vizhuthugal Sangam",
      body: request.body || "You have a new notification",
      icon: "/icon-192.png",
      badge: "/notification-badge.png",
      tag: `notification-${request.type}`,
      ...request.data,
    }

    console.log("[SA] Sending push notifications to", subscriptions.length, "subscriptions")

    // Send to all subscriptions
    const results = await Promise.all(
      subscriptions.map(async (sub, index) => {
        try {
          // Parse subscription if it's a string
          let subscription = sub.subscription as any
          if (typeof subscription === "string") {
            console.log(`[v0] [SA] Subscription ${index + 1} is a string, parsing...`)
            subscription = JSON.parse(subscription)
          }
          
          console.log(`[v0] [SA] Sending to subscription ${index + 1}:`, {
            endpoint: subscription.endpoint?.substring(0, 50),
            hasKeys: !!subscription.keys,
            hasAuth: !!subscription.keys?.auth,
            hasP256dh: !!subscription.keys?.p256dh,
          })

          await webpush.sendNotification(subscription, JSON.stringify(message))
          console.log(`[v0] [SA] Sent successfully to subscription ${index + 1}`)
          return true
        } catch (error) {
          console.error(`[v0] [SA] Failed to send to subscription ${index + 1}:`, error)
          if (error instanceof Error) {
            console.error(`[v0] [SA] Error message:`, error.message)
          }
          return false
        }
      })
    )

    const successCount = results.filter(Boolean).length
    console.log(`[SA] Successfully sent ${successCount}/${subscriptions.length} notifications`)

    return { success: true, sent: successCount, total: subscriptions.length }
  } catch (error) {
    console.error("[SA] Server action error:", error)
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    return { success: false, error: errorMsg }
  }
}
