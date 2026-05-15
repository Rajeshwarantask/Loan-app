import { NextResponse } from "next/server"

export async function POST() {
  try {
    // Dynamically import web-push
    const webpush = await import("web-push")

    // Generate VAPID keys
    const vapidKeys = webpush.default.generateVapidKeys()

    return NextResponse.json({
      success: true,
      publicKey: vapidKeys.publicKey,
      privateKey: vapidKeys.privateKey,
    })
  } catch (error) {
    console.error("[API] VAPID generation error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to generate VAPID keys" },
      { status: 500 }
    )
  }
}
