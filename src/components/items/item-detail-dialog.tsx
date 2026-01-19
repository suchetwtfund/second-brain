'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Video,
  FileText,
  Link as LinkIcon,
  StickyNote,
  ExternalLink,
  FileIcon,
  Headphones,
  Info,
  Highlighter,
} from 'lucide-react'
import { ItemHighlights } from './item-highlights'
import type { Item, Tag as TagType } from '@/lib/supabase/types'

interface ItemDetailDialogProps {
  item: Item | null
  tags?: TagType[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

const contentTypeIcons: Record<string, typeof Video> = {
  video: Video,
  article: FileText,
  tweet: FileText,
  link: LinkIcon,
  note: StickyNote,
  pdf: FileIcon,
  spotify: Headphones,
  substack: FileText,
}

const contentTypeColors: Record<string, string> = {
  video: 'bg-red-500/20 text-red-400',
  article: 'bg-green-500/20 text-green-400',
  tweet: 'bg-blue-500/20 text-blue-400',
  link: 'bg-purple-500/20 text-purple-400',
  note: 'bg-yellow-500/20 text-yellow-400',
  pdf: 'bg-orange-500/20 text-orange-400',
  spotify: 'bg-[#1DB954]/20 text-[#1DB954]',
  substack: 'bg-orange-600/20 text-orange-500',
}

export function ItemDetailDialog({ item, tags = [], open, onOpenChange }: ItemDetailDialogProps) {
  const [imageError, setImageError] = useState(false)

  if (!item) return null

  const Icon = contentTypeIcons[item.content_type] || LinkIcon

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const handleOpenLink = () => {
    if (item.url) {
      window.open(item.url, '_blank')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-0">
        {/* Header with thumbnail */}
        {item.thumbnail && !imageError ? (
          <div className="relative h-48 w-full overflow-hidden">
            <Image
              src={item.thumbnail}
              alt=""
              fill
              className="object-cover"
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          </div>
        ) : (
          <div className="flex h-32 w-full items-center justify-center bg-secondary">
            <Icon className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}

        <div className="p-6">
          <DialogHeader className="mb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <Badge className={cn('text-xs', contentTypeColors[item.content_type])}>
                    {item.content_type}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {item.status}
                  </Badge>
                </div>
                <DialogTitle className="text-xl leading-tight">{item.title}</DialogTitle>
              </div>
              {item.url && (
                <Button onClick={handleOpenLink} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </Button>
              )}
            </div>
          </DialogHeader>

          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info" className="gap-2">
                <Info className="h-4 w-4" />
                Info
              </TabsTrigger>
              <TabsTrigger value="highlights" className="gap-2">
                <Highlighter className="h-4 w-4" />
                Highlights
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-4 max-h-[40vh] overflow-auto">
              <div className="space-y-4">
                {item.description && (
                  <div>
                    <h4 className="mb-1 text-sm font-medium text-muted-foreground">Description</h4>
                    <p className="text-sm">{item.description}</p>
                  </div>
                )}

                {item.content && (
                  <div>
                    <h4 className="mb-1 text-sm font-medium text-muted-foreground">Content</h4>
                    <p className="whitespace-pre-wrap text-sm">{item.content}</p>
                  </div>
                )}

                {item.url && (
                  <div>
                    <h4 className="mb-1 text-sm font-medium text-muted-foreground">URL</h4>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-sm text-primary hover:underline"
                    >
                      {item.url}
                    </a>
                  </div>
                )}

                {tags.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          style={{ borderColor: tag.color, color: tag.color }}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Added on {formatDate(item.created_at)}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="highlights" className="mt-4 max-h-[40vh] overflow-auto">
              <ItemHighlights itemId={item.id} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
