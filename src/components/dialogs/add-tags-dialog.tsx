'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tag, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tag as TagType } from '@/lib/supabase/types'

interface AddTagsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tags: TagType[]
  currentTagIds: string[]
  onSave: (tagIds: string[]) => Promise<void>
}

export function AddTagsDialog({
  open,
  onOpenChange,
  tags,
  currentTagIds,
  onSave,
}: AddTagsDialogProps) {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(currentTagIds)
  const [loading, setLoading] = useState(false)

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedTagIds(currentTagIds)
    }
  }, [open, currentTagIds])

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    )
  }

  const handleSave = async () => {
    setLoading(true)
    await onSave(selectedTagIds)
    setLoading(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Add Tags
          </DialogTitle>
          <DialogDescription>
            Select tags to organize this item
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-1 overflow-y-auto py-2">
          {tags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  isSelected
                    ? 'bg-primary/10'
                    : 'hover:bg-secondary'
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span style={{ color: isSelected ? tag.color : undefined }}>
                    {tag.name}
                  </span>
                </span>
                {isSelected && <Check className="h-4 w-4" style={{ color: tag.color }} />}
              </button>
            )
          })}

          {tags.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No tags yet. Create one from the sidebar.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Tags'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
