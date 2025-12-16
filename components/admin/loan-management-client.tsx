"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search } from "lucide-react"
import { AdminLoansTable } from "./admin-loans-table"
import { LoanHistoryTable } from "./loan-history-table"
import { AddLoanDialog } from "./add-loan-dialog"
import { UserLoanSummaryTable } from "./user-loan-summary-table"
import { AdditionalLoanHistory } from "./additional-loan-history"

interface Profile {
  id: string
  full_name: string
  email: string
  member_id: string | null
  phone: string | null
}

interface Loan {
  id: string
  user_id: string
  loan_amount: number
  interest_rate: number
  status: string
  created_at: string
  remaining_balance?: number
  profiles: Profile
}

interface LoanPayment {
  id: string
  loan_id: string
  user_id: string
  month_year: string
  principal_paid: number
  interest_paid: number
  remaining_balance: number
  status: string
  payment_date: string | null
}

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

interface LoanManagementClientProps {
  loans: Loan[]
  payments: LoanPayment[]
  users: Profile[]
  additionalLoans: AdditionalLoan[]
}

export function LoanManagementClient({ loans, payments, users, additionalLoans }: LoanManagementClientProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedUser, setSelectedUser] = useState<string>("all")
  const [activeTab, setActiveTab] = useState("active-loans")
  const [loanStatusTab, setLoanStatusTab] = useState("active")

  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      const matchesSearch =
        loan.profiles.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loan.profiles.member_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        loan.profiles.email.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = statusFilter === "all" || loan.status === statusFilter
      const matchesUser = selectedUser === "all" || loan.user_id === selectedUser

      return matchesSearch && matchesStatus && matchesUser
    })
  }, [loans, searchTerm, statusFilter, selectedUser])

  const activeLoans = useMemo(() => {
    const active = filteredLoans.filter((loan) => loan.status === "active")
    return active.sort((a, b) => {
      const memberA = a.profiles?.member_id || ""
      const memberB = b.profiles?.member_id || ""

      // Extract numeric part from member_id (e.g., "V1" -> 1, "V10" -> 10)
      const numA = Number.parseInt(memberA.replace(/\D/g, ""), 10) || 0
      const numB = Number.parseInt(memberB.replace(/\D/g, ""), 10) || 0

      return numA - numB
    })
  }, [filteredLoans])

  const allUserLoans = useMemo(() => {
    if (searchTerm === "" && selectedUser === "all") return loans
    return filteredLoans
  }, [filteredLoans, loans, searchTerm, selectedUser])

  const filteredPayments = useMemo(() => {
    if (selectedUser === "all") return payments
    return payments.filter((p) => p.user_id === selectedUser)
  }, [payments, selectedUser])

  const filteredAdditionalLoans = useMemo(() => {
    if (selectedUser === "all") return additionalLoans
    return additionalLoans.filter((al) => al.user_id === selectedUser)
  }, [additionalLoans, selectedUser])

  return (
    <div className="container max-w-7xl py-2 md:py-6 px-2 md:px-6 space-y-2 md:space-y-6">
      {/* Header */}
      <div className="space-y-2 md:space-y-4">
        <div className="pl-12 md:pl-0">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Loan Management</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Comprehensive loan tracking and payment management
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-2 md:space-y-4">
        <TabsList className="w-full grid grid-cols-4 mx-auto md:w-fit">
          <TabsTrigger value="active-loans">Active Loans</TabsTrigger>
          <TabsTrigger value="completed-loans">User Summary</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="additional">Top-Ups</TabsTrigger>
        </TabsList>

        <TabsContent value="active-loans" className="space-y-2 md:space-y-4">
          <Card>
            <CardHeader className="pb-3 md:pb-6 px-3 md:px-6 pt-3 md:pt-6">
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              <div className="grid gap-2 md:gap-4 md:grid-cols-3">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, member ID, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>

                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.member_id ? `${user.member_id} - ` : ""}
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <AddLoanDialog users={users} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-3 md:px-6 py-3 md:py-6">
              <CardTitle>Active Loans</CardTitle>
              <CardDescription>
                Showing {activeLoans.length} active loan{activeLoans.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 md:px-6">
              <AdminLoansTable loans={activeLoans} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed-loans" className="space-y-2 md:space-y-4">
          <Card>
            <CardHeader className="pb-3 md:pb-6 px-3 md:px-6 pt-3 md:pt-6">
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              <div className="grid gap-2 md:gap-4 md:grid-cols-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, member ID, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>

                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.member_id ? `${user.member_id} - ` : ""}
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-3 md:px-6 py-3 md:py-6">
              <CardTitle>User Loan Summary</CardTitle>
              <CardDescription>
                Consolidated view of all users with total loan amounts and interest paid
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 md:px-6">
              <UserLoanSummaryTable loans={allUserLoans} payments={payments} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment History Tab */}
        <TabsContent value="history" className="space-y-2 md:space-y-4">
          <Card>
            <CardHeader className="px-3 md:px-6 py-3 md:py-6">
              <CardTitle>Filter by Member</CardTitle>
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.member_id ? `${user.member_id} - ` : ""}
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-3 md:px-6 py-3 md:py-6">
              <CardTitle>Payment History</CardTitle>
              <CardDescription>
                {selectedUser === "all"
                  ? `All payment records (${filteredPayments.length} total)`
                  : `Payment history for ${users.find((u) => u.id === selectedUser)?.full_name || "selected member"}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 md:px-6">
              <LoanHistoryTable payments={filteredPayments} loans={loans} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Additional Loans / Top-Ups Tab */}
        <TabsContent value="additional" className="space-y-2 md:space-y-4">
          <Card>
            <CardHeader className="px-3 md:px-6 py-3 md:py-6">
              <CardTitle>Filter by Member</CardTitle>
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.member_id ? `${user.member_id} - ` : ""}
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-3 md:px-6 py-3 md:py-6">
              <CardTitle>Top-Up Loan History</CardTitle>
              <CardDescription>
                {selectedUser === "all"
                  ? `All top-up records (${filteredAdditionalLoans.length} total)`
                  : `Top-up history for ${users.find((u) => u.id === selectedUser)?.full_name || "selected member"}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 md:px-6">
              <AdditionalLoanHistory additionalLoans={filteredAdditionalLoans} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
