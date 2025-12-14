"use client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils/loan-calculator"

interface AdditionalLoan {
  id: string
  user_id: string
  member_id: string
  loan_id: string
  additional_loan_amount: number
  period_year: number
  period_month: number
  period_key: string
  created_at: string
  member_name?: string
}

interface AdditionalLoanHistoryProps {
  additionalLoans: AdditionalLoan[]
}

export function AdditionalLoanHistory({ additionalLoans }: AdditionalLoanHistoryProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getMonthName = (month: number) => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ]
    return months[month - 1]
  }

  if (additionalLoans.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No additional loans found</div>
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Member Name</TableHead>
            <TableHead>Member ID</TableHead>
            <TableHead>Top-Up Amount</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Recorded Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {additionalLoans.map((loan) => (
            <TableRow key={loan.id} className="hover:bg-muted/30">
              <TableCell className="font-medium">{loan.member_name || "Unknown"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{loan.member_id}</TableCell>
              <TableCell>
                <Badge variant="outline" className="font-semibold">
                  {formatCurrency(loan.additional_loan_amount)}
                </Badge>
              </TableCell>
              <TableCell>
                {getMonthName(loan.period_month)} {loan.period_year}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDate(loan.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
