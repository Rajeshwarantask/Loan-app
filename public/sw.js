const CACHE_NAME = "vizhuthugal-sangam-v6-notification-badge"
const OFFLINE_URL = "/offline"

const STATIC_ASSETS = [
  "/",
  "/offline",
  "/manifest.json",
  "/app-logo.png",
  "/icon-192.png",
  "/icon-512.png",
  "/notification-badge.png",
]

// INSTALL - FIX #1: Skip waiting immediately
self.addEventListener("install", (event) => {
  console.log("[SW] Installing")

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => {
        // Skip waiting immediately to take control faster
        self.skipWaiting()
      })
  )
})

// ACTIVATE - FIX #1: Claim clients immediately
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating")

  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key)
            }
          })
        )
      )
      .then(() => {
        // Claim all clients immediately
        self.clients.claim()
      })
  )
})

// FETCH
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return
  if (!event.request.url.startsWith("http")) return
  if (event.request.url.includes("supabase.co")) return

  // Navigation requests
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    )
    return
  }

  // Static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request)
    })
  )
})

// PUSH NOTIFICATIONS
self.addEventListener("push", (event) => {
  console.log("[v0] [SW] Push event received")
  console.log("[v0] [SW] Event data exists:", !!event.data)

  let notificationData = {
    title: "Vizhuthugal Sangam",
    body: "You have a new notification",
    icon: "/icon-192.png",
    badge: "/notification-badge.png",
    tag: "vizhuthugal-notification",
  }

  if (event.data) {
    try {
      const data = event.data.json()
      console.log("[v0] [SW] Parsed notification data:", data)
      
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || "/notification-badge.png",
        tag: data.tag || notificationData.tag,
        data: data,
      }
    } catch (error) {
      console.error("[v0] [SW] Error parsing push data:", error)
      // Try to get text content
      try {
        const text = event.data.text()
        console.log("[v0] [SW] Raw text data:", text)
        notificationData.body = text
      } catch (e) {
        console.error("[v0] [SW] Could not get text data:", e)
      }
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: notificationData.data || {},
    actions: [],
  }

  console.log("[v0] [SW] Showing notification with options:", options)

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
      .then(() => {
        console.log("[v0] [SW] Notification shown successfully")
      })
      .catch((error) => {
        console.error("[v0] [SW] Error showing notification:", error)
      })
  )
})

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event.notification.tag)
  event.notification.close()

  const urlToOpen = event.notification.data?.url || "/"
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        if (clientList[i].url === urlToOpen && "focus" in clientList[i]) {
          return clientList[i].focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

// Handle notification close
self.addEventListener("notificationclose", (event) => {
  console.log("[SW] Notification closed:", event.notification.tag)
})

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})
