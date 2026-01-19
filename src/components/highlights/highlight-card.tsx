'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { MoreHorizontal, Pencil, Trash2, Check, X } from 'lucide-react'
import type { Highlight, HighlightColor } from '@/lib/supabase/types'

interface HighlightCardProps {
  highlight: Highlight
  onUpdateColor: (id: string, color: HighlightColor) => void
  onUpdateNote: (id: string, note: string | null) => void
  onDelete: (id: string) => void
}

const highlightColors: { value: HighlightColor; label: string; bg: string; border: string }[] = [
  { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-500/20', border: 'border-yellow-500/50' },
  { value: 'green', label: 'Green', bg: 'bg-green-500/20', border: 'border-green-500/50' },
  { value: 'blue', label: 'Blue', bg: 'bg-blue-500/20', border: 'border-blue-500/50' },
  { value: 'pink', label: 'Pink', bg: 'bg-pink-500/20', border: 'border-pink-500/50' },
  { value: 'orange', label: 'Orange', bg: 'bg-orange-500/20', border: 'border-orange-500/50' },
]

export function HighlightCard({ highlight, onUpdateColor, onUpdateNote, onDelete }: HighlightCardProps) {
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [noteText, setNoteText] = useState(highlight.note || '')

  const colorConfig = highlightColors.find((c) => c.value === highlight.color) || highlightColors[0]

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const handleSaveNote = () => {
    onUpdateNote(highlight.id, noteText.trim() || null)
    setIsEditingNote(false)
  }

  const handleCancelNote = () => {
    setNoteText(highlight.note || '')
    setIsEditingNote(false)
  }

  return (
    <div
      className={cn(
        'group rounded-lg border p-4 transition-colors',
        colorConfig.bg,
        colorConfig.border
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Highlighted text */}
        <blockquote className="flex-1 border-l-2 border-current pl-3 text-sm italic text-foreground/90">
          &ldquo;{highlight.text}&rdquo;
        </blockquote>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Color options */}
            <div className="flex items-center gap-1 px-2 py-1.5">
              {highlightColors.map((color) => (
                <button
                  key={color.value}
                  className={cn(
                    'h-5 w-5 rounded-full border-2 transition-transform hover:scale-110',
                    color.bg,
                    highlight.color === color.value
                      ? 'border-foreground ring-2 ring-foreground/20'
                      : 'border-transparent'
                  )}
                  onClick={() => onUpdateColor(highlight.id, color.value)}
                  title={color.label}
                />
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsEditingNote(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              {highlight.note ? 'Edit note' : 'Add note'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(highlight.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Note section */}
      {isEditingNote ? (
        <div className="mt-3 space-y-2">
          <Textarea
            placeholder="Add a note..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="min-h-[60px] resize-none bg-background/50"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSaveNote}>
              <Check className="mr-1 h-3 w-3" />
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancelNote}>
              <X className="mr-1 h-3 w-3" />
              Cancel
            </Button>
          </div>
        </div>
      ) : highlight.note ? (
        <p className="mt-3 rounded bg-background/30 p-2 text-xs text-muted-foreground">
          {highlight.note}
        </p>
      ) : null}

      {/* Date */}
      <p className="mt-3 text-[10px] text-muted-foreground">
        {formatDate(highlight.created_at)}
      </p>
    </div>
  )
}
