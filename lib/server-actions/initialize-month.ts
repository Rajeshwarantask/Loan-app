"use client"

import { createClient } from "@/lib/supabase/client"

/**
 * Complete server action for initializing a new month
 * Integrates with the initialize_new_month database function
 */
export async function initializeMonthAction(periodKey: string, createdBy?: string) {
  try {
    const supabase = createClient()

    const { data, error } = await supabase.rpc("initialize_new_month", {
      p_period_key: periodKey,
      p_created_by: createdBy
    })

    if (error) {
      console.error("[v0] Month initialization error:", error)
      throw new Error(error.message || "Failed to initialize month")
    }

    console.log("[v0] Month initialized successfully:", data)
    return {
      success: data.success,
      recordsCreated: data.records_created,
      periodKey: data.period_key,
      message: data.message
    }
  } catch (err) {
    console.error("[v0] Error in initializeMonthAction:", err)
    throw err
  }
}

/**
 * Get all active users who need initialization for a period
 */
export async function getActiveUsersForPeriod(periodKey: string) {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from("loans")
      .select("user_id")
      .select("DISTINCT user_id")
      .in("status", ["active", "subscription_only"])

    if (error) throw error

    return data?.map((d) => d.user_id) || []
  } catch (err) {
    console.error("[v0] Error getting active users:", err)
    return []
  }
}

/**
 * Batch initialize multiple users for a period
 */
export async function batchInitializeMonth(periodKey: string, userIds?: string[], createdBy?: string) {
  try {
    const supabase = createClient()

    // Get users if not provided
    const usersToInit = userIds || (await getActiveUsersForPeriod(periodKey))

    const results = []
    for (const userId of usersToInit) {
      const { data, error } = await supabase.rpc("initialize_new_month", {
        p_period_key: periodKey,
        p_created_by: createdBy
      })

      results.push({
        userId,
        success: !error,
        error: error?.message,
        message: data?.message
      })

      // Add small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 10))
    }

    return {
      totalProcessed: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results
    }
  } catch (err) {
    console.error("[v0] Batch initialization error:", err)
    throw err
  }
}

/**
 * Get initialization status for a period
 */
export async function getInitializationStatus(periodKey: string) {
  try {
    const supabase = createClient()

    // Count records created for this period
    const { data: records, error } = await supabase
      .from("monthly_loan_records")
      .select("id")
      .eq("period_key", periodKey)

    if (error) throw error

    // Get total active users
    const { data: users, error: usersError } = await supabase
      .from("loans")
      .select("user_id")
      .select("DISTINCT user_id")
      .in("status", ["active", "subscription_only"])

    if (usersError) throw usersError

    const totalUsers = users?.length || 0
    const initialized = records?.length || 0

    return {
      periodKey,
      totalActiveUsers: totalUsers,
      recordsCreated: initialized,
      isComplete: initialized >= totalUsers,
      progress: totalUsers > 0 ? (initialized / totalUsers) * 100 : 0
    }
  } catch (err) {
    console.error("[v0] Error getting initialization status:", err)
    throw err
  }
}
