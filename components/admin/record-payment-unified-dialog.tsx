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
}

export function RecordPaymentUnifiedDialog({ loan, isMarked = false }: RecordPaymentUnifiedDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasPaymentThisMonth, setHasPaymentThisMonth] = useState(false)
  const [checkingPayment, setCheckingPayment] = useState(false)

  const principalRemaining = loan.remaining_balance ?? loan.loan_amount
  const defaultEmi = loan.monthly_emi || 5000

  const [emiPayment, setEmiPayment] = useState(defaultEmi.toString())
  const [additionalPrincipalPayment, setAdditionalPrincipalPayment] = useState("0")
  const [newLoanAmount, setNewLoanAmount] = useState("0")
  const [interestPayment, setInterestPayment] = useState("")

  const additionalPrincipal = Number(additionalPrincipalPayment) || 0
  const newLoan = Number(newLoanAmount) || 0
  const finalRemainingBalance = Math.max(0, principalRemaining - defaultEmi - additionalPrincipal + newLoan)
  const calculatedMonthlyInterest = Math.round((finalRemainingBalance * loan.interest_rate) / 100)

  const handleAdditionalPrincipalChange = (value: string) => {
    setAdditionalPrincipalPayment(value)
  }

  const handleNewLoanChange = (value: string) => {
    setNewLoanAmount(value)
  }

  const router = useRouter()

  useEffect(() => {
    if (open) {
      checkExistingPayment()
    }
  }, [open])

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
    const interest = interestPayment ? Number(interestPayment) : calculatedMonthlyInterest
    const additionalPrincipal = Number(additionalPrincipalPayment)
    const newLoan = Number(newLoanAmount)

    if (emi <= 0) {
      setError("Monthly EMI is mandatory and must be greater than 0")
      return
    }

    if (interest < 0 || additionalPrincipal < 0 || newLoan < 0 || emi < 0) {
      setError("Please enter valid amounts (no negative values)")
      return
    }

    if (newLoan > 0 && newLoan < 10000) {
      setError("New loan amount must be at least ₹10,000 or leave it blank")
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

      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .select("remaining_balance, status, interest_rate, loan_amount, monthly_emi")
        .eq("id", loan.id)
        .single()

      if (loanError) {
        console.error("[v0] Loan fetch error:", loanError)
        throw new Error("Failed to fetch loan data")
      }

      const currentPrincipal = loanData.remaining_balance ?? loanData.loan_amount

      const monthlyInterest = Math.round((currentPrincipal * (loanData.interest_rate || loan.interest_rate)) / 100)

      const newRemainingBalance = Math.max(0, currentPrincipal - emi - additionalPrincipal + newLoan)

      const now = new Date()
      const paymentMonth = now.getMonth() + 1
      const paymentYear = now.getFullYear()

      const totalAmount = interest + emi + additionalPrincipal

      const { error: paymentError } = await supabase.from("loan_payments").insert({
        loan_id: loan.id,
        user_id: loan.user_id,
        member_id: loan.member_id || loan.profiles?.member_id,
        payment_date: new Date().toISOString(),
        principal_paid: additionalPrincipal,
        interest_paid: interest,
        amount: totalAmount,
        monthly_emi: emi,
        additional_principal: additionalPrincipal,
        remaining_balance: newRemainingBalance,
        period_month: paymentMonth,
        period_year: paymentYear,
        period_key: `${paymentYear}-${String(paymentMonth).padStart(2, "0")}`,
        status: "paid",
      })

      if (paymentError) {
        console.error("[v0] Payment insert error:", paymentError)
        throw new Error(paymentError.message || "Failed to record payment")
      }

      const shouldComplete = newRemainingBalance <= 0
      const newStatus = shouldComplete ? "paid" : loanData.status === "approved" ? "active" : loanData.status

      const { error: updateError } = await supabase
        .from("loans")
        .update({
          remaining_balance: newRemainingBalance,
          status: newStatus,
          monthly_emi: emi,
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

        const finalBalance = newRemainingBalance + newLoan
        const { error: updateLoanError } = await supabase
          .from("loans")
          .update({
            loan_amount: loanData.loan_amount + newLoan,
            remaining_balance: finalBalance,
          })
          .eq("id", loan.id)

        if (updateLoanError) {
          console.error("[v0] Loan update error:", updateLoanError)
          throw new Error("Additional loan created but failed to update total loan amount")
        }
      }

      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "An error occurred while recording the payment")
    } finally {
      setIsLoading(false)
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

        {checkingPayment && (
          <div className="text-center py-4 text-xs md:text-sm text-muted-foreground">Checking payment status...</div>
        )}

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
              <div className="text-[10px] md:text-sm font-bold text-orange-600">
                {formatCurrency(calculatedMonthlyInterest)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <div className="space-y-1">
              <Label htmlFor="emi" className="text-[10px] md:text-xs font-semibold text-red-600">
                Monthly EMI (Mandatory) *
              </Label>
              <Input
                id="emi"
                type="number"
                step="100"
                min="1"
                placeholder="₹5000"
                value={emiPayment}
                onChange={(e) => setEmiPayment(e.target.value)}
                className="h-7 md:h-9 text-xs md:text-sm border-red-300 focus:border-red-500"
                required
                disabled={hasPaymentThisMonth}
                readOnly={true}
              />
              <p className="text-[9px] md:text-xs text-muted-foreground">Monthly EMI</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="interest" className="text-[10px] md:text-xs">
                Interest Payment
              </Label>
              <Input
                id="interest"
                type="number"
                step="1"
                min="0"
                placeholder={calculatedMonthlyInterest.toString()}
                value={interestPayment || calculatedMonthlyInterest}
                onChange={(e) => setInterestPayment(e.target.value)}
                className="h-7 md:h-9 text-xs md:text-sm bg-white"
                disabled={hasPaymentThisMonth}
              />
              <p className="text-[9px] md:text-xs text-muted-foreground">
                Auto-calculated: {formatCurrency(calculatedMonthlyInterest)}
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
                step="100"
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
                step="100"
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
