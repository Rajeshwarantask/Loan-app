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
import { Banknote } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils/loan-calculator"

interface RecordPrincipalDialogProps {
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
}

export function RecordPrincipalDialog({ loan }: RecordPrincipalDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const principalRemaining = loan.principal_remaining ?? loan.amount
  const defaultPayment = Math.min(5000, principalRemaining)

  const [principalAmount, setPrincipalAmount] = useState(defaultPayment.toString())
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const amount = Number(principalAmount)
    if (amount <= 0) {
      setError("Please enter a valid principal amount")
      return
    }

    if (amount > principalRemaining) {
      setError(`Principal amount cannot exceed remaining balance of ${formatCurrency(principalRemaining)}`)
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
        .select("principal_remaining, outstanding_interest, status, interest_rate")
        .eq("id", loan.id)
        .single()

      if (loanError) {
        throw new Error("Failed to fetch loan data")
      }

      const currentPrincipal = loanData.principal_remaining ?? loan.amount
      const currentOutstandingInterest = loanData.outstanding_interest ?? 0
      const newPrincipal = Math.max(0, currentPrincipal - amount)

      // When principal is being paid, interest continues to accumulate on remaining balance
      const monthlyInterest = Math.round((currentPrincipal * (loanData.interest_rate || loan.interest_rate)) / 100)
      const updatedOutstandingInterest = currentOutstandingInterest + monthlyInterest

      // This ensures that even if principal reaches 0, the loan stays active until interest is cleared
      const shouldComplete = newPrincipal <= 0 && updatedOutstandingInterest <= 0

      // Insert payment record
      const { error: insertError } = await supabase.from("loan_payments").insert({
        loan_id: loan.id,
        user_id: loan.user_id,
        payment_date: new Date().toISOString(),
        payment_type: "principal",
        principal_paid: amount,
        interest_paid: 0,
        principal_remaining: newPrincipal,
        outstanding_interest: updatedOutstandingInterest,
        remaining_balance: newPrincipal + updatedOutstandingInterest,
        month_year: new Date().toLocaleString("en-US", { month: "short", year: "numeric" }),
      })

      if (insertError) {
        throw new Error(insertError.message || "Failed to record principal payment")
      }

      const newStatus = shouldComplete ? "completed" : loanData.status === "approved" ? "active" : loanData.status

      const { error: updateError } = await supabase
        .from("loans")
        .update({
          principal_remaining: newPrincipal,
          outstanding_interest: updatedOutstandingInterest,
          status: newStatus,
        })
        .eq("id", loan.id)

      if (updateError) {
        console.error("Failed to update loan:", updateError)
        throw new Error("Payment recorded but failed to update loan balance")
      }

      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "An error occurred while recording the principal payment")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 bg-transparent">
          <Banknote className="h-3.5 w-3.5 mr-1" />
          Principal
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Record Principal Payment</DialogTitle>
            <DialogDescription>Record principal payment for {loan.profiles?.full_name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-sm text-muted-foreground">Current Principal Balance</div>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(principalRemaining)}</div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="principalAmount">Principal Amount</Label>
              <Input
                id="principalAmount"
                type="number"
                step="100"
                min="0"
                max={principalRemaining}
                placeholder="₹0"
                value={principalAmount}
                onChange={(e) => setPrincipalAmount(e.target.value)}
                className="h-12 text-lg"
                required
              />
              <p className="text-xs text-muted-foreground">
                Remaining after payment:{" "}
                {formatCurrency(Math.max(0, principalRemaining - Number(principalAmount || 0)))}
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
              {isLoading ? "Recording..." : "Record Principal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
