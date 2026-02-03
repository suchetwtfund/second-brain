'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Video, FileText, Twitter, Link as LinkIcon, StickyNote,
  FileType, Music, ExternalLink, MoreVertical, Trash2, MessageSquare
} from 'lucide-react'
import type { Item, Profile } from '@/lib/supabase/types'

interface SharedItemCardProps {
  sharedItem: {
    id: string
    note: string | null
    created_at: string
    item: Item
    sharer: Profile
  }
  canUnshare: boolean
  onUnshare: (id: string) => void
  onOpenItem?: (item: Item) => void
}

const contentTypeConfig: Record<string, { icon: typeof Video; color: string; label: string }> = {
  video: { icon: Video, color: 'bg-red-500/10 text-red-500', label: 'Video' },
  article: { icon: FileText, color: 'bg-green-500/10 text-green-500', label: 'Article' },
  tweet: { icon: Twitter, color: 'bg-blue-500/10 text-blue-500', label: 'Tweet' },
  link: { icon: LinkIcon, color: 'bg-purple-500/10 text-purple-500', label: 'Link' },
  note: { icon: StickyNote, color: 'bg-yellow-500/10 text-yellow-500', label: 'Note' },
  pdf: { icon: FileType, color: 'bg-orange-500/10 text-orange-500', label: 'PDF' },
  spotify: { icon: Music, color: 'bg-green-500/10 text-green-500', label: 'Spotify' },
}

export function SharedItemCard({
  sharedItem,
  canUnshare,
  onUnshare,
  onOpenItem
}: SharedItemCardProps) {
  const { item, sharer, note, created_at } = sharedItem
  const config = contentTypeConfig[item.content_type] || contentTypeConfig.link
  const Icon = config.icon

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return email.slice(0, 2).toUpperCase()
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = diff / (1000 * 60 * 60)

    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60))
      return `${minutes}m ago`
    }
    if (hours < 24) {
      return `${Math.floor(hours)}h ago`
    }
    if (hours < 48) {
      return 'Yesterday'
    }
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <Card className="overflow-hidden hover:bg-muted/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {item.thumbnail && (
            <div className="flex-shrink-0 w-24 h-16 rounded-md overflow-hidden bg-muted">
              <img
                src={item.thumbnail}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className={`${config.color} text-xs`}>
                    <Icon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>
                </div>
                <h3
                  className="font-medium text-sm line-clamp-1 cursor-pointer hover:text-primary"
                  onClick={() => onOpenItem?.(item)}
                >
                  {item.title}
                </h3>
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {item.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {item.url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    asChild
                  >
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canUnshare && (
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => onUnshare(sharedItem.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove from group
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {note && (
              <div className="mt-2 p-2 bg-muted rounded-md">
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground italic">&quot;{note}&quot;</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Avatar className="h-4 w-4">
                <AvatarImage src={sharer.avatar_url || undefined} />
                <AvatarFallback className="text-[8px]">
                  {getInitials(sharer.display_name, sharer.email)}
                </AvatarFallback>
              </Avatar>
              <span>Shared by {sharer.display_name || sharer.email}</span>
              <span>·</span>
              <span>{formatDate(created_at)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
