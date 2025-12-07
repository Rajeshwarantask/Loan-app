import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Mail, Clock, Shield } from "lucide-react"

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-semibold">Confirm Your Email</CardTitle>
            <CardDescription>
              We've sent a verification link to your email address. Please check your inbox and spam folder.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-lg bg-muted p-4 text-sm">
              <div className="flex gap-2">
                <Shield className="h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">What to do:</p>
                  <p className="text-muted-foreground">
                    Click the confirmation link in your email to activate your account
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Clock className="h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">Link expires in:</p>
                  <p className="text-muted-foreground">24 hours for security reasons</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="font-medium">Security Note:</p>
              <ul className="list-inside space-y-1">
                <li>• Never share the confirmation link with anyone</li>
                <li>• Do not share it via chat or social media</li>
                <li>• If you didn't sign up, please ignore this email</li>
              </ul>
            </div>

            <Button asChild className="w-full">
              <Link href="/auth/login">Back to Sign In</Link>
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Didn't receive the email? Check your spam folder or{" "}
              <Link href="/auth/signup" className="font-medium text-primary hover:underline">
                try signing up again
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
