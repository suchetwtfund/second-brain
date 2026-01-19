'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { HighlightCard } from '@/components/highlights/highlight-card'
import { Highlighter, Loader2 } from 'lucide-react'
import type { Highlight, HighlightColor } from '@/lib/supabase/types'
import { toast } from 'sonner'

interface ItemHighlightsProps {
  itemId: string
}

export function ItemHighlights({ itemId }: ItemHighlightsProps) {
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    const fetchHighlights = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('highlights')
        .select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to fetch highlights:', error)
        toast.error('Failed to load highlights')
      } else {
        setHighlights(data as Highlight[])
      }
      setLoading(false)
    }

    fetchHighlights()
  }, [itemId, supabase])

  const handleUpdateColor = async (id: string, color: HighlightColor) => {
    const { error } = await supabase
      .from('highlights')
      .update({ color })
      .eq('id', id)

    if (error) {
      toast.error('Failed to update highlight color')
      return
    }

    setHighlights((prev) =>
      prev.map((h) => (h.id === id ? { ...h, color } : h))
    )
  }

  const handleUpdateNote = async (id: string, note: string | null) => {
    const { error } = await supabase
      .from('highlights')
      .update({ note })
      .eq('id', id)

    if (error) {
      toast.error('Failed to update note')
      return
    }

    setHighlights((prev) =>
      prev.map((h) => (h.id === id ? { ...h, note } : h))
    )
    toast.success('Note saved')
  }

  const handleDelete = async (id: string) => {
    const highlight = highlights.find((h) => h.id === id)
    if (!highlight) return

    // Optimistically remove
    setHighlights((prev) => prev.filter((h) => h.id !== id))

    const { error } = await supabase
      .from('highlights')
      .delete()
      .eq('id', id)

    if (error) {
      // Restore on error
      setHighlights((prev) => [highlight, ...prev])
      toast.error('Failed to delete highlight')
      return
    }

    toast.success('Highlight deleted')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (highlights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <Highlighter className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No highlights yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Use the browser extension to highlight text on this page
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Highlighter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">
          {highlights.length} highlight{highlights.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="space-y-2">
        {highlights.map((highlight) => (
          <HighlightCard
            key={highlight.id}
            highlight={highlight}
            onUpdateColor={handleUpdateColor}
            onUpdateNote={handleUpdateNote}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  )
}
