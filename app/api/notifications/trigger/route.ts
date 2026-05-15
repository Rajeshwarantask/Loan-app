import { createServerClient } from "@/lib/supabase/server"

interface NotificationRequest {
  type: "payment" | "loan_approval" | "loan_rejection" | "penalty" | "notice"
  userId?: string
  userIds?: string[]
  title: string
  body: string
  data?: Record<string, any>
}

interface PushSubscription {
  endpoint: string
  expirationTime: null | number
  keys: {
    p256dh: string
    auth: string
  }
}

export async function POST(request: Request) {
  try {
    const notificationRequest: NotificationRequest = await request.json()
    const supabase = await createServerClient()

    let userIds: string[] = []

    if (notificationRequest.userId) {
      userIds = [notificationRequest.userId]
    } else if (notificationRequest.userIds) {
      userIds = notificationRequest.userIds
    }

    if (userIds.length === 0) {
      return Response.json({ error: "No users specified" }, { status: 400 })
    }

    // Get all push subscriptions for these users (subscription is JSONB)
    const { data: subscriptions, error: fetchError } = await supabase
      .from("push_subscriptions")
      .select("user_id, subscription, enabled")
      .in("user_id", userIds)
      .eq("enabled", true)

    if (fetchError) {
      console.error("[v0] Error fetching subscriptions:", fetchError)
      return Response.json({ error: "Failed to fetch subscriptions" }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[v0] No active subscriptions for ${userIds.length} users`)
      return Response.json({ success: true, sent: 0 }, { status: 200 })
    }

    // Send notifications through the send endpoint
    const sendUrl = new URL("/api/notifications/send", request.url)
    console.log(`[Trigger] Sending notifications to ${subscriptions.length} subscriptions`)
    
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          console.log(`[Trigger] Sending notification to user ${sub.user_id}`)
          const subscription = sub.subscription as PushSubscription
          
          const sendResponse = await fetch(sendUrl.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: sub.user_id,
              type: notificationRequest.type,
              title: notificationRequest.title,
              body: notificationRequest.body,
              data: notificationRequest.data || {},
            }),
          })
          
          const responseData = await sendResponse.json()
          console.log(`[Trigger] Response for user ${sub.user_id}:`, responseData)
          
          return sendResponse.ok
        } catch (error) {
          console.error(`[Trigger] Failed to send notification for ${sub.user_id}:`, error)
          return false
        }
      })
    )

    console.log(`[v0] Notifications processed for ${subscriptions.length} subscriptions`)
    return Response.json({ success: true, sent: subscriptions.length }, { status: 200 })
  } catch (error) {
    console.error("[v0] Notification trigger error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
