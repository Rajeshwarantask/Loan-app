// Push Notification Utility Functions

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.log("[Push] Notifications not supported")
    return false
  }

  if (Notification.permission === "granted") {
    console.log("[Push] Notification permission already granted")
    return true
  }

  if (Notification.permission === "denied") {
    console.warn("[Push] Notification permission previously denied by user")
    return false
  }

  if (Notification.permission !== "denied") {
    console.log("[Push] Requesting notification permission from user...")
    const permission = await Notification.requestPermission()
    console.log("[Push] Permission result:", permission)

    if (permission === "granted") {
      return true
    } else if (permission === "denied") {
      console.warn("[Push] User denied notification permission")
      return false
    }
  }

  return false
}

export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.log("[Push] Push notifications not supported")
      return null
    }

    // Request permission first
    const hasPermission = await requestNotificationPermission()
    if (!hasPermission) {
      console.log("[Push] Permission denied")
      return null
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidPublicKey) {
      throw new Error("VAPID public key is not configured. Please set NEXT_PUBLIC_VAPID_PUBLIC_KEY environment variable.")
    }

    const registration = await navigator.serviceWorker.ready
    
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription()
    
    if (!subscription) {
      // Create new subscription with valid VAPID key
      try {
        console.log("[Push] Converting VAPID key to Uint8Array...")
        const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)
        console.log("[Push] VAPID key converted successfully, subscribing to push manager...")
        
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })
        
        console.log("[Push] Successfully subscribed to push manager")
      } catch (subscriptionError) {
        console.error("[Push] Subscription failed:", subscriptionError)
        const errorMsg = subscriptionError instanceof Error ? subscriptionError.message : String(subscriptionError)
        
        if (errorMsg.includes("InvalidAccessError")) {
          throw new Error("VAPID public key is invalid. Please check that NEXT_PUBLIC_VAPID_PUBLIC_KEY environment variable is correctly set.")
        } else if (errorMsg.includes("applicationServerKey")) {
          throw new Error("Failed to subscribe to push notifications. The applicationServerKey (VAPID public key) format may be invalid.")
        } else {
          throw new Error(`Failed to subscribe to push notifications: ${errorMsg}`)
        }
      }
    }

    console.log("[Push] Subscribed to push notifications:", subscription)
    return subscription
  } catch (error) {
    console.error("[Push] Subscription error:", error)
    throw error
  }
}

export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    
    if (subscription) {
      await subscription.unsubscribe()
      console.log("[Push] Unsubscribed from push notifications")
      return true
    }
    return false
  } catch (error) {
    console.error("[Push] Unsubscribe error:", error)
    return false
  }
}

export async function getPushSubscriptionStatus(): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return false
    }

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return !!subscription
  } catch (error) {
    console.error("[Push] Status check error:", error)
    return false
  }
}

// Helper function to convert VAPID key (URL-safe base64 to Uint8Array)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  if (!base64String) {
    throw new Error("VAPID key is empty")
  }

  try {
    // Pad the string if needed
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    // Convert URL-safe base64 to standard base64
    const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/")

    // Decode base64 to binary string
    const rawData = window.atob(base64)
    
    // Convert binary string to Uint8Array
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    
    console.log(`[Push] Converted VAPID key (${base64String.length} chars) to Uint8Array (${outputArray.length} bytes)`)
    return outputArray
  } catch (error) {
    console.error("[Push] Failed to convert VAPID key:", error)
    throw new Error(`Invalid VAPID key format: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Save subscription to backend
export async function savePushSubscription(subscription: PushSubscription, userId: string): Promise<boolean> {
  try {
    console.log("[Push] Saving subscription to backend for user:", userId)
    console.log("[Push] Subscription endpoint:", subscription.endpoint)
    
    // The PushSubscription has keys as an object with p256dh and auth properties
    // These are already strings (base64 encoded), not CryptoKey objects
    console.log("[Push] Keys object:", subscription.keys)

    // Use toJSON() method if available, otherwise use the object directly
    const subscriptionJSON = subscription.toJSON()
    console.log("[Push] Subscription JSON:", JSON.stringify(subscriptionJSON, null, 2))

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    try {
      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscriptionJSON,
          userId,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      console.log("[Push] Response status:", response.status)
      console.log("[Push] Response headers:", {
        contentType: response.headers.get("content-type"),
      })

      let responseData
      try {
        responseData = await response.json()
      } catch (parseError) {
        console.error("[Push] Failed to parse response JSON:", parseError)
        const text = await response.text()
        console.error("[Push] Response text:", text)
        throw new Error("Invalid response from server")
      }

      console.log("[Push] Backend response:", responseData)

      if (!response.ok) {
        throw new Error(responseData.error || `Server error: ${response.status}`)
      }

      console.log("[Push] Subscription saved to backend successfully")
      return true
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError instanceof TypeError && fetchError.message.includes("abort")) {
        console.error("[Push] Request timeout after 10 seconds")
        throw new Error("Request timeout - server not responding")
      }
      throw fetchError
    }
  } catch (error) {
    console.error("[Push] Failed to save subscription:", error)
    if (error instanceof Error) {
      console.error("[Push] Error message:", error.message)
      console.error("[Push] Error stack:", error.stack?.split("\n").slice(0, 3).join("\n"))
    }
    return false
  }
}

// Remove subscription from backend
export async function removePushSubscription(userId: string): Promise<boolean> {
  try {
    const response = await fetch("/api/notifications/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })

    if (!response.ok) {
      throw new Error("Failed to remove subscription")
    }

    console.log("[Push] Subscription removed from backend")
    return true
  } catch (error) {
    console.error("[Push] Failed to remove subscription:", error)
    return false
  }
}
