"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react"

interface Profile {
  id: string
  full_name: string
  email: string
  member_id: string | null
}

interface MigrationLog {
  id: string
  old_uuid: string
  new_uuid: string
  tables_affected: string[]
  records_migrated: number
  status: "success" | "failed"
  error_message: string | null
  created_by: string
  created_at: string
}

export function UUIDMigrationClient({
  profiles,
  migrationLogs,
}: {
  profiles: Profile[]
  migrationLogs: MigrationLog[]
}) {
  const supabase = createClient()
  const [oldUUID, setOldUUID] = useState("")
  const [newUUID, setNewUUID] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [affectedData, setAffectedData] = useState<{ table: string; count: number }[]>([])
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const validateUUIDs = () => {
    if (!oldUUID.trim() || !newUUID.trim()) {
      setMessage({ type: "error", text: "Please enter both old and new UUIDs" })
      return false
    }

    if (oldUUID === newUUID) {
      setMessage({ type: "error", text: "Old and new UUIDs must be different" })
      return false
    }

    return true
  }

  const checkAffectedData = async () => {
    if (!validateUUIDs()) return

    setIsLoading(true)
    setMessage(null)

    try {
      // Check affected tables
      const tables = [
        { name: "profiles", column: "id" },
        { name: "loans", column: "user_id" },
        { name: "loan_payments", column: "user_id" },
        { name: "additional_loan", column: "user_id" },
        { name: "investments", column: "user_id" },
        { name: "loan_requests", column: "user_id" },
      ]

      const affected: { table: string; count: number }[] = []

      for (const { name, column } of tables) {
        const { count, error } = await supabase
          .from(name)
          .select("*", { count: "exact", head: true })
          .eq(column, oldUUID)

        if (!error && count !== null && count > 0) {
          affected.push({ table: name, count })
        }
      }

      setAffectedData(affected)

      if (affected.length === 0) {
        setMessage({ type: "error", text: "No records found with the old UUID" })
        setIsLoading(false)
        return
      }

      setShowConfirmation(true)
      setMessage(null)
    } catch (error) {
      console.error("[v0] Error checking affected data:", error)
      setMessage({ type: "error", text: "Failed to check affected data" })
    } finally {
      setIsLoading(false)
    }
  }

  const performMigration = async () => {
    setIsLoading(true)
    setMessage(null)

    try {
      console.log("[v0] Starting UUID migration:", { oldUUID, newUUID })

      const tables = [
        { name: "profiles", column: "id" },
        { name: "loans", column: "user_id" },
        { name: "loan_payments", column: "user_id" },
        { name: "additional_loan", column: "user_id" },
        { name: "investments", column: "user_id" },
        { name: "loan_requests", column: "user_id" },
      ]

      let totalRecordsMigrated = 0

      // Migrate each table
      for (const { name, column } of tables) {
        // Special handling for profiles table - check if duplicate would be formed
        if (name === "profiles") {
          console.log("[v0] Handling profiles table special case")
          
          // Check if a profile with the newUUID already exists
          const { data: existingNewProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", newUUID)
            .single()

          const newProfileExists = !!existingNewProfile

          console.log(`[v0] New profile (${newUUID}) exists: ${newProfileExists}`)

          // Update all foreign key references first
          const referencingTables = [
            { name: "loans", column: "user_id" },
            { name: "loan_payments", column: "user_id" },
            { name: "additional_loan", column: "user_id" },
            { name: "investments", column: "user_id" },
            { name: "loan_requests", column: "user_id" },
          ]

          for (const { name: refTable, column: refColumn } of referencingTables) {
            const { error: refError } = await supabase
              .from(refTable)
              .update({ [refColumn]: newUUID })
              .eq(refColumn, oldUUID)

            if (refError) {
              console.error(`[v0] Error updating foreign keys in ${refTable}:`, refError)
              throw new Error(`Failed to update ${refTable}: ${refError.message}`)
            }
          }

          // If newUUID exists, delete the old profile to avoid duplicate key error
          // If newUUID doesn't exist, just update the old profile ID to newUUID
          if (newProfileExists) {
            const { error: deleteError, count: deletedCount } = await supabase
              .from("profiles")
              .delete()
              .eq("id", oldUUID)

            if (deleteError) {
              console.error("[v0] Error deleting old profile:", deleteError)
              throw new Error(`Failed to delete old profile: ${deleteError.message}`)
            }

            console.log(`[v0] Deleted old profile record for ${oldUUID} (newUUID already exists)`)
            totalRecordsMigrated += deletedCount || 0
          } else {
            // Just update the old profile ID to the new UUID
            const { error: updateError, count: updatedCount } = await supabase
              .from("profiles")
              .update({ id: newUUID })
              .eq("id", oldUUID)

            if (updateError) {
              console.error("[v0] Error updating profile ID:", updateError)
              throw new Error(`Failed to update profile ID: ${updateError.message}`)
            }

            console.log(`[v0] Updated profile ID from ${oldUUID} to ${newUUID}`)
            totalRecordsMigrated += updatedCount || 0
          }
        } else {
          // For other tables, just update the user_id
          const { error, count } = await supabase
            .from(name)
            .update({ [column]: newUUID })
            .eq(column, oldUUID)

          if (error) {
            console.error(`[v0] Migration error in ${name}:`, error)
            throw new Error(`Failed to migrate ${name}: ${error.message}`)
          }

          console.log(`[v0] Migrated ${count || 0} records in ${name}`)
          totalRecordsMigrated += count || 0
        }
      }

      // Log the migration
      const { error: logError } = await supabase.from("uuid_migration_logs").insert({
        old_uuid: oldUUID,
        new_uuid: newUUID,
        tables_affected: tables.map((t) => t.name),
        records_migrated: totalRecordsMigrated,
        status: "success",
        error_message: null,
      })

      if (logError) {
        console.error("[v0] Error logging migration:", logError)
      }

      setMessage({
        type: "success",
        text: `Migration successful! ${totalRecordsMigrated} records migrated across ${affectedData.length} tables.`,
      })

      // Reset form
      setOldUUID("")
      setNewUUID("")
      setAffectedData([])
      setShowConfirmation(false)
    } catch (error: any) {
      console.error("[v0] Migration failed:", error)

      // Log the failed migration
      await supabase.from("uuid_migration_logs").insert({
        old_uuid: oldUUID,
        new_uuid: newUUID,
        tables_affected: affectedData.map((a) => a.table),
        records_migrated: 0,
        status: "failed",
        error_message: error.message,
      })

      setMessage({ type: "error", text: `Migration failed: ${error.message}` })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="pl-12 md:pl-0">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">UUID Migration</h1>
        <p className="text-muted-foreground">Migrate legacy UUIDs to authenticated Supabase Auth UUIDs</p>
      </div>

      <div className="grid gap-6">
        {/* Migration Form */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Migrate User Identity</h2>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="old-uuid">Old Legacy UUID</Label>
              <Input
                id="old-uuid"
                placeholder="Enter the old/legacy UUID"
                value={oldUUID}
                onChange={(e) => setOldUUID(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">The UUID that currently owns the historical records</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-uuid">New Auth UUID</Label>
              <Input
                id="new-uuid"
                placeholder="Enter the new Supabase Auth UUID"
                value={newUUID}
                onChange={(e) => setNewUUID(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">The authenticated user's UUID (from auth.users.id)</p>
            </div>

            <div className="pt-4">
              <Button onClick={checkAffectedData} disabled={isLoading} className="w-full md:w-auto">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Check Affected Data
              </Button>
            </div>
          </div>
        </Card>

        {/* Messages */}
        {message && (
          <Alert variant={message.type === "error" ? "destructive" : "default"}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Confirm UUID Migration
              </DialogTitle>
              <DialogDescription>
                This action will permanently update all records. This cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <p className="text-sm">
                  <span className="font-semibold">Old UUID:</span> {oldUUID}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">New UUID:</span> {newUUID}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Affected Tables and Records:</h3>
                <div className="space-y-1">
                  {affectedData.map((item) => (
                    <div key={item.table} className="flex justify-between text-sm p-2 bg-muted rounded">
                      <span>{item.table}</span>
                      <span className="font-semibold">{item.count} records</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  <strong>Total:</strong> {affectedData.reduce((sum, item) => sum + item.count, 0)} records will be
                  migrated
                </p>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  The authenticated user's UUID will remain unchanged. Only the legacy UUID will be updated across all
                  tables.
                </AlertDescription>
              </Alert>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowConfirmation(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button onClick={performMigration} disabled={isLoading} className="bg-red-600 hover:bg-red-700">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Proceed with Migration
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Migration Logs */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Recent Migrations</h2>

          {migrationLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No migration history</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {migrationLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition"
                >
                  {log.status === "success" ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {log.status === "success" ? "Success" : "Failed"} -{" "}
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {log.old_uuid} → {log.new_uuid}
                    </p>
                    {log.status === "success" ? (
                      <p className="text-xs text-green-700 mt-1">
                        {log.records_migrated} records migrated across {log.tables_affected?.length || 0} tables
                      </p>
                    ) : (
                      <p className="text-xs text-red-700 mt-1">{log.error_message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
