"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface MonthlyReportDialogProps {
  monthYear: string
  records: Array<{
    id: string
    opening_outstanding: number
    monthly_subscription: number
    interest_paid: number
    principal_paid: number
    new_loan_taken: number
    penalty: number
    closing_outstanding: number
    total_monthly_income: number
    income_difference: number
    profiles: {
      full_name: string
      member_id: string | null
    }
  }>
}

export function MonthlyReportDialog({ monthYear, records }: MonthlyReportDialogProps) {
  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString()}`
  }

  const groupTotals = {
    totalSubscription: records.reduce((sum, r) => sum + r.monthly_subscription, 0),
    totalInterest: records.reduce((sum, r) => sum + r.interest_paid, 0),
    totalPrincipal: records.reduce((sum, r) => sum + r.principal_paid, 0),
    totalNewLoans: records.reduce((sum, r) => sum + r.new_loan_taken, 0),
    totalPenalty: records.reduce((sum, r) => sum + r.penalty, 0),
    totalIncome: records.reduce((sum, r) => sum + r.total_monthly_income, 0),
    totalOutstanding: records.reduce((sum, r) => sum + r.closing_outstanding, 0),
  }

  // Sort by member_id
  const sortedRecords = [...records].sort((a, b) => {
    const aId = a.profiles.member_id || ""
    const bId = b.profiles.member_id || ""
    return aId.localeCompare(bId)
  })

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="h-4 w-4 mr-2" />
          View Report
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Monthly Report - {monthYear}</DialogTitle>
          <DialogDescription>Complete financial summary for all members</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Group Summary */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Group Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(groupTotals.totalIncome)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Subscription</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(groupTotals.totalSubscription)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Interest Collected</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(groupTotals.totalInterest)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Principal Repaid</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(groupTotals.totalPrincipal)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">New Loans Issued</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(groupTotals.totalNewLoans)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Penalties</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(groupTotals.totalPenalty)}</div>
                </CardContent>
              </Card>

              <Card className="col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(groupTotals.totalOutstanding)}</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Member-wise Details */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Member-wise Report</h3>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">New Loan</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                    <TableHead className="text-right">Subscription</TableHead>
                    <TableHead className="text-right">Penalty</TableHead>
                    <TableHead className="text-right">Total Income</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{record.profiles.member_id || "N/A"}</div>
                          <div className="text-sm text-muted-foreground">{record.profiles.full_name}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(record.opening_outstanding)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.new_loan_taken)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.principal_paid)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.interest_paid)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.monthly_subscription)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.penalty)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(record.total_monthly_income)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(record.closing_outstanding)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
