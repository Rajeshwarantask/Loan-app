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

interface RecordPaymentUnifiedDialogProps {
  loan: {
    id: string
    user_id: string
    interest_rate: number
    principal_remaining?: number
    outstanding_interest?: number
    amount: number
    monthly_emi_amount?: number
    profiles: {
      full_name: string
    }
  }
  isMarked?: boolean
}

export function RecordPaymentUnifiedDialog({ loan, isMarked = false }: RecordPaymentUnifiedDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const principalRemaining = loan.principal_remaining ?? loan.amount
  const outstandingInterest = loan.outstanding_interest ?? 0
  const totalLoan = principalRemaining + outstandingInterest
  const calculatedInterest = Math.round((principalRemaining * loan.interest_rate) / 100)
  const defaultEmi = 5000

  const [interestAmount, setInterestAmount] = useState(calculatedInterest.toString())
  const [principalAmount, setPrincipalAmount] = useState("0")
  const [newLoanTaken, setNewLoanTaken] = useState("0")
  const [monthlyEmi, setMonthlyEmi] = useState(defaultEmi.toString())

  const router = useRouter()

  const handleSubmit = async (isPaid: boolean) => {
    if (!isPaid) {
      setOpen(false)
      return
    }

    const interest = Number(interestAmount)
    const principal = Number(principalAmount)
    const newLoan = Number(newLoanTaken)
    const emi = Number(monthlyEmi)

    if (interest < 0 || principal < 0 || newLoan < 0 || emi < 0) {
      setError("Please enter valid amounts (no negative values)")
      return
    }

    if (newLoan > 0 && newLoan < 10000) {
      setError("New loan amount must be at least ₹10,000 or leave it blank")
      return
    }

    if (interest === 0 && principal === 0 && newLoan === 0) {
      setError("Please enter at least one payment amount")
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

      // Fetch current loan data
      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .select("principal_remaining, outstanding_interest, status, interest_rate, amount")
        .eq("id", loan.id)
        .single()

      if (loanError) {
        throw new Error("Failed to fetch loan data")
      }

      const currentPrincipal = loanData.principal_remaining ?? loanData.amount
      const currentOutstandingInterest = loanData.outstanding_interest ?? 0

      const newPrincipal = Math.max(0, currentPrincipal - principal)
      const monthlyInterest = Math.round((currentPrincipal * (loanData.interest_rate || loan.interest_rate)) / 100)
      const updatedOutstandingInterest = Math.max(0, currentOutstandingInterest + monthlyInterest - interest)

      const now = new Date()
      const paymentMonth = now.getMonth() + 1
      const paymentYear = now.getFullYear()

      // Record interest payment if any
      if (interest > 0) {
        const { error: interestError } = await supabase.from("loan_payments").insert({
          loan_id: loan.id,
          user_id: loan.user_id,
          payment_date: new Date().toISOString(),
          payment_type: "interest",
          principal_paid: 0,
          interest_paid: interest,
          principal_remaining: newPrincipal,
          outstanding_interest: updatedOutstandingInterest,
          remaining_balance: newPrincipal + updatedOutstandingInterest,
          month_year: new Date().toLocaleString("en-US", { month: "short", year: "numeric" }),
          payment_month: paymentMonth,
          payment_year: paymentYear,
        })

        if (interestError) {
          throw new Error(interestError.message || "Failed to record interest payment")
        }
      }

      // Record principal payment if any
      if (principal > 0) {
        const { error: principalError } = await supabase.from("loan_payments").insert({
          loan_id: loan.id,
          user_id: loan.user_id,
          payment_date: new Date().toISOString(),
          payment_type: "principal",
          principal_paid: principal,
          interest_paid: 0,
          principal_remaining: newPrincipal,
          outstanding_interest: updatedOutstandingInterest,
          remaining_balance: newPrincipal + updatedOutstandingInterest,
          month_year: new Date().toLocaleString("en-US", { month: "short", year: "numeric" }),
          payment_month: paymentMonth,
          payment_year: paymentYear,
        })

        if (principalError) {
          throw new Error(principalError.message || "Failed to record principal payment")
        }
      }

      // Determine if loan should be completed
      const shouldComplete = newPrincipal <= 0 && updatedOutstandingInterest <= 0
      const newStatus = shouldComplete ? "completed" : loanData.status === "approved" ? "active" : loanData.status

      const { error: updateError } = await supabase
        .from("loans")
        .update({
          principal_remaining: newPrincipal,
          outstanding_interest: updatedOutstandingInterest,
          status: newStatus,
          monthly_emi_amount: emi,
        })
        .eq("id", loan.id)

      if (updateError) {
        console.error("Failed to update loan:", updateError)
        throw new Error("Payment recorded but failed to update loan balance")
      }

      if (newLoan > 0) {
        const { error: newLoanError } = await supabase.from("loans").insert({
          user_id: loan.user_id,
          amount: newLoan,
          interest_rate: loan.interest_rate, // Use the same interest rate as current loan
          installment_loan_taken: newLoan,
          principal_remaining: newLoan,
          outstanding_interest: 0,
          status: "active",
          approved_at: new Date().toISOString(),
          monthly_emi_amount: emi,
        })

        if (newLoanError) {
          console.error("Failed to create new loan:", newLoanError)
          throw new Error("Payment recorded but failed to create new loan")
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 bg-transparent"
          disabled={isMarked}
          title={isMarked ? "Payment already recorded for this month" : "Record payment"}
        >
          <Receipt className="h-3.5 w-3.5 mr-1" />
          Record Payment
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>Record payment for {loan.profiles?.full_name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-xs text-muted-foreground mb-1">Total Loan</div>
              <div className="text-sm font-bold text-blue-600">{formatCurrency(totalLoan)}</div>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="text-xs text-muted-foreground mb-1">Principal</div>
              <div className="text-sm font-bold text-green-600">{formatCurrency(principalRemaining)}</div>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-xs text-muted-foreground mb-1">Interest</div>
              <div className="text-sm font-bold text-orange-600">{formatCurrency(outstandingInterest)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="interest" className="text-xs">
                Interest Payment
              </Label>
              <Input
                id="interest"
                type="number"
                step="1"
                min="0"
                placeholder="₹0"
                value={interestAmount}
                onChange={(e) => setInterestAmount(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="principal" className="text-xs">
                Principal Payment
              </Label>
              <Input
                id="principal"
                type="number"
                step="100"
                min="0"
                placeholder="₹0"
                value={principalAmount}
                onChange={(e) => setPrincipalAmount(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="monthlyEmi" className="text-xs">
                Monthly EMI
              </Label>
              <Input
                id="monthlyEmi"
                type="number"
                step="100"
                min="0"
                placeholder="₹5000"
                value={monthlyEmi}
                onChange={(e) => setMonthlyEmi(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newLoan" className="text-xs">
                New Loan Taken
              </Label>
              <Input
                id="newLoan"
                type="number"
                step="100"
                min="0"
                placeholder="₹0"
                value={newLoanTaken}
                onChange={(e) => setNewLoanTaken(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-200">{error}</div>}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={isLoading}
            className="flex-1"
          >
            Not Paid
          </Button>
          <Button type="button" onClick={() => handleSubmit(true)} disabled={isLoading} className="flex-1">
            {isLoading ? "Recording..." : "Paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
