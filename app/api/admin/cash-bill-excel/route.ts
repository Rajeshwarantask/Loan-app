// app/api/admin/cash-bill-excel/route.ts
import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"

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
    console.log("[v0] Cash bill API called")
    const { selectedUser, monthYear } = await request.json()

    const supabase = await createClient()

    // First get monthly records
    let monthlyRecordsQuery = supabase.from("monthly_loan_records").select("*").order("user_id")

    if (monthYear) {
      monthlyRecordsQuery = monthlyRecordsQuery.eq("month_year", monthYear)
    }

    if (selectedUser) {
      monthlyRecordsQuery = monthlyRecordsQuery.eq("user_id", selectedUser)
    }

    const { data: monthlyRecords, error: recordsError } = await monthlyRecordsQuery
    if (recordsError) {
      console.error("[v0] Error fetching monthly records:", recordsError.message)
      return NextResponse.json(
        { error: "Failed to fetch cash bill data", details: recordsError.message },
        { status: 500 },
      )
    }
    if (!monthlyRecords || monthlyRecords.length === 0) {
      return NextResponse.json({ error: "No cash bill data found" }, { status: 404 })
    }

    // Get unique user IDs to fetch profile data
    const userIds = [...new Set(monthlyRecords.map((r) => r.user_id))]

    // Fetch profiles separately
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, member_id, full_name, monthly_subscription")
      .in("id", userIds)

    if (profilesError) {
      console.error("[v0] Error fetching profiles:", profilesError.message)
      return NextResponse.json(
        { error: "Failed to fetch profile data", details: profilesError.message },
        { status: 500 },
      )
    }

    // Create a map for easy lookup
    const profileMap = new Map(profiles?.map((p) => [p.id, p]) || [])

    // Combine the data
    const users = monthlyRecords
      .map((record) => {
        const profile = profileMap.get(record.user_id)
        return {
          user_id: record.user_id,
          full_name: profile?.full_name || "",
          member_id: profile?.member_id || "",
          name: profile?.full_name || "",
          voucher_no: profile?.member_id || "",
          monthly_installment: record.monthly_subscription || profile?.monthly_subscription || 2100,
          total_loan_balance: record.closing_outstanding || 0,
          monthly_emi: record.additional_principal || 0,
          fine: record.penalty || 0,
          // Additional fields for compatibility
          monthly_installment_amount: record.monthly_subscription || profile?.monthly_subscription || 2100,
          loan_balance: record.closing_outstanding || 0,
          total_loan: record.closing_outstanding || 0,
          available_loan: record.available_loan_amount || 400000 - (record.closing_outstanding || 0),
        }
      })
      .sort((a, b) => {
        // Sort by member_id
        const aId = a.member_id || ""
        const bId = b.member_id || ""
        return aId.localeCompare(bId)
      })

    const wb = new ExcelJS.Workbook()
    wb.creator = "Financial Community App"
    wb.created = new Date()
    const ws = wb.addWorksheet("Cash Bills")

    // -------------------------
    // SHIFTED layout: start at column A and row 1 (previously started at B row 2)
    // -------------------------

    // Do NOT hide column 1 or row 1 — content will start at A1 now.
    // Assign widths for columns A..F so the old B..G widths are moved to A..F
    ws.getColumn(1).width = 22 // A (was B)
    ws.getColumn(2).width = 17.67 // B (was C)
    ws.getColumn(3).width = 5 // C (was D spacer)
    ws.getColumn(4).width = 22 // D (was E)
    ws.getColumn(5).width = 17.67 // E (was F)
    ws.getColumn(6).width = 5 // F (was G safety)

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

    /**
     * Place one bill block (two columns: leftCol .. leftCol+1)
     * Returns rows used.
     */
    function placeBillAt(user: AnyObj, topRow: number, leftCol: number) {
      const { name: pureName, voucher: extractedVoucher } = cleanNameAndVoucher(user)
      let voucher: string
      if (extractedVoucher) voucher = String(extractedVoucher).trim()
      else voucher = user.member_id != null ? String(user.member_id).trim() : ""

      const monthlyInstallment = safeNum(user.monthly_installment)
      const totalLoan = safeNum(user.total_loan_balance) // This is now total_loan_outstanding
      const monthlyEmi = safeNum(user.monthly_emi) // This is previous_month_principal_received
      const fine = safeNum(user.fine)
      const availableLoan = safeNum(user.available_loan)

      // Rows indices (unchanged relative logic)
      const titleRow = topRow
      const dateRow = topRow + 1
      const nameRow = topRow + 2
      const hdrRow = topRow + 3
      const firstData = hdrRow + 1
      const totalRowIndex = firstData + 6 // 7 data rows

      // Set heights (title a bit taller; data rows = 20)
      ws.getRow(titleRow).height = 24
      ws.getRow(dateRow).height = 16
      ws.getRow(nameRow).height = 18
      ws.getRow(hdrRow).height = 26
      for (let r = firstData; r <= totalRowIndex; r++) ws.getRow(r).height = 26

      // Title (merged across leftCol and leftCol+1)
      ws.mergeCells(titleRow, leftCol, titleRow, leftCol + 1)
      ws.getCell(titleRow, leftCol).value = "CASH BILL MEETING 85"
      ws.getCell(titleRow, leftCol).font = { size: 13, bold: true, color: { argb: blueARGB } }
      ws.getCell(titleRow, leftCol).alignment = { horizontal: "center", vertical: "middle" }

      // Date (merged)
      ws.mergeCells(dateRow, leftCol, dateRow, leftCol + 1)
      ws.getCell(dateRow, leftCol).value = `Date: ${formatDateDDMMYYYY(new Date())}`
      ws.getCell(dateRow, leftCol).font = { size: 11, color: { argb: blueARGB } }
      ws.getCell(dateRow, leftCol).alignment = { horizontal: "center", vertical: "middle" }

      // Name / Voucher
      ws.getCell(nameRow, leftCol).value = `Name: ${pureName}`.trim()
      ws.getCell(nameRow, leftCol).font = { size: 11, color: { argb: blueARGB } }
      ws.getCell(nameRow, leftCol).alignment = { horizontal: "left", vertical: "middle" }

      ws.getCell(nameRow, leftCol + 1).value = null
      if (voucher) {
        ws.getCell(nameRow, leftCol + 1).value = voucher
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

      // Data rows with indian formatting
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
      interestCell.value = {
        formula: `${totalLoanCell.address}*0.015`,
        result: Math.round(totalLoan * 0.015),
      }
      interestCell.numFmt = indianNumFmt
      interestCell.alignment = { horizontal: "right", vertical: "middle" }

      ws.getCell(firstData + 3, leftCol).value = "Monthly EMI"
      const monthlyEmiCell = ws.getCell(firstData + 3, leftCol + 1)
      monthlyEmiCell.value = monthlyEmi
      monthlyEmiCell.numFmt = indianNumFmt
      monthlyEmiCell.alignment = { horizontal: "right", vertical: "middle" }

      ws.getCell(firstData + 4, leftCol).value = "Available Loan"
      const availableCell = ws.getCell(firstData + 4, leftCol + 1)
      availableCell.value = availableLoan
      availableCell.numFmt = indianNumFmt
      availableCell.alignment = { horizontal: "right", vertical: "middle" }

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
        result: monthlyInstallment + Math.round(totalLoan * 0.015) + monthlyEmi + fine,
      }
      totalCell.font = { bold: true }
      totalCell.numFmt = indianNumFmt
      totalCell.alignment = { horizontal: "right", vertical: "middle" }

      applyThinBorderRange(titleRow, leftCol, totalRowIndex, leftCol + 1)
      applyOuterThickBorder(titleRow, leftCol, totalRowIndex, leftCol + 1)

      return totalRowIndex - topRow + 1
    }

    // Layout: start at row 1 col A (1). Two bills per row: leftCol=1 (A), rightCol=4 (D)
    const startRow = 1
    const leftCol = 1 // A
    const rightCol = 4 // D
    const verticalGap = 1

    let cursor = startRow
    for (let i = 0; i < users.length; i += 2) {
      const leftUsed = placeBillAt(users[i], cursor, leftCol)
      if (i + 1 < users.length) {
        const rightUsed = placeBillAt(users[i + 1], cursor, rightCol)
        const used = Math.max(leftUsed, rightUsed)
        const billNumber = Math.floor(i / 2) + 1 // Which row of bills (1, 2, 3, ...)
        const shouldAddGap = billNumber % 3 !== 0 // Add gap unless it's every 3rd row
        cursor += used + (shouldAddGap ? verticalGap : 0)
      } else {
        // Last bill (odd number of users)
        const billNumber = Math.floor(i / 2) + 1
        const shouldAddGap = billNumber % 3 !== 0
        cursor += leftUsed + (shouldAddGap ? verticalGap : 0)
      }
    }

    // Print area shifted left/up: A1..E<lastRow>
    const lastUsedRow = Math.max(startRow, cursor - 1)
    ws.pageSetup.printArea = `A1:E${lastUsedRow}`

    const sanitizeFilename = (s: string) => (s || "").replace(/[^a-z0-9_\-.]/gi, "_")
    let filename: string
    if (selectedUser) {
      const single = users[0]
      const base =
        (single.full_name && String(single.full_name).trim()) ||
        (single.name && String(single.name).trim()) ||
        (single.member_id && String(single.member_id).trim()) ||
        String(single.user_id ?? selectedUser)
      filename = `cash-bill-${sanitizeFilename(base)}-${new Date().toISOString().split("T")[0]}.xlsx`
    } else {
      filename = `cash-bill-all-members-${new Date().toISOString().split("T")[0]}.xlsx`
    }

    const bufferCandidate = await wb.xlsx.writeBuffer()
    const buffer = Buffer.isBuffer(bufferCandidate) ? bufferCandidate : Buffer.from(bufferCandidate)

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error("[v0] Error generating cash bill:", err)
    return NextResponse.json({ error: "Failed to generate cash bill", details: String(err) }, { status: 500 })
  }
}
