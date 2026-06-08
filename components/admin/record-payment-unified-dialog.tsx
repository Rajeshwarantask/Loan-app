"use client"

import { useEffect } from "react"

import type React from "react"
import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { triggerNotification } from "@/lib/server-actions/notifications"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Receipt } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils/loan-calculator"

interface RecordPaymentUnifiedDialogProps {
  loan: {
    id: string
    user_id: string
    member_id?: string
    interest_rate: number
    remaining_balance?: number
    loan_amount: number
    original_loan_amount?: number
    monthly_emi?: number
    status?: string
    profiles: {
      full_name: string
      member_id?: string
    }
  }
  isMarked?: boolean
  onPaymentRecorded?: () => void
  backfillMonth?: number
  backfillYear?: number
}

export function RecordPaymentUnifiedDialog({
  loan,
  isMarked = false,
  onPaymentRecorded,
  backfillMonth,
  backfillYear,
}: RecordPaymentUnifiedDialogProps) {
  const now = new Date()
  const currentRealMonth = now.getMonth() + 1
  const currentRealYear = now.getFullYear()

  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasPaymentThisMonth, setHasPaymentThisMonth] = useState(false)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [monthlySubscription, setMonthlySubscription] = useState("2100")
  const [principalRemaining, setPrincipalRemaining] = useState(() => 
    Math.max(0, loan?.original_loan_amount || loan?.loan_amount || 0)
  )
  const [penaltyPayment, setPenaltyPayment] = useState("0")
  const [outstandingPenalty, setOutstandingPenalty] = useState(0)
  const [missedLastMonthPayment, setMissedLastMonthPayment] = useState(false)
  const [accumulatedInterest, setAccumulatedInterest] = useState(0)
  const [accumulatedSubscription, setAccumulatedSubscription] = useState(0)
  // Pending interest months: each entry = { periodKey, openingBalance, interest, paymentId }
  const [pendingInterestMonths, setPendingInterestMonths] = useState<
    { periodKey: string; openingBalance: number; interest: number; paymentId: string }[]
  >([])
  // Which past month the user explicitly intends to settle — no automatic order assumed
  const [selectedSettlementPeriod, setSelectedSettlementPeriod] = useState<string | null>(null)
  // Separate input: amount to settle the selected past month's interest
  const [settlementPayment, setSettlementPayment] = useState("")

  // Use backfill period from parent if provided, otherwise default to current month
  const selectedMonth = backfillMonth ?? currentRealMonth
  const selectedYear = backfillYear ?? currentRealYear
  const selectedPeriodKey = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`
  const isBackfill = selectedMonth !== currentRealMonth || selectedYear !== currentRealYear
  const monthName = new Date(
  selectedYear,
  selectedMonth - 1
).toLocaleString("default", {
  month: "short",
})
  const defaultEmi = 5000

  // State to track current loan status (refreshes when needed)
  const [currentLoanStatus, setCurrentLoanStatus] = useState(loan.status || "active")
  const isSubscriptionOnly = currentLoanStatus === "subscription_only"

  // Refresh loan status when dialog opens or loan id changes
  useEffect(() => {
    const refreshLoanStatus = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("loans")
          .select("status")
          .eq("id", loan.id)
          .single()

        if (!error && data) {
          setCurrentLoanStatus(data.status)
          console.log("[v0] Refreshed loan status:", data.status)
        }
      } catch (err) {
        console.error("[v0] Error refreshing loan status:", err)
      }
    }

    refreshLoanStatus()
  }, [loan.id])
  
  // For subscription_only users converting to active, allow new loan input
  // For active users, EMI is always based on loan details
  const [emiPayment, setEmiPayment] = useState(isSubscriptionOnly ? "0" : defaultEmi.toString())
  const [additionalPrincipalPayment, setAdditionalPrincipalPayment] = useState("0")
  const [newLoanAmount, setNewLoanAmount] = useState("0")
  const [newLoanRate, setNewLoanRate] = useState("1.5")
  const [interestPayment, setInterestPayment] = useState("")

  const emi = Number(emiPayment) || 0
  const additionalPrincipal = Number(additionalPrincipalPayment) || 0
  const newLoan = Number(newLoanAmount) || 0
  const interest_rate = loan?.interest_rate ?? 1.5

  // EMI and Additional principal will reduce NEXT month's balance, not this month
  // Current month's balance remains unchanged for display purposes
  const finalRemainingBalance = Math.max(0, principalRemaining + newLoan)
  // Interest should be calculated on current month's opening balance (before any payments)
  // EMI, additional principal, and new loan will affect NEXT month's balance and interest
  const balanceForCurrentInterest = principalRemaining
  const currentMonthInterest = Math.max(0, Math.round((balanceForCurrentInterest * interest_rate) / 100))
  // Current month interest only — accumulated past months are settled separately via settlementPayment
  const totalInterestDue = currentMonthInterest
  const totalSubscriptionDue = accumulatedSubscription + 2100

  const handleAdditionalPrincipalChange = (value: string) => {
    setAdditionalPrincipalPayment(value)
  }

  const handleNewLoanChange = (value: string) => {
    setNewLoanAmount(value)
  }

  const handleMonthlySubscriptionChange = (value: string) => {
    setMonthlySubscription(value)
  }

  const handlePenaltyPaymentChange = (value: string) => {
    const numValue = Number(value) || 0
    if (numValue <= outstandingPenalty) {
      setPenaltyPayment(value)
    } else {
      setPenaltyPayment(outstandingPenalty.toString())
    }
  }

  const router = useRouter()

  const fetchAccumulatedUnpaidAmounts = async () => {
    try {
      const supabase = createClient()

      console.log("[v0] Fetching accumulated unpaid amounts (penalty-column approach) for user:", loan.user_id)

      const interestRate = Number(loan.interest_rate || 1.5)

      // ── Pending interest: fetch all records where penalty > 0 ──
      // penalty column = opening_balance of that month when interest was not fully paid
      const { data: penaltyRows, error: penaltyError } = await supabase
        .from("loan_payments")
        .select("id, period_key, penalty, monthly_subscription")
        .eq("user_id", loan.user_id)
        .gt("penalty", 0)
        .lt("period_key", selectedPeriodKey)
        .order("period_key", { ascending: true })

      if (penaltyError) {
        console.error("[v0] Error fetching penalty rows:", penaltyError)
        setAccumulatedInterest(0)
        setPendingInterestMonths([])
      } else {
        // unpaid_interest per month = penalty (opening_balance) x rate / 100
        const months = (penaltyRows || []).map(row => ({
          periodKey: row.period_key as string,
          openingBalance: Number(row.penalty),
          interest: Math.round((Number(row.penalty) * interestRate) / 100),
          paymentId: row.id as string,
        }))

        const totalUnpaidInterest = months.reduce((sum, m) => sum + m.interest, 0)

        console.log("[v0] Pending interest months:", months)
        console.log("[v0] Total accumulated unpaid interest:", totalUnpaidInterest)

        setPendingInterestMonths(months)
        setAccumulatedInterest(totalUnpaidInterest)

      }
      // ── Accumulated unpaid subscription ──
      const { data: payments, error: subError } = await supabase
        .from("loan_payments")
        .select("period_key, monthly_subscription")
        .eq("user_id", loan.user_id)
        .lt("period_key", selectedPeriodKey)

      if (subError) {
        console.error("[v0] Error fetching subscription history:", subError)
        setAccumulatedSubscription(0)
        return
      }

      const totalSubExpected = (payments || []).length * 2100
      const totalSubPaid = (payments || []).reduce((sum, p) => sum + (p.monthly_subscription == null || p.monthly_subscription === "" ? 0 : Number(p.monthly_subscription) ), 0)
      const unpaidSubscription = Math.max(0, totalSubExpected - totalSubPaid)
      console.log(`[v0] Subscription — expected: ${totalSubExpected}, paid: ${totalSubPaid}, unpaid: ${unpaidSubscription}`)
      setAccumulatedSubscription(unpaidSubscription)
    } catch (err) {
      console.error("[v0] Error in fetchAccumulatedUnpaidAmounts:", err)
      setAccumulatedInterest(0)
      setAccumulatedSubscription(0)
      setPendingInterestMonths([])
    }
  }

  const checkLastMonthPayment = async () => {
    try {
      const supabase = createClient()
      // Use the period BEFORE the selected backfill period, not before today
      const lastMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
      const lastMonthYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear
      const lastMonthPeriodKey = `${lastMonthYear}-${String(lastMonth).padStart(2, "0")}`

      console.log("[v0] Checking payment for last month:", lastMonthPeriodKey)

      // Check if loan was created before last month to determine if penalty should apply
      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .select("created_at")
        .eq("id", loan.id)
        .single()

      if (loanError) {
        console.error("[v0] Error fetching loan creation date:", loanError)
        setMissedLastMonthPayment(false)
        return
      }

      const loanCreatedDate = new Date(loanData.created_at)
      const lastMonthStart = new Date(lastMonthYear, lastMonth - 1, 1)
      
      // If loan was created in or after last month, no penalty should apply
      if (loanCreatedDate >= lastMonthStart) {
        console.log("[v0] Loan is new (created after last month start), no penalty check needed")
        setMissedLastMonthPayment(false)
        return
      }

      const { data: lastMonthPayment, error } = await supabase
        .from("loan_payments")
        .select("id, interest_paid, monthly_subscription")
        .eq("user_id", loan.user_id)
        .eq("period_key", lastMonthPeriodKey)
        .limit(1)

      if (error) {
        console.error("[v0] Error checking last month payment:", error)
        setMissedLastMonthPayment(false)
        return
      }

      const missedPayment =
        !lastMonthPayment ||
        lastMonthPayment.length === 0 ||
        (lastMonthPayment[0].interest_paid === 0 && lastMonthPayment[0].monthly_subscription === 0)

      setMissedLastMonthPayment(missedPayment)

      if (missedPayment) {
        console.log("[v0] User missed last month payment, adding 100 penalty")
        await addAutomaticPenalty(supabase, lastMonthPeriodKey)
      }
    } catch (err) {
      console.error("[v0] Error in checkLastMonthPayment:", err)
      setMissedLastMonthPayment(false)
    }
  }

  const addAutomaticPenalty = async (supabase: any, periodKey: string) => {
    try {
      const { data: existingPenalty, error: checkError } = await supabase
        .from("loan_payments")
        .select("penalty")
        .eq("user_id", loan.user_id)
        .eq("period_key", periodKey)
        .limit(1)

      if (checkError) {
        console.error("[v0] Error checking existing penalty:", checkError)
        return
      }

      if (existingPenalty && existingPenalty.length > 0 && existingPenalty[0].penalty > 0) {
        console.log("[v0] Penalty already recorded for this period")
        return
      }

      // Penalties are stored in loan_payments table - no separate RPC needed
      console.log("[v0] Penalty from current payment record will be stored in loan_payments.penalty column")
    } catch (err) {
      console.error("[v0] Error in addAutomaticPenalty:", err)
    }
  }

  const fetchOutstandingPenalty = async () => {
    try {
      // Penalties are stored in loan_payments table, not a separate penalties table
      // Outstanding penalty = sum of penalty column from recent unpaid periods
      const supabase = createClient()
      const { data, error } = await supabase
        .from("loan_payments")
        .select("penalty")
        .eq("user_id", loan.user_id)
        .eq("status", "unpaid")

      if (error) {
        console.error("[v0] Error fetching outstanding penalty:", error)
        setOutstandingPenalty(0)
      } else {
        const totalPenalty = (data || []).reduce((sum, p) => sum + (Number(p.penalty) || 0), 0)
        setOutstandingPenalty(totalPenalty)
      }
    } catch (err) {
      console.error("[v0] Error in fetchOutstandingPenalty:", err)
      setOutstandingPenalty(0)
    }
  }

  const fetchMostRecentBalance = async () => {
    try {
      const supabase = createClient()

      // Opening Balance = Previous period's closing balance ONLY
      // NO additional adjustments needed - they're already reflected in the closing balance

      // Calculate previous month's period_key
      let previousMonth = selectedMonth - 1
      let previousYear = selectedYear
      if (previousMonth < 1) {
        previousMonth = 12
        previousYear = selectedYear - 1
      }
      const previousPeriodKey = `${previousYear}-${String(previousMonth).padStart(2, "0")}`

      // Get previous period's closing balance - use this directly as opening balance
      const { data: previousPayment } = await supabase
        .from("loan_payments")
        .select("remaining_balance, period_key, period_year, period_month")
        .eq("user_id", loan.user_id)
        .eq("period_key", previousPeriodKey)
        .limit(1)
        .single()

      if (previousPayment) {
        const openingBalance = Math.max(0, previousPayment.remaining_balance)
        console.log("[v0] Period:", selectedPeriodKey, "Opening Balance:", openingBalance, "(directly from previous closing balance)")
        setPrincipalRemaining(openingBalance)
      } else {
        // No prior payment found - use original_loan_amount if available, otherwise fallback to loan_amount
        const fallbackBalance = loan.original_loan_amount || loan.loan_amount || 0
        console.log("[v0] No prior payment found for period", previousPeriodKey, "Using fallback balance:", fallbackBalance)
        setPrincipalRemaining(fallbackBalance)
      }
    } catch (err) {
      console.error("[v0] Error in fetchMostRecentBalance:", err)
      // Fallback: use original_loan_amount if available, otherwise loan_amount
      const fallbackBalance = loan.original_loan_amount || loan.loan_amount || 0
      setPrincipalRemaining(fallbackBalance)
    }
  }

  const checkExistingPayment = async () => {
    setCheckingPayment(true)
    try {
      const supabase = createClient()

      const { data, error } = await supabase
        .from("loan_payments")
        .select("id")
        .eq("loan_id", loan.id)
        .eq("period_key", selectedPeriodKey)
        .limit(1)

      if (error) {
        console.error("[v0] Error checking payment:", error)
        setHasPaymentThisMonth(false)
      } else {
        setHasPaymentThisMonth(data && data.length > 0)
      }
    } catch (err) {
      console.error("[v0] Error checking payment:", err)
      setHasPaymentThisMonth(false)
    } finally {
      setCheckingPayment(false)
    }
  }

  // Initialize data when dialog opens
  useEffect(() => {
    if (open) {
      checkExistingPayment()
      fetchMostRecentBalance()
      fetchOutstandingPenalty()
      checkLastMonthPayment()
      fetchAccumulatedUnpaidAmounts()
    }
  }, [open, selectedMonth, selectedYear])

  const handleSubmit = async (isPaid: boolean) => {
    if (!isPaid) {
      setOpen(false)
      return
    }

    const emi = Number(emiPayment)
    // interest = current month only; past month settlement is handled via settlementPayment separately
    const interest = interestPayment ? Number(interestPayment) : currentMonthInterest
    const settlementAmount = Number(settlementPayment) || 0
    const additionalPrincipal = Number(additionalPrincipalPayment)
    const newLoan = Number(newLoanAmount)
    const wasSubscriptionOnly = currentLoanStatus === "subscription_only"
    
    const subscription = Number(monthlySubscription) || 2100 + accumulatedSubscription
    const penalty = Number(penaltyPayment) || 0

    // For subscription_only users, special handling for first month conversion
    if (isSubscriptionOnly) {
      if (emi > 0 && newLoan === 0) {
        setError("Subscription-only users cannot pay EMI without adding a new loan")
        return
      }
      // When adding new loan (subscription_only → active conversion):
      // First month: Can have 0 EMI (only subscription charged)
      // This matches the "reflect next month" pattern - EMI starts collecting from month 2
      if (newLoan > 0 && emi < 0) {
        setError("EMI cannot be negative")
        return
      }
    } else {
      if (emi <= -1) {
        setError("Monthly EMI is mandatory and must be greater than -1")
        return
      }
    }

    if (interest < 0 || additionalPrincipal < 0 || newLoan < 0 || emi < 0 || subscription < 0 || penalty < 0) {
      setError("Please enter valid amounts (no negative values)")
      return
    }

    if (newLoan > 0 && newLoan < 10000) {
      setError("New loan amount must be at least ₹10,000 or leave it blank")
      return
    }

    if (penalty > outstandingPenalty) {
      setError(`Penalty payment cannot exceed outstanding penalty of ${formatCurrency(outstandingPenalty)}`)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        throw new Error("You must be logged in to record payments")
      }

      const currentPrincipal = principalRemaining

      // Closing balance = Opening Balance + New Loan − EMI − additional_principal
      // For subscription_only users converting to active: includes new loan in calculation
      // For regular users: new loan typically 0, so reduces by EMI and additional principal
      const newRemainingBalance = Math.max(0, currentPrincipal + newLoan - emi - additionalPrincipal)

      // Use selected period (supports backfill for missed months)
      const paymentMonth = selectedMonth
      const paymentYear = selectedYear
      const periodKey = selectedPeriodKey

      const totalAmount = interest + emi + additionalPrincipal + subscription + settlementAmount

      // If subscription_only user is converting to active, update loan status first
      if (isSubscriptionOnly && newLoan > 0) {
        // Total loan amount = current opening balance + new loan taken
        const totalLoanAmount = principalRemaining + newLoan
        const finalLoanRate = Number(newLoanAmount) > 0 ? (Number(newLoanAmount) / (principalRemaining + Number(newLoanAmount))) * (loan?.interest_rate ?? 1.5) : (loan?.interest_rate ?? 1.5)

        const { error: loanUpdateError } = await supabase
          .from("loans")
          .update({
            loan_amount: totalLoanAmount,
            original_loan_amount: totalLoanAmount,
            interest_rate: finalLoanRate,
            status: "active",
          })
          .eq("id", loan.id)

        if (loanUpdateError) {
          console.error("[v0] Loan conversion error:", loanUpdateError)
          throw new Error("Failed to convert subscription to active loan")
        }

        // Update local state to reflect the conversion
        setCurrentLoanStatus("active")
        console.log("[v0] Successfully converted subscription_only to active loan. Opening balance:", principalRemaining, "+ new loan:", newLoan, "= total:", totalLoanAmount)
      }

      // ── Penalty tracking logic ──
      // penalty = opening_balance  →  that month's interest is unresolved
      // penalty = 0               →  that month's interest is fully settled
      //
      // Two completely separate fields:
      //   interest         = current month payment only
      //   settlementAmount = payment toward the user-selected past month only
      // No merging. No automatic order. No FIFO/LIFO.
      const isActiveWithLoan = !wasSubscriptionOnly || newLoan > 0
      const interestForThisMonth = wasSubscriptionOnly && newLoan === 0 ? null : interest

      // Current month: underpaid if paid < expected
      const thisMonthUnderpaid =
        isActiveWithLoan && currentMonthInterest > 0 && (interestForThisMonth ?? 0) < currentMonthInterest
      const penaltyToStore = thisMonthUnderpaid ? principalRemaining : 0

      console.log(`[v0] Current month — expected: ${currentMonthInterest}, paid: ${interestForThisMonth ?? 0}, underpaid: ${thisMonthUnderpaid}, penalty: ${penaltyToStore}`)

      const { error: paymentError } = await supabase.from("loan_payments").insert({
        loan_id: loan.id,
        user_id: loan.user_id,
        member_id: loan.member_id || loan.profiles?.member_id,
        full_name: loan.profiles?.full_name || "Unknown",
        payment_date: new Date().toISOString(),

        interest_paid: interestForThisMonth,

        amount: totalAmount,

        monthly_emi:
          wasSubscriptionOnly && newLoan === 0
            ? null
            : emi,

        additional_principal: additionalPrincipal,
        remaining_balance: newRemainingBalance,
        period_month: paymentMonth,
        period_year: paymentYear,
        period_key: periodKey,
        status: "paid",
        monthly_subscription: subscription,
        // penalty = opening_balance if current month underpaid, 0 if fully paid
        penalty: penaltyToStore,
        conversion_status: wasSubscriptionOnly && newLoan > 0 ? 'converted' : null,
      })

      if (paymentError) {
        console.error("[v0] Payment insert error:", paymentError)
        throw new Error(paymentError.message || "Failed to record payment")
      }

      console.log(`[v0] Payment recorded for ${periodKey}. penalty=${penaltyToStore}`)

      // Past month settlement: ONLY the user-selected month. Nothing else touched.
      // settlementAmount is a dedicated field — completely separate from current month interest.
      // Clear penalty only when settlementAmount >= that month's full interest due.
      if (selectedSettlementPeriod && settlementAmount > 0 && pendingInterestMonths.length > 0) {
        const targetMonth = pendingInterestMonths.find(m => m.periodKey === selectedSettlementPeriod)
        if (targetMonth) {
          if (settlementAmount >= targetMonth.interest) {
            const { error: settlePenaltyError } = await supabase
              .from("loan_payments")
              .update({ penalty: 0 })
              .eq("id", targetMonth.paymentId)

            if (settlePenaltyError) {
              console.error(`[v0] Error clearing penalty for ${targetMonth.periodKey}:`, settlePenaltyError)
            } else {
              console.log(`[v0] Cleared ${targetMonth.periodKey} (paid ${settlementAmount} >= required ${targetMonth.interest})`)
            }
          } else {
            console.log(`[v0] settlementAmount (${settlementAmount}) < required (${targetMonth.interest}) for ${targetMonth.periodKey} — not cleared`)
          }
        }
      }

      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .select("status")
        .eq("id", loan.id)
        .single()

      if (loanError) {
        console.error("[v0] Loan fetch error:", loanError)
      }

      // For subscription_only users, they never reach "paid" status - it's ongoing
      // For active loans, mark as paid only if balance is fully cleared
      // Detect if subscription_only user is converting to active
      const hasConvertedToActive = wasSubscriptionOnly && newLoan > 0
      
      // For active loans, mark as paid only if balance is fully cleared
      const loanCleared =
        newRemainingBalance <= 0 &&
        !wasSubscriptionOnly &&
        !hasConvertedToActive
      
      const newStatus = loanCleared
        ? "subscription_only"
        : hasConvertedToActive
          ? "active"
          : isSubscriptionOnly
            ? "subscription_only"
            : "active"

      // Keep loans.loan_amount in sync with loan_payments.remaining_balance (both = current outstanding)
      // IMPORTANT: original_loan_amount should NEVER be updated - it remains static as the checkpoint
      const { error: updateError } = await supabase
        .from("loans")
        .update({
          loan_amount: newRemainingBalance,
          status: newStatus,
        })
        .eq("id", loan.id)

      if (updateError) {
        console.error("[v0] Loan update error:", updateError)
        throw new Error("Payment recorded but failed to update loan balance")
      }

      if (newLoan > 0) {
        // Check if additional_loan for this period already exists to prevent duplicates
        const { data: existingLoan } = await supabase
          .from("additional_loan")
          .select("id")
          .eq("user_id", loan.user_id)
          .eq("period_key", periodKey)
          .limit(1)
          .single()

        if (!existingLoan) {
          // Only insert if no existing record for this period
          const { error: newLoanError } = await supabase.from("additional_loan").insert({
            user_id: loan.user_id,
            member_id: loan.member_id || loan.profiles?.member_id,
            full_name: loan.profiles?.full_name || "Unknown",
            loan_id: loan.id,
            additional_loan_amount: newLoan,
            period_year: paymentYear,
            period_month: paymentMonth,
            period_key: periodKey,
          })

          if (newLoanError) {
            console.error("[v0] Additional loan error:", newLoanError)
            throw new Error("Payment recorded but failed to create additional loan")
          }
        } else {
          console.warn("[v0] Additional loan for this period already exists, skipping duplicate")
        }
        // No need to update loans.remaining_balance again — loan_payments is the source of truth
        // The new loan will be picked up by fetchMostRecentBalance on next open via additional_loan table
      }

      await checkAndAutoInitializeNextMonth(supabase, paymentYear, paymentMonth)

      // Send payment confirmation notification via server action
      console.log("[v0] ========== PAYMENT NOTIFICATION ==========")
      console.log("[v0] Loan belongs to user ID:", loan.user_id)
      console.log("[v0] Loan user name:", loan.profiles?.full_name || "Unknown")
      console.log("[v0] Sending notification to user ID:", loan.user_id)
      console.log("[v0] Notification details:", {
        userId: loan.user_id,
        amount: totalAmount,
        remainingBalance: newRemainingBalance,
      })
      console.log("[v0] ==========================================")
      
      const notificationResult = await triggerNotification({
        type: "payment",
        userId: loan.user_id,
        title: "Payment Confirmed",
        body: `Payment of ${formatCurrency(totalAmount)} has been recorded. Remaining balance: ${formatCurrency(newRemainingBalance)}`,
        data: { type: "payment_confirmation", amount: totalAmount },
      })
      
      console.log("[v0] Notification result:", notificationResult)

      setOpen(false)
      onPaymentRecorded?.()
      router.refresh()
    } catch (err: any) {
      setError(err.message || "An error occurred while recording the payment")
    } finally {
      setIsLoading(false)
    }
  }

  const checkAndAutoInitializeNextMonth = async (supabase: any, paymentYear: number, paymentMonth: number) => {
    try {
      const periodKey = `${paymentYear}-${String(paymentMonth).padStart(2, "0")}`

      console.log("[v0] Checking if all payments are recorded for period:", periodKey)

      const { data: activeLoanUsersData, error: activeLoanUsersError } = await supabase
        .from("loans")
        .select("user_id")
        .in("status", ["active", "subscription_only"])
      
      if (activeLoanUsersError) {
        console.error("[v0] Error fetching active loan users:", activeLoanUsersError)
        return
      }
      
      const activeLoanUsers = new Set(
        activeLoanUsersData?.map((l: any) => l.user_id) || []
      )
      
      const totalUsersNeedingPayment = activeLoanUsers.size
      
      const { data: paymentsThisPeriod, error: paymentsError } = await supabase
        .from("loan_payments")
        .select("user_id")
        .eq("period_key", periodKey)

      if (paymentsError) {
        console.error("[v0] Error fetching payments:", paymentsError)
        return
      }

      if (!paymentsThisPeriod || paymentsThisPeriod.length === 0) {
        console.log("[v0] No payments recorded yet for this period")
        return
      }

      const uniqueUsersPaid = new Set(paymentsThisPeriod.map((p: any) => p.user_id))
      const totalPaymentsRecorded = uniqueUsersPaid.size

      console.log(
        "[v0] Users needing payment:",
        totalUsersNeedingPayment,
        "Total payments recorded:",
        totalPaymentsRecorded,
      )

      if (totalUsersNeedingPayment > 0 && totalPaymentsRecorded >= totalUsersNeedingPayment) {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          console.error("[v0] User not authenticated for auto-initialization")
          return
        }

        console.log(
          "[v0] All payments (active loans + subscription-only) recorded! Auto-initializing month:",
          periodKey,
        )

        const { data, error: rpcError } = await supabase.rpc("initialize_new_month", {
          p_period_key: periodKey,
          p_created_by: user.id,
        })

        if (rpcError) {
          console.error("[v0] Auto-initialization error:", rpcError)
        } else if (data) {
          const result = typeof data === "string" ? JSON.parse(data) : data
          console.log("[v0] Auto-initialization successful:", result)
          alert(`All payments recorded! Successfully initialized ${periodKey}`)
        }
      } else {
        const remaining = totalUsersNeedingPayment - totalPaymentsRecorded
        console.log("[v0] Not all payments recorded yet. Need", remaining > 0 ? remaining : 0, "more payments")
      }
    } catch (err) {
      console.error("[v0] Error in auto-initialization check:", err)
    }
  }

  const isPaymentRecorded = isMarked || hasPaymentThisMonth

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-6 md:h-8 bg-transparent text-[10px] md:text-sm px-1 md:px-2"
          disabled={isPaymentRecorded}
          title={isPaymentRecorded ? "Payment already recorded for this month" : "Record payment"}
        >
          <Receipt className="h-3 w-3 md:h-3.5 md:w-3.5 md:mr-1" />
          <span className="hidden md:inline">Record Payment</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[95vw] md:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm md:text-base">
            {isSubscriptionOnly ? "Record Subscription Payment" : "Record Monthly Payment"}
          </DialogTitle>
          <DialogDescription className="text-xs md:text-sm">
            {isSubscriptionOnly
              ? `Record subscription payment for ${loan.profiles?.full_name} for ${monthName} ${selectedYear}`
              : `Record payment for ${loan.profiles?.full_name} for ${monthName} ${selectedYear}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 md:space-y-4 py-2 md:py-4">
          <div className="grid grid-cols-3 gap-1.5 md:gap-3">
            <div className="p-2 md:p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-[9px] md:text-xs text-muted-foreground mb-1">Total Due</div>
              <div className="text-[8px] md:text-xs space-y-0.5">
                <div className="text-blue-600 font-semibold">EMI: {formatCurrency(emi)}</div>
                <div className="text-blue-600 font-semibold">Sub: {formatCurrency(Number(monthlySubscription))}</div>
                <div className="text-blue-600 font-semibold">Int: {formatCurrency(totalInterestDue)}</div>
                <div className="text-blue-700 font-bold border-t border-blue-200 pt-0.5">= {formatCurrency(emi + Number(monthlySubscription) + totalInterestDue)}</div>
              </div>
            </div>
            <div className="p-2 md:p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="text-[9px] md:text-xs text-muted-foreground mb-1">Remaining Principal</div>
              <div className="text-[10px] md:text-sm font-bold text-green-600">
                {formatCurrency(principalRemaining)}
              </div>
            </div>
            <div className="p-2 md:p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-[9px] md:text-xs text-muted-foreground mb-1">Interest Due</div>
              <div className="text-[10px] md:text-sm font-bold text-orange-600">{formatCurrency(totalInterestDue)}</div>
            </div>
          </div>

          {outstandingPenalty > 0 && (
            <div className="p-2 md:p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="text-[9px] md:text-xs text-muted-foreground mb-1">Outstanding Penalty</div>
              <div className="text-[10px] md:text-sm font-bold text-red-600">{formatCurrency(outstandingPenalty)}</div>
            </div>
          )}

          {(pendingInterestMonths.length > 0 || accumulatedSubscription > 0) && (
            <div className="p-2 md:p-3 bg-yellow-50 rounded-lg border border-yellow-300 space-y-1.5">
              <div className="text-[10px] md:text-sm font-semibold text-yellow-800">
                Unpaid Amounts Carried Forward
              </div>
              {pendingInterestMonths.length > 0 && (
                <div className="flex items-start justify-between gap-3">
              
                  {/* LEFT SIDE */}
                  <div className="flex-1">
                    {pendingInterestMonths.map((m) => (
                      <div
                        key={m.periodKey}
                        className="flex justify-between text-[9px] md:text-xs text-yellow-700"
                      >
                        <span>{m.periodKey}</span>
                        <span>{formatCurrency(m.interest)}</span>
                      </div>
                    ))}
              
                    <div className="flex justify-between text-[9px] md:text-xs font-bold text-yellow-800 border-t border-yellow-200 mt-1 pt-1">
                      <span>Total</span>
                      <span>{formatCurrency(accumulatedInterest)}</span>
                    </div>
                  </div>
              
                  {/* RIGHT SIDE */}
                  <div className="flex gap-1 shrink-0">
              
                    <select
                      value={selectedSettlementPeriod ?? ""}
                      onChange={(e) => {
                        const v = e.target.value || null
                        setSelectedSettlementPeriod(v)
              
                        const m = pendingInterestMonths.find(
                          (x) => x.periodKey === v
                        )
              
                        setSettlementPayment(
                          m ? m.interest.toString() : ""
                        )
                      }}
                      disabled={hasPaymentThisMonth}
                      className="w-32 md:w-40 h-7 text-[9px] md:text-xs rounded border border-yellow-400 bg-white px-1"
                    >
                      <option value="">Select</option>
              
                      {pendingInterestMonths.map((m) => (
                        <option
                          key={m.periodKey}
                          value={m.periodKey}
                        >
                          {m.periodKey}
                        </option>
                      ))}
                    </select>
              
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={settlementPayment}
                      onChange={(e) =>
                        setSettlementPayment(e.target.value)
                      }
                      disabled={
                        hasPaymentThisMonth ||
                        !selectedSettlementPeriod
                      }
                      className="w-20 h-7 text-[9px] md:text-xs"
                    />
                  </div>
              
                </div>
              )}
              {accumulatedSubscription > 0 && (
                <div className="text-[9px] md:text-xs text-yellow-700">
                  Previous Subscription: {formatCurrency(accumulatedSubscription)}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <div className="space-y-1">
              <Label htmlFor="emi" className="text-[10px] md:text-xs font-semibold text-red-600">
                Monthly EMI (Mandatory) *
              </Label>
              <Input
                id="emi"
                type="number"
                step="1000"
                min="0"
                placeholder="₹5000"
                value={emiPayment}
                onChange={(e) => setEmiPayment(e.target.value)}
                className="h-7 md:h-9 text-xs md:text-sm border-red-300 focus:border-red-500"
                required
                disabled={hasPaymentThisMonth}
              />
              <p className="text-[9px] md:text-xs text-muted-foreground">Monthly EMI</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="interest" className="text-[10px] md:text-xs">
                Interest Payment (Current Month)
              </Label>
              <Input
                id="interest"
                type="number"
                step="1"
                min="0"
                placeholder={`₹${currentMonthInterest}`}
                value={interestPayment || currentMonthInterest}
                onChange={(e) => setInterestPayment(e.target.value)}
                className="h-7 md:h-9 text-xs md:text-sm bg-white"
                disabled={hasPaymentThisMonth}
              />
              <p className="text-[9px] md:text-xs text-muted-foreground">
                Current: {formatCurrency(currentMonthInterest)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <div className="space-y-1">
              <Label htmlFor="additionalPrincipal" className="text-[10px] md:text-xs">
                Additional Principal (Optional)
              </Label>
              <Input
                id="additionalPrincipal"
                type="number"
                step="1000"
                min="0"
                placeholder="₹0"
                value={additionalPrincipalPayment}
                onChange={(e) => handleAdditionalPrincipalChange(e.target.value)}
                className="h-7 md:h-9 text-xs md:text-sm"
                disabled={hasPaymentThisMonth || isSubscriptionOnly}
              />
              <p className="text-[9px] md:text-xs text-muted-foreground">Extra payment beyond EMI</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="newLoan" className="text-[10px] md:text-xs">
                {isSubscriptionOnly ? "New Loan (To Convert)" : "New Loan Taken"}
              </Label>
              <Input
                id="newLoan"
                type="number"
                step="1000"
                min="0"
                placeholder="₹0"
                value={newLoanAmount}
                onChange={(e) => handleNewLoanChange(e.target.value)}
                className="h-7 md:h-9 text-xs md:text-sm"
                disabled={hasPaymentThisMonth}
              />
              <p className="text-[9px] md:text-xs text-muted-foreground">Minimum ₹10,000</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <div className="space-y-1">
              <Label htmlFor="monthlySubscription" className="text-[10px] md:text-xs">
                Monthly Subscription {accumulatedSubscription > 0 && "(Including Previous)"}
              </Label>
              <Input
                id="monthlySubscription"
                type="number"
                step="100"
                min="0"
                placeholder={`₹${totalSubscriptionDue}`}
                value={accumulatedSubscription > 0 ? monthlySubscription || totalSubscriptionDue : monthlySubscription}
                onChange={(e) => handleMonthlySubscriptionChange(e.target.value)}
                className="h-7 md:h-9 text-xs md:text-sm"
                disabled={hasPaymentThisMonth}
              />
              <p className="text-[9px] md:text-xs text-muted-foreground">
                {accumulatedSubscription > 0
                  ? `Previous: ${formatCurrency(accumulatedSubscription)} + Current: ₹2,100`
                  : `Monthly contribution amount: ${formatCurrency(2100)}`}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="penaltyPayment" className="text-[10px] md:text-xs text-red-600">
                Penalty Payment {outstandingPenalty > 0 ? "(Required)" : "(Optional)"}
              </Label>
              <Input
                id="penaltyPayment"
                type="number"
                step="100"
                min="0"
                max={outstandingPenalty}
                placeholder={outstandingPenalty > 0 ? `₹${outstandingPenalty}` : "₹0"}
                value={penaltyPayment}
                onChange={(e) => handlePenaltyPaymentChange(e.target.value)}
                className="h-7 md:h-9 text-xs md:text-sm border-red-200"
                disabled={hasPaymentThisMonth || outstandingPenalty === 0}
              />
              <p className="text-[9px] md:text-xs text-muted-foreground">
                {outstandingPenalty > 0 ? `Outstanding: ${formatCurrency(outstandingPenalty)}` : "No penalty due"}
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-2 md:p-3 text-[10px] md:text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={isLoading || hasPaymentThisMonth}
            className="flex-1 h-8 md:h-10 text-xs md:text-sm"
          >
            Not Paid
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={isLoading || hasPaymentThisMonth}
            className="flex-1 h-8 md:h-10 text-xs md:text-sm"
          >
            {isLoading ? "Recording..." : "Paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
