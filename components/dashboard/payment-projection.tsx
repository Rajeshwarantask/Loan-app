"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils/loan-calculator"
import { cn } from "@/lib/utils"

interface Loan {
  id: string
  user_id: string
  loan_amount: string
  interest_rate: string
  status: string
  created_at: string
  updated_at: string
}

interface Payment {
  id: string
  user_id: string
  principal_paid: string
  interest_paid: string
  remaining_balance: string
  monthly_subscription_amount: string
  period_key: string
}

interface PaymentProjectionProps {
  loans: Loan[]
  payments: Payment[]
}

export function PaymentProjection({ loans, payments }: PaymentProjectionProps) {
  const [activeTab, setActiveTab] = useState<"this-month" | "next-month">("this-month")

  console.log("PaymentProjection - loans:", loans)
  console.log("PaymentProjection - payments:", payments)

  if (!loans || loans.length === 0) {
    console.log("  No loans available")
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Projection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No active loans to display payment projections
          </div>
        </CardContent>
      </Card>
    )
  }

  // Get the most recent active loan
  const activeLoan = loans.find((loan) => loan.status === "active") || loans[0]
  if (!activeLoan) {
    console.log("  No active loan found")
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Projection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No active loans to display payment projections
          </div>
        </CardContent>
      </Card>
    )
  }

  console.log("  Active loan:", activeLoan)

  // Get the most recent payment to determine interest calculation basis
  const mostRecentPayment = payments && payments.length > 0 ? payments[0] : null
  
  // The remaining_balance from mostRecentPayment is the balance AFTER that payment was made
  // This is the starting balance for calculating THIS month's dues
  const thisMonthStartBalance = mostRecentPayment?.remaining_balance 
    ? Number(mostRecentPayment.remaining_balance) 
    : Number(activeLoan.loan_amount)
  
  const loanAmount = Number(activeLoan.loan_amount)

  console.log("  This Month Start Balance:", thisMonthStartBalance)
  console.log("  Loan amount:", loanAmount)
  console.log("  Most recent payment:", mostRecentPayment)

  // Business Rules:
  // 1. Interest: Balance × Interest Rate (not divided by 12)
  const interestRate = Number(activeLoan.interest_rate) / 100

  // 2. Principal (EMI): Fixed ₹5,000, but optional if CURRENT BALANCE <= ₹1 lakh (100,000)
  const fixedPrincipal = 5000

  // 3. Subscription: Fixed ₹2,100 (mandatory for all)
  const fixedSubscription = 2100

  // For "This Month", calculate based on the CURRENT remaining balance
  // Check if THIS month's balance is <= 1 lakh to determine if EMI is optional
  const thisMonthIsSmallLoan = thisMonthStartBalance <= 100000
  const thisMonthPrincipal = thisMonthIsSmallLoan ? 0 : fixedPrincipal
  const thisMonthInterest = thisMonthStartBalance * interestRate
  const thisMonthSubscription = fixedSubscription
  const thisMonthTotal = thisMonthPrincipal + thisMonthInterest + thisMonthSubscription

  // For "Next Month", we need to assume the principal WILL be paid (even if optional)
  // to calculate what NEXT month's dues would be
  // If this month's balance <= 1 lakh and principal is optional, we still assume 5000 principal for next month calculation
  const assumedPrincipalPayment = thisMonthIsSmallLoan ? fixedPrincipal : thisMonthPrincipal
  const nextMonthStartBalance = thisMonthStartBalance - assumedPrincipalPayment
  
  // Check if NEXT month's balance is <= 1 lakh to determine if EMI is optional
  const nextMonthIsSmallLoan = nextMonthStartBalance <= 100000
  const nextMonthPrincipal = nextMonthIsSmallLoan ? 0 : fixedPrincipal
  const nextMonthInterest = nextMonthStartBalance * interestRate
  const nextMonthSubscription = fixedSubscription
  const nextMonthTotal = nextMonthPrincipal + nextMonthInterest + nextMonthSubscription

  const renderMonthCard = (
    principal: number,
    interest: number,
    subscription: number,
    total: number,
    balance: number,
    isThisMonth: boolean
  ) => (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Interest Card */}
        <Card className="bg-slate-50 dark:bg-slate-900/50">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Interest</p>
              <div className="space-y-1">
                <p className="text-2xl font-semibold">{formatCurrency(interest)}</p>
                <p className="text-xs text-muted-foreground">
                  Calculation: Balance × Interest Rate
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(balance)} × {Number(activeLoan.interest_rate)}% = {formatCurrency(interest)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Principal/EMI Card */}
        <Card className="bg-slate-50 dark:bg-slate-900/50">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Principal (EMI)</p>
              <div className="space-y-1">
                <p className="text-2xl font-semibold">{formatCurrency(principal)}</p>
                {principal === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Optional (Loan ≤ ₹1 Lakh)
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Fixed ₹5,000 monthly principal
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Card */}
        <Card className="bg-slate-50 dark:bg-slate-900/50">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Subscription</p>
              <div className="space-y-1">
                <p className="text-2xl font-semibold">{formatCurrency(subscription)}</p>
                <p className="text-xs text-muted-foreground">
                  Fixed ₹2,100 monthly subscription (mandatory)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Card */}
        <Card className="border-2 border-primary bg-primary/5 dark:bg-primary/10">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Total Due</p>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-primary">{formatCurrency(total)}</p>
                <p className="text-xs text-muted-foreground">
                  EMI + Interest + Subscription
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(principal)} + {formatCurrency(interest)} + {formatCurrency(subscription)} = {formatCurrency(total)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Projection</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Pill-style Tab Navigation */}
        <div className="flex gap-2 mb-6 bg-slate-100 dark:bg-slate-900 p-1 rounded-full w-fit">
          <button
            onClick={() => setActiveTab("this-month")}
            className={cn(
              "px-6 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
              activeTab === "this-month"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            This Month
          </button>
          <button
            onClick={() => setActiveTab("next-month")}
            className={cn(
              "px-6 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
              activeTab === "next-month"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            Next Month
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "this-month" &&
            renderMonthCard(thisMonthPrincipal, thisMonthInterest, thisMonthSubscription, thisMonthTotal, thisMonthStartBalance, true)}
          {activeTab === "next-month" &&
            renderMonthCard(nextMonthPrincipal, nextMonthInterest, nextMonthSubscription, nextMonthTotal, nextMonthStartBalance, false)}
        </div>
      </CardContent>
    </Card>
  )
}
