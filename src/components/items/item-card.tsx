'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Video,
  FileText,
  Link as LinkIcon,
  StickyNote,
  ExternalLink,
  MoreHorizontal,
  Check,
  CheckCircle2,
  Archive,
  Trash2,
  FolderOpen,
  Tag,
  FileIcon,
  Headphones,
} from 'lucide-react'
import type { Item, Tag as TagType } from '@/lib/supabase/types'

interface ItemCardProps {
  item: Item
  tags?: TagType[]
  viewMode: 'grid' | 'list'
  onMarkRead: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  onMoveToFolder: (id: string) => void
  onAddTag: (id: string) => void
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

export function ItemCard({
  item,
  tags = [],
  viewMode,
  onMarkRead,
  onArchive,
  onDelete,
  onMoveToFolder,
  onAddTag,
}: ItemCardProps) {
  const [imageError, setImageError] = useState(false)
  const Icon = contentTypeIcons[item.content_type] || LinkIcon

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const handleOpen = () => {
    if (item.url) {
      window.open(item.url, '_blank')
    }
  }

  if (viewMode === 'list') {
    return (
      <div
        className={cn(
          'group flex items-center gap-4 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/30 hover:bg-card/80',
          item.status === 'unread' && 'border-l-2 border-l-primary'
        )}
      >
        {/* Thumbnail or Icon */}
        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-secondary">
          {item.thumbnail && !imageError ? (
            <Image
              src={item.thumbnail}
              alt=""
              fill
              className="object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-medium">{item.title}</h3>
            <Badge variant="secondary" className={cn('text-[10px]', contentTypeColors[item.content_type])}>
              {item.content_type}
            </Badge>
          </div>
          {(item.description || item.content) && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {item.description || item.content}
            </p>
          )}
        </div>

        {/* Tags */}
        <div className="hidden items-center gap-1 md:flex">
          {tags.slice(0, 2).map((tag) => (
            <Badge
              key={tag.id}
              variant="outline"
              className="text-[10px]"
              style={{ borderColor: tag.color, color: tag.color }}
            >
              {tag.name}
            </Badge>
          ))}
        </div>

        {/* Date */}
        <span className="text-xs text-muted-foreground">
          {formatDate(item.created_at)}
        </span>

        {/* Read Status Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onMarkRead(item.id)}
          title={item.status === 'read' ? 'Mark as unread' : 'Mark as read'}
        >
          <CheckCircle2
            className={cn(
              'h-4 w-4 transition-colors',
              item.status === 'read'
                ? 'text-red-500'
                : 'text-muted-foreground hover:text-foreground'
            )}
          />
        </Button>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {item.url && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleOpen}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onMarkRead(item.id)}>
                <Check className="mr-2 h-4 w-4" />
                Mark as {item.status === 'read' ? 'unread' : 'read'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMoveToFolder(item.id)}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Move to folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddTag(item.id)}>
                <Tag className="mr-2 h-4 w-4" />
                Add tag
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onArchive(item.id)}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  }

  // Grid view
  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
        item.status === 'unread' && 'ring-1 ring-primary/50',
        item.url && 'cursor-pointer'
      )}
      onClick={item.url ? handleOpen : undefined}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-secondary">
        {item.thumbnail && !imageError ? (
          <Image
            src={item.thumbnail}
            alt=""
            fill
            className="object-cover transition-transform group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}

        {/* Type badge overlay */}
        <Badge
          className={cn(
            'absolute left-2 top-2 text-[10px]',
            contentTypeColors[item.content_type]
          )}
        >
          {item.content_type}
        </Badge>

        {/* Mobile: Always visible action buttons */}
        <div className="absolute right-2 top-2 flex items-center gap-1 md:hidden">
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8"
            onClick={(e) => { e.stopPropagation(); onMarkRead(item.id); }}
            title={item.status === 'read' ? 'Mark as unread' : 'Mark as read'}
          >
            <CheckCircle2
              className={cn(
                'h-5 w-5 transition-colors',
                item.status === 'read'
                  ? 'text-red-500'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="secondary" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {item.url && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpen(); }}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open link
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMarkRead(item.id); }}>
                <Check className="mr-2 h-4 w-4" />
                Mark as {item.status === 'read' ? 'unread' : 'read'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMoveToFolder(item.id); }}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Move to folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAddTag(item.id); }}>
                <Tag className="mr-2 h-4 w-4" />
                Add tag
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(item.id); }}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Desktop: Always visible tick button */}
        <div className="absolute right-2 top-2 hidden md:block">
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8"
            onClick={(e) => { e.stopPropagation(); onMarkRead(item.id); }}
            title={item.status === 'read' ? 'Mark as unread' : 'Mark as read'}
          >
            <CheckCircle2
              className={cn(
                'h-5 w-5 transition-colors',
                item.status === 'read'
                  ? 'text-red-500'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            />
          </Button>
        </div>

        {/* Desktop: Hover overlay */}
        <div className="absolute inset-0 hidden items-center justify-center gap-2 bg-background/80 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 md:flex">
          {item.url && (
            <Button size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); handleOpen(); }}>
              <ExternalLink className="h-4 w-4" />
              Open
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMarkRead(item.id); }}>
                <Check className="mr-2 h-4 w-4" />
                Mark as {item.status === 'read' ? 'unread' : 'read'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMoveToFolder(item.id); }}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Move to folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAddTag(item.id); }}>
                <Tag className="mr-2 h-4 w-4" />
                Add tag
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(item.id); }}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-medium">{item.title}</h3>
        {(item.description || item.content) && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {item.description || item.content}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-3">
          {/* Tags */}
          <div className="flex items-center gap-1">
            {tags.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: tag.color }}
                title={tag.name}
              />
            ))}
          </div>

          {/* Date */}
          <span className="text-[10px] text-muted-foreground">
            {formatDate(item.created_at)}
          </span>
        </div>
      </div>
    </div>
  )
}
