import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const supabase = await createClient()

  const { searchParams } = new URL(request.url)
  const limit = Number.parseInt(searchParams.get("limit") || "12")
  const member_id = searchParams.get("member_id")

  // Get distinct periods with counts
  let query = supabase
    .from("monthly_loan_records")
    .select("period_key, period_year, period_month, status")
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .limit(limit)

  if (member_id) {
    query = query.eq("member_id", member_id)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Group by period_key and get month labels
  const periods = data?.reduce((acc: any[], record) => {
    if (!acc.find((p) => p.period_key === record.period_key)) {
      acc.push({
        period_key: record.period_key,
        period_year: record.period_year,
        period_month: record.period_month,
        month_label: new Date(record.period_year, record.period_month - 1).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
        status: record.status,
      })
    }
    return acc
  }, [])

  return NextResponse.json({ periods: periods || [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { period_year, period_month } = await request.json()
  const period_key = `${period_year}-${String(period_month).padStart(2, "0")}`

  // Call refresh function
  const { error } = await supabase.rpc("refresh_monthly_records", {
    target_period_key: period_key,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, period_key })
}
