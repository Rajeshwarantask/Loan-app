"use client"

import type React from "react"

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
import { DollarSign } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils/loan-calculator"

interface RecordInterestDialogProps {
  loan: {
    id: string
    user_id: string
    interest_rate: number
    principal_remaining?: number
    amount: number
    profiles: {
      full_name: string
    }
  }
  disabled?: boolean
}

export function RecordInterestDialog({ loan, disabled }: RecordInterestDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const principalRemaining = loan.principal_remaining ?? loan.amount
  const calculatedInterest = Math.round((principalRemaining * loan.interest_rate) / 100)

  const [interestAmount, setInterestAmount] = useState(calculatedInterest.toString())
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const amount = Number(interestAmount)
    if (amount <= 0) {
      setError("Please enter a valid interest amount")
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
        .select("principal_remaining, outstanding_interest, status")
        .eq("id", loan.id)
        .single()

      if (loanError) {
        throw new Error("Failed to fetch loan data")
      }

      const currentPrincipal = loanData.principal_remaining ?? loan.amount
      const currentOutstandingInterest = loanData.outstanding_interest ?? 0
      const newOutstandingInterest = Math.max(0, currentOutstandingInterest - amount)

      // Insert payment record
      const { error: insertError } = await supabase.from("loan_payments").insert({
        loan_id: loan.id,
        user_id: loan.user_id,
        payment_date: new Date().toISOString(),
        payment_type: "interest",
        interest_paid: amount,
        principal_paid: 0,
        principal_remaining: currentPrincipal,
        outstanding_interest: newOutstandingInterest,
        remaining_balance: currentPrincipal + newOutstandingInterest,
        month_year: new Date().toLocaleString("en-US", { month: "short", year: "numeric" }),
        payment_month: new Date().getMonth() + 1,
        payment_year: new Date().getFullYear(),
      })

      if (insertError) {
        if (insertError.message.includes("only be recorded once per month")) {
          throw new Error("Interest has already been recorded for this month")
        }
        throw new Error(insertError.message || "Failed to record interest payment")
      }

      // This prevents premature completion when only principal is paid but interest remains
      const shouldComplete = currentPrincipal <= 0 && newOutstandingInterest <= 0
      const newStatus = shouldComplete ? "completed" : loanData.status === "approved" ? "active" : loanData.status

      // Update loan outstanding interest and status
      const { error: updateError } = await supabase
        .from("loans")
        .update({
          outstanding_interest: newOutstandingInterest,
          status: newStatus,
        })
        .eq("id", loan.id)

      if (updateError) {
        console.error("Failed to update loan outstanding interest:", updateError)
      }

      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "An error occurred while recording the interest payment")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="h-8 bg-transparent">
          <DollarSign className="h-3.5 w-3.5 mr-1" />
          Interest
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Record Interest Payment</DialogTitle>
            <DialogDescription>Record interest for {loan.profiles?.full_name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-muted-foreground">Current Principal Balance</div>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(principalRemaining)}</div>
              <div className="text-xs text-muted-foreground">Interest Rate: {loan.interest_rate}%</div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interestAmount">Interest Amount</Label>
              <Input
                id="interestAmount"
                type="number"
                step="1"
                min="0"
                placeholder="₹0"
                value={interestAmount}
                onChange={(e) => setInterestAmount(e.target.value)}
                className="h-12 text-lg"
                required
              />
              <p className="text-xs text-muted-foreground">
                Calculated interest for current month: {formatCurrency(calculatedInterest)}
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-200">{error}</div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Recording..." : "Record Interest"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
