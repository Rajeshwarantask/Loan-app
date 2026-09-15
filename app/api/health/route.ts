import { timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createHealthClient } from "@/lib/supabase/health"

export const dynamic = "force-dynamic"

function secretsMatch(provided: string | null, expected: string) {
  if (!provided) return false
  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(expected)
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer)
}

/**
 * Health Check Endpoint
 * 
 * Purpose: Keep Supabase project active by registering periodic activity
 * Prevents automatic pause due to inactivity (typically after ~1 week)
 * 
 * Security: Protected by x-cron-secret header
 * Called by: GitHub Actions (every 3 days)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the cron secret from header
    const cronSecret = request.headers.get("x-cron-secret")
    
    // Check if CRON_SECRET is set and validate
    if (!process.env.CRON_SECRET) {
      console.warn("[Health] CRON_SECRET not configured")
      return NextResponse.json(
        { error: "Health check not properly configured" },
        { status: 500 }
      )
    }

    if (!secretsMatch(cronSecret, process.env.CRON_SECRET)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Use a cookie-free client and make a read-only request through Supabase.
    const supabase = createHealthClient()
    const { error } = await supabase.from("loans").select("id", { count: "exact", head: true })

    if (error) {
      console.error("[Health] Supabase query failed:", error.code)
      return NextResponse.json({ error: "Health check failed" }, { status: 503, headers: { "Cache-Control": "no-store" } })
    }

    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString(), message: "Supabase connection verified" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error("[Health] Unexpected error:", err)
    return NextResponse.json(
      { error: "Health check failed" },
      { status: 500 }
    )
  }
}
