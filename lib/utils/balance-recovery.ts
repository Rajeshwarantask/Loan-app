"use client"

import { createClient } from "@/lib/supabase/client"
import type { BalanceReconstruction } from "./loan-calculator"

/**
 * Service for managing loan balance recovery and period reversion
 */
export class BalanceRecoveryService {
  private supabase = createClient()

  /**
   * Revert a payment period and restore balance using priority logic
   */
  async revertPeriod(userId: string, periodKey: string, revertedBy?: string) {
    try {
      const { data, error } = await this.supabase.rpc(
        "revert_period_payment",
        {
          p_user_id: userId,
          p_period_key: periodKey,
          p_reverted_by: revertedBy
        }
      )

      if (error) {
        throw new Error(`Revert failed: ${error.message}`)
      }

      return data
    } catch (err) {
      console.error("[v0] Balance revert error:", err)
      throw err
    }
  }

  /**
   * Get opening balance for a period using priority order
   * Priority: Previous closing → Original amount → Reconstruction
   */
  async getOpeningBalance(userId: string, periodKey: string): Promise<number> {
    try {
      const { data, error } = await this.supabase.rpc(
        "get_opening_balance",
        {
          p_user_id: userId,
          p_period_key: periodKey
        }
      )

      if (error) {
        throw new Error(`Failed to get opening balance: ${error.message}`)
      }

      return data || 0
    } catch (err) {
      console.error("[v0] Failed to get opening balance:", err)
      throw err
    }
  }

  /**
   * Calculate closing balance for a period
   */
  async calculateClosingBalance(userId: string, periodKey: string): Promise<number> {
    try {
      const { data, error } = await this.supabase.rpc(
        "calculate_closing_balance",
        {
          p_user_id: userId,
          p_period_key: periodKey
        }
      )

      if (error) {
        throw new Error(`Failed to calculate closing balance: ${error.message}`)
      }

      return data || 0
    } catch (err) {
      console.error("[v0] Failed to calculate closing balance:", err)
      throw err
    }
  }

  /**
   * Reconstruct balance using the formula:
   * Closing Balance = Opening Balance - EMI - Additional Principal + New Loan Amount
   */
  async reconstructBalance(
    userId: string,
    periodKey: string
  ): Promise<BalanceReconstruction> {
    try {
      // Get all needed data
      const opening = await this.getOpeningBalance(userId, periodKey)

      // Fetch payments for this period
      const { data: payments, error } = await this.supabase
        .from("loan_payments")
        .select("monthly_emi, additional_principal")
        .eq("user_id", userId)
        .eq("period_key", periodKey)

      if (error) throw error

      const emiPaid = payments?.reduce((sum, p) => sum + (p.monthly_emi || 0), 0) || 0
      const additionalPrincipal = payments?.reduce((sum, p) => sum + (p.additional_principal || 0), 0) || 0

      // Fetch additional loans for this period
      const { data: loans, error: loanError } = await this.supabase
        .from("additional_loan")
        .select("additional_loan_amount")
        .eq("user_id", userId)
        .eq("period_key", periodKey)

      if (loanError) throw loanError

      const newLoansAdded = loans?.reduce((sum, l) => sum + (l.additional_loan_amount || 0), 0) || 0

      // Calculate closing: Closing = Opening - EMI - Additional Principal + New Loans
      const closing = Math.max(0, opening - emiPaid - additionalPrincipal + newLoansAdded)

      return {
        openingBalance: opening,
        emiPaid,
        additionalPrincipal,
        newLoansAdded,
        closingBalance: closing,
        calculationMethod: 'reconstruction'
      }
    } catch (err) {
      console.error("[v0] Balance reconstruction error:", err)
      throw err
    }
  }

  /**
   * Validate balance consistency for a period
   */
  async validateBalanceConsistency(userId: string, periodKey: string) {
    try {
      const { data, error } = await this.supabase.rpc(
        "validate_balance_consistency",
        {
          p_user_id: userId
        }
      )

      if (error) throw error

      // Filter for the specific period
      return data?.find((v: any) => v.period_key === periodKey)
    } catch (err) {
      console.error("[v0] Balance validation error:", err)
      throw err
    }
  }

  /**
   * Synchronize member status (subscription_only → active)
   */
  async syncMemberStatus(userId: string) {
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
      console.error("[v0] Member status sync error:", err)
      throw err
    }
  }

  /**
   * Get complete balance history for a user
   */
  async getBalanceHistory(userId: string, limit: number = 24) {
    try {
      const { data, error } = await this.supabase
        .from("loan_payments")
        .select(
          `
          id,
          period_key,
          period_year,
          period_month,
          monthly_emi,
          additional_principal,
          remaining_balance,
          interest_paid,
          monthly_subscription,
          penalty
        `
        )
        .eq("user_id", userId)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false })
        .limit(limit)

      if (error) throw error

      return data || []
    } catch (err) {
      console.error("[v0] Failed to fetch balance history:", err)
      throw err
    }
  }
}

export const balanceRecoveryService = new BalanceRecoveryService()
