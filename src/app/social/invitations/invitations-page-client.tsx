'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from '@/components/layout/sidebar'
import { InvitationCard } from '@/components/social/invitation-card'
import { CreateGroupDialog } from '@/components/social/create-group-dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { toast } from 'sonner'
import { Menu, Mail } from 'lucide-react'
import type { Folder, Tag, Group, GroupInvitationWithGroup } from '@/lib/supabase/types'

interface InvitationsPageClientProps {
  invitations: GroupInvitationWithGroup[]
  groups: (Group & { userRole: string })[]
  folders: Folder[]
  tags: Tag[]
  userEmail: string
}

export function InvitationsPageClient({
  invitations: initialInvitations,
  groups: initialGroups,
  folders,
  tags,
  userEmail
}: InvitationsPageClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const [invitations, setInvitations] = useState(initialInvitations)
  const [groups, setGroups] = useState(initialGroups)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleAccept = async (invitationId: string) => {
    const res = await fetch(`/api/invitations/${invitationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept' })
    })

    const data = await res.json()

    if (res.ok) {
      setInvitations(invitations.filter(i => i.id !== invitationId))
      toast.success(data.message || 'Invitation accepted')

      // Refresh groups
      const groupsRes = await fetch('/api/groups')
      if (groupsRes.ok) {
        const groupsData = await groupsRes.json()
        setGroups(groupsData.groups)
      }

      // Navigate to the group
      if (data.group) {
        router.push(`/social/group/${data.group.id}`)
      }
    } else {
      toast.error(data.error || 'Failed to accept invitation')
    }
  }

  const handleDecline = async (invitationId: string) => {
    const res = await fetch(`/api/invitations/${invitationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decline' })
    })

    if (res.ok) {
      setInvitations(invitations.filter(i => i.id !== invitationId))
      toast.success('Invitation declined')
    } else {
      const data = await res.json()
      toast.error(data.error || 'Failed to decline invitation')
    }
  }

  const handleCreateGroup = async (name: string, description: string) => {
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    })

    if (res.ok) {
      const data = await res.json()
      setGroups([data.group, ...groups])
      toast.success('Group created')
    } else {
      const data = await res.json()
      toast.error(data.error || 'Failed to create group')
    }
  }

  const sidebarContent = (
    <Sidebar
      folders={folders}
      tags={tags}
      groups={groups}
      pendingInvitationsCount={invitations.length}
      userEmail={userEmail}
      onSignOut={handleSignOut}
      onCreateFolder={() => {}}
      onCreateTag={() => {}}
      onCreateGroup={() => setCreateGroupDialogOpen(true)}
      onAddItem={() => router.push('/')}
      onOpenSettings={() => {}}
    />
  )

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-64">
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Custom Header */}
        <header className="flex h-14 items-center gap-3 border-b px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Invitations</h1>
        </header>

        <ScrollArea className="flex-1 p-6">
          {invitations.length === 0 ? (
            <div className="text-center py-16">
              <Mail className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No pending invitations</h3>
              <p className="text-muted-foreground">
                When someone invites you to a group, it will appear here.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {invitations.map(invitation => (
                <InvitationCard
                  key={invitation.id}
                  invitation={invitation}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Dialogs */}
      <CreateGroupDialog
        open={createGroupDialogOpen}
        onOpenChange={setCreateGroupDialogOpen}
        onCreateGroup={handleCreateGroup}
      />
    </div>
  )
}
