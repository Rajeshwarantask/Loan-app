import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { PWARegister } from "@/components/pwa/pwa-register"
import { InstallPrompt } from "@/components/pwa/install-prompt"
import { Toaster } from "@/components/ui/toaster"
import { ChunkErrorHandler } from "@/components/chunk-error-handler"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Vizhuthugal Sangam - Loan Tracker",
  description: "Community loan tracking and financial management system for Vizhuthugal Sangam",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vizhuthugal Sangam",
  },
  formatDetection: {
    telephone: false,
  },
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/app-logo.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Vizhuthugal" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                if (e.message && (e.message.includes('Failed to load chunk') || e.message.includes('Cannot find module'))) {
                  console.error('[v0] Chunk loading error detected, reloading...');
                  window.location.href = window.location.origin;
                }
              });
            `,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ChunkErrorHandler>
          <PWARegister />
          {children}
          <InstallPrompt />
          <Toaster />
        </ChunkErrorHandler>
      </body>
    </html>
  )
}
