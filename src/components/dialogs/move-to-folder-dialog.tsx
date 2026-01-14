'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FolderOpen, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Folder } from '@/lib/supabase/types'

interface MoveToFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folders: Folder[]
  currentFolderId: string | null
  onMove: (folderId: string | null) => Promise<void>
}

export function MoveToFolderDialog({
  open,
  onOpenChange,
  folders,
  currentFolderId,
  onMove,
}: MoveToFolderDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId)
  const [loading, setLoading] = useState(false)

  const handleMove = async () => {
    setLoading(true)
    await onMove(selectedFolderId)
    setLoading(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Move to Folder
          </DialogTitle>
          <DialogDescription>
            Select a folder to organize this item
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-1 overflow-y-auto py-2">
          {/* No folder option */}
          <button
            type="button"
            onClick={() => setSelectedFolderId(null)}
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
              selectedFolderId === null
                ? 'bg-primary/10 text-primary'
                : 'hover:bg-secondary'
            )}
          >
            <span className="text-muted-foreground">No folder</span>
            {selectedFolderId === null && <Check className="h-4 w-4" />}
          </button>

          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => setSelectedFolderId(folder.id)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                selectedFolderId === folder.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-secondary'
              )}
            >
              <span className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                {folder.name}
              </span>
              {selectedFolderId === folder.id && <Check className="h-4 w-4" />}
            </button>
          ))}

          {folders.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No folders yet. Create one from the sidebar.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Moving...
              </>
            ) : (
              'Move'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
