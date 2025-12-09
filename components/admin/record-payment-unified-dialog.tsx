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

  const calculatedMonthlyInterest = Math.round((principalRemaining * loan.interest_rate) / 100)
  const defaultEmi = loan.monthly_emi_amount || 5000

  const [interestPayment, setInterestPayment] = useState(calculatedMonthlyInterest.toString())
  const [emiPayment, setEmiPayment] = useState(defaultEmi.toString())
  const [additionalPrincipalPayment, setAdditionalPrincipalPayment] = useState("0")
  const [newLoanTaken, setNewLoanTaken] = useState("0")

  const router = useRouter()

  const handleSubmit = async (isPaid: boolean) => {
    if (!isPaid) {
      setOpen(false)
      return
    }

    const emi = Number(emiPayment)
    const interest = Number(interestPayment)
    const additionalPrincipal = Number(additionalPrincipalPayment)
    const newLoan = Number(newLoanTaken)

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

      const monthlyInterest = Math.round((currentPrincipal * (loanData.interest_rate || loan.interest_rate)) / 100)

      const updatedOutstandingInterest = Math.max(0, currentOutstandingInterest + monthlyInterest - interest)

      const totalPrincipalReduction = emi + additionalPrincipal
      const newPrincipal = Math.max(0, currentPrincipal - totalPrincipalReduction)

      const now = new Date()
      const paymentMonth = now.getMonth() + 1
      const paymentYear = now.getFullYear()

      if (interest > 0) {
        const { error: interestError } = await supabase.from("loan_payments").insert({
          loan_id: loan.id,
          user_id: loan.user_id,
          payment_date: new Date().toISOString(),
          payment_type: "interest",
          principal_paid: 0,
          interest_paid: interest,
          amount: interest,
          month_year: new Date().toLocaleString("en-US", { month: "short", year: "numeric" }),
        })

        if (interestError) {
          throw new Error(interestError.message || "Failed to record interest payment")
        }
      }

      const { error: emiError } = await supabase.from("loan_payments").insert({
        loan_id: loan.id,
        user_id: loan.user_id,
        payment_date: new Date().toISOString(),
        payment_type: "principal",
        principal_paid: emi,
        interest_paid: 0,
        amount: emi,
        month_year: new Date().toLocaleString("en-US", { month: "short", year: "numeric" }),
      })

      if (emiError) {
        throw new Error(emiError.message || "Failed to record EMI payment")
      }

      if (additionalPrincipal > 0) {
        const { error: principalError } = await supabase.from("loan_payments").insert({
          loan_id: loan.id,
          user_id: loan.user_id,
          payment_date: new Date().toISOString(),
          payment_type: "principal",
          principal_paid: additionalPrincipal,
          interest_paid: 0,
          amount: additionalPrincipal,
          month_year: new Date().toLocaleString("en-US", { month: "short", year: "numeric" }),
        })

        if (principalError) {
          throw new Error(principalError.message || "Failed to record additional principal payment")
        }
      }

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
          interest_rate: loan.interest_rate,
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
          className="h-6 md:h-8 bg-transparent text-[10px] md:text-sm px-1 md:px-2"
          disabled={isMarked}
          title={isMarked ? "Payment already recorded for this month" : "Record payment"}
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
              <div className="text-[9px] md:text-xs text-muted-foreground mb-1">Total Outstanding</div>
              <div className="text-[10px] md:text-sm font-bold text-blue-600">{formatCurrency(totalLoan)}</div>
            </div>
            <div className="p-2 md:p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="text-[9px] md:text-xs text-muted-foreground mb-1">Principal</div>
              <div className="text-[10px] md:text-sm font-bold text-green-600">
                {formatCurrency(principalRemaining)}
              </div>
            </div>
            <div className="p-2 md:p-3 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-[9px] md:text-xs text-muted-foreground mb-1">Interest Due</div>
              <div className="text-[10px] md:text-sm font-bold text-orange-600">
                {formatCurrency(outstandingInterest)}
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
              />
              <p className="text-[9px] md:text-xs text-muted-foreground">Reduces principal directly</p>
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
                placeholder="₹0"
                value={interestPayment}
                onChange={(e) => setInterestPayment(e.target.value)}
                className="h-7 md:h-9 text-xs md:text-sm"
              />
              <p className="text-[9px] md:text-xs text-muted-foreground">
                Monthly interest: ₹{calculatedMonthlyInterest}
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
                onChange={(e) => setAdditionalPrincipalPayment(e.target.value)}
                className="h-7 md:h-9 text-xs md:text-sm"
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
                value={newLoanTaken}
                onChange={(e) => setNewLoanTaken(e.target.value)}
                className="h-7 md:h-9 text-xs md:text-sm"
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
            disabled={isLoading}
            className="flex-1 h-8 md:h-10 text-xs md:text-sm"
          >
            Not Paid
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={isLoading}
            className="flex-1 h-8 md:h-10 text-xs md:text-sm"
          >
            {isLoading ? "Recording..." : "Paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
