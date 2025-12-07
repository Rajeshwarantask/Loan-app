"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { Settings, Save, AlertCircle, CheckCircle2 } from "lucide-react"

interface Setting {
  id: string
  setting_key: string
  setting_value: string
  description: string | null
}

interface AdminSettingsClientProps {
  settings: Setting[]
}

export function AdminSettingsClient({ settings: initialSettings }: AdminSettingsClientProps) {
  const [settings, setSettings] = useState<Record<string, string>>(
    initialSettings.reduce((acc, s) => ({ ...acc, [s.setting_key]: s.setting_value }), {}),
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    const supabase = createClient()

    try {
      console.log("[v0] Saving settings:", settings)

      // Update each setting
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase
          .from("system_settings")
          .update({ setting_value: value, updated_at: new Date().toISOString() })
          .eq("setting_key", key)

        if (error) throw error
      }

      setMessage({ type: "success", text: "Settings saved successfully!" })
      console.log("[v0] Settings saved successfully")
    } catch (error) {
      console.error("[v0] Error saving settings:", error)
      setMessage({ type: "error", text: "Failed to save settings. Please try again." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container max-w-4xl py-6 px-2 md:px-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="pl-12 md:pl-0 px-2 md:px-0">
          <div className="flex items-center gap-2">
            <Settings className="h-6 w-6" />
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">System Settings</h1>
          </div>
          <p className="text-sm md:text-base text-muted-foreground">Configure default values and system parameters</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <Alert variant={message.type === "error" ? "destructive" : "default"}>
          {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Settings Cards */}
      <div className="space-y-6">
        {/* Monthly Subscription */}
        <Card>
          <CardHeader>
            <CardTitle>Default Monthly Subscription</CardTitle>
            <CardDescription>Set the default monthly subscription amount for new members</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="subscription">Amount (₹)</Label>
              <Input
                id="subscription"
                type="number"
                value={settings.default_monthly_subscription || "2000"}
                onChange={(e) => handleChange("default_monthly_subscription", e.target.value)}
                placeholder="2000"
              />
              <p className="text-xs text-muted-foreground">
                This amount will be pre-filled when creating new user accounts
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Loan Issue Day */}
        <Card>
          <CardHeader>
            <CardTitle>Loan Issue Day</CardTitle>
            <CardDescription>Set the default day of the month for loan disbursement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="issue-day">Day of Month</Label>
              <Select
                value={settings.loan_issue_day || "11"}
                onValueChange={(value) => handleChange("loan_issue_day", value)}
              >
                <SelectTrigger id="issue-day">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      {day}
                      {day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th"} of each month
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Loans will be issued on this day each month by default</p>
            </div>
          </CardContent>
        </Card>

        {/* Loan Calculation Rule */}
        <Card>
          <CardHeader>
            <CardTitle>Loan Duration Calculation</CardTitle>
            <CardDescription>Configure how loan durations are calculated</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="calc-rule">Calculation Method</Label>
              <Select
                value={settings.loan_calculation_rule || "dynamic"}
                onValueChange={(value) => handleChange("loan_calculation_rule", value)}
              >
                <SelectTrigger id="calc-rule">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dynamic">Dynamic (Based on payment dates)</SelectItem>
                  <SelectItem value="fixed">Fixed (Pre-determined duration)</SelectItem>
                </SelectContent>
              </Select>
              <div className="rounded-md bg-muted p-3 text-xs space-y-2">
                <p className="font-medium">Dynamic Calculation:</p>
                <p className="text-muted-foreground">
                  Loan months are calculated from the issue date (11th) to the closing date, rounded down to the 11th of
                  the closing month. Duration adjusts based on actual payment history.
                </p>
                <p className="font-medium mt-2">Fixed Calculation:</p>
                <p className="text-muted-foreground">
                  Loan duration is set at creation and remains unchanged regardless of payment schedule.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  )
}
