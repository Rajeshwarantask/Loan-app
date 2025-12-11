import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { periodKey: string } }) {
  const supabase = await createClient()
  const { periodKey } = params

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
