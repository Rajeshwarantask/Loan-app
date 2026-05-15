"use client"

import type React from "react"
import { formatCurrency } from "@/lib/utils/loan-calculator"

import { useState, useMemo } from "react"
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
import { Plus, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { v4 as uuidv4 } from "uuid"
import { triggerNotification } from "@/lib/server-actions/notifications"

interface AddLoanDialogProps {
  users: Array<{ id: string; full_name: string; email: string; member_id: string }>
}

const formatCurrencyForNotification = (amount: number) => formatCurrency(amount)

export function AddLoanDialog({ users }: AddLoanDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users

    const query = searchQuery.toLowerCase()
    return users.filter(
      (user) =>
        user.full_name.toLowerCase().includes(query) ||
        user.member_id.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    )
  }, [users, searchQuery])

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
        .select("id, loan_amount, member_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle()

      console.log("[v0] Existing loans check:", { existingLoans, checkError })

      if (checkError) {
        console.error("[v0] Error checking existing loans:", checkError)
        throw checkError
      }

      if (existingLoans) {
        // Top-up existing loan using additional_loan table (new logic)
        console.log("[v0] Top-up existing loan via additional_loan:", existingLoans.id)

        const today = new Date()
        const periodKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

        console.log("[v0] Adding to additional_loan table:", {
          user_id: userId,
          loan_id: existingLoans.id,
          amount: principal,
          period_key: periodKey,
        })

        // Insert into additional_loan table for tracking
        const { error: additionalError } = await supabase.from("additional_loan").insert({
          user_id: userId,
          member_id: existingLoans.member_id || selectedUser.member_id,
          full_name: selectedUser.full_name,
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

        // Also update loans.loan_amount to stay in sync (loan_amount = current outstanding balance)
        const newLoanAmount = (existingLoans.loan_amount || 0) + principal
        const { error: loanUpdateError } = await supabase
          .from("loans")
          .update({ loan_amount: newLoanAmount })
          .eq("id", existingLoans.id)

        if (loanUpdateError) {
          console.error("[v0] Failed to update loans.loan_amount on top-up:", loanUpdateError)
          throw loanUpdateError
        }

        console.log("[v0] Loan top-up recorded in additional_loan and loans.loan_amount updated to:", newLoanAmount)

        // Top-up notification via server action
        triggerNotification({
          type: "loan_approval",
          userId: userId,
          title: "Loan Top-up",
          body: `Your loan has been topped up with an additional ${formatCurrency(principal)}.`,
          data: { type: "loan_topup", amount: principal },
        }).catch((err) => console.error("[v0] Failed to send top-up notification:", err))
      } else {
        console.log("[v0] Creating new loan for user:", userId)

        // Generate a UUID for the loan
        const loanId = uuidv4()

        // Set period information for the new loan
        const today = new Date()
        const periodKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

        const { error: loanError } = await supabase.from("loans").insert({
          id: loanId,
          user_id: userId,
          member_id: selectedUser.member_id,
          full_name: selectedUser.full_name,
          loan_amount: principal,
          interest_rate: Number.parseFloat(interestRate),
          status: "active",
          approved_by: user?.id || null,
          period_year: today.getFullYear(),
          period_month: today.getMonth() + 1,
          period_key: periodKey,
        })

        if (loanError) {
          console.error("[v0] Loan creation error:", loanError)
          throw loanError
        }

        console.log("[v0] New loan created successfully")

        // Send loan creation notification via server action
        triggerNotification({
          type: "loan_approval",
          userId: userId,
          title: "Loan Created",
          body: `A new loan of ${formatCurrency(principal)} has been created for you.`,
          data: { type: "loan_created", amount: principal },
        }).catch((err) => console.error("[v0] Failed to send loan creation notification:", err))
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

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // Reset form state when dialog closes
      setSearchQuery("")
      setSelectedUserId("")
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            {/* User Selection Section */}
            <div className="space-y-2">
              <Label htmlFor="userId">Select User</Label>
              <div className="flex gap-2">
                {/* Dropdown on Left */}
                <div className="flex-1">
                  <Select name="userId" required onValueChange={setSelectedUserId} value={selectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose user" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {filteredUsers.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">No users found</div>
                      ) : (
                        filteredUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.member_id} - {user.full_name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Search on Right */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {/* Loan Details Section */}
            <div className="space-y-3 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Loan Amount (₹)</Label>
                <Input id="amount" name="amount" type="number" step="1000" min="10000" defaultValue="50000" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interestRate">Interest Rate (%)</Label>
                <Input id="interestRate" name="interestRate" type="number" step="0.5" defaultValue="1.5" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purpose">Purpose (Optional)</Label>
                <Input id="purpose" name="purpose" placeholder="e.g., Business expansion" />
              </div>
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
