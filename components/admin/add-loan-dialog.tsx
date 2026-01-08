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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { v4 as uuidv4 } from "uuid"

interface AddLoanDialogProps {
  users: Array<{ id: string; full_name: string; email: string; member_id: string }>
}

export function AddLoanDialog({ users }: AddLoanDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const userId = formData.get("userId") as string
    const amount = formData.get("amount") as string
    const interestRate = formData.get("interestRate") as string
    const purpose = formData.get("purpose") as string

    console.log("[v0] Add loan form submitted:", { userId, amount, interestRate, purpose })

    const principal = Number.parseFloat(amount)
    if (principal < 10000) {
      setError("Loan amount must be at least ₹10,000")
      setIsLoading(false)
      return
    }

    const selectedUser = users.find((u) => u.id === userId)
    if (!selectedUser) {
      setError("Please select a valid user")
      setIsLoading(false)
      return
    }

    console.log("[v0] Selected user:", selectedUser)

    try {
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      console.log("[v0] Current user:", user?.id)

      const { data: existingLoans, error: checkError } = await supabase
        .from("loans")
        .select("id, loan_amount, remaining_balance, member_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle()

      console.log("[v0] Existing loans check:", { existingLoans, checkError })

      if (checkError) {
        console.error("[v0] Error checking existing loans:", checkError)
        throw checkError
      }

      if (existingLoans) {
        // Top-up existing loan
        console.log("[v0] Top-up existing loan:", existingLoans.id)

        const currentBalance = existingLoans.remaining_balance ?? existingLoans.loan_amount

        const today = new Date()
        const periodKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

        console.log("[v0] Adding to additional_loan table:", {
          user_id: userId,
          loan_id: existingLoans.id,
          amount: principal,
          period_key: periodKey,
        })

        const { error: additionalError } = await supabase.from("additional_loan").insert({
          user_id: userId,
          member_id: existingLoans.member_id || selectedUser.member_id,
          loan_id: existingLoans.id,
          additional_loan_amount: principal,
          period_year: today.getFullYear(),
          period_month: today.getMonth() + 1,
          period_key: periodKey,
        })

        if (additionalError) {
          console.error("[v0] Additional loan creation error:", additionalError)
          throw additionalError
        }

        const newTotalAmount = currentBalance + principal

        console.log("[v0] Updating loan:", {
          id: existingLoans.id,
          newTotalAmount,
          currentBalance,
        })

        const { error: updateError } = await supabase
          .from("loans")
          .update({
            loan_amount: newTotalAmount,
            remaining_balance: newTotalAmount,
          })
          .eq("id", existingLoans.id)

        if (updateError) {
          console.error("[v0] Loan update error:", updateError)
          throw updateError
        }

        console.log("[v0] Loan top-up successful")
      } else {
        console.log("[v0] Creating new loan for user:", userId)

        // Generate a UUID for the loan
        const loanId = uuidv4()

        const { error: loanError } = await supabase.from("loans").insert({
          id: loanId,
          user_id: userId,
          member_id: selectedUser.member_id,
          loan_amount: principal,
          interest_rate: Number.parseFloat(interestRate),
          remaining_balance: principal,
          status: "active",
          approved_by: user?.id || null,
        })

        if (loanError) {
          console.error("[v0] Loan creation error:", loanError)
          throw loanError
        }

        console.log("[v0] New loan created successfully")
      }

      setOpen(false)
      router.refresh()
    } catch (error: unknown) {
      console.error("[v0] Error in handleSubmit:", error)
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Loan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Loan</DialogTitle>
            <DialogDescription>Create a new loan or top-up an existing one</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User</Label>
              <Select name="userId" required onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.member_id} - {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Loan Amount (₹)</Label>
              <Input id="amount" name="amount" type="number" step="1000" min="10000" defaultValue="5000" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interestRate">Interest Rate (%)</Label>
              <Input id="interestRate" name="interestRate" type="number" step="0.5" defaultValue="1.5" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose</Label>
              <Input id="purpose" name="purpose" placeholder="Optional loan purpose" />
            </div>
            {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Processing..." : "Add Loan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
