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
import { Textarea } from "@/components/ui/textarea"
import { Edit } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface EditMonthlyRecordDialogProps {
  record: {
    id: string
    user_id: string
    month_year: string
    opening_outstanding: number
    monthly_subscription: number
    interest_due: number
    interest_paid: number
    principal_paid: number
    new_loan_taken: number
    penalty: number
    total_loan_taken: number
    additional_principal: number
    monthly_installment_income: number
    previous_month_interest_income: number
    previous_month_total_income: number
    previous_month_total_loan_outstanding: number
    income_difference: number
    available_loan_amount: number
    status: string
    notes: string | null
    profiles: {
      full_name: string
      member_id: string | null
    }
  }
}

export function EditMonthlyRecordDialog({ record }: EditMonthlyRecordDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [interestPaid, setInterestPaid] = useState((record.interest_paid ?? 0).toString())
  const [principalPaid, setPrincipalPaid] = useState((record.principal_paid ?? 0).toString())
  const [newLoanTaken, setNewLoanTaken] = useState((record.new_loan_taken ?? 0).toString())
  const [penalty, setPenalty] = useState((record.penalty ?? 0).toString())
  const [notes, setNotes] = useState(record.notes || "")
  const [additionalPrincipal, setAdditionalPrincipal] = useState((record.additional_principal ?? 0).toString())

  const router = useRouter()

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("You must be logged in")
      }

      const interestPaidNum = Number.parseFloat(interestPaid)
      const principalPaidNum = Number.parseFloat(principalPaid)
      const newLoanTakenNum = Number.parseFloat(newLoanTaken)
      const penaltyNum = Number.parseFloat(penalty)
      const additionalPrincipalNum = Number.parseFloat(additionalPrincipal)

      const openingOutstanding = record.opening_outstanding ?? 0
      const monthlySubscription = record.monthly_subscription ?? 0

      const closingOutstanding = openingOutstanding + newLoanTakenNum - principalPaidNum - additionalPrincipalNum
      const totalMonthlyIncome = monthlySubscription + interestPaidNum + principalPaidNum + penaltyNum
      const installmentIncome = interestPaidNum + principalPaidNum
      const availableLoanAmount = 400000 - closingOutstanding

      const updateData = {
        interest_paid: interestPaidNum,
        principal_paid: principalPaidNum,
        new_loan_taken: newLoanTakenNum,
        penalty: penaltyNum,
        additional_principal: additionalPrincipalNum,
        closing_outstanding: closingOutstanding,
        total_monthly_income: totalMonthlyIncome,
        monthly_installment_income: installmentIncome,
        available_loan_amount: availableLoanAmount,
        notes,
        updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase.from("monthly_loan_records").update(updateData).eq("id", record.id)

      if (updateError) {
        throw new Error(updateError.message || "Failed to update record")
      }

      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFinalize = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("You must be logged in")
      }

      // First update the data
      await handleSubmit()

      // Then finalize the record
      const { error: finalizeError } = await supabase.rpc("finalize_monthly_record", {
        record_id: record.id,
        admin_id: user.id,
      })

      if (finalizeError) {
        throw new Error(finalizeError.message || "Failed to finalize record")
      }

      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const isFinalized = record.status === "finalized"

  return (
    <Dialog open={open} onValueChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Edit Monthly Record - {record.profiles.member_id} {record.profiles.full_name}
          </DialogTitle>
          <DialogDescription>
            {record.month_year} • Opening Outstanding: ₹{(record.opening_outstanding ?? 0).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="interestPaid">Interest Paid</Label>
              <Input
                id="interestPaid"
                type="number"
                step="0.01"
                min="0"
                value={interestPaid}
                onChange={(e) => setInterestPaid(e.target.value)}
                disabled={isFinalized}
              />
              <p className="text-xs text-muted-foreground">
                Calculated: ₹{(record.interest_due ?? 0).toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="principalPaid">Principal Paid (EMI)</Label>
              <Input
                id="principalPaid"
                type="number"
                step="0.01"
                min="0"
                value={principalPaid}
                onChange={(e) => setPrincipalPaid(e.target.value)}
                disabled={isFinalized}
              />
              <p className="text-xs text-muted-foreground">Reduces outstanding balance</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="newLoanTaken">New Loan Taken</Label>
              <Input
                id="newLoanTaken"
                type="number"
                step="0.01"
                min="0"
                value={newLoanTaken}
                onChange={(e) => setNewLoanTaken(e.target.value)}
                disabled={isFinalized}
              />
              <p className="text-xs text-muted-foreground">Increases outstanding balance</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="penalty">Penalty</Label>
              <Input
                id="penalty"
                type="number"
                step="0.01"
                min="0"
                value={penalty}
                onChange={(e) => setPenalty(e.target.value)}
                disabled={isFinalized}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="additionalPrincipal">Additional Principal</Label>
              <Input
                id="additionalPrincipal"
                type="number"
                step="0.01"
                min="0"
                value={additionalPrincipal}
                onChange={(e) => setAdditionalPrincipal(e.target.value)}
                disabled={isFinalized}
              />
              <p className="text-xs text-muted-foreground">Reduces outstanding balance</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes or remarks..."
              disabled={isFinalized}
              rows={3}
            />
          </div>

          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-200">{error}</div>}

          {isFinalized && (
            <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-600 border border-blue-200">
              This record has been finalized and cannot be edited.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          {!isFinalized && (
            <>
              <Button type="button" variant="secondary" onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Draft"}
              </Button>
              <Button type="button" onClick={handleFinalize} disabled={isLoading}>
                {isLoading ? "Finalizing..." : "Save & Finalize"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
