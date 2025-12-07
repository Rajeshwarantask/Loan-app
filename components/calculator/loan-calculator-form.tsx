"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { calculateLoan, formatCurrency } from "@/lib/utils/loan-calculator"
import type { LoanSummary } from "@/lib/utils/loan-calculator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function LoanCalculatorForm() {
  const [amount, setAmount] = useState("2000")
  const [interestRate, setInterestRate] = useState("15")
  const [duration, setDuration] = useState("2")
  const [result, setResult] = useState<LoanSummary | null>(null)

  const handleCalculate = () => {
    const loanAmount = Number.parseFloat(amount)
    const rate = Number.parseFloat(interestRate)
    const months = Number.parseInt(duration)

    if (loanAmount > 0 && rate >= 0 && months > 0) {
      const calculation = calculateLoan(loanAmount, rate, months)
      setResult(calculation)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Calculate Your Loan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Loan Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="2000"
                min="0"
                step="100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (Months)</Label>
              <Input
                id="duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="2"
                min="1"
                max="60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interest">Interest Rate (%)</Label>
              <Input
                id="interest"
                type="number"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="15"
                min="0"
                max="100"
                step="0.1"
              />
            </div>
          </div>
          <Button onClick={handleCalculate} className="w-full md:w-auto">
            Calculate
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Loan Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Loan Amount</p>
                  <p className="text-2xl font-semibold">{formatCurrency(result.loanAmount)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Interest</p>
                  <p className="text-2xl font-semibold text-orange-600">{formatCurrency(result.totalInterest)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-semibold text-blue-600">{formatCurrency(result.totalAmount)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Monthly Payment</p>
                  <p className="text-2xl font-semibold text-green-600">{formatCurrency(result.monthlyPayment)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Month-wise Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Principal</TableHead>
                      <TableHead className="text-right">Interest</TableHead>
                      <TableHead className="text-right">Total Payment</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.breakdown.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell className="font-medium">{row.monthLabel}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.principalPaid)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.interestPaid)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(row.totalPayment)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.remainingBalance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
