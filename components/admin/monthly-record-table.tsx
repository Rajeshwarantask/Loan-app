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
  period_month: number
  period_year: number
  status: string
  monthly_subscription: number
  total_loan_taken: number
  additional_principal: number
  new_loan_taken: number
  total_loan_outstanding: number
  monthly_interest_income: number
  monthly_installment_income: number
  penalty: number
  previous_month_total_income: number
  total_income_current_month: number
  difference: number
  previous_month_total_loan_outstanding: number
  available_loan_amount: number
  profiles: Profile
}

interface MonthlyRecordTableProps {
  records: MonthlyRecord[]
  monthYear: string
}

export function MonthlyRecordTable({ records, monthYear }: MonthlyRecordTableProps) {
  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) {
      return "₹0"
    }
    return `₹${amount.toLocaleString()}`
  }

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
            <TableHead className="w-[60px] whitespace-normal">V ID</TableHead>
            <TableHead className="w-[120px] whitespace-normal">Name</TableHead>
            <TableHead className="text-right w-[90px] whitespace-normal">Monthly Subscription Fee</TableHead>
            <TableHead className="text-right w-[90px] whitespace-normal">Total Loan Taken</TableHead>
            <TableHead className="text-right w-[90px] whitespace-normal">Additional Principal</TableHead>
            <TableHead className="text-right w-[90px] whitespace-normal">New Loans Issued Last Month</TableHead>
            <TableHead className="text-right w-[90px] whitespace-normal">Total Loan Outstanding</TableHead>
            <TableHead className="text-right w-[90px] whitespace-normal">Monthly Interest Income</TableHead>
            <TableHead className="text-right w-[90px] whitespace-normal">Monthly Installment Income</TableHead>
            <TableHead className="text-right w-[80px] whitespace-normal">Penalty Income</TableHead>
            <TableHead className="text-right w-[90px] whitespace-normal">Previous Month Interest Income</TableHead>
            <TableHead className="text-right w-[90px] whitespace-normal">Total Income (Current Month)</TableHead>
            <TableHead className="text-right w-[90px] whitespace-normal">Previous Month Total Income</TableHead>
            <TableHead className="text-right w-[80px] whitespace-normal">Difference</TableHead>
            <TableHead className="text-right w-[90px] whitespace-normal">
              Previous Month Total Loan Outstanding
            </TableHead>
            <TableHead className="text-right w-[90px] whitespace-normal">Available Loan</TableHead>
            <TableHead className="text-center w-[80px] whitespace-normal">Status</TableHead>
            <TableHead className="text-right w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRecords.length === 0 ? (
            <TableRow>
              <TableCell colSpan={18} className="text-center py-8 text-muted-foreground">
                No records found for this month
              </TableCell>
            </TableRow>
          ) : (
            sortedRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium px-2 md:px-4">{record.profiles.member_id || "N/A"}</TableCell>
                <TableCell className="px-2 md:px-4">{record.profiles.full_name}</TableCell>
                <TableCell className="text-right px-2 md:px-4">{formatCurrency(record.monthly_subscription)}</TableCell>
                <TableCell className="text-right px-2 md:px-4">{formatCurrency(record.total_loan_taken)}</TableCell>
                <TableCell className="text-right px-2 md:px-4">{formatCurrency(record.additional_principal)}</TableCell>
                <TableCell className="text-right px-2 md:px-4">{formatCurrency(record.new_loan_taken)}</TableCell>
                <TableCell className="text-right font-medium px-2 md:px-4">
                  {formatCurrency(record.total_loan_outstanding)}
                </TableCell>
                <TableCell className="text-right px-2 md:px-4">
                  {formatCurrency(record.monthly_interest_income)}
                </TableCell>
                <TableCell className="text-right px-2 md:px-4">
                  {formatCurrency(record.monthly_installment_income)}
                </TableCell>
                <TableCell className="text-right px-2 md:px-4">{formatCurrency(record.penalty)}</TableCell>
                <TableCell className="text-right px-2 md:px-4">
                  {formatCurrency(record.previous_month_total_income)}
                </TableCell>
                <TableCell className="text-right font-medium px-2 md:px-4">
                  {formatCurrency(record.total_income_current_month)}
                </TableCell>
                <TableCell className="text-right px-2 md:px-4">
                  {formatCurrency(record.previous_month_total_income)}
                </TableCell>
                <TableCell className="text-right px-2 md:px-4">{formatCurrency(record.difference)}</TableCell>
                <TableCell className="text-right px-2 md:px-4">
                  {formatCurrency(record.previous_month_total_loan_outstanding)}
                </TableCell>
                <TableCell className="text-right text-green-600 font-medium px-2 md:px-4">
                  {formatCurrency(record.available_loan_amount)}
                </TableCell>
                <TableCell className="text-center px-2 md:px-4">
                  <Badge variant={record.status === "finalized" ? "default" : "secondary"}>
                    {record.status === "finalized" ? "Finalized" : "Draft"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right px-2 md:px-4">
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
