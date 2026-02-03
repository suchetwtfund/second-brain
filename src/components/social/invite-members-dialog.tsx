'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { UserPlus, Loader2, Mail, X, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface InviteMembersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupName: string
  onInvite: (emails: string[]) => Promise<{ email: string; success: boolean; error?: string }[]>
}

export function InviteMembersDialog({
  open,
  onOpenChange,
  groupName,
  onInvite
}: InviteMembersDialogProps) {
  const [email, setEmail] = useState('')
  const [emails, setEmails] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{ email: string; success: boolean; error?: string }[]>([])

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const addEmail = () => {
    const trimmed = email.trim().toLowerCase()
    if (trimmed && isValidEmail(trimmed) && !emails.includes(trimmed)) {
      setEmails([...emails, trimmed])
      setEmail('')
    }
  }

  const removeEmail = (emailToRemove: string) => {
    setEmails(emails.filter(e => e !== emailToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addEmail()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Add current email if valid
    const allEmails = [...emails]
    const currentEmail = email.trim().toLowerCase()
    if (currentEmail && isValidEmail(currentEmail) && !allEmails.includes(currentEmail)) {
      allEmails.push(currentEmail)
    }

    if (allEmails.length === 0) return

    setLoading(true)
    try {
      const inviteResults = await onInvite(allEmails)
      setResults(inviteResults)

      // Clear successfully invited emails
      const successEmails = inviteResults.filter(r => r.success).map(r => r.email)
      setEmails(emails.filter(e => !successEmails.includes(e)))
      setEmail('')

      // If all succeeded, close dialog after a delay
      if (inviteResults.every(r => r.success)) {
        setTimeout(() => {
          onOpenChange(false)
          setResults([])
        }, 1500)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setEmail('')
      setEmails([])
      setResults([])
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Invite Members
          </DialogTitle>
          <DialogDescription>
            Invite people to join &quot;{groupName}&quot; by email
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email Addresses</label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              <Button
                type="button"
                variant="outline"
                onClick={addEmail}
                disabled={!email.trim() || !isValidEmail(email.trim())}
              >
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Press Enter or click Add to add multiple emails
            </p>
          </div>

          {emails.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {emails.map(e => (
                <Badge key={e} variant="secondary" className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {e}
                  <button
                    type="button"
                    onClick={() => removeEmail(e)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2 border rounded-md p-3">
              {results.map(result => (
                <div key={result.email} className="flex items-center gap-2 text-sm">
                  {result.success ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                  <span>{result.email}</span>
                  {result.error && (
                    <span className="text-muted-foreground">- {result.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              {results.length > 0 ? 'Close' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              disabled={loading || (emails.length === 0 && !isValidEmail(email.trim()))}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                `Send ${emails.length + (isValidEmail(email.trim()) ? 1 : 0)} Invitation${emails.length + (isValidEmail(email.trim()) ? 1 : 0) !== 1 ? 's' : ''}`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
