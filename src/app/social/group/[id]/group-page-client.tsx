'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Sidebar } from '@/components/layout/sidebar'
import { SharedItemCard } from '@/components/social/shared-item-card'
import { InviteMembersDialog } from '@/components/social/invite-members-dialog'
import { GroupSettingsDialog } from '@/components/social/group-settings-dialog'
import { CreateGroupDialog } from '@/components/social/create-group-dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { MemberAvatarStack } from '@/components/social/member-avatar'
import { toast } from 'sonner'
import { Menu, UserPlus, Settings, Users } from 'lucide-react'
import type { Folder, Tag, Group, Item, Profile, GroupRole } from '@/lib/supabase/types'

interface Member extends Profile {
  role: GroupRole
  joined_at: string
}

interface SharedItemData {
  id: string
  note: string | null
  created_at: string
  item: Item
  sharer: Profile
}

interface GroupPageClientProps {
  group: Group
  members: Member[]
  userRole: GroupRole
  sharedItems: SharedItemData[]
  groups: (Group & { userRole: string })[]
  folders: Folder[]
  tags: Tag[]
  userId: string
  userEmail: string
  pendingInvitationsCount: number
}

export function GroupPageClient({
  group: initialGroup,
  members: initialMembers,
  userRole,
  sharedItems: initialSharedItems,
  groups: initialGroups,
  folders,
  tags,
  userId,
  userEmail,
  pendingInvitationsCount: initialPendingCount
}: GroupPageClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const [group, setGroup] = useState(initialGroup)
  const [members, setMembers] = useState(initialMembers)
  const [sharedItems, setSharedItems] = useState(initialSharedItems)
  const [groups, setGroups] = useState(initialGroups)
  const [pendingInvitationsCount] = useState(initialPendingCount)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false)

  const canInvite = ['owner', 'admin'].includes(userRole)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleInvite = async (emails: string[]) => {
    const results = await Promise.all(
      emails.map(async (email) => {
        try {
          const res = await fetch(`/api/groups/${group.id}/invitations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          })
          const data = await res.json()
          if (!res.ok) {
            return { email, success: false, error: data.error }
          }
          return { email, success: true }
        } catch {
          return { email, success: false, error: 'Network error' }
        }
      })
    )

    const successCount = results.filter(r => r.success).length
    if (successCount > 0) {
      toast.success(`${successCount} invitation${successCount !== 1 ? 's' : ''} sent successfully`)
    }

    return results
  }

  const handleUpdateGroup = async (name: string, description: string) => {
    const res = await fetch(`/api/groups/${group.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    })

    if (res.ok) {
      const data = await res.json()
      setGroup(data.group)
      toast.success('Group updated')
    } else {
      const data = await res.json()
      toast.error(data.error || 'Failed to update group')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    const res = await fetch(`/api/groups/${group.id}/members?userId=${memberId}`, {
      method: 'DELETE'
    })

    if (res.ok) {
      setMembers(members.filter(m => m.id !== memberId))
      toast.success('Member removed')
    } else {
      const data = await res.json()
      toast.error(data.error || 'Failed to remove member')
    }
  }

  const handleDeleteGroup = async () => {
    const res = await fetch(`/api/groups/${group.id}`, {
      method: 'DELETE'
    })

    if (res.ok) {
      toast.success('Group deleted')
      router.push('/')
    } else {
      const data = await res.json()
      toast.error(data.error || 'Failed to delete group')
    }
  }

  const handleUnshare = async (sharedItemId: string) => {
    const res = await fetch(`/api/shared/${sharedItemId}`, {
      method: 'DELETE'
    })

    if (res.ok) {
      setSharedItems(sharedItems.filter(si => si.id !== sharedItemId))
      toast.success('Item removed from group')
    } else {
      const data = await res.json()
      toast.error(data.error || 'Failed to remove item')
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
      pendingInvitationsCount={pendingInvitationsCount}
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
        <header className="flex h-14 items-center justify-between border-b px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">{group.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <MemberAvatarStack members={members} max={4} />
            {canInvite && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setInviteDialogOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Invite
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSettingsDialogOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <ScrollArea className="flex-1 p-6">
          {group.description && (
            <p className="text-muted-foreground mb-6">{group.description}</p>
          )}

          {sharedItems.length === 0 ? (
            <div className="text-center py-16">
              <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No shared items yet</h3>
              <p className="text-muted-foreground">
                Share items from your library to this group for your team to see.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sharedItems.map(sharedItem => (
                <SharedItemCard
                  key={sharedItem.id}
                  sharedItem={sharedItem}
                  canUnshare={sharedItem.sharer.id === userId || ['owner', 'admin'].includes(userRole)}
                  onUnshare={handleUnshare}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Dialogs */}
      <InviteMembersDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        groupName={group.name}
        onInvite={handleInvite}
      />

      <GroupSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        group={group}
        members={members}
        userRole={userRole}
        currentUserId={userId}
        onUpdate={handleUpdateGroup}
        onRemoveMember={handleRemoveMember}
        onDeleteGroup={handleDeleteGroup}
      />

      <CreateGroupDialog
        open={createGroupDialogOpen}
        onOpenChange={setCreateGroupDialogOpen}
        onCreateGroup={handleCreateGroup}
      />
    </div>
  )
}
