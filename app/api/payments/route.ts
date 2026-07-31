import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    loan_id,
    member_id,
    user_id,
    payment_date,
    payment_type,
    amount,
    principal_component,
    interest_component,
    penalty_component,
    subscription_component,
    notes,
    opening_balance,
  } = await request.json()

  // Parse period from payment_date
  const date = new Date(payment_date)
  const period_year = date.getFullYear()
  const period_month = date.getMonth() + 1
  const period_key = `${period_year}-${String(period_month).padStart(2, "0")}`

  // If opening_balance not provided, fetch it from database using get_opening_balance function
  let finalOpeningBalance = opening_balance

  if (!finalOpeningBalance && user_id) {
    const { data: balanceData, error: balanceError } = await supabase.rpc(
      "get_opening_balance",
      {
        p_user_id: user_id,
        p_period_key: period_key,
      }
    )

    if (balanceError) {
      console.error("[v0] Error fetching opening balance:", balanceError)
      return NextResponse.json(
        { error: `Failed to calculate opening balance: ${balanceError.message}` },
        { status: 400 }
      )
    }

    finalOpeningBalance = balanceData || 0
  }

  // Insert payment with opening_balance
  const { data, error } = await supabase
    .from("loan_payments")
    .insert({
      loan_id,
      member_id,
      payment_date,
      period_year,
      period_month,
      period_key,
      payment_type,
      amount: Number(amount),
      principal_component: Number(principal_component || 0),
      interest_component: Number(interest_component || 0),
      penalty_component: Number(penalty_component || 0),
      subscription_component: Number(subscription_component || 0),
      opening_balance: Number(finalOpeningBalance || 0),
      notes,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Trigger will automatically update monthly_loan_records
  return NextResponse.json({ success: true, payment: data })
}
