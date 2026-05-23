import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Validate period key format (YYYY-MM)
function validatePeriodKey(periodKey: string): { valid: boolean; error?: string } {
  const periodPattern = /^\d{4}-\d{2}$/
  if (!periodPattern.test(periodKey)) {
    return { valid: false, error: "Invalid period key format. Expected YYYY-MM" }
  }

  const [yearStr, monthStr] = periodKey.split("-")
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)

  if (month < 1 || month > 12) {
    return { valid: false, error: "Invalid month. Must be between 01 and 12" }
  }

  if (year < 2000 || year > 2100) {
    return { valid: false, error: "Invalid year. Must be between 2000 and 2100" }
  }

  return { valid: true }
}

export async function GET(request: Request, { params }: { params: { periodKey: string } }) {
  const supabase = await createClient()
  const { periodKey } = params

  // Validate period key format
  const validation = validatePeriodKey(periodKey)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const member_id = searchParams.get("member_id")

  // Query the monthly_cycle_summary view
  let query = supabase
    .from("monthly_cycle_summary")
    .select("*")
    .eq("period_key", periodKey)
    .order("member_ref", { ascending: true })

  if (member_id) {
    query = query.eq("member_id", member_id)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ records: data || [] })
}
