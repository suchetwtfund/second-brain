'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, Check, Key, Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      loadApiKey()
    }
  }, [open])

  async function loadApiKey() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const response = await fetch('/api/quick-save', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          setApiKey(data.api_key)
        }
      }
    } catch (error) {
      console.error('Failed to load API key:', error)
    }
    setLoading(false)
  }

  async function copyApiKey() {
    if (apiKey) {
      await navigator.clipboard.writeText(apiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const shortcutUrl = apiKey
    ? `https://www.icloud.com/shortcuts/api/records/create?fields[name]=Save%20to%20Telos`
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* API Key Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Key className="h-4 w-4" />
              API Key for iOS Shortcuts
            </div>
            <p className="text-xs text-muted-foreground">
              Use this key to save links from iOS Shortcuts or other apps.
            </p>

            {loading ? (
              <div className="h-10 animate-pulse rounded-md bg-muted" />
            ) : apiKey ? (
              <div className="flex gap-2">
                <Input
                  value={apiKey}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyApiKey}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-destructive">Failed to load API key</p>
            )}
          </div>

          {/* iOS Shortcut Instructions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Smartphone className="h-4 w-4" />
              iOS Shortcut Setup
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>1. Open the <strong>Shortcuts</strong> app on your iPhone</p>
              <p>2. Create a new shortcut with these actions:</p>
              <div className="rounded-md bg-muted p-3 font-mono text-xs">
                <p>• Get Clipboard</p>
                <p>• URL: POST to</p>
                <p className="break-all pl-2">https://telos-deploy.vercel.app/api/quick-save</p>
                <p>• Body: {`{"url": [Clipboard], "api_key": "[Your Key]"}`}</p>
              </div>
              <p>3. Go to <strong>Settings → Accessibility → Touch → Back Tap</strong></p>
              <p>4. Set Double Tap to run your shortcut</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
