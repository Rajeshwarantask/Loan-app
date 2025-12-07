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
import { Eye } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/utils/loan-calculator"

export function RecordPaymentDialog({ loan }: { loan: any }) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [interestPaid, setInterestPaid] = useState<boolean>(false)
  const [principalPaid, setPrincipalPaid] = useState<boolean>(false)
  const [principalAmount, setPrincipalAmount] = useState("")
  const router = useRouter()

  const handleSubmit = async () => {
    console.log("[v0] Starting payment recording...")
    console.log("[v0] Interest paid:", interestPaid)
    console.log("[v0] Principal paid:", principalPaid)
    console.log("[v0] Principal amount:", principalAmount)

    if (!interestPaid && !principalPaid) {
      setError("Please select at least one payment type to record")
      return
    }

    if (principalPaid && (!principalAmount || Number(principalAmount) <= 0)) {
      setError("Please enter a valid principal amount")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Check authentication
      console.log("[v0] Checking authentication...")
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        console.error("[v0] Authentication error:", authError)
        throw new Error("You must be logged in to record payments")
      }

      console.log("[v0] User authenticated:", user.id)

      // Check admin role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()

      if (profileError) {
        console.error("[v0] Profile fetch error:", profileError)
        throw new Error("Failed to verify admin permissions")
      }

      if (!profile || profile.role !== "admin") {
        console.error("[v0] User is not admin. Role:", profile?.role)
        throw new Error("You must be an admin to record payments")
      }

      console.log("[v0] Admin verified")

      // Fetch the loan to get the latest balance
      console.log("[v0] Fetching loan data for loan_id:", loan.id)
      const { data: loanData, error: loanError } = await supabase
        .from("loans")
        .select("*")
        .eq("id", loan.id)
        .maybeSingle()

      if (loanError || !loanData) {
        console.error("[v0] Loan fetch error:", loanError)
        throw new Error("Failed to fetch loan data")
      }

      console.log("[v0] Loan data fetched:", loanData)

      const principalPaidAmount = principalPaid && principalAmount ? Number(principalAmount) : 0
      const newRemainingBalance = loanData.amount - principalPaidAmount

      // Prepare payment data
      const paymentData: any = {
        loan_id: loan.id,
        user_id: loan.user_id,
        payment_date: new Date().toISOString(),
        month_year: new Date().toLocaleString("en-US", { month: "short", year: "numeric" }),
        remaining_balance: newRemainingBalance, // Always set remaining_balance
      }

      if (interestPaid) {
        paymentData.interest_paid = (loanData.amount * loanData.interest_rate) / 100
        console.log("[v0] Interest to be recorded:", paymentData.interest_paid)
      }

      if (principalPaid && principalAmount) {
        const amount = Number(principalAmount)
        if (amount > loanData.amount) {
          throw new Error("Principal amount cannot exceed loan balance")
        }
        paymentData.principal_paid = amount
        console.log("[v0] Principal to be recorded:", amount)
      }

      console.log("[v0] New remaining balance:", paymentData.remaining_balance)
      console.log("[v0] Inserting payment record:", paymentData)

      // Insert the payment record
      const { data: paymentRecord, error: insertError } = await supabase
        .from("loan_payments")
        .insert(paymentData)
        .select()
        .single()

      if (insertError) {
        console.error("[v0] Payment insert error:", insertError.message)
        console.error("[v0] Error details:", JSON.stringify(insertError, null, 2))
        throw new Error(insertError.message || "Failed to record payment")
      }

      console.log("[v0] Payment recorded successfully:", paymentRecord)

      // Update loan balance if principal was paid
      if (principalPaid && principalAmount) {
        const newAmount = loanData.amount - Number(principalAmount)
        const newStatus = newAmount <= 0 ? "completed" : loanData.status

        console.log("[v0] Updating loan balance to:", newAmount)
        console.log("[v0] New status:", newStatus)

        const { error: updateError } = await supabase
          .from("loans")
          .update({
            amount: newAmount,
            status: newStatus,
          })
          .eq("id", loan.id)

        if (updateError) {
          console.error("[v0] Loan update error:", updateError)
          console.warn("[v0] Payment recorded but loan balance update failed")
        } else {
          console.log("[v0] Loan balance updated successfully")
        }
      }

      console.log("[v0] Payment recording complete!")
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      console.error("[v0] Error in handleSubmit:", err)
      setError(err.message || "An error occurred while recording the payment")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onValueChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2">
          <Eye className="h-4 w-4 mr-1" />
          Record
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>Record payment for {loan.profiles?.full_name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1 text-sm text-muted-foreground border-b pb-4">
          <div>Current Balance: {formatCurrency(loan.amount)}</div>
          <div>Interest Rate: {loan.interest_rate}%</div>
          <div>Monthly Interest: {formatCurrency((loan.amount * loan.interest_rate) / 100)}</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Interest Card */}
          <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50">
            <div className="space-y-2">
              <Label className="text-lg font-semibold text-blue-900">Record Interest</Label>
              <p className="text-sm text-muted-foreground">Mark monthly interest payment</p>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-white rounded-md border">
                <div className="text-sm text-muted-foreground">Monthly Interest Amount</div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency((loan.amount * loan.interest_rate) / 100)}
                </div>
              </div>

              <Button
                type="button"
                variant={interestPaid ? "default" : "outline"}
                onClick={() => setInterestPaid(!interestPaid)}
                className="w-full h-12"
                size="lg"
              >
                {interestPaid ? "✓ Interest Marked as Paid" : "Mark Interest as Paid"}
              </Button>

              {interestPaid && (
                <div className="rounded-md bg-green-100 p-3 text-sm text-green-800 border border-green-200">
                  ✓ Interest payment of {formatCurrency((loan.amount * loan.interest_rate) / 100)} will be recorded
                </div>
              )}
            </div>
          </div>

          {/* Principal Card */}
          <div className="space-y-4 p-4 border rounded-lg bg-green-50/50">
            <div className="space-y-2">
              <Label className="text-lg font-semibold text-green-900">Record Principal</Label>
              <p className="text-sm text-muted-foreground">Enter principal amount paid</p>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-white rounded-md border">
                <div className="text-sm text-muted-foreground">Current Principal Balance</div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(loan.amount)}</div>
              </div>

              <Button
                type="button"
                variant={principalPaid ? "default" : "outline"}
                onClick={() => {
                  setPrincipalPaid(!principalPaid)
                  if (!principalPaid) setPrincipalAmount("")
                }}
                className="w-full h-12"
                size="lg"
              >
                {principalPaid ? "✓ Principal Payment Enabled" : "Enable Principal Payment"}
              </Button>

              {principalPaid && (
                <div className="space-y-2">
                  <Label htmlFor="principalAmount" className="text-sm font-medium">
                    Enter Principal Amount Paid
                  </Label>
                  <Input
                    id="principalAmount"
                    type="number"
                    step="100"
                    min="0"
                    max={loan.amount}
                    placeholder="₹0"
                    value={principalAmount}
                    onChange={(e) => setPrincipalAmount(e.target.value)}
                    className="h-12 text-lg"
                  />
                  <div className="text-xs text-muted-foreground bg-white p-2 rounded border">
                    Remaining after payment:{" "}
                    <span className="font-semibold">
                      {formatCurrency(Math.max(0, loan.amount - (Number(principalAmount) || 0)))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-200">{error}</div>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Recording..." : "Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
