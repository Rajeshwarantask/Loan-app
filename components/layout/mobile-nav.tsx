"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Calculator,
  FileText,
  User,
  Bell,
  Users,
  Menu,
  HandCoins,
  Phone,
  CreditCard,
  ClipboardList,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/types"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

interface MobileNavProps {
  role: UserRole
  userName: string
}

export function MobileNav({ role, userName }: MobileNavProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const allUserLinks = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/calculator", label: "Calculator", icon: Calculator },
    { href: "/loans", label: "My Loans", icon: FileText },
    { href: "/request-loan", label: "Request Loan", icon: HandCoins },
    { href: "/notices", label: "Notices", icon: Bell },
    { href: "/contact", label: "Contact Admin", icon: Phone },
    { href: "/settings", label: "Profile", icon: User },
  ]

  const allAdminLinks = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/admin/users", label: "User Management", icon: Users },
    { href: "/admin/loans", label: "Loan Management", icon: CreditCard },
    { href: "/admin/requests", label: "Loan Requests", icon: ClipboardList },
    { href: "/admin/notices", label: "Manage Notices", icon: Bell },
    { href: "/admin/cash-bill", label: "Cash Bill", icon: FileText },
    { href: "/admin/settings", label: "System Settings", icon: Settings },
    { href: "/calculator", label: "Calculator", icon: Calculator },
    { href: "/contact", label: "Contact", icon: Phone },
    { href: "/settings", label: "Profile", icon: User },
  ]

  const bottomUserLinks = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/calculator", label: "Calculator", icon: Calculator },
    { href: "/loans", label: "My Loans", icon: FileText },
    { href: "/settings", label: "Profile", icon: User },
  ]

  const bottomAdminLinks = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/admin/requests", label: "Requests", icon: ClipboardList },
    { href: "/admin/loans", label: "Loans", icon: CreditCard },
    { href: "/admin/cash-bill", label: "Bills", icon: FileText },
    { href: "/settings", label: "Profile", icon: User },
  ]

  const allLinks = role === "admin" ? allAdminLinks : allUserLinks
  const bottomLinks = role === "admin" ? bottomAdminLinks : bottomUserLinks

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="fixed left-4 top-4 z-50 md:hidden">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px]">
          <SheetHeader>
            <SheetTitle className="text-left">Menu</SheetTitle>
          </SheetHeader>
          <nav className="mt-6 flex flex-col gap-1">
            {allLinks.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{link.label}</span>
                </Link>
              )
            })}
          </nav>
        </SheetContent>
      </Sheet>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
        <div className="flex items-center justify-around">
          {bottomLinks.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-3 text-xs transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px]">{link.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
