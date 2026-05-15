"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { SubscriptionOnlyPaymentDialog } from "./subscription-only-payment-dialog"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"

interface User {
  id: string
  full_name: string
  email: string
  member_id: string | null
}

interface UsersWithoutLoansTableProps {
  users: User[]
}

interface SubscriptionStatus {
  [userId: string]: {
    marked: boolean
    monthYear: string
  }
}

export function UsersWithoutLoansTable({ users }: UsersWithoutLoansTableProps) {
  const [subscriptionStatusMap, setSubscriptionStatusMap] = useState<SubscriptionStatus>({})
  const [refreshKey, setRefreshKey] = useState(0)
  const router = useRouter()

  const handlePaymentRecorded = () => {
    console.log("[v0] Subscription payment recorded, refreshing...")
    setRefreshKey((prev) => prev + 1)
  }

  const handleDeletePayment = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete the subscription payment for ${userName}?`)) {
      return
    }

    try {
      const supabase = createClient()
      const now = new Date()
      const currentMonth = now.getMonth() + 1
      const currentYear = now.getFullYear()
      const periodKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`

      // Delete the subscription payment record for the current period
      const { error } = await supabase.from("loan_payments").delete().eq("user_id", userId).eq("period_key", periodKey)

      if (error) throw error

      toast({
        title: "Payment Deleted",
        description: `Subscription payment for ${userName} has been deleted.`,
      })

      router.refresh()
      setRefreshKey((prev) => prev + 1)
    } catch (error) {
      console.error("[v0] Error deleting subscription payment:", error)
      toast({
        title: "Error",
        description: "Failed to delete subscription payment. Please try again.",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      const supabase = createClient()
      const now = new Date()
      const currentMonth = now.getMonth() + 1
      const currentYear = now.getFullYear()
      const periodKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`

      const statusMap: SubscriptionStatus = {}

      for (const user of users) {
        const { data: payments } = await supabase
          .from("loan_payments")
          .select("payment_date")
          .eq("user_id", user.id)
          .eq("period_key", periodKey)
          .limit(1)

        if (payments && payments.length > 0) {
          const paymentDate = new Date(payments[0].payment_date)
          const monthYear = paymentDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })
          statusMap[user.id] = { marked: true, monthYear }
        } else {
          statusMap[user.id] = { marked: false, monthYear: "" }
        }
      }

      setSubscriptionStatusMap(statusMap)
    }

    if (users.length > 0) {
      fetchSubscriptionStatus()
    }
  }, [users, refreshKey])

  if (users.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Subscription-Only Members</h2>
          <p className="text-sm text-muted-foreground">
            Members without active loans who can still contribute monthly subscriptions
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {users.length} {users.length === 1 ? "member" : "members"}
        </Badge>
      </div>

      <div className="overflow-x-auto -mx-2 md:mx-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-2 md:px-4">ID</TableHead>
              <TableHead className="px-2 md:px-4">Name</TableHead>
              <TableHead className="px-2 md:px-4">Status</TableHead>
              <TableHead className="px-2 md:px-4 text-center">Delete</TableHead>
              <TableHead className="text-right px-2 md:px-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const subscriptionStatus = subscriptionStatusMap[user.id]

              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium px-2 md:px-4">{user.member_id || "N/A"}</TableCell>
                  <TableCell className="px-2 md:px-4">
                    <div className="font-medium">{user.full_name}</div>
                  </TableCell>
                  <TableCell className="px-2 md:px-4">
                    {subscriptionStatus?.marked ? (
                      <Badge variant="default" className="bg-green-600 px-2">
                        Paid — {subscriptionStatus.monthYear}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="px-2">
                        Not paid
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-2 md:px-4 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePayment(user.id, user.full_name)}
                      disabled={!subscriptionStatus?.marked}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={subscriptionStatus?.marked ? "Delete this payment" : "No payment recorded yet"}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete payment</span>
                    </Button>
                  </TableCell>
                  <TableCell className="text-right px-2 md:px-4">
                    <SubscriptionOnlyPaymentDialog
                      user={user}
                      isMarked={subscriptionStatus?.marked ?? false}
                      onPaymentRecorded={handlePaymentRecorded}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
