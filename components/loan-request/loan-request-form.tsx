"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { createBrowserClient } from "@/lib/supabase/client"

interface LoanRequestFormProps {
  userId: string
  onSuccess?: () => void
}

export function LoanRequestForm({ userId, onSuccess }: LoanRequestFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    const formData = new FormData(e.currentTarget)
    const amount = formData.get("amount") as string
    const purpose = formData.get("purpose") as string

    try {
      const supabase = createBrowserClient()

      const { error: requestError } = await supabase.from("loan_requests").insert({
        user_id: userId,
        amount: Number.parseFloat(amount),
        purpose,
        status: "pending",
      })

      if (requestError) throw requestError

      setSuccess(true)
      e.currentTarget.reset()

      if (onSuccess) {
        setTimeout(() => {
          onSuccess()
        }, 1500)
      }
    } catch (error: unknown) {
      console.error("[v0] Loan request error:", error)
      setError(error instanceof Error ? error.message : "An error occurred while submitting your request")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Loan Request</CardTitle>
        <CardDescription>
          Fill in the details for your loan request. An admin will review and respond soon.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Loan Amount (₹)</Label>
            <Input id="amount" name="amount" type="number" placeholder="2000" required min="100" step="100" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose / Reason</Label>
            <Textarea id="purpose" name="purpose" placeholder="Describe why you need this loan..." required rows={4} />
          </div>
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}
          {success && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-600">
              Your loan request has been submitted successfully! Refresh the page to see it in your pending requests.
            </div>
          )}
          <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
            {isLoading ? "Submitting..." : "Submit Request"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
