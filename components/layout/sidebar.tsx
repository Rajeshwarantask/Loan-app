"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Calculator, FileText, Settings, Bell, Users, DollarSign, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/types"
import { LogoutButton } from "@/components/auth/logout-button"

interface SidebarProps {
  role: UserRole
  userName: string
}

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname()

  const userLinks = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/calculator", label: "Loan Calculator", icon: Calculator },
    { href: "/loans", label: "My Loans", icon: FileText },
    { href: "/request-loan", label: "Request Loan", icon: DollarSign },
    { href: "/notices", label: "Notices", icon: Bell },
    { href: "/contact", label: "Contact Admin", icon: MessageSquare },
  ]

  const adminLinks = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/admin/users", label: "User Management", icon: Users },
    { href: "/admin/loans", label: "Loan Management", icon: FileText },
    { href: "/admin/requests", label: "Loan Requests", icon: DollarSign },
    { href: "/admin/notices", label: "Manage Notices", icon: Bell },
    { href: "/admin/cash-bill", label: "Cash Bill", icon: FileText },
    { href: "/admin/settings", label: "System Settings", icon: Settings }, // Added settings link
    { href: "/calculator", label: "Calculator", icon: Calculator },
  ]

  const links = role === "admin" ? adminLinks : userLinks

  return (
    <aside className="hidden w-64 border-r bg-background md:block">
      <div className="flex h-full flex-col">
        <div className="border-b p-6">
          <h2 className="text-lg font-semibold">Community Loans</h2>
          <p className="text-sm text-muted-foreground">{userName}</p>
          <p className="text-xs text-muted-foreground capitalize">{role}</p>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {links.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t p-4">
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <div className="mt-2">
            <LogoutButton />
          </div>
        </div>
      </div>
    </aside>
  )
}
