"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Copy, RefreshCw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function VAPIDGeneratorPage() {
  const [publicKey, setPublicKey] = useState<string>("")
  const [privateKey, setPrivateKey] = useState<string>("")
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  const generateKeys = async () => {
    setLoading(true)
    setMessage("")
    try {
      // Import web-push from server
      const response = await fetch("/api/admin/generate-vapid", {
        method: "POST",
      })

      const data = await response.json()

      if (data.success) {
        setPublicKey(data.publicKey)
        setPrivateKey(data.privateKey)
        setMessage("Keys generated successfully! Copy them to your environment variables.")
      } else {
        setMessage("Error generating keys. Please try again.")
      }
    } catch (error) {
      setMessage("Failed to generate keys. Make sure web-push is installed.")
      console.error("Error:", error)
    }
    setLoading(false)
  }

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied({ ...copied, [key]: true })
    setTimeout(() => setCopied({ ...copied, [key]: false }), 2000)
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>VAPID Key Generator</CardTitle>
            <CardDescription>
              Generate Web Push VAPID keys for your application. Keep the private key secure.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button onClick={generateKeys} disabled={loading} size="lg" className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              {loading ? "Generating..." : "Generate VAPID Keys"}
            </Button>

            {message && (
              <Alert variant={message.includes("Error") ? "destructive" : "default"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            {publicKey && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="public-key">Public Key (NEXT_PUBLIC_VAPID_PUBLIC_KEY)</Label>
                  <div className="flex gap-2">
                    <Input id="public-key" value={publicKey} readOnly className="font-mono text-xs" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(publicKey, "public")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  {copied.public && <p className="text-xs text-green-600">Copied!</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="private-key">
                    Private Key (VAPID_PRIVATE_KEY) - Keep this secret!
                  </Label>
                  <div className="flex gap-2">
                    <Input id="private-key" value={privateKey} readOnly className="font-mono text-xs" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(privateKey, "private")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  {copied.private && <p className="text-xs text-green-600">Copied!</p>}
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Next Steps:</strong>
                    <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                      <li>Copy the Public Key and add it to Vercel Env Vars as NEXT_PUBLIC_VAPID_PUBLIC_KEY</li>
                      <li>Copy the Private Key and add it to Vercel Env Vars as VAPID_PRIVATE_KEY</li>
                      <li>Redeploy your app on Vercel</li>
                      <li>Push notifications will now work</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
