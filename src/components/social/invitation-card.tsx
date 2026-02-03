'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Users, Loader2, Check, X } from 'lucide-react'
import type { GroupInvitationWithGroup } from '@/lib/supabase/types'

interface InvitationCardProps {
  invitation: GroupInvitationWithGroup
  onAccept: (id: string) => Promise<void>
  onDecline: (id: string) => Promise<void>
}

export function InvitationCard({ invitation, onAccept, onDecline }: InvitationCardProps) {
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null)

  const handleAccept = async () => {
    setLoading('accept')
    try {
      await onAccept(invitation.id)
    } finally {
      setLoading(null)
    }
  }

  const handleDecline = async () => {
    setLoading('decline')
    try {
      await onDecline(invitation.id)
    } finally {
      setLoading(null)
    }
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email.slice(0, 2).toUpperCase()
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })
  }

  const expiresAt = new Date(invitation.expires_at)
  const isExpiringSoon = expiresAt.getTime() - Date.now() < 24 * 60 * 60 * 1000 // 24 hours

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{invitation.group.name}</CardTitle>
              {invitation.group.description && (
                <CardDescription className="mt-0.5">
                  {invitation.group.description}
                </CardDescription>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Avatar className="h-5 w-5">
            <AvatarImage src={invitation.inviter.avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {getInitials(invitation.inviter.display_name, invitation.inviter.email)}
            </AvatarFallback>
          </Avatar>
          <span>
            Invited by {invitation.inviter.display_name || invitation.inviter.email}
          </span>
          <span>·</span>
          <span>{formatDate(invitation.created_at)}</span>
        </div>
        {isExpiringSoon && (
          <p className="text-xs text-orange-500 mt-2">
            Expires {expiresAt.toLocaleDateString()}
          </p>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDecline}
          disabled={loading !== null}
        >
          {loading === 'decline' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <X className="h-4 w-4 mr-1" />
              Decline
            </>
          )}
        </Button>
        <Button
          size="sm"
          onClick={handleAccept}
          disabled={loading !== null}
        >
          {loading === 'accept' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Check className="h-4 w-4 mr-1" />
              Accept
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
