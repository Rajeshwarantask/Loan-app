import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr"

let supabaseClient: ReturnType<typeof createSupabaseBrowserClient> | null = null

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
}

export function createBrowserClient() {
  if (!supabaseClient) {
    supabaseClient = createSupabaseBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return supabaseClient
}

export function createClient() {
  return createBrowserClient()
}
