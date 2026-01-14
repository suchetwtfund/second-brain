'use client'

import { useState, useRef } from 'react'
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
import { Loader2, Link, StickyNote, Sparkles, FileText, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface AddItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddItem: (data: { url?: string; title: string; content?: string; type: 'link' | 'note' | 'pdf' }) => Promise<void>
}

export function AddItemDialog({ open, onOpenChange, onAddItem }: AddItemDialogProps) {
  const [mode, setMode] = useState<'link' | 'note' | 'pdf'>('link')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingMetadata, setFetchingMetadata] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

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

  const handleFileSelect = (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      alert('File size must be less than 20MB')
      return
    }
    setSelectedFile(file)
    if (!title) {
      setTitle(file.name.replace('.pdf', ''))
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'link' && !url) return
    if (mode === 'note' && !title) return
    if (mode === 'pdf' && !selectedFile) return

    setLoading(true)
    try {
      if (mode === 'pdf' && selectedFile) {
        // Upload PDF first
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token

        const formData = new FormData()
        formData.append('file', selectedFile)

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        })

        if (!uploadResponse.ok) {
          let errorMessage = 'Failed to upload PDF'
          try {
            const error = await uploadResponse.json()
            errorMessage = error.error || errorMessage
          } catch {
            // Response wasn't JSON
            if (uploadResponse.status === 413) {
              errorMessage = 'File too large'
            }
          }
          throw new Error(errorMessage)
        }

        const uploadData = await uploadResponse.json()

        await onAddItem({
          type: 'pdf',
          url: uploadData.url,
          title: title || selectedFile.name,
        })
      } else {
        await onAddItem({
          type: mode,
          url: mode === 'link' ? url : undefined,
          title: title || url,
          content: mode === 'note' ? content : undefined,
        })
      }
      // Reset form
      resetForm()
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to add item:', error)
      alert(error instanceof Error ? error.message : 'Failed to add item')
    }
    setLoading(false)
  }

  const resetForm = () => {
    setUrl('')
    setTitle('')
    setContent('')
    setSelectedFile(null)
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
          <Button
            type="button"
            variant={mode === 'pdf' ? 'default' : 'secondary'}
            className="flex-1 gap-2"
            onClick={() => setMode('pdf')}
          >
            <FileText className="h-4 w-4" />
            PDF
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'link' && (
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
          )}

          {mode === 'note' && (
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

          {mode === 'pdf' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">PDF File</label>
                <div
                  className={`relative flex min-h-[120px] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors ${
                    dragActive
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleFileSelect(e.target.files[0])
                      }
                    }}
                  />
                  {selectedFile ? (
                    <div className="flex items-center gap-2 px-4 w-full overflow-hidden">
                      <FileText className="h-8 w-8 flex-shrink-0 text-orange-500" />
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedFile(null)
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Drop PDF here or click to browse
                      </p>
                      <p className="text-xs text-muted-foreground/75">
                        Max size: 20MB
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="PDF title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                (mode === 'link' && !url) ||
                (mode === 'note' && !title) ||
                (mode === 'pdf' && !selectedFile)
              }
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === 'pdf' ? 'Uploading...' : 'Adding...'}
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
