"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { X, Bell } from "lucide-react"
import { cn } from "@/lib/utils"

interface Notice {
  id: string
  title: string
  content: string
  priority: string
  created_at: string
}

export function NotificationToast() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [currentNotice, setCurrentNotice] = useState<Notice | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [dismissedNotices, setDismissedNotices] = useState<Set<string>>(new Set())
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const subscriptionRef = useRef<any>(null)
  const initializationDoneRef = useRef(false)

  useEffect(() => {
    const checkAuthAndFetchNotices = async () => {
      const supabase = createClient()
      
      // Check if user is authenticated
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setIsAuthenticated(false)
        return
      }

      setIsAuthenticated(true)

      // Calculate date from 5 days ago
      const fiveDaysAgo = new Date()
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
      const fiveDaysAgoString = fiveDaysAgo.toISOString()

      // Fetch recent notices from the last 5 days
      const { data } = await supabase
        .from("notices")
        .select("id, title, content, priority, created_at")
        .gte("created_at", fiveDaysAgoString)
        .order("created_at", { ascending: false })

      if (data && data.length > 0) {
        console.log("[v0] NotificationToast - Found", data.length, "recent notices")
        setNotices(data)
        
        // Get dismissed notices from localStorage
        const dismissed = localStorage.getItem("dismissedNotices")
        const dismissedSet = dismissed ? new Set(JSON.parse(dismissed)) : new Set()
        setDismissedNotices(dismissedSet)

        // Find first non-dismissed notice and show immediately
        const firstNotice = data.find((notice) => !dismissedSet.has(notice.id))
        if (firstNotice) {
          console.log("[v0] NotificationToast - Showing notice:", firstNotice.title)
          setCurrentNotice(firstNotice)
          setTimeout(() => setIsVisible(true), 100)
        }
      } else {
        console.log("[v0] NotificationToast - No recent notices found")
      }

      // Setup real-time subscription for new notices
      const channel = supabase
        .channel("notices-realtime")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notices",
          },
          (payload) => {
            const newNotice = payload.new as Notice
            console.log("[v0] NotificationToast - New notice received:", newNotice.title)
            
            setNotices((prev) => [newNotice, ...prev])
            
            // Show new notice if not already showing or if current is dismissed
            setCurrentNotice((current) => {
              if (current === null) {
                console.log("[v0] NotificationToast - Showing new notice immediately")
                setTimeout(() => setIsVisible(true), 100)
                return newNotice
              }
              return current
            })
          }
        )
        .subscribe()

      subscriptionRef.current = channel
      initializationDoneRef.current = true
    }

    if (!initializationDoneRef.current) {
      checkAuthAndFetchNotices()
    }

    return () => {
      // Cleanup subscription on unmount
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
      }
    }
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    if (currentNotice) {
      // Add to dismissed list
      const newDismissed = new Set(dismissedNotices)
      newDismissed.add(currentNotice.id)
      setDismissedNotices(newDismissed)
      localStorage.setItem("dismissedNotices", JSON.stringify(Array.from(newDismissed)))

      // Show next notice after animation
      setTimeout(() => {
        const nextNotice = notices.find((notice) => !newDismissed.has(notice.id))
        if (nextNotice) {
          console.log("[v0] NotificationToast - Showing next notice:", nextNotice.title)
          setCurrentNotice(nextNotice)
          setTimeout(() => setIsVisible(true), 100)
        } else {
          setCurrentNotice(null)
        }
      }, 600)
    }
  }

  if (!currentNotice || !isAuthenticated) return null

  const priorityStyles = {
    high: {
      bg: "bg-[#fcfcfc] border-red-300",
      borderColor: "border-l-red-500",
      text: "text-red-600",
      badge: "bg-red-100 text-red-700",
      icon: "text-red-500",
    },
    medium: {
      bg: "bg-[#fcfcfc] border-amber-300",
      borderColor: "border-l-amber-500",
      text: "text-amber-600",
      badge: "bg-amber-100 text-amber-700",
      icon: "text-amber-500",
    },
    low: {
      bg: "bg-[#fcfcfc] border-emerald-300",
      borderColor: "border-l-emerald-500",
      text: "text-emerald-600",
      badge: "bg-emerald-100 text-emerald-700",
      icon: "text-emerald-500",
    },
    info: {
      bg: "bg-[#fcfcfc] border-blue-300",
      borderColor: "border-l-blue-500",
      text: "text-blue-600",
      badge: "bg-blue-100 text-blue-700",
      icon: "text-blue-500",
    },
  }

  const style = priorityStyles[currentNotice.priority as keyof typeof priorityStyles] || priorityStyles.info

  return (
    <div
      className={cn(
        "fixed top-6 z-50 w-[calc(100%-1.5rem)] max-w-md transition-all duration-500 ease-in-out",
        isVisible ? "right-6" : "-right-[500px]",
        "md:w-96"
      )}
    >
      <div
        className={cn(
          "rounded-lg border-l-4 shadow-lg overflow-hidden",
          style.bg,
          style.borderColor
        )}
      >
        <div className="p-4 md:p-5">
          <div className="flex items-start gap-3">
            <Bell className={cn("h-5 w-5 mt-0.5 flex-shrink-0", style.icon)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className={cn("font-semibold text-sm md:text-base leading-tight", style.text)}>
                  {currentNotice.title}
                </h3>
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", style.badge)}>
                  {currentNotice.priority.charAt(0).toUpperCase() + currentNotice.priority.slice(1)}
                </span>
              </div>
              <p className={cn("text-xs md:text-sm line-clamp-3 leading-relaxed", style.text, "opacity-70")}>
                {currentNotice.content}
              </p>
            </div>
            <button
              onClick={handleClose}
              className={cn(
                "flex-shrink-0 transition-all duration-200 hover:opacity-70",
                style.text
              )}
              aria-label="Close notification"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
