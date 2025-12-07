import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Image from "next/image"

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 via-white to-green-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Image src="/app-logo.png" alt="Vizhuthugal Sangam" width={120} height={120} className="rounded-lg" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Vizhuthugal Sangam</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">Community Loan Management System</p>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <Button asChild className="w-full" size="lg">
            <Link href="/auth/login">Sign In</Link>
          </Button>

          <Button asChild variant="outline" className="w-full bg-transparent" size="lg">
            <Link href="/auth/signup">Create Account</Link>
          </Button>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Track loans, manage payments, and connect with your community
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
