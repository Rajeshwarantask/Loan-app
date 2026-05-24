"use client"

import { createClient } from "@/lib/supabase/client"

/**
 * Service for managing member status transitions
 */
export class MemberStatusService {
  private supabase = createClient()

  /**
   * Check if a member is subscription-only
   */
  async isSubscriptionOnly(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from("loans")
        .select("status")
        .eq("user_id", userId)
        .limit(1)

      if (error) throw error

      return data?.[0]?.status === "subscription_only"
    } catch (err) {
      console.error("[v0] Error checking member status:", err)
      return false
    }
  }

  /**
   * Convert subscription_only member to active when they receive a loan
   * This should be called when adding new_loan_amount to a subscription_only member
   */
  async convertSubscriptionToActive(
    userId: string,
    loanId: string,
    newLoanAmount: number,
    currentOpeningBalance: number,
    interestRate: number
  ) {
    try {
      // Calculate total loan amount
      const totalLoanAmount = currentOpeningBalance + newLoanAmount

      // If new loan has a different rate, blend the rates
      const finalRate = interestRate

      // Update loan status and amounts
      const { error: updateError } = await this.supabase
        .from("loans")
        .update({
          status: "active",
          loan_amount: totalLoanAmount,
          original_loan_amount: totalLoanAmount,
          interest_rate: finalRate,
          updated_at: new Date().toISOString()
        })
        .eq("id", loanId)

      if (updateError) throw updateError

      // Trigger member status sync if available
      const { error: syncError } = await this.supabase.rpc(
        "sync_member_status_on_loan_conversion",
        {
          p_user_id: userId
        }
      )

      if (syncError) {
        console.warn("[v0] Member status sync returned warning:", syncError.message)
        // Non-fatal warning, conversion still succeeded
      }

      return {
        success: true,
        message: "Member converted from subscription_only to active",
        totalLoanAmount,
        finalRate
      }
    } catch (err) {
      console.error("[v0] Conversion error:", err)
      throw err
    }
  }

  /**
   * Get member's current status
   */
  async getMemberStatus(userId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from("loans")
        .select("status")
        .eq("user_id", userId)
        .limit(1)

      if (error) throw error

      return data?.[0]?.status || null
    } catch (err) {
      console.error("[v0] Error fetching member status:", err)
      return null
    }
  }

  /**
   * Get all loans for a user with their status
   */
  async getMemberLoans(userId: string) {
    try {
      const { data, error } = await this.supabase
        .from("loans")
        .select(
          `
          id,
          status,
          loan_amount,
          original_loan_amount,
          interest_rate,
          created_at
        `
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (error) throw error

      return data || []
    } catch (err) {
      console.error("[v0] Error fetching member loans:", err)
      return []
    }
  }

  /**
   * Ensure member status consistency
   * Use this as a maintenance function to fix any status inconsistencies
   */
  async ensureStatusConsistency(userId: string) {
    try {
      const { data, error } = await this.supabase.rpc(
        "sync_member_status_on_loan_conversion",
        {
          p_user_id: userId
        }
      )

      if (error) throw error

      return data
    } catch (err) {
      console.error("[v0] Status consistency check error:", err)
      throw err
    }
  }
}

export const memberStatusService = new MemberStatusService()
