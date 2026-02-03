'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Settings, Loader2, Trash2, UserMinus, Crown, Shield, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { Profile, GroupRole } from '@/lib/supabase/types'

interface Member extends Profile {
  role: GroupRole
  joined_at: string
}

interface GroupSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: {
    id: string
    name: string
    description: string | null
    owner_id: string
  }
  members: Member[]
  userRole: GroupRole
  currentUserId: string
  onUpdate: (name: string, description: string) => Promise<void>
  onRemoveMember: (userId: string) => Promise<void>
  onDeleteGroup: () => Promise<void>
}

const roleIcons: Record<GroupRole, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: User
}

const roleColors: Record<GroupRole, string> = {
  owner: 'bg-yellow-500/10 text-yellow-600',
  admin: 'bg-blue-500/10 text-blue-600',
  member: 'bg-gray-500/10 text-gray-600'
}

export function GroupSettingsDialog({
  open,
  onOpenChange,
  group,
  members,
  userRole,
  currentUserId,
  onUpdate,
  onRemoveMember,
  onDeleteGroup
}: GroupSettingsDialogProps) {
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description || '')
  const [loading, setLoading] = useState(false)
  const [removingMember, setRemovingMember] = useState<string | null>(null)

  const canEdit = ['owner', 'admin'].includes(userRole)
  const isOwner = userRole === 'owner'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !canEdit) return

    setLoading(true)
    try {
      await onUpdate(name.trim(), description.trim())
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    setRemovingMember(userId)
    try {
      await onRemoveMember(userId)
    } finally {
      setRemovingMember(null)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setName(group.name)
      setDescription(group.description || '')
    }
    onOpenChange(open)
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email.slice(0, 2).toUpperCase()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Group Settings
          </DialogTitle>
          <DialogDescription>
            {canEdit ? 'Manage your group settings and members' : 'View group settings and members'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Group Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                disabled={!canEdit}
              />
            </div>

            {canEdit && (
              <Button
                type="submit"
                disabled={loading || !name.trim() || (name === group.name && description === (group.description || ''))}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            )}
          </form>

          <div className="space-y-3">
            <h4 className="text-sm font-medium">Members ({members.length})</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {members.map(member => {
                const RoleIcon = roleIcons[member.role]
                const isSelf = member.id === currentUserId
                const canRemove = canEdit && !isSelf && member.role !== 'owner'

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback>
                          {getInitials(member.display_name, member.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {member.display_name || member.email}
                          {isSelf && <span className="text-muted-foreground ml-1">(you)</span>}
                        </span>
                        {member.display_name && (
                          <span className="text-xs text-muted-foreground">{member.email}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={roleColors[member.role]}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {member.role}
                      </Badge>
                      {canRemove && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={removingMember === member.id}
                        >
                          {removingMember === member.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserMinus className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {isOwner && (
            <div className="pt-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Group
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Group</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete &quot;{group.name}&quot;? This will remove all
                      members and shared items. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDeleteGroup}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Group
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
