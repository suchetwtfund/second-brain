'use client'

import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Plus,
  Search,
  FolderOpen,
  Tag,
  Home,
  Inbox,
  Archive,
  Settings,
  LogOut,
  Video,
  FileText,
  Link as LinkIcon,
  StickyNote,
  FileIcon,
  Headphones,
} from 'lucide-react'
import type { Item, Folder, Tag as TagType } from '@/lib/supabase/types'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddItem: () => void
  items: Item[]
  folders: Folder[]
  tags: TagType[]
}

const contentTypeIcons = {
  video: Video,
  article: FileText,
  tweet: FileText,
  link: LinkIcon,
  note: StickyNote,
  pdf: FileIcon,
  spotify: Headphones,
}

export function CommandPalette({
  open,
  onOpenChange,
  onAddItem,
  items,
  folders,
  tags,
}: CommandPaletteProps) {
  const router = useRouter()

  const handleSelect = (callback: () => void) => {
    onOpenChange(false)
    callback()
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => handleSelect(onAddItem)}>
            <Plus className="mr-2 h-4 w-4" />
            Add new item
            <span className="ml-auto text-xs text-muted-foreground">⌘N</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => router.push('/'))}>
            <Home className="mr-2 h-4 w-4" />
            Go to All Items
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => router.push('/inbox'))}>
            <Inbox className="mr-2 h-4 w-4" />
            Go to Inbox
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => router.push('/archived'))}>
            <Archive className="mr-2 h-4 w-4" />
            Go to Archived
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Recent Items */}
        {items.length > 0 && (
          <>
            <CommandGroup heading="Recent Items">
              {items.slice(0, 5).map((item) => {
                const Icon = contentTypeIcons[item.content_type]
                return (
                  <CommandItem
                    key={item.id}
                    onSelect={() =>
                      handleSelect(() => {
                        if (item.url) window.open(item.url, '_blank')
                      })
                    }
                  >
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{item.title}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {item.content_type}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Folders */}
        {folders.length > 0 && (
          <>
            <CommandGroup heading="Folders">
              {folders.map((folder) => (
                <CommandItem
                  key={folder.id}
                  onSelect={() =>
                    handleSelect(() => router.push(`/folder/${folder.id}`))
                  }
                >
                  <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
                  {folder.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <>
            <CommandGroup heading="Tags">
              {tags.map((tag) => (
                <CommandItem
                  key={tag.id}
                  onSelect={() =>
                    handleSelect(() => router.push(`/tag/${tag.id}`))
                  }
                >
                  <span
                    className="mr-2 h-3 w-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Settings */}
        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => handleSelect(() => {})}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => {})}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
