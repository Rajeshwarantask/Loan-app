import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")

  if (code) {
    const resetUrl = new URL("/auth/reset-password", request.url)
    resetUrl.searchParams.set("code", code)
    return NextResponse.redirect(resetUrl)
  }

  // Otherwise render the homepage normally
  return NextResponse.next()
}
