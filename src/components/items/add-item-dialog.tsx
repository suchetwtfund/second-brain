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
import { Loader2, Link, StickyNote, Sparkles } from 'lucide-react'

interface AddItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddItem: (data: { url?: string; title: string; content?: string; type: 'link' | 'note' }) => Promise<void>
}

export function AddItemDialog({ open, onOpenChange, onAddItem }: AddItemDialogProps) {
  const [mode, setMode] = useState<'link' | 'note'>('link')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingMetadata, setFetchingMetadata] = useState(false)

  const handleUrlChange = async (value: string) => {
    setUrl(value)

    // Auto-fetch metadata when a valid URL is pasted
    if (value && isValidUrl(value)) {
      setFetchingMetadata(true)
      try {
        const response = await fetch(`/api/metadata?url=${encodeURIComponent(value)}`)
        if (response.ok) {
          const data = await response.json()
          if (data.title) setTitle(data.title)
        }
      } catch {
        // Ignore errors - user can still manually enter title
      }
      setFetchingMetadata(false)
    }
  }

  const isValidUrl = (str: string) => {
    try {
      new URL(str)
      return true
    } catch {
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'link' && !url) return
    if (mode === 'note' && !title) return

    setLoading(true)
    try {
      await onAddItem({
        type: mode,
        url: mode === 'link' ? url : undefined,
        title: title || url,
        content: mode === 'note' ? content : undefined,
      })
      // Reset form
      setUrl('')
      setTitle('')
      setContent('')
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to add item:', error)
    }
    setLoading(false)
  }

  const resetForm = () => {
    setUrl('')
    setTitle('')
    setContent('')
    setMode('link')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="glass sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to your brain</DialogTitle>
          <DialogDescription>
            Save a link or create a quick note
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === 'link' ? 'default' : 'secondary'}
            className="flex-1 gap-2"
            onClick={() => setMode('link')}
          >
            <Link className="h-4 w-4" />
            Link
          </Button>
          <Button
            type="button"
            variant={mode === 'note' ? 'default' : 'secondary'}
            className="flex-1 gap-2"
            onClick={() => setMode('note')}
          >
            <StickyNote className="h-4 w-4" />
            Note
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'link' ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">URL</label>
                <div className="relative">
                  <Input
                    placeholder="https://..."
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    className="pr-10"
                    autoFocus
                  />
                  {fetchingMetadata && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Title (optional)</label>
                <Input
                  placeholder="Auto-detected from URL"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Note title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Content</label>
                <textarea
                  placeholder="Write your note..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || (mode === 'link' && !url) || (mode === 'note' && !title)}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
