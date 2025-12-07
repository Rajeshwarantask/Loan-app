"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils/loan-calculator"
import { format } from "date-fns"
import { useState } from "react"
import { Eye } from "lucide-react"

interface Loan {
  id: string
  amount: number
  interest_rate: number
  status: string
  requested_at: string
  profiles: {
    full_name: string
    email: string
  }
}

interface CompletedLoansTableProps {
  loans: Loan[]
}

export function CompletedLoansTable({ loans }: CompletedLoansTableProps) {
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
  const [loanDetailsOpen, setLoanDetailsOpen] = useState(false)

  return (
    <div className="overflow-x-auto">
      {loans.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <p>No completed loans found</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Borrower</TableHead>
              <TableHead>Loan Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Completion Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.map((loan) => (
              <TableRow key={loan.id} className="hover:bg-muted/50">
                <TableCell>
                  <div className="font-medium">{loan.profiles.full_name}</div>
                  <div className="text-sm text-muted-foreground">{loan.profiles.email}</div>
                </TableCell>
                <TableCell className="font-semibold">{formatCurrency(Number(loan.amount))}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Completed
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{format(new Date(loan.requested_at), "MMM dd, yyyy")}</TableCell>
                <TableCell className="text-right">
                  <Dialog
                    open={loanDetailsOpen && selectedLoan?.id === loan.id}
                    onOpenChange={(open) => {
                      setLoanDetailsOpen(open)
                      if (!open) setSelectedLoan(null)
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setSelectedLoan(loan)} className="h-8">
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Completed Loan Details</DialogTitle>
                      </DialogHeader>
                      {selectedLoan && (
                        <div className="space-y-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm font-medium text-muted-foreground">Borrower</div>
                              <div className="text-base font-semibold">{selectedLoan.profiles.full_name}</div>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-muted-foreground">Email</div>
                              <div className="text-sm">{selectedLoan.profiles.email}</div>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-muted-foreground">Original Amount</div>
                              <div className="text-lg font-bold">{formatCurrency(Number(selectedLoan.amount))}</div>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-muted-foreground">Interest Rate</div>
                              <div className="text-lg font-bold">{selectedLoan.interest_rate}%</div>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-muted-foreground">Status</div>
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Completed
                              </Badge>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-muted-foreground">Created Date</div>
                              <div className="text-sm">
                                {format(new Date(selectedLoan.requested_at), "MMM dd, yyyy")}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
