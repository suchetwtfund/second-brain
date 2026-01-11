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
import { Tag, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CreateTagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateTag: (name: string, color: string) => Promise<void>
}

const TAG_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Green', value: '#10b981' },
  { name: 'Yellow', value: '#f59e0b' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Indigo', value: '#6366f1' },
]

export function CreateTagDialog({ open, onOpenChange, onCreateTag }: CreateTagDialogProps) {
  const [name, setName] = useState('')
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0].value)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    await onCreateTag(name.trim(), selectedColor)
    setLoading(false)
    setName('')
    setSelectedColor(TAG_COLORS[0].value)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Create Tag
          </DialogTitle>
          <DialogDescription>
            Add labels to organize your items
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tag Name</label>
            <Input
              placeholder="e.g., Important, To Read, AI"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Color</label>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className={cn(
                    'h-8 w-8 rounded-full transition-all',
                    selectedColor === color.value
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-background'
                      : 'hover:scale-110'
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          {name && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Preview</label>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium"
                  style={{ backgroundColor: `${selectedColor}20`, color: selectedColor }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: selectedColor }}
                  />
                  {name}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Tag'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
