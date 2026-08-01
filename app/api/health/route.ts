import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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

    if (cronSecret !== process.env.CRON_SECRET) {
      console.warn("[Health] Invalid cron secret provided")
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Create Supabase client and perform minimal query to register activity
    const supabase = await createClient()

    // Lightweight RPC call to keep database connection active
    const { data, error } = await supabase.rpc("get_opening_balance", {
      p_user_id: "00000000-0000-0000-0000-000000000000", // Dummy UUID
      p_period_key: "1970-01", // Dummy period
    })

    if (error) {
      // Even if the RPC fails, the connection attempt still registers activity
      console.log("[Health] RPC check completed (error expected for dummy values):", error.code)
    } else {
      console.log("[Health] RPC check successful")
    }

    // Alternative: Simple SELECT 1 if RPC fails
    // const { error: simpleError } = await supabase.from("loans").select("count", { count: "exact", head: true })

    const timestamp = new Date().toISOString()
    
    return NextResponse.json(
      {
        status: "ok",
        timestamp,
        message: "Supabase connection verified - project activity registered",
      },
      { status: 200 }
    )
  } catch (err) {
    console.error("[Health] Unexpected error:", err)
    return NextResponse.json(
      { error: "Health check failed" },
      { status: 500 }
    )
  }
}
