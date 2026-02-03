'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Share2, Loader2, Users } from 'lucide-react'
import type { Group, Item } from '@/lib/supabase/types'

interface ShareToGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: Item | null
  groups: (Group & { userRole: string })[]
  onShare: (itemId: string, groupIds: string[], note: string) => Promise<void>
}

export function ShareToGroupDialog({
  open,
  onOpenChange,
  item,
  groups,
  onShare
}: ShareToGroupDialogProps) {
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!item || selectedGroups.length === 0) return

    setLoading(true)
    try {
      await onShare(item.id, selectedGroups, note.trim())
      setSelectedGroups([])
      setNote('')
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedGroups([])
      setNote('')
    }
    onOpenChange(open)
  }

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Share to Group
          </DialogTitle>
          <DialogDescription>
            {item ? (
              <>Share &quot;{item.title}&quot; to your groups</>
            ) : (
              'Select groups to share this item'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {groups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>You&apos;re not a member of any groups yet.</p>
              <p className="text-sm mt-1">Create a group to start sharing items.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Groups</label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
                  {groups.map(group => (
                    <div
                      key={group.id}
                      className="flex items-center space-x-3 p-2 hover:bg-muted rounded-md cursor-pointer"
                      onClick={() => toggleGroup(group.id)}
                    >
                      <Checkbox
                        id={group.id}
                        checked={selectedGroups.includes(group.id)}
                        onCheckedChange={() => toggleGroup(group.id)}
                      />
                      <label
                        htmlFor={group.id}
                        className="flex-1 cursor-pointer text-sm"
                      >
                        <span className="font-medium">{group.name}</span>
                        {group.description && (
                          <span className="text-muted-foreground ml-2">
                            - {group.description}
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Add a note (optional)</label>
                <Textarea
                  placeholder="Why are you sharing this? Any context for your team..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            {groups.length > 0 && (
              <Button type="submit" disabled={loading || selectedGroups.length === 0}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sharing...
                  </>
                ) : (
                  `Share to ${selectedGroups.length} group${selectedGroups.length !== 1 ? 's' : ''}`
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
