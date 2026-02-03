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
  BookOpen,
  Clock,
} from 'lucide-react'
import { OfflineBadge } from '@/components/ui/offline-badge'
import { ItemHighlights } from './item-highlights'
import type { Item, Tag as TagType } from '@/lib/supabase/types'

interface ItemDetailDialogProps {
  item: Item | null
  tags?: TagType[]
  open: boolean
  isOfflineCached?: boolean
  onOpenChange: (open: boolean) => void
  onOpenReader?: () => void
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

export function ItemDetailDialog({ item, tags = [], open, isOfflineCached, onOpenChange, onOpenReader }: ItemDetailDialogProps) {
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
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-hidden p-0 sm:w-full">
        {/* Header with thumbnail */}
        {item.thumbnail && !imageError ? (
          <div className="relative h-32 w-full overflow-hidden sm:h-48">
            <Image
              src={item.thumbnail}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 672px"
              className="object-cover"
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          </div>
        ) : (
          <div className="flex h-24 w-full items-center justify-center bg-secondary sm:h-32">
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
                  {isOfflineCached && <OfflineBadge />}
                  {item.reading_time_minutes && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {item.reading_time_minutes} min
                    </span>
                  )}
                </div>
                <DialogTitle className="text-xl leading-tight">{item.title}</DialogTitle>
              </div>
              <div className="flex items-center gap-2">
                {onOpenReader && item.type === 'link' && (
                  <Button onClick={onOpenReader} variant="secondary" className="gap-2">
                    <BookOpen className="h-4 w-4" />
                    Read
                  </Button>
                )}
                {item.url && (
                  <Button onClick={handleOpenLink} className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </Button>
                )}
              </div>
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

            <TabsContent value="info" className="mt-4 max-h-[50vh] overflow-auto sm:max-h-[40vh]">
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

            <TabsContent value="highlights" className="mt-4 max-h-[50vh] overflow-auto sm:max-h-[40vh]">
              <ItemHighlights itemId={item.id} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
