"use client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { EditMonthlyRecordDialog } from "./edit-monthly-record-dialog"

interface Profile {
  id: string
  full_name: string
  email: string
  member_id: string | null
}

interface MonthlyRecord {
  id: string
  user_id: string
  month_year: string
  opening_outstanding: number
  monthly_subscription: number
  interest_calculated: number
  interest_paid: number
  principal_paid: number
  new_loan_taken: number
  penalty: number
  closing_outstanding: number
  total_monthly_income: number
  income_difference: number
  status: string
  profiles: Profile
}

interface MonthlyRecordTableProps {
  records: MonthlyRecord[]
  monthYear: string
}

export function MonthlyRecordTable({ records, monthYear }: MonthlyRecordTableProps) {
  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString()}`
  }

  // Sort by member_id
  const sortedRecords = [...records].sort((a, b) => {
    const aId = a.profiles.member_id || ""
    const bId = b.profiles.member_id || ""
    return aId.localeCompare(bId)
  })

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Member ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Opening</TableHead>
            <TableHead className="text-right">New Loan</TableHead>
            <TableHead className="text-right">Principal Paid</TableHead>
            <TableHead className="text-right">Interest Paid</TableHead>
            <TableHead className="text-right">Subscription</TableHead>
            <TableHead className="text-right">Total Income</TableHead>
            <TableHead className="text-right">Closing</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRecords.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                No records found for this month
              </TableCell>
            </TableRow>
          ) : (
            sortedRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium">{record.profiles.member_id || "N/A"}</TableCell>
                <TableCell>{record.profiles.full_name}</TableCell>
                <TableCell className="text-right">{formatCurrency(record.opening_outstanding)}</TableCell>
                <TableCell className="text-right">{formatCurrency(record.new_loan_taken)}</TableCell>
                <TableCell className="text-right">{formatCurrency(record.principal_paid)}</TableCell>
                <TableCell className="text-right">{formatCurrency(record.interest_paid)}</TableCell>
                <TableCell className="text-right">{formatCurrency(record.monthly_subscription)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(record.total_monthly_income)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(record.closing_outstanding)}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={record.status === "finalized" ? "default" : "secondary"}>
                    {record.status === "finalized" ? "Finalized" : "Draft"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <EditMonthlyRecordDialog record={record} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
