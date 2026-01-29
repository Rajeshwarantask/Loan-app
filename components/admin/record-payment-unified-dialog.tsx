"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
    monthly_emi?: number
    profiles: {
      full_name: string
      member_id?: string
    }
  }
  isMarked?: boolean
  onPaymentRecorded?: () => void
}

export function RecordPaymentUnifiedDialog({
  loan,
  isMarked = false,
  onPaymentRecorded,
}: RecordPaymentUnifiedDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasPaymentThisMonth, setHasPaymentThisMonth] = useState(false)
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [monthlySubscription, setMonthlySubscription] = useState("2100")
  const [principalRemaining, setPrincipalRemaining] = useState(loan.remaining_balance ?? loan.loan_amount)
  const [penaltyPayment, setPenaltyPayment] = useState("0")
  const [outstandingPenalty, setOutstandingPenalty] = useState(0)
  const [missedLastMonthPayment, setMissedLastMonthPayment] = useState(false)
  const [accumulatedInterest, setAccumulatedInterest] = useState(0)
  const [accumulatedSubscription, setAccumulatedSubscription] = useState(0)

  const defaultEmi = 5000

  const [emiPayment, setEmiPayment] = useState(defaultEmi.toString())
  const [additionalPrincipalPayment, setAdditionalPrincipalPayment] = useState("0")
  const [newLoanAmount, setNewLoanAmount] = useState("0")
  const [interestPayment, setInterestPayment] = useState("")

  const emi = Number(emiPayment) || 0
  const additionalPrincipal = Number(additionalPrincipalPayment) || 0
  const newLoan = Number(newLoanAmount) || 0

  const finalRemainingBalance = Math.max(0, principalRemaining - emi - additionalPrincipal + newLoan)
  // Interest should be calculated on balance BEFORE new loan is added (for current month)
  // New loan will affect NEXT month's interest calculation
  const balanceForCurrentInterest = Math.max(0, principalRemaining - emi - additionalPrincipal)
  const currentMonthInterest = Math.max(0, Math.round((balanceForCurrentInterest * loan.interest_rate) / 100))
  const totalInterestDue = accumulatedInterest + currentMonthInterest
  const totalSubscriptionDue = accumulatedSubscription + 2100

  console.log("[v0] totalSubscriptionDue calculation:", {
    accumulatedSubscription,
    current: 2100,
    total: totalSubscriptionDue,
  })

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

  useEffect(() => {
    if (open) {
      checkExistingPayment()
      fetchMostRecentBalance()
      fetchOutstandingPenalty()
      checkLastMonthPayment()
      fetchAccumulatedUnpaidAmounts()
    }
  }, [open])

  const fetchAccumulatedUnpaidAmounts = async () => {
    try {
      const supabase = createClient()
      const now = new Date()

      console.log("[v0] Fetching accumulated unpaid amounts for user:", loan.user_id)

      // Get all payment records for this user, ordered by period
      const { data: payments, error } = await supabase
        .from("loan_payments")
        .select("period_year, period_month, period_key, interest_paid, monthly_subscription, remaining_balance")
        .eq("user_id", loan.user_id)
        .order("period_year", { ascending: true })
        .order("period_month", { ascending: true })

      if (error) {
        console.error("[v0] Error fetching payment history:", error)
        setAccumulatedInterest(0)
        setAccumulatedSubscription(0)
        return
      }

      if (!payments || payments.length === 0) {
        console.log("[v0] No payment history found")
        setAccumulatedInterest(0)
        setAccumulatedSubscription(0)
        return
      }

      let totalUnpaidInterest = 0
      let totalUnpaidSubscription = 0

      // Check each previous month for unpaid amounts
      for (const payment of payments) {
        // Calculate what the interest should have been for that period
        const expectedInterest = Math.round((payment.remaining_balance * loan.interest_rate) / 100)
        const expectedSubscription = 2100

        // Check if interest was not paid
        if (payment.interest_paid === 0 || payment.interest_paid === null) {
          totalUnpaidInterest += expectedInterest
          console.log(`[v0] Unpaid interest found for ${payment.period_key}: ${expectedInterest}`)
        }

        // Check if subscription was not paid
        if (payment.monthly_subscription === 0 || payment.monthly_subscription === null) {
          totalUnpaidSubscription += expectedSubscription
          console.log(`[v0] Unpaid subscription found for ${payment.period_key}: ${expectedSubscription}`)
        }
      }

      console.log("[v0] Total accumulated interest:", totalUnpaidInterest)
      console.log("[v0] Total accumulated subscription:", totalUnpaidSubscription)

      setAccumulatedInterest(totalUnpaidInterest)
      setAccumulatedSubscription(totalUnpaidSubscription)
    } catch (err) {
      console.error("[v0] Error in fetchAccumulatedUnpaidAmounts:", err)
      setAccumulatedInterest(0)
      setAccumulatedSubscription(0)
    }
  }

  const checkLastMonthPayment = async () => {
    try {
      const supabase = createClient()
      const now = new Date()
      const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth()
      const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
      const lastMonthPeriodKey = `${lastMonthYear}-${String(lastMonth).padStart(2, "0")}`

      console.log("[v0] Checking payment for last month:", lastMonthPeriodKey)

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

      const { data, error: penaltyError } = await supabase.rpc("get_user_outstanding_penalties", {
        p_user_id: loan.user_id,
      })

      if (penaltyError) {
        console.error("[v0] Error getting current penalty:", penaltyError)
        return
      }

      const newOutstandingPenalty = (Number(data) || 0) + 100
      console.log("[v0] New outstanding penalty after missed payment:", newOutstandingPenalty)

      setOutstandingPenalty(newOutstandingPenalty)
    } catch (err) {
      console.error("[v0] Error in addAutomaticPenalty:", err)
    }
  }

  const fetchOutstandingPenalty = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc("get_user_outstanding_penalties", {
        p_user_id: loan.user_id,
      })

      if (error) {
        console.error("[v0] Error fetching outstanding penalty:", error)
        setOutstandingPenalty(0)
      } else {
        setOutstandingPenalty(Number(data) || 0)
      }
    } catch (err) {
      console.error("[v0] Error in fetchOutstandingPenalty:", err)
      setOutstandingPenalty(0)
    }
  }

  const fetchMostRecentBalance = async () => {
    try {
      const supabase = createClient()

      // Fetch the most recent payment balance
      const { data: paymentData, error: paymentError } = await supabase
        .from("loan_payments")
        .select("remaining_balance, period_key, period_month, period_year")
        .eq("user_id", loan.user_id)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false })
        .limit(1)

      if (paymentError) {
        console.error("[v0] Error fetching payment balance:", paymentError)
        setPrincipalRemaining(loan.loan_amount)
        return
      }

      let balanceToUse = loan.loan_amount

      if (paymentData && paymentData.length > 0) {
        const mostRecentPayment = paymentData[0]
        balanceToUse = mostRecentPayment.remaining_balance || loan.loan_amount

        // Fetch additional loans taken AFTER the last payment period
        const { data: additionalLoans, error: loanError } = await supabase
          .from("additional_loans")
          .select("amount")
          .eq("user_id", loan.user_id)
          .filter(
            "created_at",
            "gt",
            new Date(mostRecentPayment.period_year, mostRecentPayment.period_month - 1).toISOString(),
          )

        if (!loanError && additionalLoans) {
          const additionalLoanAmount = additionalLoans.reduce((sum, al) => sum + (al.amount || 0), 0)
          balanceToUse += additionalLoanAmount

          console.log(
            "[v0] RecordPayment - Balance from period:",
            mostRecentPayment.period_key,
            "base balance:",
            mostRecentPayment.remaining_balance,
            "additional loans:",
            additionalLoanAmount,
            "total for next month:",
            balanceToUse,
          )
        } else {
          console.log(
            "[v0] RecordPayment - using balance from period:",
            mostRecentPayment.period_key,
            "balance:",
            balanceToUse,
          )
        }
      } else {
        console.log("[v0] RecordPayment - no payment history (first month), using loan_amount:", loan.loan_amount)
      }

      setPrincipalRemaining(balanceToUse)
    } catch (err) {
      console.error("[v0] Error in fetchMostRecentBalance:", err)
      setPrincipalRemaining(loan.loan_amount)
    }
  }

  const checkExistingPayment = async () => {
    setCheckingPayment(true)
    try {
      const supabase = createClient()
      const now = new Date()
      const currentMonth = now.getMonth() + 1
      const currentYear = now.getFullYear()
      const periodKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`

      const { data, error } = await supabase
        .from("loan_payments")
        .select("id")
        .eq("loan_id", loan.id)
        .eq("period_key", periodKey)
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

  const handleSubmit = async (isPaid: boolean) => {
    if (!isPaid) {
      setOpen(false)
      return
    }

    const emi = Number(emiPayment)
    const interest = interestPayment ? Number(interestPayment) : totalInterestDue
    const additionalPrincipal = Number(additionalPrincipalPayment)
    const newLoan = Number(newLoanAmount)
    const subscription = Number(monthlySubscription) || 2100 + accumulatedSubscription
    const penalty = Number(penaltyPayment) || 0

    if (emi <= -1) {
      setError("Monthly EMI is mandatory and must be greater than -1")
      return
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

      const newRemainingBalance = Math.max(0, currentPrincipal - emi - additionalPrincipal + newLoan)

      const now = new Date()
      const paymentMonth = now.getMonth() + 1
      const paymentYear = now.getFullYear()

      const totalAmount = interest + emi + additionalPrincipal + subscription

      const { error: paymentError } = await supabase.from("loan_payments").insert({
        loan_id: loan.id,
        user_id: loan.user_id,
        member_id: loan.member_id || loan.profiles?.member_id,
        payment_date: new Date().toISOString(),
        interest_paid: interest,
        amount: totalAmount,
        monthly_emi: emi,
        additional_principal: additionalPrincipal,
        remaining_balance: newRemainingBalance,
        period_month: paymentMonth,
        period_year: paymentYear,
        period_key: `${paymentYear}-${String(paymentMonth).padStart(2, "0")}`,
        status: "paid",
        monthly_subscription: subscription,
        penalty: penalty,
      })

      if (paymentError) {
        console.error("[v0] Payment insert error:", paymentError)
        throw new Error(paymentError.message || "Failed to record payment")
      }

      if (penalty > 0) {
        const { error: penaltyError } = await supabase.from("penalties").insert({
          user_id: loan.user_id,
          member_id: loan.member_id || loan.profiles?.member_id,
          penalty_type: "payment",
          amount: penalty,
          reason: "Penalty payment via monthly payment dialog",
          period_key: `${paymentYear}-${String(paymentMonth).padStart(2, "0")}`,
          period_month: paymentMonth,
          period_year: paymentYear,
          recorded_by: user.id,
        })

        if (penaltyError) {
          console.error("[v0] Penalty payment error:", penaltyError)
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

      const shouldComplete = newRemainingBalance <= 0
      const newStatus = shouldComplete
        ? "paid"
        : loanData?.status === "approved"
          ? "active"
          : loanData?.status || "active"

      const { error: updateError } = await supabase
        .from("loans")
        .update({
          remaining_balance: newRemainingBalance,
          status: newStatus,
        })
        .eq("id", loan.id)

      if (updateError) {
        console.error("[v0] Loan update error:", updateError)
        throw new Error("Payment recorded but failed to update loan balance")
      }

      if (newLoan > 0) {
        const { error: newLoanError } = await supabase.from("additional_loan").insert({
          user_id: loan.user_id,
          member_id: loan.member_id || loan.profiles?.member_id,
          loan_id: loan.id,
          additional_loan_amount: newLoan,
          period_year: paymentYear,
          period_month: paymentMonth,
          period_key: `${paymentYear}-${String(paymentMonth).padStart(2, "0")}`,
        })

        if (newLoanError) {
          console.error("[v0] Additional loan error:", newLoanError)
          throw new Error("Payment recorded but failed to create additional loan")
        }

        const { error: updateLoanError } = await supabase
          .from("loans")
          .update({
            remaining_balance: newRemainingBalance,
          })
          .eq("id", loan.id)

        if (updateLoanError) {
          console.error("[v0] Loan update error:", updateLoanError)
          throw new Error("Additional loan created but failed to update remaining balance")
        }
      }

      await checkAndAutoInitializeNextMonth(supabase, paymentYear, paymentMonth)

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

      const { count: currentActiveLoans, error: activeLoansError } = await supabase
        .from("loans")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")

      if (activeLoansError) {
        console.error("[v0] Error counting active loans:", activeLoansError)
        return
      }

      const { data: allUsersData, error: allUsersError } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "member")

      if (allUsersError) {
        console.error("[v0] Error counting all users:", allUsersError)
        return
      }

      const { data: usersWithLoansData, error: usersWithLoansError } = await supabase
        .from("loans")
        .select("user_id")
        .eq("status", "active")

      if (usersWithLoansError) {
        console.error("[v0] Error counting users with loans:", usersWithLoansError)
        return
      }

      const usersWithActiveLoans = new Set(usersWithLoansData?.map((l: any) => l.user_id) || [])
      const subscriptionOnlyUsers = allUsersData?.filter((user: any) => !usersWithActiveLoans.has(user.id)).length || 0

      const totalUsersNeedingPayment = (currentActiveLoans || 0) + subscriptionOnlyUsers

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
        "[v0] Active loans:",
        currentActiveLoans,
        "Subscription-only users:",
        subscriptionOnlyUsers,
        "Total users needing payment:",
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
          <DialogTitle className="text-sm md:text-base">Record Monthly Payment</DialogTitle>
          <DialogDescription className="text-xs md:text-sm">
            Record payment for {loan.profiles?.full_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 md:space-y-4 py-2 md:py-4">
          <div className="grid grid-cols-3 gap-1.5 md:gap-3">
            <div className="p-2 md:p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-[9px] md:text-xs text-muted-foreground mb-1">Total Loan Taken</div>
              <div className="text-[10px] md:text-sm font-bold text-blue-600">{formatCurrency(loan.loan_amount)}</div>
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

          {(accumulatedInterest > 0 || accumulatedSubscription > 0) && (
            <div className="p-2 md:p-3 bg-yellow-50 rounded-lg border border-yellow-300">
              <div className="text-[10px] md:text-sm font-semibold text-yellow-800 mb-1">
                Unpaid Amounts Carried Forward
              </div>
              {accumulatedInterest > 0 && (
                <div className="text-[9px] md:text-xs text-yellow-700">
                  Previous Interest: {formatCurrency(accumulatedInterest)}
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
                Interest Payment {accumulatedInterest > 0 && "(Including Previous)"}
              </Label>
              <Input
                id="interest"
                type="number"
                step="1"
                min="0"
                placeholder={`₹${totalInterestDue}`}
                value={interestPayment || totalInterestDue}
                onChange={(e) => setInterestPayment(e.target.value)}
                className="h-7 md:h-9 text-xs md:text-sm bg-white"
                disabled={hasPaymentThisMonth}
              />
              <p className="text-[9px] md:text-xs text-muted-foreground">
                {accumulatedInterest > 0
                  ? `Previous: ${formatCurrency(accumulatedInterest)} + Current: ${formatCurrency(currentMonthInterest)}`
                  : `Current: ${formatCurrency(currentMonthInterest)}`}
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
                disabled={hasPaymentThisMonth}
              />
              <p className="text-[9px] md:text-xs text-muted-foreground">Extra payment beyond EMI</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="newLoan" className="text-[10px] md:text-xs">
                New Loan Taken
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
