"use client"

import { useState } from "react"
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

interface SubscriptionOnlyPaymentDialogProps {
  user: {
    id: string
    full_name: string
    member_id?: string
    email: string
  }
  isMarked?: boolean
  onPaymentRecorded?: () => void
}

export function SubscriptionOnlyPaymentDialog({
  user,
  isMarked = false,
  onPaymentRecorded,
}: SubscriptionOnlyPaymentDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [monthlySubscription, setMonthlySubscription] = useState("2100")
  const [penaltyPayment, setPenaltyPayment] = useState("0")
  const router = useRouter()

  const handleSubmit = async () => {
    const subscription = Number(monthlySubscription) || 2100
    const penalty = Number(penaltyPayment) || 0

    if (subscription < 0 || penalty < 0) {
      setError("Please enter valid amounts (no negative values)")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !authUser) {
        throw new Error("You must be logged in to record payments")
      }

      let memberIdToUse = user.member_id

      if (!memberIdToUse) {
        const { data: profileData } = await supabase.from("profiles").select("member_id").eq("id", user.id).single()

        memberIdToUse = profileData?.member_id || null
        console.log("[v0] Fetched member_id from profiles:", memberIdToUse)
      }

      const now = new Date()
      const paymentMonth = now.getMonth() + 1
      const paymentYear = now.getFullYear()
      const periodKey = `${paymentYear}-${String(paymentMonth).padStart(2, "0")}`

      // Check if subscription payment already exists for this month
      const { data: existingPayment } = await supabase
        .from("loan_payments")
        .select("id")
        .eq("user_id", user.id)
        .eq("period_key", periodKey)
        .limit(1)

      if (existingPayment && existingPayment.length > 0) {
        throw new Error("Subscription payment already recorded for this month")
      }

      // Even if loan is completed, we need a loan_id for the foreign key constraint
      const { data: existingLoans } = await supabase
        .from("loans")
        .select("id, loan_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)

      // Use the most recent loan_id if available, otherwise use 'SUBSCRIPTION_ONLY' as placeholder
      const referenceLoanId =
        existingLoans && existingLoans.length > 0
          ? existingLoans[0].loan_id || existingLoans[0].id
          : "SUBSCRIPTION_ONLY"

      console.log("[v0] Using loan_id for subscription payment:", referenceLoanId)
      console.log("[v0] Using member_id for subscription payment:", memberIdToUse)

      // Insert subscription-only payment with zero loan-related amounts
      const { error: paymentError } = await supabase.from("loan_payments").insert({
        loan_id: referenceLoanId,
        user_id: user.id,
        member_id: memberIdToUse, // Use fetched member_id
        payment_date: new Date().toISOString(),
        interest_paid: 0,
        amount: subscription,
        monthly_emi: 0,
        additional_principal: 0,
        remaining_balance: 0,
        period_month: paymentMonth,
        period_year: paymentYear,
        period_key: periodKey,
        status: "paid",
        monthly_subscription: subscription,
        principal_paid: 0,
        penalty: penalty, // Added penalty field
      })

      if (paymentError) {
        console.error("[v0] Subscription payment insert error:", paymentError.message)
        throw new Error(paymentError.message || "Failed to record subscription payment")
      }

      setOpen(false)

      await checkAndAutoInitializeNextMonth(supabase, paymentYear, paymentMonth)

      onPaymentRecorded?.()
      router.refresh()
    } catch (err: any) {
      setError(err.message || "An error occurred while recording the subscription payment")
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

      // Count users without active loans (subscription-only users)
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
          data: { user: authUser },
        } = await supabase.auth.getUser()

        if (!authUser) {
          console.error("[v0] User not authenticated for auto-initialization")
          return
        }

        console.log(
          "[v0] All payments (active loans + subscription-only) recorded! Auto-initializing month:",
          periodKey,
        )

        const { data, error: rpcError } = await supabase.rpc("initialize_new_month", {
          p_period_key: periodKey,
          p_created_by: authUser.id,
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-6 md:h-8 bg-transparent text-[10px] md:text-sm px-1 md:px-2"
          disabled={isMarked}
        >
          <Receipt className="h-3 w-3 md:h-3.5 md:w-3.5 md:mr-1" />
          <span className="hidden md:inline">Record Subscription</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[95vw] md:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm md:text-base">Record Subscription Payment</DialogTitle>
          <DialogDescription className="text-xs md:text-sm">
            Record monthly subscription for {user.full_name} (No active loan)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 md:space-y-4 py-2 md:py-4">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-xs text-muted-foreground mb-2">
              This user has no active loan but can still contribute their monthly subscription.
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthlySubscription" className="text-xs md:text-sm">
              Monthly Subscription Amount
            </Label>
            <Input
              id="monthlySubscription"
              type="number"
              step="100"
              min="0"
              placeholder="₹2100"
              value={monthlySubscription}
              onChange={(e) => setMonthlySubscription(e.target.value)}
              className="h-9 md:h-10 text-sm md:text-base"
            />
            <p className="text-xs text-muted-foreground">Default: {formatCurrency(2100)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="penalty" className="text-xs md:text-sm">
              Penalty Payment (Optional)
            </Label>
            <Input
              id="penalty"
              type="number"
              step="100"
              min="0"
              placeholder="₹0"
              value={penaltyPayment}
              onChange={(e) => setPenaltyPayment(e.target.value)}
              className="h-9 md:h-10 text-sm md:text-base"
            />
            <p className="text-xs text-muted-foreground">
              Enter penalty amount if user is paying off penalty (e.g., ₹100)
            </p>
          </div>

          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-200">{error}</div>}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
            className="flex-1 h-9 md:h-10 text-xs md:text-sm"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 h-9 md:h-10 text-xs md:text-sm"
          >
            {isLoading ? "Recording..." : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
