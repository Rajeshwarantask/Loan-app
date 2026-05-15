import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"

const EMI_THRESHOLD = 100000

type AnyObj = Record<string, any>

function cleanNameAndVoucher(user: AnyObj) {
  const rawName = user.full_name ? String(user.full_name).trim() : String(user.name ?? "").trim()
  const explicit = (user.voucher_no ?? user.voucher ?? user.member_id ?? "").toString().trim()
  const explicitMatch = explicit.match(/\bV[-]?\d{1,6}\b/i)
  if (explicitMatch) {
    const voucher = explicitMatch[0].toUpperCase()
    const cleanedName = rawName.replace(new RegExp(`(?:[\\s,\\-\$$\$$]*)${voucher}$`, "i"), "").trim()
    return { name: cleanedName || rawName, voucher }
  }

  const trailingRegex = /^(.*?)[\s,-]*(?:[$$#]?)(V[-]?\s*\d{1,6})(?:[$$]?)\s*$/i
  const m = rawName.match(trailingRegex)
  if (m) {
    const namePart = (m[1] || "").trim()
    const voucher = (m[2] || "").replace(/\s+/g, "").toUpperCase()
    return { name: namePart || rawName, voucher }
  }

  return { name: rawName, voucher: "" }
}

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Prediction bill API called")
    const { monthYear } = await request.json()

    const supabase = await createClient()

    // Current period is next month (e.g., if today is Mar, get Mar bills)
    const currentDate = new Date()
    const currentPeriodKey = monthYear || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`

    // Previous period (e.g., if current is Mar, get Feb data)
    const [year, month] = currentPeriodKey.split("-").map(Number)
    let prevMonth = month - 1
    let prevYear = year
    if (prevMonth === 0) {
      prevMonth = 12
      prevYear = year - 1
    }
    const prevPeriodKey = `${prevYear}-${String(prevMonth).padStart(2, "0")}`

    // Get all active loan holders
    const { data: loans, error: loansError } = await supabase
      .from("loans")
      .select("user_id, loan_amount, interest_rate, status")
      .eq("status", "active")

    if (loansError) {
      console.error("[v0] Error fetching loans:", loansError.message)
      return NextResponse.json({ error: "Failed to fetch loan data" }, { status: 500 })
    }

    const loanUserIds = new Set((loans || []).map((l) => l.user_id))

    // Get previous month payments (includes both loan holders and subscription-only members)
    const { data: prevPayments, error: prevError } = await supabase
      .from("loan_payments")
      .select("user_id, interest_paid, monthly_subscription, monthly_emi, remaining_balance")
      .eq("period_key", prevPeriodKey)

    if (prevError) console.error("[v0] Error fetching previous payments:", prevError.message)

    // Get all users who made payments in previous month (includes subscription-only)
    const paymentUserIds = new Set((prevPayments || []).map((p) => p.user_id))

    // Combine both sets: users with active loans OR users who made payments
    const userIds = Array.from(new Set([...loanUserIds, ...paymentUserIds]))

    if (userIds.length === 0) {
      return NextResponse.json({ error: "No payment data found" }, { status: 404 })
    }

    // Get profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, member_id, full_name")
      .in("id", userIds)

    if (profilesError) {
      console.error("[v0] Error fetching profiles:", profilesError.message)
      return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 })
    }

    const loanMap = new Map(loans.map((l) => [l.user_id, l]))
    const prevPaymentMap = new Map((prevPayments || []).map((p) => [p.user_id, p]))
    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || [])

    // Build prediction data (includes subscription-only members)
    const users = userIds
      .map((userId) => {
        const loan = loanMap.get(userId) // May be undefined for subscription-only members
        const prevPayment = prevPaymentMap.get(userId)
        const profile = profileMap.get(userId)

        if (!profile) return null // Profile is required

        const loanAmount = loan?.loan_amount || 0
        const interest = prevPayment?.interest_paid || (loan ? Math.round((loanAmount * loan.interest_rate) / 100) : 0)
        const subscription = prevPayment?.monthly_subscription || 2100
        const emi = loanAmount > EMI_THRESHOLD ? (prevPayment?.monthly_emi || 5000) : 0
        const remaining = loanAmount
        const total = subscription + interest + emi

        return {
          user_id: userId,
          member_id: profile.member_id || "",
          full_name: profile.full_name || "",
          loan_amount: loanAmount,
          interest,
          subscription,
          emi,
          remaining,
          total,
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aId = a.member_id || ""
        const bId = b.member_id || ""

        // Extract numeric part from member IDs like "V1", "V10", "V44"
        const aMatch = aId.match(/V[-]?(\d+)/i)
        const bMatch = bId.match(/V[-]?(\d+)/i)

        if (aMatch && bMatch) {
          // Both have numeric parts - compare as numbers
          const aNum = Number.parseInt(aMatch[1], 10)
          const bNum = Number.parseInt(bMatch[1], 10)
          return aNum - bNum
        }

        // Fallback to alphabetical if no numeric part found
        return aId.localeCompare(bId)
      })

    const wb = new ExcelJS.Workbook()
    wb.creator = "Financial Community App"
    wb.created = new Date()
    const ws = wb.addWorksheet("Prediction Bills")

    ws.getColumn(1).width = 22
    ws.getColumn(2).width = 17.67
    ws.getColumn(3).width = 5
    ws.getColumn(4).width = 22
    ws.getColumn(5).width = 17.67
    ws.getColumn(6).width = 5

    const blueARGB = "FF0B2E6F"
    const thinSide = { style: "thin", color: { argb: "FF000000" } }
    const thickSide = { style: "medium", color: { argb: "FF000000" } }
    const borderThin = { top: thinSide, left: thinSide, bottom: thinSide, right: thinSide }

    const safeNum = (v: any) => {
      const n = Number(v)
      return Number.isFinite(n) ? n : 0
    }

    const formatDateDDMMYYYY = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, "0")
      const mm = String(d.getMonth() + 1).padStart(2, "0")
      const yyyy = d.getFullYear()
      return `${dd}/${mm}/${yyyy}`
    }

    function applyThinBorderRange(top: number, left: number, bottom: number, right: number) {
      for (let r = top; r <= bottom; r++) {
        for (let c = left; c <= right; c++) {
          const cell = ws.getCell(r, c)
          cell.border = { ...cell.border, ...borderThin }
        }
      }
    }

    function applyOuterThickBorder(top: number, left: number, bottom: number, right: number) {
      for (let c = left; c <= right; c++) {
        ws.getCell(top, c).border = { ...ws.getCell(top, c).border, top: thickSide }
        ws.getCell(bottom, c).border = { ...ws.getCell(bottom, c).border, bottom: thickSide }
      }
      for (let r = top; r <= bottom; r++) {
        ws.getCell(r, left).border = { ...ws.getCell(r, left).border, left: thickSide }
        ws.getCell(r, right).border = { ...ws.getCell(r, right).border, right: thickSide }
      }
    }

    const indianNumFmt = "#,##,##0.00"

    function placeBillAt(user: AnyObj, topRow: number, leftCol: number) {
      const { name: pureName, voucher: extractedVoucher } = cleanNameAndVoucher(user)
      const voucher = extractedVoucher || user.member_id

      const monthlyInstallment = safeNum(user.subscription)
      const totalLoan = safeNum(user.loan_amount)
      const interest = safeNum(user.interest)
      const monthlyEmi = safeNum(user.emi)
      const availableLoan = safeNum(400000 - user.loan_amount)
      const fine = 0

      const titleRow = topRow
      const dateRow = topRow + 1
      const nameRow = topRow + 2
      const hdrRow = topRow + 3
      const firstData = hdrRow + 1
      const totalRowIndex = firstData + 6 // 7 data rows

      ws.getRow(titleRow).height = 24
      ws.getRow(dateRow).height = 16
      ws.getRow(nameRow).height = 18
      ws.getRow(hdrRow).height = 26
      for (let r = firstData; r <= totalRowIndex; r++) ws.getRow(r).height = 26

      // Title
      ws.mergeCells(titleRow, leftCol, titleRow, leftCol + 1)
      ws.getCell(titleRow, leftCol).value = "PREDICTION BILL MEETING 85"
      ws.getCell(titleRow, leftCol).font = { size: 13, bold: true, color: { argb: blueARGB } }
      ws.getCell(titleRow, leftCol).alignment = { horizontal: "center", vertical: "middle" }

      // Date
      ws.mergeCells(dateRow, leftCol, dateRow, leftCol + 1)
      ws.getCell(dateRow, leftCol).value = `For Month: ${currentPeriodKey} | Date: ${formatDateDDMMYYYY(new Date())}`
      ws.getCell(dateRow, leftCol).font = { size: 11, color: { argb: blueARGB } }
      ws.getCell(dateRow, leftCol).alignment = { horizontal: "center", vertical: "middle" }

      // Name / Voucher
      ws.getCell(nameRow, leftCol).value = `Name: ${pureName}`.trim()
      ws.getCell(nameRow, leftCol).font = { size: 11, color: { argb: blueARGB } }
      ws.getCell(nameRow, leftCol).alignment = { horizontal: "left", vertical: "middle" }

      ws.getCell(nameRow, leftCol + 1).value = voucher || null
      if (voucher) {
        ws.getCell(nameRow, leftCol + 1).font = { size: 18, bold: true, color: { argb: blueARGB } }
        ws.getCell(nameRow, leftCol + 1).alignment = { horizontal: "center", vertical: "middle" }
      }

      // Header
      ws.getCell(hdrRow, leftCol).value = "Description"
      ws.getCell(hdrRow, leftCol + 1).value = "Amount to be Paid"
      ws.getCell(hdrRow, leftCol).font = { bold: true, color: { argb: blueARGB } }
      ws.getCell(hdrRow, leftCol + 1).font = { bold: true, color: { argb: blueARGB } }
      ws.getCell(hdrRow, leftCol).alignment = { horizontal: "left", vertical: "middle" }
      ws.getCell(hdrRow, leftCol + 1).alignment = { horizontal: "right", vertical: "middle" }

      // Data rows with all 7 fields
      ws.getCell(firstData + 0, leftCol).value = "Monthly Installment"
      const monthlyInstallmentCell = ws.getCell(firstData + 0, leftCol + 1)
      monthlyInstallmentCell.value = monthlyInstallment
      monthlyInstallmentCell.numFmt = indianNumFmt
      monthlyInstallmentCell.alignment = { horizontal: "right", vertical: "middle" }

      ws.getCell(firstData + 1, leftCol).value = "Total Loan"
      const totalLoanCell = ws.getCell(firstData + 1, leftCol + 1)
      totalLoanCell.value = totalLoan
      totalLoanCell.numFmt = indianNumFmt
      totalLoanCell.alignment = { horizontal: "right", vertical: "middle" }

      ws.getCell(firstData + 2, leftCol).value = "Interest"
      const interestCell = ws.getCell(firstData + 2, leftCol + 1)
      interestCell.value = interest
      interestCell.numFmt = indianNumFmt
      interestCell.alignment = { horizontal: "right", vertical: "middle" }

      ws.getCell(firstData + 3, leftCol).value = "Monthly EMI"
      const monthlyEmiCell = ws.getCell(firstData + 3, leftCol + 1)
      monthlyEmiCell.value = monthlyEmi
      monthlyEmiCell.numFmt = indianNumFmt
      monthlyEmiCell.alignment = { horizontal: "right", vertical: "middle" }

      ws.getCell(firstData + 4, leftCol).value = "Available Loan"
      const availableLoanCell = ws.getCell(firstData + 4, leftCol + 1)
      availableLoanCell.value = availableLoan
      availableLoanCell.numFmt = indianNumFmt
      availableLoanCell.alignment = { horizontal: "right", vertical: "middle" }

      ws.getCell(firstData + 5, leftCol).value = "Fine"
      const fineCell = ws.getCell(firstData + 5, leftCol + 1)
      fineCell.value = fine
      fineCell.numFmt = indianNumFmt
      fineCell.alignment = { horizontal: "right", vertical: "middle" }

      ws.getCell(totalRowIndex, leftCol).value = "Total"
      ws.getCell(totalRowIndex, leftCol).font = { bold: true }
      const totalCell = ws.getCell(totalRowIndex, leftCol + 1)
      totalCell.value = {
        formula: `SUM(${monthlyInstallmentCell.address},${interestCell.address},${monthlyEmiCell.address},${fineCell.address})`,
        result: monthlyInstallment + interest + monthlyEmi + fine,
      }
      totalCell.font = { bold: true }
      totalCell.numFmt = indianNumFmt
      totalCell.alignment = { horizontal: "right", vertical: "middle" }

      applyThinBorderRange(titleRow, leftCol, totalRowIndex, leftCol + 1)
      applyOuterThickBorder(titleRow, leftCol, totalRowIndex, leftCol + 1)

      return totalRowIndex - topRow + 1
    }

    const startRow = 1
    const leftCol = 1
    const rightCol = 4
    const verticalGap = 1

    let cursor = startRow
    for (let i = 0; i < users.length; i += 2) {
      const leftUsed = placeBillAt(users[i], cursor, leftCol)
      if (i + 1 < users.length) {
        const rightUsed = placeBillAt(users[i + 1], cursor, rightCol)
        const used = Math.max(leftUsed, rightUsed)
        const billNumber = Math.floor(i / 2) + 1
        const shouldAddGap = billNumber % 3 !== 0
        cursor += used + (shouldAddGap ? verticalGap : 0)
      } else {
        const billNumber = Math.floor(i / 2) + 1
        const shouldAddGap = billNumber % 3 !== 0
        cursor += leftUsed + (shouldAddGap ? verticalGap : 0)
      }
    }

    const lastUsedRow = Math.max(startRow, cursor - 1)
    ws.pageSetup.printArea = `A1:E${lastUsedRow}`

    const filename = `prediction-bill-${currentPeriodKey}-${new Date().toISOString().split("T")[0]}.xlsx`

    const bufferCandidate = await wb.xlsx.writeBuffer()
    const buffer = Buffer.isBuffer(bufferCandidate) ? bufferCandidate : Buffer.from(bufferCandidate)

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("[v0] Error generating prediction bill:", err)
    return NextResponse.json({ error: "Failed to generate prediction bill", details: String(err) }, { status: 500 })
  }
}
