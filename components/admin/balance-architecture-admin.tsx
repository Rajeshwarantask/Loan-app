"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle, Loader2, AlertTriangle } from "lucide-react"
import { balanceRecoveryService } from "@/lib/utils/balance-recovery"
import { dataIntegrityService } from "@/lib/utils/data-integrity"
import { memberStatusService } from "@/lib/utils/member-status"

export function BalanceArchitectureAdmin() {
  const [activeTab, setActiveTab] = useState<"revert" | "validate" | "repair" | "sync">("validate")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Revert Tab State
  const [userId, setUserId] = useState("")
  const [periodKey, setPeriodKey] = useState("")

  // Validate Tab State
  const [validateUserId, setValidateUserId] = useState("")

  // Status Sync State
  const [syncUserId, setSyncUserId] = useState("")

  const handleRevertPeriod = async () => {
    if (!userId || !periodKey) {
      setError("Please enter both User ID and Period Key (YYYY-MM)")
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const revertResult = await balanceRecoveryService.revertPeriod(userId, periodKey)
      setResult({
        success: revertResult.success,
        message: revertResult.message,
        details: revertResult
      })
    } catch (err: any) {
      setError(err.message || "Failed to revert period")
    } finally {
      setIsLoading(false)
    }
  }

  const handleValidateBalances = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const validationResult = await dataIntegrityService.validateAllBalances(
        validateUserId || undefined
      )
      const issues = validationResult.filter((v: any) => !v.is_valid)

      setResult({
        success: issues.length === 0,
        totalPeriods: validationResult.length,
        issues,
        message: issues.length === 0 ? "All balances are consistent!" : `Found ${issues.length} inconsistencies`
      })
    } catch (err: any) {
      setError(err.message || "Failed to validate balances")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFixOriginalAmounts = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const fixResult = await dataIntegrityService.fixMissingOriginalAmounts()
      setResult({
        success: true,
        message: fixResult.message,
        details: fixResult
      })
    } catch (err: any) {
      setError(err.message || "Failed to fix missing amounts")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckDuplicates = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const duplicates = await dataIntegrityService.findDuplicatePayments()
      setResult({
        success: duplicates.length === 0,
        duplicateCount: duplicates.length,
        duplicates,
        message: duplicates.length === 0 ? "No duplicate payments found!" : `Found ${duplicates.length} duplicate sets`
      })
    } catch (err: any) {
      setError(err.message || "Failed to check duplicates")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckStatusConsistency = async () => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const consistency = await dataIntegrityService.verifyMemberStatusConsistency()
      setResult({
        success: consistency.isConsistent,
        totalChecked: consistency.totalUsersChecked,
        inconsistencies: consistency.inconsistencies,
        message: consistency.isConsistent
          ? "All member statuses are consistent!"
          : `Found ${consistency.inconsistencies.length} inconsistencies`
      })
    } catch (err: any) {
      setError(err.message || "Failed to check member status consistency")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSyncMemberStatus = async () => {
    if (!syncUserId) {
      setError("Please enter User ID")
      return
    }

    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const syncResult = await memberStatusService.ensureStatusConsistency(syncUserId)
      setResult({
        success: true,
        message: syncResult.action === "no_change_needed" ? "Status is already consistent" : "Member status synchronized",
        details: syncResult
      })
    } catch (err: any) {
      setError(err.message || "Failed to sync member status")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Balance Architecture Admin</h1>
        <p className="text-muted-foreground mt-2">Manage loan balances, revert periods, and validate data integrity</p>
      </div>

      <div className="flex gap-2 border-b">
        {(["validate", "revert", "repair", "sync"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === tab
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive text-destructive flex gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </Card>
      )}

      {result && (
        <Card
          className={`p-4 border ${
            result.success ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"
          }`}
        >
          <div className="flex gap-2">
            {result.success ? (
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`font-semibold ${result.success ? "text-green-900" : "text-yellow-900"}`}>
                {result.message}
              </p>
              {result.details && (
                <pre className="text-xs mt-2 overflow-auto p-2 bg-white rounded border">
                  {JSON.stringify(result.details, null, 2)}
                </pre>
              )}
              {result.issues && result.issues.length > 0 && (
                <div className="mt-3 space-y-2">
                  {result.issues.slice(0, 5).map((issue: any, idx: number) => (
                    <div key={idx} className="text-xs p-2 bg-white rounded border">
                      <p>
                        <strong>{issue.period_key}:</strong> Recorded: {issue.recorded_closing}, Calculated:{" "}
                        {issue.calculated_closing}, Variance: {issue.variance}
                      </p>
                    </div>
                  ))}
                  {result.issues.length > 5 && <p className="text-xs">... and {result.issues.length - 5} more</p>}
                </div>
              )}
              {result.duplicates && result.duplicates.length > 0 && (
                <div className="mt-3 space-y-2">
                  {result.duplicates.slice(0, 3).map((dup: any, idx: number) => (
                    <div key={idx} className="text-xs p-2 bg-white rounded border">
                      <p>
                        <strong>{dup.key}</strong>: {dup.count} records
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {result.inconsistencies && result.inconsistencies.length > 0 && (
                <div className="mt-3 space-y-2">
                  {result.inconsistencies.slice(0, 3).map((inc: any, idx: number) => (
                    <div key={idx} className="text-xs p-2 bg-white rounded border">
                      <p>
                        <strong>{inc.memberId}:</strong> {inc.issue}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Validate Tab */}
      {activeTab === "validate" && (
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">Validate Balance Consistency</h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="validate-user-id">User ID (optional, validates all if empty)</Label>
                <Input
                  id="validate-user-id"
                  placeholder="Enter User ID or leave empty for all users"
                  value={validateUserId}
                  onChange={(e) => setValidateUserId(e.target.value)}
                />
              </div>

              <Button onClick={handleValidateBalances} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Validate All Balances"
                )}
              </Button>

              <div className="pt-4 border-t space-y-3">
                <Button
                  onClick={handleCheckStatusConsistency}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    "Check Member Status Consistency"
                  )}
                </Button>

                <Button
                  onClick={handleCheckDuplicates}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    "Find Duplicate Payments"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Revert Tab */}
      {activeTab === "revert" && (
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">Revert Payment Period</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Delete all payments for a period and restore balance using priority logic.
            </p>

            <div className="space-y-4">
              <div>
                <Label htmlFor="revert-user-id">User ID</Label>
                <Input
                  id="revert-user-id"
                  placeholder="Enter User ID (UUID)"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="period-key">Period Key</Label>
                <Input
                  id="period-key"
                  placeholder="Enter Period Key (e.g., 2024-06)"
                  value={periodKey}
                  onChange={(e) => setPeriodKey(e.target.value)}
                />
              </div>

              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-900">
                Warning: This will delete all payments for the specified period. Make sure this is intentional.
              </div>

              <Button onClick={handleRevertPeriod} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reverting...
                  </>
                ) : (
                  "Revert Period"
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Repair Tab */}
      {activeTab === "repair" && (
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">Repair Data Issues</h2>

            <div className="space-y-3">
              <Button onClick={handleFixOriginalAmounts} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Fixing...
                  </>
                ) : (
                  "Fix Missing Original Loan Amounts"
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                Populates original_loan_amount for all loans where it's missing or zero.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Sync Tab */}
      {activeTab === "sync" && (
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-4">Synchronize Member Status</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Ensure member status is consistent (fixes cases where subscription_only and active exist for same user).
            </p>

            <div className="space-y-4">
              <div>
                <Label htmlFor="sync-user-id">User ID</Label>
                <Input
                  id="sync-user-id"
                  placeholder="Enter User ID (UUID)"
                  value={syncUserId}
                  onChange={(e) => setSyncUserId(e.target.value)}
                />
              </div>

              <Button onClick={handleSyncMemberStatus} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  "Synchronize Status"
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
