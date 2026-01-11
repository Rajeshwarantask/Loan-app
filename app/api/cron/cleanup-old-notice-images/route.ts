import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()

    // Get notices older than 1 month with images
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    const { data: oldNotices, error: fetchError } = await supabase
      .from("notices")
      .select("id, image_path")
      .not("image_path", "is", null)
      .lt("created_at", oneMonthAgo.toISOString())

    if (fetchError) {
      console.error("[v0] Error fetching old notices:", fetchError)
      throw fetchError
    }

    let deletedCount = 0

    // Delete images from storage and update notices
    for (const notice of oldNotices || []) {
      if (notice.image_path) {
        // Delete from storage
        const { error: storageError } = await supabase.storage.from("notice-images").remove([notice.image_path])

        if (storageError) {
          console.error("[v0] Error deleting image from storage:", storageError)
          continue
        }

        // Update notice to remove image references
        const { error: updateError } = await supabase
          .from("notices")
          .update({ image_url: null, image_path: null })
          .eq("id", notice.id)

        if (updateError) {
          console.error("[v0] Error updating notice:", updateError)
          continue
        }

        deletedCount++
      }
    }

    console.log(`[v0] Cleanup completed: ${deletedCount} old notice images deleted`)

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} old notice images`,
      deletedCount,
    })
  } catch (error) {
    console.error("[v0] Cleanup cron job error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}
