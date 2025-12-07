import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import type { Profile } from "./types"

export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

export async function getUserProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const user = await getUser()

  if (!user) {
    return null
  }

  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()

  if (error || !profile) {
    return null
  }

  return profile
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    redirect("/auth/login")
  }
  return user
}

export async function requireAdmin() {
  const profile = await getUserProfile()
  if (!profile || profile.role !== "admin") {
    redirect("/dashboard")
  }
  return profile
}

export async function isAdmin(): Promise<boolean> {
  const profile = await getUserProfile()
  return profile?.role === "admin"
}
