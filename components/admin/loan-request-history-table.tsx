"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils/loan-calculator"
import { format } from "date-fns"

interface LoanRequest {
  id: string
  user_id: string
  amount: number
  purpose: string
  status: string
  created_at: string
  admin_remark?: string
  approved_amount?: number
  profiles: {
    full_name: string
    email: string
  }
}

interface LoanRequestHistoryTableProps {
  requests: LoanRequest[]
}

export function LoanRequestHistoryTable({ requests }: LoanRequestHistoryTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Purpose</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Admin Remark</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell>
                <div className="font-medium">{request.profiles.full_name}</div>
              </TableCell>
              <TableCell className="font-semibold">
                {request.approved_amount && request.approved_amount !== request.amount ? (
                  <div>
                    <div className="font-semibold">{formatCurrency(request.approved_amount)}</div>
                    <div className="text-green-400">Requested: {formatCurrency(request.amount)}</div>
                  </div>
                ) : (
                  formatCurrency(request.amount)
                )}
              </TableCell>
              <TableCell className="max-w-xs truncate">{request.purpose}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    request.status === "approved"
                      ? "default"
                      : request.status === "rejected"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {request.status}
                </Badge>
              </TableCell>
              <TableCell>{format(new Date(request.created_at), "MMM dd, yyyy")}</TableCell>
              <TableCell>
                <div className="max-w-xs">
                  {request.admin_remark ? (
                    <span className="text-sm">{request.admin_remark}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">No remark</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
