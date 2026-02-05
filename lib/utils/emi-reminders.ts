// EMI Reminder Utilities for Push Notifications

export interface EMIReminder {
  userId: string
  loanId: string
  amount: number
  dueDate: string
  daysUntilDue: number
  type: "due_soon" | "overdue" | "payment_confirmed"
}

/**
 * Calculate if an EMI is due soon (within next 5 days)
 */
export function isEMIDueSoon(dueDate: Date): boolean {
  const today = new Date()
  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return daysUntilDue > 0 && daysUntilDue <= 5
}

/**
 * Calculate if an EMI is overdue
 */
export function isEMIOverdue(dueDate: Date): boolean {
  const today = new Date()
  return dueDate < today
}

/**
 * Get days until EMI due date
 */
export function getDaysUntilDue(dueDate: Date): number {
  const today = new Date()
  return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Generate reminder notification message
 */
export function generateEMIReminderMessage(reminder: EMIReminder): {
  title: string
  body: string
} {
  switch (reminder.type) {
    case "due_soon":
      if (reminder.daysUntilDue === 1) {
        return {
          title: "EMI Payment Due Tomorrow",
          body: `Your EMI of ₹${reminder.amount.toLocaleString()} is due tomorrow. Please pay on time.`,
        }
      }
      return {
        title: "EMI Payment Due Soon",
        body: `Your EMI of ₹${reminder.amount.toLocaleString()} is due in ${reminder.daysUntilDue} days.`,
      }

    case "overdue":
      return {
        title: "EMI Payment Overdue",
        body: `Your EMI of ₹${reminder.amount.toLocaleString()} is ${Math.abs(reminder.daysUntilDue)} days overdue. Please pay immediately.`,
      }

    case "payment_confirmed":
      return {
        title: "Payment Confirmed",
        body: `Your EMI payment of ₹${reminder.amount.toLocaleString()} has been confirmed. Thank you!`,
      }

    default:
      return {
        title: "EMI Notification",
        body: `Please review your EMI due date: ${reminder.dueDate}`,
      }
  }
}

/**
 * Send EMI reminder via push notification
 */
export async function sendEMIReminder(reminder: EMIReminder): Promise<boolean> {
  try {
    const { title, body } = generateEMIReminderMessage(reminder)

    const response = await fetch("/api/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: reminder.userId,
        type: `emi_${reminder.type}`,
        title,
        body,
        data: {
          url: "/dashboard",
          loanId: reminder.loanId,
          type: reminder.type,
        },
      }),
    })

    if (!response.ok) {
      throw new Error("Failed to send reminder")
    }

    console.log("[EMI] Reminder sent for user:", reminder.userId)
    return true
  } catch (error) {
    console.error("[EMI] Error sending reminder:", error)
    return false
  }
}

/**
 * Check for users who need EMI reminders (to be run as a cron job)
 */
export async function checkAndSendEMIReminders(supabase: any): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  try {
    // Get all active loans
    const { data: loans, error: loansError } = await supabase
      .from("loans")
      .select("id, user_id, remaining_balance, status, created_at")
      .eq("status", "active")

    if (loansError) throw loansError

    // Get users with notifications enabled
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, notifications_enabled")
      .eq("notifications_enabled", true)

    if (profilesError) throw profilesError

    const enabledUserIds = new Set(profiles?.map((p: any) => p.id) || [])

    // Get current month's payments for each user to check if they've paid
    const today = new Date()
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

    const { data: payments } = await supabase
      .from("loan_payments")
      .select("user_id, period_key, status")
      .eq("period_key", currentMonth)
      .eq("status", "paid")

    const paidUserIds = new Set(payments?.map((p: any) => p.user_id) || [])

    // Process each loan
    for (const loan of loans || []) {
      // Skip if user doesn't have notifications enabled
      if (!enabledUserIds.has(loan.user_id)) {
        continue
      }

      // Skip if already paid this month
      if (paidUserIds.has(loan.user_id)) {
        continue
      }

      // Calculate next payment date (assuming monthly, same day as creation)
      const loanDate = new Date(loan.created_at)
      const nextPaymentDate = new Date(today.getFullYear(), today.getMonth() + 1, loanDate.getDate())

      // Send reminder if due soon or overdue
      const reminder: EMIReminder = {
        userId: loan.user_id,
        loanId: loan.id,
        amount: 5000, // Fixed EMI amount
        dueDate: nextPaymentDate.toISOString(),
        daysUntilDue: getDaysUntilDue(nextPaymentDate),
        type: isEMIOverdue(nextPaymentDate)
          ? "overdue"
          : isEMIDueSoon(nextPaymentDate)
            ? "due_soon"
            : "payment_confirmed",
      }

      if (reminder.type !== "payment_confirmed") {
        const success = await sendEMIReminder(reminder)
        if (success) {
          sent++
        } else {
          failed++
        }
      }
    }

    console.log(`[EMI] Reminder check completed - Sent: ${sent}, Failed: ${failed}`)
    return { sent, failed }
  } catch (error) {
    console.error("[EMI] Error checking reminders:", error)
    return { sent, failed }
  }
}
